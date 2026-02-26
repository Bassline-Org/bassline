use std::ffi::CString;
use std::os::raw::{c_char, c_int, c_void};
use std::sync::atomic::Ordering;

use crate::channel::{path_from_c, send_request, should_reject_path, REQUEST_ID};
use crate::fuse_sys;
use crate::proto;

/// Wraps a FUSE callback body with `catch_unwind` so panics never cross the FFI boundary.
fn fuse_wrap<F: FnOnce() -> c_int + std::panic::UnwindSafe>(f: F) -> c_int {
    match std::panic::catch_unwind(f) {
        Ok(ret) => ret,
        Err(_) => {
            eprintln!("fuse-bridge: panic in FUSE callback");
            -libc::EIO
        }
    }
}

pub(crate) fn fill_stat(stbuf: *mut fuse_sys::stat, stat: &proto::StatResult) {
    let st = unsafe { &mut *stbuf };

    if !stat.kind.is_empty() {
        st.st_mode = match stat.kind.as_str() {
            "dir" => libc::S_IFDIR | 0o755,
            "file_exec" => libc::S_IFREG | 0o755,
            _ => libc::S_IFREG | 0o644,
        };
    } else if stat.mode != 0 {
        st.st_mode = stat.mode as fuse_sys::mode_t;
    } else {
        st.st_mode = libc::S_IFREG | 0o644;
    }

    st.st_size = stat.size as fuse_sys::off_t;
    st.st_uid = unsafe { libc::getuid() };
    st.st_gid = unsafe { libc::getgid() };

    if stat.nlink > 0 {
        st.st_nlink = stat.nlink as fuse_sys::nlink_t;
    } else if (st.st_mode & libc::S_IFMT) == libc::S_IFDIR {
        st.st_nlink = 2;
    } else {
        st.st_nlink = 1;
    }

    st.st_atimespec.tv_sec = stat.atime as fuse_sys::time_t;
    st.st_mtimespec.tv_sec = stat.mtime as fuse_sys::time_t;
    st.st_ctimespec.tv_sec = if stat.ctime != 0 {
        stat.ctime
    } else {
        stat.mtime
    } as fuse_sys::time_t;

    // Use a monotonic counter for tv_nsec so NFS always sees a "changed" mtime
    // and never serves stale cached data.
    let seq = REQUEST_ID.load(Ordering::Relaxed);
    st.st_mtimespec.tv_nsec = (seq % 1_000_000_000) as i64;
}

// --- FUSE Callbacks ---

pub(crate) unsafe extern "C" fn fuse_getattr(
    path: *const c_char,
    stbuf: *mut fuse_sys::stat,
) -> c_int {
    let path = path;
    let stbuf = stbuf;
    fuse_wrap(std::panic::AssertUnwindSafe(move || {
        if stbuf.is_null() {
            return -libc::EFAULT;
        }
        let path_str = match path_from_c(path) {
            Ok(p) => p,
            Err(e) => return e,
        };
        if should_reject_path(&path_str) {
            return -libc::ENOENT;
        }

        let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        let req = proto::FuseRequest {
            id,
            op: Some(proto::fuse_request::Op::Getattr(proto::GetattrRequest {
                path: path_str,
            })),
        };

        match send_request(&req) {
            Ok(resp) => {
                if resp.error != 0 {
                    return resp.error;
                }
                if let Some(proto::fuse_response::Result::Stat(ref stat)) = resp.result {
                    std::ptr::write_bytes(stbuf, 0, 1);
                    fill_stat(stbuf, stat);
                    0
                } else {
                    -libc::EIO
                }
            }
            Err(e) => e.0,
        }
    }))
}

