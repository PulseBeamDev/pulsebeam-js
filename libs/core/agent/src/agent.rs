use alloc::string::String;

pub struct ClientState {
    pub connection: ConnectionState,
}

pub enum ConnectionState {
    Disconnected,

    Connected { room: String, token: Option<String> },
}

pub enum Event {}
pub enum Effect {}

pub struct AgentConfig {}

pub struct Agent {}

impl Agent {
    pub fn new(config: AgentConfig) -> Self {
        Self {}
    }

    /// Replace complete desired state.
    pub fn set_state(&mut self, state: ClientState) {}

    /// Tell the engine something happened in the outside world.
    pub fn handle(&mut self, event: Event) {}

    /// Ask what outside work needs to happen next.
    pub fn next_effect(&mut self) -> Option<Effect> {
        None
    }
}
