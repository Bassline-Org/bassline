fn main() {
    // Find FUSE-T via pkg-config
    let fuse_include = if let Ok(lib) = pkg_config::Config::new().probe("fuse") {
        for path in &lib.link_paths {
            println!("cargo:rustc-link-arg=-Wl,-rpath,{}", path.display());
        }
        lib.include_paths
            .first()
            .map(|p| p.display().to_string())
    } else {
        println!("cargo:rustc-link-search=/usr/local/lib");
        println!("cargo:rustc-link-lib=fuse-t");
        println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/local/lib");
        Some("/usr/local/include/fuse".to_string())
    };

    // Generate FFI bindings from FUSE-T headers
    let mut builder = bindgen::Builder::default()
        .header("wrapper.h")
        .clang_arg("-D_FILE_OFFSET_BITS=64")
        .clang_arg("-DFUSE_USE_VERSION=26")
        .allowlist_type("fuse_operations")
        .allowlist_type("fuse_file_info")
        .allowlist_type("fuse_fill_dir_t")
        .allowlist_function("fuse_main_real")
        .generate_comments(false)
        .derive_default(true);

    if let Some(ref inc) = fuse_include {
        // pkg-config returns .../fuse, but wrapper.h does #include <fuse/fuse.h>,
        // so pass the parent directory
        let parent = std::path::Path::new(inc)
            .parent()
            .unwrap_or(std::path::Path::new(inc));
        builder = builder.clang_arg(format!("-I{}", parent.display()));
    }

    let bindings = builder.generate().expect("bindgen failed");

    let out_dir = std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out_dir.join("fuse_bindings.rs"))
        .expect("failed to write bindings");

    // Compile protobuf
    prost_build::compile_protos(&["../protocol.proto"], &["../"]).unwrap();
}
