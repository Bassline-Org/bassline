use std::ffi::CStr;
use std::io::{self, BufReader, BufWriter, Read, Write};
use std::os::raw::{c_char, c_int};
use std::sync::atomic::AtomicU64;
use std::sync::Mutex;

use byteorder::{LittleEndian, ReadBytesExt, WriteBytesExt};
use prost::Message;

use crate::error::FuseError;
use crate::proto;

pub(crate) struct StdioChannel {
    writer: BufWriter<io::Stdout>,
    reader: BufReader<io::Stdin>,
}

pub(crate) static CHANNEL: Mutex<Option<StdioChannel>> = Mutex::new(None);
pub(crate) static REQUEST_ID: AtomicU64 = AtomicU64::new(1);

const MAX_RESPONSE_SIZE: usize = 64 * 1024 * 1024; // 64 MB

pub(crate) fn init_channel() {
    let mut channel = CHANNEL.lock().unwrap();
    *channel = Some(StdioChannel {
        writer: BufWriter::new(io::stdout()),
        reader: BufReader::new(io::stdin()),
    });
}

pub(crate) fn send_request(req: &proto::FuseRequest) -> Result<proto::FuseResponse, FuseError> {
    let mut channel = CHANNEL.lock().map_err(|_| FuseError(-libc::EIO))?;
    let channel = channel.as_mut().ok_or(FuseError(-libc::EIO))?;

    let encoded = req.encode_to_vec();
    channel
        .writer
        .write_u32::<LittleEndian>(encoded.len() as u32)
        .map_err(|_| FuseError(-libc::EIO))?;
    channel
        .writer
        .write_all(&encoded)
        .map_err(|_| FuseError(-libc::EIO))?;
    channel.writer.flush().map_err(|_| FuseError(-libc::EIO))?;

    // Poll stdin with 30-second timeout before reading response
    if channel.reader.buffer().len() < 4 {
        let mut pfd = libc::pollfd {
            fd: libc::STDIN_FILENO,
            events: libc::POLLIN,
            revents: 0,
        };
        let ret = unsafe { libc::poll(&mut pfd, 1, 30_000) };
        if ret <= 0 {
            eprintln!("fuse-bridge: stdin read timeout (30s)");
            return Err(FuseError(-libc::EIO));
        }
    }

    let msg_len = channel
        .reader
        .read_u32::<LittleEndian>()
        .map_err(|e| {
            eprintln!("fuse-bridge: failed to read response header: {}", e);
            FuseError(-libc::EIO)
        })? as usize;

    if msg_len > MAX_RESPONSE_SIZE {
        eprintln!("fuse-bridge: response too large: {} bytes", msg_len);
        return Err(FuseError(-libc::EIO));
    }

    let mut buf = vec![0u8; msg_len];
    channel.reader.read_exact(&mut buf).map_err(|e| {
        eprintln!("fuse-bridge: failed to read response body: {}", e);
        FuseError(-libc::EIO)
    })?;

    let resp = proto::FuseResponse::decode(&buf[..]).map_err(|e| {
        eprintln!("fuse-bridge: failed to decode response: {}", e);
        FuseError(-libc::EIO)
    })?;

    if resp.id != req.id {
        eprintln!(
            "fuse-bridge: response id {} != request id {}",
            resp.id, req.id
        );
        return Err(FuseError(-libc::EIO));
    }

    Ok(resp)
}

pub(crate) fn path_from_c(path: *const c_char) -> Result<String, c_int> {
    if path.is_null() {
        return Err(-libc::EFAULT);
    }
    unsafe { CStr::from_ptr(path) }
        .to_str()
        .map(|s| s.to_string())
        .map_err(|_| -libc::EIO)
}

pub(crate) fn should_reject_path(path: &str) -> bool {
    let name = path.rsplit('/').next().unwrap_or(path);
    name == ".DS_Store" || name.starts_with("._")
}
