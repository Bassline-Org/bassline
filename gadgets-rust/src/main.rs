mod lib;
mod server;

use server::GadgetServer;

fn main() {
    println!("Starting Rust Gadget Server...");

    let server = GadgetServer::new();

    // Start server on localhost:9999
    if let Err(e) = server.start("127.0.0.1:9999") {
        eprintln!("Server error: {}", e);
    }
}
