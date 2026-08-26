#![no_std]

mod conn;
pub mod host;
mod proto;
use alloc::{format, string::String, vec::Vec};

use crate::conn::{Connection, ConnectionEffect, ConnectionEvent};

extern crate alloc;

pub struct AgentEngineConfig {}

pub struct AgentEngine {
    effects: Vec<ConnectionEffect>,
}

impl AgentEngine {
    pub fn new(cfg: AgentEngineConfig) -> Self {
        Self {
            effects: Vec::new(),
        }
    }

    pub fn connect(&mut self) {
        let intent = proto::signaling::ClientIntent::default();
        let msg = format!("Hello, {:?}!", intent);
        let mut conn = Connection::new();
        conn.handle(ConnectionEvent::Connect(host::now()), &mut self.effects);
        let compressed = lz4_flex::compress(msg.as_bytes());
        let decompressed = lz4_flex::decompress(&compressed, 0).unwrap();
        let msg = String::from_utf8(decompressed).unwrap();
        conn.handle(ConnectionEvent::Connected(host::now()), &mut self.effects);

        log::debug!("{}", msg);
    }
}