pub(crate) unsafe extern "C" fn fuse_readdir(
    path: *const c_char,
    buf: *mut c_void,
    filler: fuse_sys::fuse_fill_dir_t,
    _offset: fuse_sys::off_t,
    _fi: *mut fuse_sys::fuse_file_info,
) -> c_int {
    let path = path;
    let buf = buf;
    let filler = filler;
    fuse_wrap(std::panic::AssertUnwindSafe(move || {
        let filler = match filler {
            Some(f) => f,
            None => return -libc::EIO,
        };

        let path_str = match path_from_c(path) {
            Ok(p) => p,
            Err(e) => return e,
        };

        let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        let req = proto::FuseRequest {
            id,
            op: Some(proto::fuse_request::Op::Readdir(proto::ReaddirRequest {
                path: path_str,
            })),
        };

        match send_request(&req) {
            Ok(resp) => {
                if resp.error != 0 {
                    return resp.error;
                }
                if let Some(proto::fuse_response::Result::Readdir(ref readdir)) = resp.result {
                    let dot = CString::new(".").unwrap();
                    let dotdot = CString::new("..").unwrap();
                    if filler(buf, dot.as_ptr(), std::ptr::null(), 0) != 0 {
                        return 0;
                    }
                    if filler(buf, dotdot.as_ptr(), std::ptr::null(), 0) != 0 {
                        return 0;
                    }

                    for entry in &readdir.entries {
                        if let Ok(name) = CString::new(entry.name.as_str()) {
                            if filler(buf, name.as_ptr(), std::ptr::null(), 0) != 0 {
                                break; // buffer full
                            }
                        }
                    }
                    0
                } else {
                    -libc::EIO
                }
            }
            Err(e) => e.0,
        }
    }))
}

pub(crate) unsafe extern "C" fn fuse_open(
    path: *const c_char,
    fi: *mut fuse_sys::fuse_file_info,
) -> c_int {
    let path = path;
    let fi = fi;
    fuse_wrap(std::panic::AssertUnwindSafe(move || {
        let path_str = match path_from_c(path) {
            Ok(p) => p,
            Err(e) => return e,
        };
        if should_reject_path(&path_str) {
            return -libc::ENOENT;
        }

        // Bypass NFS caching: direct_io skips data cache,
        // purge_attr/purge_ubc invalidate any stale NFS-level caches
        if !fi.is_null() {
            (*fi).set_direct_io(1);
            (*fi).set_purge_attr(1);
            (*fi).set_purge_ubc(1);
        }

        let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        let req = proto::FuseRequest {
            id,
            op: Some(proto::fuse_request::Op::Open(proto::OpenRequest {
                path: path_str,
                flags: 0,
            })),
        };

        match send_request(&req) {
            Ok(resp) => resp.error,
            Err(e) => e.0,
        }
    }))
}

pub(crate) unsafe extern "C" fn fuse_read(
    path: *const c_char,
    buf: *mut c_char,
    size: usize,
    offset: fuse_sys::off_t,
    _fi: *mut fuse_sys::fuse_file_info,
) -> c_int {
    let path = path;
    let buf = buf;
    fuse_wrap(std::panic::AssertUnwindSafe(move || {
        let path_str = match path_from_c(path) {
            Ok(p) => p,
            Err(e) => return e,
        };

        let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        let req = proto::FuseRequest {
            id,
            op: Some(proto::fuse_request::Op::Read(proto::ReadRequest {
                path: path_str,
                offset: offset as u64,
                size: size as u32,
            })),
        };

        match send_request(&req) {
            Ok(resp) => {
                if resp.error != 0 {
                    return resp.error;
                }
                if let Some(proto::fuse_response::Result::Read(ref read_result)) = resp.result {
                    let data = &read_result.data;
                    let len = data.len().min(size);
                    std::ptr::copy_nonoverlapping(data.as_ptr(), buf as *mut u8, len);
                    len as c_int
                } else {
                    -libc::EIO
                }
            }
            Err(e) => e.0,
        }
    }))
}

pub(crate) unsafe extern "C" fn fuse_write(
    path: *const c_char,
    buf: *const c_char,
    size: usize,
    offset: fuse_sys::off_t,
    _fi: *mut fuse_sys::fuse_file_info,
) -> c_int {
    let path = path;
    let buf = buf;
    fuse_wrap(std::panic::AssertUnwindSafe(move || {
        let path_str = match path_from_c(path) {
            Ok(p) => p,
            Err(e) => return e,
        };

        let data = std::slice::from_raw_parts(buf as *const u8, size);

        let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        let req = proto::FuseRequest {
            id,
            op: Some(proto::fuse_request::Op::Write(proto::WriteRequest {
                path: path_str,
                offset: offset as u64,
                data: data.to_vec(),
            })),
        };

        match send_request(&req) {
            Ok(resp) => {
                if resp.error != 0 {
                    return resp.error;
                }
                if let Some(proto::fuse_response::Result::Write(ref write_result)) = resp.result {
                    write_result.written as c_int
                } else {
                    -libc::EIO
                }
            }
            Err(e) => e.0,
        }
    }))
}

