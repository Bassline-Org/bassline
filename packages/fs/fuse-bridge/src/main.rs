use std::ffi::CString;
use std::os::raw::{c_char, c_int};

mod callbacks;
mod channel;
mod error;

#[allow(non_upper_case_globals, non_camel_case_types, non_snake_case, dead_code)]
mod fuse_sys {
    include!(concat!(env!("OUT_DIR"), "/fuse_bindings.rs"));
}

pub mod proto {
    include!(concat!(env!("OUT_DIR"), "/fuse_bridge.rs"));
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: fuse-bridge <mountpoint>");
        std::process::exit(1);
    }

    channel::init_channel();

    // Build FUSE operations struct — zeroed then set implemented ops
    let mut ops: fuse_sys::fuse_operations = unsafe { std::mem::zeroed() };
    ops.getattr = Some(callbacks::fuse_getattr);
    ops.readdir = Some(callbacks::fuse_readdir);
    ops.open = Some(callbacks::fuse_open);
    ops.read = Some(callbacks::fuse_read);
    ops.write = Some(callbacks::fuse_write);
    ops.release = Some(callbacks::fuse_release);
    ops.truncate = Some(callbacks::fuse_truncate);
    ops.create = Some(callbacks::fuse_create);
    ops.unlink = Some(callbacks::fuse_unlink);
    ops.mkdir = Some(callbacks::fuse_mkdir);
    ops.rmdir = Some(callbacks::fuse_rmdir);

    // Build argv: -f (foreground), -s (single-threaded), attr_timeout=0 (FUSE-level)
    // Note: FUSE-T uses NFS internally. The macOS NFS client has its own ~1s attribute
    // cache that cannot be disabled from the FUSE side. Dynamic files like time.txt
    // may show data up to ~1s stale. direct_io (set in open) bypasses data caching.
    let argv_strs: Vec<CString> = vec![
        CString::new("fuse-bridge").unwrap(),
        CString::new(args[1].as_str()).unwrap(),
        CString::new("-f").unwrap(),
        CString::new("-s").unwrap(),
        CString::new("-oattr_timeout=0").unwrap(),
    ];
    let mut argv_ptrs: Vec<*mut c_char> =
        argv_strs.iter().map(|s| s.as_ptr() as *mut c_char).collect();

    eprintln!("fuse-bridge: mounting at {}", args[1]);

    let ret = unsafe {
        fuse_sys::fuse_main_real(
            argv_ptrs.len() as c_int,
            argv_ptrs.as_mut_ptr(),
            &ops,
            std::mem::size_of::<fuse_sys::fuse_operations>(),
            std::ptr::null_mut(),
        )
    };

    eprintln!("fuse-bridge: fuse_main returned {}", ret);
    std::process::exit(ret);
}
