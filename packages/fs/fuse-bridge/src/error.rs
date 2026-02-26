use std::os::raw::c_int;

/// Thin error type wrapping a negative errno value for FUSE callbacks.
pub struct FuseError(pub c_int);

impl From<FuseError> for c_int {
    fn from(e: FuseError) -> c_int {
        e.0
    }
}

impl From<prost::DecodeError> for FuseError {
    fn from(e: prost::DecodeError) -> Self {
        eprintln!("fuse-bridge: protobuf decode error: {}", e);
        FuseError(-libc::EIO)
    }
}

impl From<std::io::Error> for FuseError {
    fn from(e: std::io::Error) -> Self {
        eprintln!("fuse-bridge: I/O error: {}", e);
        FuseError(-libc::EIO)
    }
}
