<div style="white-space: pre;">

# Running Locally

Run 
```bash
python3 -m http.server
```

Which will say something like:
```bash
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

Go to browser, two tabs
URL of first http://localhost:8000/send.html
URL of Second http://localhost:8000/receive.html

Important to do localhost instead of 0.0.0.0 !!

run PeerJS server
```bash
npx peer --port 9000
```

Update `new Peer` in `recieve.js` and `send.js` to be using local signaling server
```js
peer = new Peer(null, {
    debug: 2,
    host: "/",
    port: 9000
});
```

# Peer-to-Peer Cue System #

Cue system for simple two-way communication and visual signaling using a WebRTC peer-to-peer connection.
This was initially designed for signaling on-stage actors during a theater performance.

Demo: https://jmcker.github.io/Peer-to-Peer-Cue-System

[PeerJS examples](https://peerjs.com/examples.html)

### Setup ###

1. Open receive.html on the receiving device.
2. Open send.html on the sending device.
3. Copy the ID from the receiving device to the sending device's ID field.
4. Press *Connect*.
4. Both should indicate a successful connection in the *Status* box.

### Features ###

The receiver has access to large indicators for standby, go, fade, and stop signals.

The sender has access to buttons that send the standby, go, fade, and stop signals, triggering the receiver's indicators.

Both have access to a two-way messenger for additional communication.

</div>