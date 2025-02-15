import { describe, it, expect } from "vitest";
import { GROUP_ID, Peer, PulseBeamOptions, } from "../src/adapter";

async function getToken(){
  const peerId = "peerjs-adapter-peer1"
  // See https://pulsebeam.dev/docs/guides/token/#example-nodejs-http-server
  // For explanation of this token-serving method
  const resp = await fetch(
    `/auth?groupId=${GROUP_ID}&peerId=${peerId}`,
  );
  const token = await resp.text();
  return token
}

async function exampleUsage() {
  const token = await getToken();
  const pulsebeamOptions: PulseBeamOptions = {
    pulsebeam:{
      token, 
    },
    debug: 3, // Enable debug logging level 3
  };

  const peer = new Peer(undefined, pulsebeamOptions);

  peer.on('open', (id) => {
      console.log('PeerJS Peer opened with ID:', id);

      const connectToPeerId = 'peerjs-adapter-peer2'; // Replace with the peerId you want to connect to in the same group
      const dc = peer.connect(connectToPeerId);

      dc.on('open', () => {
          console.log('Data channel opened');
          dc.send('Hello from PeerJS Adapter!');
      });

      dc.on('data', (data) => {
          console.log('Data received:', data);
      });

      dc.on('close', () => {
          console.log('Data channel closed');
      });

      dc.on('error', (err) => {
          console.error('Data channel error:', err);
      });
  });

  peer.on('connection', (dataConnection: DataConnection) => {
      console.log('Incoming connection from:', dataConnection.peer);

      dataConnection.on('data', (data) => {
          console.log('Received data on incoming connection:', data);
          dataConnection.send('Hello back from incoming!');
      });

      dataConnection.on('open', () => {
          console.log('Incoming data channel opened');
      });
      dataConnection.on('close', () => {
          console.log('Incoming data channel closed');
      });

      dataConnection.on('error', (err) => {
          console.error('Incoming data channel error:', err);
      });
  });


  peer.on('disconnected', () => {
      console.log('Peer disconnected from server');
  });

  peer.on('close', () => {
      console.log('Peer closed');
  });

  peer.on('error', (err) => {
      console.error('Peer error:', err);
  });

  // To connect from another Peer instance (e.g., standard PulseBeam or another PeerJS adapter instance)
  // You would use the 'peerjs-adapter-peer2' (or whatever peerId you set) as the target peerId
}

describe("Adapter", () => {
  it("should connect to PeerJS", async () => {
    const adapter = new Peer();
    // Test your adapter's logic here
    // expect(adapter.isConnected()).toBe(true)
    // ;
    exampleUsage();
    expect(adapter).not.toBeNull()
  });
});