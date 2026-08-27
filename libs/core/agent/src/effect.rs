use crate::id::*;
use alloc::{string::ToString, vec::Vec};

pub(crate) struct Effects<E> {
    inner: Vec<E>,
}

impl<E> Effects<E> {
    pub(crate) const fn new() -> Self {
        Self { inner: Vec::new() }
    }

    pub(crate) fn emit(&mut self, effect: E) {
        self.inner.push(effect);
    }

    pub(crate) fn extend(&mut self, effects: impl IntoIterator<Item = E>) {
        self.inner.extend(effects);
    }
}

impl<E> IntoIterator for Effects<E> {
    type Item = E;
    type IntoIter = alloc::vec::IntoIter<E>;

    fn into_iter(self) -> Self::IntoIter {
        self.inner.into_iter()
    }
}

pub enum RtcEffect {
    CreateOffer {
        generation: Generation,
    },
    ApplyAnswer {
        generation: Generation,
        answer: String,
    },
    Close {
        generation: Generation,
    },
}

pub enum DataChannelEffect {
    Create {
        generation: Generation,
        config: DataChannelConfig,
    },
    Close {
        generation: Generation,
        label: DataChannelLabel,
    },
}

pub enum DataChannelReliability {
    Reliable,
    MaxRetransmits(u16),
    MaxPacketLifetime(u16),
}

pub struct DataChannelConfig {
    pub label: String,
    pub protocol: String,
    pub ordered: bool,
    pub negotiated: Option<DataChannelId>,
    pub reliability: DataChannelReliability,
}

impl DataChannelConfig {
    fn reliable(label: String) -> Self {
        Self {
            label,
            protocol: "pulsebeam/v1".into(),
            ordered: true,
            negotiated: None,
            reliability: DataChannelReliability::Reliable,
        }
    }
}

pub enum HttpEffect {
    Request {
        id: RequestId,
        request: http::Request<Vec<u8>>,
    },
}

pub enum TimerEffect {
    Schedule { id: OperationId, after: Duration },

    Cancel { id: OperationId },
}
