import { describe, it, expect } from "vitest";
import { GROUP_ID, Peer, DataConnection } from "../src/adapter";

async function getToken(peerId: string){
  // See https://pulsebeam.dev/docs/guides/token/#example-nodejs-http-server
  // For explanation of this token-serving method
  const resp = await fetch(
    `/auth?groupId=${GROUP_ID}&peerId=${peerId}`,
  );
  const token = await resp.text();
  return token
}

// async function exampleUsage() {
//   const peerId = "peerjs-adapter-peer1"
//   const token = await getToken(peerId);
//   const pulsebeamOptions: PulseBeamOptions = {
//     pulsebeam:{
//       token, 
//     },
//     debug: 3, // Enable debug logging level 3
//   };

//   const peer = new Peer(undefined, pulsebeamOptions);

//   peer.on('open', (id) => {
//       console.log('PeerJS Peer opened with ID:', id);

//       const connectToPeerId = 'peerjs-adapter-peer2'; // Replace with the peerId you want to connect to in the same group
//       const dc = peer.connect(connectToPeerId);

//       dc.on('open', () => {
//           console.log('Data channel opened');
//           dc.send('Hello from PeerJS Adapter!');
//       });

//       dc.on('data', (data) => {
//           console.log('Data received:', data);
//       });

//       dc.on('close', () => {
//           console.log('Data channel closed');
//       });

//       dc.on('error', (err) => {
//           console.error('Data channel error:', err);
//       });
//   });

//   peer.on('connection', (dataConnection: DataConnection) => {
//       console.log('Incoming connection from:', dataConnection.peer);

//       dataConnection.on('data', (data) => {
//           console.log('Received data on incoming connection:', data);
//           dataConnection.send('Hello back from incoming!');
//       });

//       dataConnection.on('open', () => {
//           console.log('Incoming data channel opened');
//       });
//       dataConnection.on('close', () => {
//           console.log('Incoming data channel closed');
//       });

//       dataConnection.on('error', (err) => {
//           console.error('Incoming data channel error:', err);
//       });
//   });


//   peer.on('disconnected', () => {
//       console.log('Peer disconnected from server');
//   });

//   peer.on('close', () => {
//       console.log('Peer closed');
//   });

//   peer.on('error', (err) => {
//       console.error('Peer error:', err);
//   });

//   // To connect from another Peer instance (e.g., standard PulseBeam or another PeerJS adapter instance)
//   // You would use the 'peerjs-adapter-peer2' (or whatever peerId you set) as the target peerId
// }
const cuesend = { 'initalize': 
  async function initialize(peerId: string): Promise<(string)=> void>{
    let conn: undefined | DataConnection = undefined;
  const token = await getToken(peerId)
    // Create own peer object with connection to shared PeerJS server
    const peer = new Peer(undefined, {
        debug: 2,
        pulsebeam:{token}
    });

    peer.on('open', function (id) {
        console.log('ID: ' + peer.id);
    });
    peer.on('connection', function (c) {
        // Disallow incoming connections
        c.on('open', function() {
            c.send("Sender does not accept incoming connections");
            setTimeout(function() { c.close(); }, 500);
        });
    });
    peer.on('disconnected', function () {
        // status.innerHTML = "Connection lost. Please reconnect";
        console.log('Connection lost. Please reconnect');

        // Workaround for peer.reconnect deleting previous id
        // peer.id = lastPeerId;
        // peer._lastServerId = lastPeerId;
        peer.reconnect();
    });
    peer.on('close', function() {
        conn = undefined;
        // status.innerHTML = "Connection destroyed. Please refresh";
        console.log('Connection destroyed');
    });
    peer.on('error', function (err) {
        console.log(err);
        alert('' + err);
    });

    function connect(otherPeerId: string) {
      // Close old connection
      if (conn) {
          conn.close();
      }

      // Create connection to destination peer specified in the input field
      conn = peer.connect(otherPeerId, {
          reliable: true
      });

      conn.on('open', function () {
          // status.innerHTML = "Connected to: " + conn.peer;
          console.log("Connected to: " + conn?.peer);

          // Check URL params for comamnds that should be sent immediately
          // var command = getUrlParam("command");
          // if (command)
          //     conn.send(command);
      });
      // Handle incoming data (messages only since this is the signal sender)
      conn.on('data', function (data) {
          // addMessage("<span class=\"peerMsg\">Peer:</span> " + data);
          console.log("<span class=\"peerMsg\">Peer:</span> " + data)
      });
      conn.on('close', function () {
          // status.innerHTML = "Connection closed";
      });
    }
    return connect
},

}
const cuerecieve = { 'initalize':
/**
 * Create the Peer object for our end of the connection.
 *
 * Sets up callbacks that handle any events related to our
 * peer object.
 */
async function initialize(peerId: string) {
  let conn: DataConnection | undefined = undefined;
  const token = await getToken(peerId)
  // Create own peer object with connection to shared PeerJS server
  const peer = new Peer(undefined, {
    debug: 2,
    pulsebeam:{token}
  });

  peer.on('open', function (id) {
      // // Workaround for peer.reconnect deleting previous id
      // if (peer.id === null) {
      //     console.log('Received null id from peer open');
      //     peer.id = lastPeerId;
      // } else {
      //     lastPeerId = peer.id;
      // }

    console.log('ID: ' + peer.id);
    // recvId.innerHTML = "ID: " + peer.id;
    // status.innerHTML = "Awaiting connection...";
  });
  peer.on('connection', function (c) {
    // Allow only a single connection
    if (conn && conn.open) {
      c.on('open', function() {
        c.send("Already connected to another client");
        setTimeout(function() { c.close(); }, 500);
      });
      return;
    }

    // @ts-ignore
    conn = c; // TODO: make both compatible! b/c we don't own peerjs types
    console.log("Connected to: " + conn?.peer);
    // status.innerHTML = "Connected";
    // ready();
    c.on('data', function (data) {
      console.log("Data recieved");
      var cueString = "<span class=\"cueMsg\">Cue: </span>";
      switch (data) {
        case 'Go':
        case 'Fade':
        case 'Off':
        case 'Reset':
          console.log(cueString+data)
          break;
        default:
          console.log("<span class=\"peerMsg\">Peer: </span>" + data)
          break;
      };
    });
    c.on('close', function () {
      // status.innerHTML = "Connection reset<br>Awaiting connection...";
      conn = undefined;
    });
  });
  peer.on('disconnected', function () {
      // status.innerHTML = "Connection lost. Please reconnect";
      console.log('Connection lost. Please reconnect');

      // Workaround for peer.reconnect deleting previous id
      // peer.id = lastPeerId;
      // peer._lastServerId = lastPeerId;
      peer.reconnect();
  });
  peer.on('close', function() {
      conn = undefined;
      // status.innerHTML = "Connection destroyed. Please refresh";
      console.log('Connection destroyed');
  });
  peer.on('error', function (err) {
      console.log(err);
      alert('' + err);
  });
},
}

describe("Adapter", () => {
  it("should connect to PeerJS", async () => {
    const adapter = new Peer();
    // Test your adapter's logic here
    // expect(adapter.isConnected()).toBe(true)
    // ;
    // exampleUsage();

    cuerecieve.initalize("cue-recieve")
    const connect = await cuesend.initalize("cue-send")
    connect("cue-recieve")
    expect(adapter).not.toBeNull()
  });
});