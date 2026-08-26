use core::time::Duration;

use crate::{conn, host::Instant};
use alloc::vec::Vec;

#[derive(PartialEq, Clone, Copy)]
pub(crate) enum ConnectionState {
    New,
    Connecting(ConnectingStats),
    Connected(ConnectedStats),
    Failed,
}

#[derive(PartialEq, Clone, Copy)]
pub(crate) enum ConnectingMode {
    Initial,
    Reconnecting,
}

#[derive(PartialEq, Clone, Copy)]
pub(crate) struct ConnectingStats {
    started_at: Instant,
    mode: ConnectingMode,
}

#[derive(PartialEq, Clone, Copy)]
pub(crate) struct ConnectedStats {
    time_to_connected: Duration,
}

pub(crate) struct Connection {
    state: ConnectionState,
}

pub(crate) enum ConnectionEvent {
    Connect(Instant),
    Connected(Instant),
}

pub(crate) enum ConnectionEffect {
    Connect,
    Disconnect,
}

impl Connection {
    pub(crate) fn new() -> Self {
        Self {
            state: ConnectionState::New,
        }
    }

    pub(crate) fn handle(
        &mut self,
        ev: ConnectionEvent,
        effects: &mut Vec<ConnectionEffect>,
    ) -> bool {
        let new_state = match (self.state, ev) {
            (ConnectionState::New, ConnectionEvent::Connect(started_at)) => {
                ConnectionState::Connecting(ConnectingStats {
                    started_at,
                    mode: ConnectingMode::Initial,
                })
            }
            (ConnectionState::Connecting(_), ConnectionEvent::Connect(_)) => self.state,
            (
                ConnectionState::Connecting(connecting_stats),
                ConnectionEvent::Connected(connected_at),
            ) => ConnectionState::Connected(ConnectedStats {
                time_to_connected: connected_at.elapsed_since(connecting_stats.started_at),
            }),
            _ => todo!(),
        };

        match (self.state, new_state) {
            (a, b) if a == b => {
                return false;
            }
            (_, ConnectionState::Connecting(_)) => {
                log::debug!("connecting");
            }
            (_, ConnectionState::Connected(stats)) => {
                log::debug!("connected took {}ms", stats.time_to_connected.as_millis());
            }
            _ => todo!(),
        }
        self.state = new_state;
        true
    }
}
