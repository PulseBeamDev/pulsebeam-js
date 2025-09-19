# pulsebeam-js

**Thin JavaScript client for PulseBeam SFU.**  
A lightweight, optional SDK for connecting to the PulseBeam WebRTC SFU server. Simplifies real-time video, audio, and data streaming using native WebRTC APIs.

[Report a Bug](https://github.com/pulsebeamdev/pulsebeam-js/issues) · [Request a Feature](https://github.com/pulsebeamdev/pulsebeam-js/issues) · [Discord](https://discord.gg/Bhd3t9afuB)

---

## What is pulsebeam-js?

`pulsebeam-js` is a minimal JavaScript client for the [PulseBeam SFU server](https://github.com/pulsebeamdev/pulsebeam). It’s an optional convenience layer to streamline connecting browsers or Node.js apps to PulseBeam for real-time media (video/audio/data). 

- **Thin and optional**: Wraps native WebRTC APIs, no dependencies, no bloat.
- **Purpose**: Simplifies setup for publishing and subscribing to streams.
- **No lock-in**: You can use raw WebRTC with PulseBeam’s HTTP signaling (WHIP/WHEP-compatible) without this SDK.

The SDK is not implemented yet—our focus is on stabilizing the [PulseBeam SFU server](https://github.com/pulsebeamdev/pulsebeam). Check the server repo for setup, demos, and raw WebRTC examples.

---

## Get Started

The PulseBeam SFU is the core. See the [PulseBeam README](https://github.com/pulsebeamdev/pulsebeam) for how to run the server and use browser-native WebRTC APIs for publishing and viewing streams.

This client will provide a simpler API for the same functionality when ready. For now, use the server’s raw HTTP signaling as shown in the [PulseBeam demos](https://github.com/pulsebeamdev/pulsebeam#demo-broadcast).

---

## License

Apache-2.0

Need a different license? → [lukas@pulsebeam.dev](mailto:lukas@pulsebeam.dev)

---

## Community

* 💬 [Discord](https://discord.gg/Bhd3t9afuB)
* 🐛 [Issues](https://github.com/pulsebeamdev/pulsebeam-js/issues)

PRs welcome.