pub(crate) unsafe extern "C" fn fuse_release(
    path: *const c_char,
    _fi: *mut fuse_sys::fuse_file_info,
) -> c_int {
    let path = path;
    fuse_wrap(std::panic::AssertUnwindSafe(move || {
        let path_str = match path_from_c(path) {
            Ok(p) => p,
            Err(e) => return e,
        };

        let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        let req = proto::FuseRequest {
            id,
            op: Some(proto::fuse_request::Op::Release(proto::ReleaseRequest {
                path: path_str,
            })),
        };

        match send_request(&req) {
            Ok(resp) => resp.error,
            Err(e) => e.0,
        }
    }))
}

pub(crate) unsafe extern "C" fn fuse_truncate(
    path: *const c_char,
    size: fuse_sys::off_t,
) -> c_int {
    let path = path;
    fuse_wrap(std::panic::AssertUnwindSafe(move || {
        let path_str = match path_from_c(path) {
            Ok(p) => p,
            Err(e) => return e,
        };

        let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        let req = proto::FuseRequest {
            id,
            op: Some(proto::fuse_request::Op::Truncate(proto::TruncateRequest {
                path: path_str,
                size: size as u64,
            })),
        };

        match send_request(&req) {
            Ok(resp) => resp.error,
            Err(e) => e.0,
        }
    }))
}

pub(crate) unsafe extern "C" fn fuse_create(
    path: *const c_char,
    mode: fuse_sys::mode_t,
    fi: *mut fuse_sys::fuse_file_info,
) -> c_int {
    let path = path;
    let fi = fi;
    fuse_wrap(std::panic::AssertUnwindSafe(move || {
        let path_str = match path_from_c(path) {
            Ok(p) => p,
            Err(e) => return e,
        };

        // Bypass NFS caching
        if !fi.is_null() {
            (*fi).set_direct_io(1);
            (*fi).set_purge_attr(1);
            (*fi).set_purge_ubc(1);
        }

        let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        let req = proto::FuseRequest {
            id,
            op: Some(proto::fuse_request::Op::Create(proto::CreateRequest {
                path: path_str,
                mode: mode as u32,
            })),
        };

        match send_request(&req) {
            Ok(resp) => resp.error,
            Err(e) => e.0,
        }
    }))
}

pub(crate) unsafe extern "C" fn fuse_unlink(path: *const c_char) -> c_int {
    let path = path;
    fuse_wrap(std::panic::AssertUnwindSafe(move || {
        let path_str = match path_from_c(path) {
            Ok(p) => p,
            Err(e) => return e,
        };

        let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        let req = proto::FuseRequest {
            id,
            op: Some(proto::fuse_request::Op::Unlink(proto::UnlinkRequest {
                path: path_str,
            })),
        };

        match send_request(&req) {
            Ok(resp) => resp.error,
            Err(e) => e.0,
        }
    }))
}

pub(crate) unsafe extern "C" fn fuse_mkdir(
    path: *const c_char,
    mode: fuse_sys::mode_t,
) -> c_int {
    let path = path;
    fuse_wrap(std::panic::AssertUnwindSafe(move || {
        let path_str = match path_from_c(path) {
            Ok(p) => p,
            Err(e) => return e,
        };

        let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        let req = proto::FuseRequest {
            id,
            op: Some(proto::fuse_request::Op::Mkdir(proto::MkdirRequest {
                path: path_str,
                mode: mode as u32,
            })),
        };

        match send_request(&req) {
            Ok(resp) => resp.error,
            Err(e) => e.0,
        }
    }))
}

pub(crate) unsafe extern "C" fn fuse_rmdir(path: *const c_char) -> c_int {
    let path = path;
    fuse_wrap(std::panic::AssertUnwindSafe(move || {
        let path_str = match path_from_c(path) {
            Ok(p) => p,
            Err(e) => return e,
        };

        let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        let req = proto::FuseRequest {
            id,
            op: Some(proto::fuse_request::Op::Rmdir(proto::RmdirRequest {
                path: path_str,
            })),
        };

        match send_request(&req) {
            Ok(resp) => resp.error,
            Err(e) => e.0,
        }
    }))
}
