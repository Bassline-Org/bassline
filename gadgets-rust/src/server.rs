// TCP server for gadget communication
// Simple line-based protocol: GADGET_NAME COMMAND DATA

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;

use crate::lib::{Counter, Effect, Gadget, MaxCell};

pub struct GadgetServer {
    gadgets: Arc<Mutex<HashMap<String, Box<dyn GadgetHandler>>>>,
}

// Trait for handling gadgets over the network
trait GadgetHandler: Send {
    fn receive(&mut self, data: &str) -> String;
    fn current(&self) -> String;
}

// Wrapper for Counter
struct CounterHandler {
    counter: Counter,
}

impl GadgetHandler for CounterHandler {
    fn receive(&mut self, data: &str) -> String {
        self.counter.receive(data.to_string());
        format!("{}", self.counter.current())
    }

    fn current(&self) -> String {
        format!("{}", self.counter.current())
    }
}

// Wrapper for MaxCell
struct MaxCellHandler {
    maxcell: MaxCell,
}

impl GadgetHandler for MaxCellHandler {
    fn receive(&mut self, data: &str) -> String {
        if let Ok(value) = data.parse::<i32>() {
            self.maxcell.receive(value);
            format!("{}", self.maxcell.current())
        } else {
            format!("ERROR: Invalid integer")
        }
    }

    fn current(&self) -> String {
        format!("{}", self.maxcell.current())
    }
}

impl GadgetServer {
    pub fn new() -> Self {
        let mut gadgets: HashMap<String, Box<dyn GadgetHandler>> = HashMap::new();

        // Create default gadgets
        gadgets.insert(
            "counter".to_string(),
            Box::new(CounterHandler {
                counter: Counter::new(),
            }),
        );

        gadgets.insert(
            "maxcell".to_string(),
            Box::new(MaxCellHandler {
                maxcell: MaxCell::new(0),
            }),
        );

        Self {
            gadgets: Arc::new(Mutex::new(gadgets)),
        }
    }

    pub fn start(&self, addr: &str) -> std::io::Result<()> {
        let listener = TcpListener::bind(addr)?;
        println!("Gadget server listening on {}", addr);

        for stream in listener.incoming() {
            match stream {
                Ok(stream) => {
                    let gadgets = Arc::clone(&self.gadgets);
                    thread::spawn(move || {
                        handle_client(stream, gadgets);
                    });
                }
                Err(e) => {
                    eprintln!("Error accepting connection: {}", e);
                }
            }
        }

        Ok(())
    }
}

fn handle_client(
    mut stream: TcpStream,
    gadgets: Arc<Mutex<HashMap<String, Box<dyn GadgetHandler>>>>,
) {
    let reader = BufReader::new(stream.try_clone().unwrap());

    for line in reader.lines() {
        match line {
            Ok(line) => {
                let response = process_command(&line, &gadgets);
                writeln!(stream, "{}", response).unwrap();
                stream.flush().unwrap();
            }
            Err(e) => {
                eprintln!("Error reading from client: {}", e);
                break;
            }
        }
    }
}

fn process_command(
    command: &str,
    gadgets: &Arc<Mutex<HashMap<String, Box<dyn GadgetHandler>>>>,
) -> String {
    let parts: Vec<&str> = command.trim().split_whitespace().collect();

    if parts.len() < 2 {
        return "ERROR: Invalid command format. Use: GADGET_NAME COMMAND [DATA]".to_string();
    }

    let gadget_name = parts[0];
    let action = parts[1];
    let data = if parts.len() > 2 {
        parts[2..].join(" ")
    } else {
        String::new()
    };

    let mut gadgets_lock = gadgets.lock().unwrap();

    match action {
        "receive" => {
            if let Some(gadget) = gadgets_lock.get_mut(gadget_name) {
                gadget.receive(&data)
            } else {
                format!("ERROR: Gadget '{}' not found", gadget_name)
            }
        }
        "current" => {
            if let Some(gadget) = gadgets_lock.get(gadget_name) {
                gadget.current()
            } else {
                format!("ERROR: Gadget '{}' not found", gadget_name)
            }
        }
        "create" => {
            // Create new gadget instances
            match gadget_name {
                "counter" => {
                    gadgets_lock.insert(
                        data.clone(),
                        Box::new(CounterHandler {
                            counter: Counter::new(),
                        }),
                    );
                    format!("Created counter '{}'", data)
                }
                "maxcell" => {
                    let initial = data.parse::<i32>().unwrap_or(0);
                    gadgets_lock.insert(
                        format!("maxcell_{}", initial),
                        Box::new(MaxCellHandler {
                            maxcell: MaxCell::new(initial),
                        }),
                    );
                    format!("Created maxcell with initial value {}", initial)
                }
                _ => format!("ERROR: Unknown gadget type '{}'", gadget_name)
            }
        }
        "list" => {
            let keys: Vec<String> = gadgets_lock.keys().cloned().collect();
            format!("Gadgets: {}", keys.join(", "))
        }
        _ => format!("ERROR: Unknown action '{}'", action),
    }
}