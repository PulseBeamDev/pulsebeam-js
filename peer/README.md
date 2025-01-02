# @pulsebeam/peer: WebRTC Peer-to-Peer Communication SDK

Simplifies real-time application development. Defines signaling protocol for connection establishment, handling media and data transmission, and provides infrastructure.

### Features

- Media & Data Support: Transmit audio, video, and/or data channels within your applications.
- Abstracted Signaling: Handles the exchange of information required to set up WebRTC connections, relieving you of low-level details.
- Automatic Reconnection: Maintains connection stability by automatically re-establishing connections when disruptions occur.
- Opt out of Peer-to-Peer: Can configure to force server-relayed communication.

# Installation

Install and import the package using npm, deno, or yarn:

### Use with npm

Add Package

`npx jsr add @pulsebeam/peer`

Import symbol

`import * as peer from "@pulsebeam/peer";`


### Use with Deno

Add Package

`deno add jsr:@pulsebeam/peer`

Import symbol

`import * as peer from "@pulsebeam/peer";`

---- OR ----

Import directly with a jsr specifier

`import * as peer from "jsr:@pulsebeam/peer";`

### Use with Yarn

Add Package

`yarn dlx jsr add @pulsebeam/peer`

Import symbol

`import * as peer from "@pulsebeam/peer";`


# Usage

Here's an example demonstrating how to use @pulsebeam/peer to establish a peer-to-peer connection:

```ts
import { Peer, createPeer } from "@pulsebeam/peer";

// Obtain an authentication token (implementation specific)
const authResponse = await fetch("/auth");
const { groupId, peerId, token } = await authResponse.json();

// Create a Peer instance
const peer = await createPeer({ groupId, peerId, token });

// Define handlers for incoming events (optional)
peer.onsession = (session) => {
  session.ontrack = ({ streams }) => console.log("New media stream:", streams);
  session.ondatachannel = (event) => console.log("Data channel:", event.channel);
  session.onconnectionstatechange = () => console.log("Connection state changed");
};

// Start Alice's availability. Connect to our signaling servers
peer.start();

// Connect to bob
const abortController = new AbortController();
await peer.connect(groupId, "bob", abortController.signal);
```

This example retrieves an authentication token (implementation details will vary depending on your setup), creates a Peer instance, and defines event handlers for receiving media streams, data channels, and connection state changes (optional). Finally, it starts connection attempts and connects to a specific peer identified by its ID within the group.

# Documentation

For documentation, API keys, and usage scenarios, please refer to the official PulseBeam documentation:

* https://pulsebeam.dev/docs/getting-started/

# WebRTC Resources

For a deeper understanding of WebRTC concepts, consult the official WebRTC documentation:

* https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API