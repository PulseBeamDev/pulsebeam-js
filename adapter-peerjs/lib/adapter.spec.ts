import { describe, it, expect, vi, beforeEach } from "vitest";
import { GROUP_ID, Peer, DataConnection, PeerOptions, MediaConnection, PeerConnectOption, CallOption } from "../lib/index";
import { jwtDecode } from "jwt-decode";

async function getToken(peerId: string){
  // See https://pulsebeam.dev/docs/guides/token/#example-nodejs-http-server
  // For explanation of this token-serving method
  const resp = await fetch(
    `http://localhost:3000/auth?groupId=${GROUP_ID}&peerId=${peerId}`,
  );
  const token = await resp.text();
  return token
}

async function exampleUsage() {
  const peerId = "peerjs-adapter-peer1"
  const token = await getToken(peerId);
  const peerOptions: PeerOptions = {
    pulsebeam:{
      token, 
    },
    debug: 3, // Enable debug logging level 3
  };

  const peer = new Peer(undefined, peerOptions);

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

  // @ts-ignore todo
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
    const token = await getToken("peer-b");
    const adapter = new Peer(undefined, {pulsebeam: {token}});
    // Test your adapter's logic here
    // expect(adapter.isConnected()).toBe(true);
    exampleUsage();
    cuerecieve.initalize("cue-recieve")
    const connect = await cuesend.initalize("cue-send")
    connect("cue-recieve")
    expect(adapter).not.toBeNull()
  });
});

// Mock external dependencies
vi.mock("@pulsebeam/peer", () => ({
  pulseBeamCreatePeer: vi.fn().mockResolvedValue({
    peerId: "mock-peer-id",
    state: "new",
    onstatechange: null,
    onsession: null,
    connect: vi.fn(),
    close: vi.fn(),
  }),
}));


vi.mock("jwt-decode", () => ({
  jwtDecode: vi.fn().mockImplementation(() => ({
    gid: "mock-group-id",
    pid: "mock-peer-id"
  }))
}));

vi.mock("crypto", () => ({
  randomUUID: vi.fn().mockReturnValue("random-uuid"),
}))

beforeEach(() => {
  global.MediaStream = vi.fn(() => ({
    getTracks: vi.fn().mockReturnValue([])
  }));
});

global.fetch = vi.fn().mockResolvedValue({
  text: vi.fn().mockResolvedValue("mock-token"),
});

describe("Peer", () => {
  const mockOptions: PeerOptions = {
    pulsebeam: {
      insecureAuth: {
        apiKey: "test-key",
        apiSecret: "test-secret",
        authEndpoint: "https://test.endpoint",
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with insecure auth", async () => {
      const peer = new Peer("test-peer", mockOptions);
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(peer.id).toBe("mock-peer-id");
      expect(peer.destroyed).toBe(false);
    });

    it("should throw error when options are missing", () => {
      expect(() => new Peer()).toThrow("Options required");
    });
  });

  describe("connect", () => {
    it("should create a data connection", async () => {
      const peer = new Peer("test-peer", mockOptions);
      const connection = peer.connect("remote-peer");
      expect(connection).toBeInstanceOf(DataConnection);
    });
  });

  describe("call", () => {
    it("should create a media connection", async () => {
      const peer = new Peer("test-peer", mockOptions);
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const mockStream = new MediaStream();
      const connection = peer.call("remote-peer", mockStream);
      
      expect(connection).toBeInstanceOf(MediaConnection);
    });
  });

  describe("event handling", () => {
    // it("should emit open event", async () => {
    //   const peer = new Peer("test-peer", mockOptions);
    //   await new Promise(resolve => setTimeout(resolve, 0));
      
    //   const mockCallback = vi.fn();
    //   peer.on("open", mockCallback);
      
    //   // Simulate session creation
    //   const mockSession = { other: { peerId: "remote-peer" } };
    //   peer.pulseBeamPeer.onsession(mockSession);
      
    //   expect(mockCallback).toHaveBeenCalledWith("remote-peer");
    // });

    // it("should handle incoming connections", async () => {
    //   const peer = new Peer("test-peer", mockOptions);
    //   await new Promise(resolve => setTimeout(resolve, 0));
      
    //   const mockCallback = vi.fn();
    //   peer.on("connection", mockCallback);
      
    //   // Simulate incoming data channel
    //   const mockChannel = new RTCDataChannel();
    //   const mockSession = { other: { peerId: "remote-peer" } };
    //   peer.handleIncomingDataChannel(mockSession, { channel: mockChannel });
      
    //   expect(mockCallback).toHaveBeenCalled();
    // });
  });

  describe("lifecycle methods", () => {
    it("should destroy peer", async () => {
      const peer = new Peer("test-peer", mockOptions);
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const mockCallback = vi.fn();
      peer.on("close", mockCallback);
      
      peer.destroy();
      
      expect(peer.destroyed).toBe(true);
      expect(mockCallback).toHaveBeenCalled();
    });

    it("should handle disconnect", () => {
      const peer = new Peer("test-peer", mockOptions);
      const mockCallback = vi.fn();
      peer.on("disconnected", mockCallback);
      
      peer.disconnect();
      
      expect(mockCallback).toHaveBeenCalledWith("mock-peer-id");
    });
  });

  describe("authentication", () => {
    it("should handle token authentication", async () => {
      const optionsWithToken: PeerOptions = {
        pulsebeam: { token: "test-token" },
      };
      const peer = new Peer("test-peer", optionsWithToken);
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(peer.groupId).toBe("mock-group-id");
    });

    it("should handle insecure auth failure", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Auth failed"));
      await expect(new Peer("test-peer", mockOptions)).rejects.toThrow();
    });
  });

  describe("session management", () => {
    // it("should handle incoming connections", async () => {
    //   const peer = new Peer("test-peer", mockOptions);
      
    //   // Simulate pending connection
    //   // const sessionPromise = peer.getSession("remote-peer");
    //   const sessionPromise = eval('peer.#getSession("remote-peer")');
    //   const mockSession = { other: { peerId: "remote-peer" } };
    //   peer.pulseBeamPeer?.onsession(mockSession);
      
    //   await expect(sessionPromise).resolves.toBe(mockSession);
    // });
  });
});

describe("Authentication Handling", () => {
  const mockAuthEndpoint = "https://custom.auth.endpoint";
  const mockGroupId = "custom-group-id";

  describe("Token Authentication", () => {
    it("should handle valid token authentication", async () => {
      const options: PeerOptions = {
        pulsebeam: {
          token: "valid.token.123"
        }
      };

      vi.mocked(jwtDecode).mockReturnValueOnce({
        gid: "token-group-id",
        pid: "token-peer-id"
      });

      const peer = new Peer("token-peer-id", options);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(peer.groupId).toBe("token-group-id");
      expect(peer.id).toBe("token-peer-id");
      expect(jwtDecode).toHaveBeenCalledWith("valid.token.123");
    });

    it("should throw on token peer ID mismatch", async () => {
      const options: PeerOptions = {
        pulsebeam: {
          token: "valid.token.123"
        }
      };

      vi.mocked(jwtDecode).mockReturnValueOnce({
        gid: "token-group-id",
        pid: "token-peer-id"
      });

      expect(() => new Peer("different-peer-id", options))
        .toThrow("Id mismatch");
    });

    it("should handle token decoding failure", async () => {
      const options: PeerOptions = {
        pulsebeam: {
          token: "invalid.token"
        }
      };

      vi.mocked(jwtDecode).mockImplementationOnce(() => {
        throw new Error("Invalid token");
      });

      expect(() => new Peer(undefined, options))
        .toThrow("Failed to create PulseBeam Peer: Invalid token");
    });

    it("should handle missing token claims", async () => {
      const options: PeerOptions = {
        pulsebeam: {
          token: "invalid.token"
        }
      };

      vi.mocked(jwtDecode).mockReturnValueOnce({} as any);

      expect(() => new Peer(undefined, options))
        .toThrow("Failed to create PulseBeam Peer");
    });
  });

  describe("Insecure Authentication", () => {
    const baseInsecureOptions: PeerOptions = {
      pulsebeam: {
        insecureAuth: {
          apiKey: "test-key",
          apiSecret: "test-secret"
        }
      }
    };

    it("should generate peer ID when not provided", async () => {
      const peer = new Peer(undefined, baseInsecureOptions);
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(crypto.randomUUID).toHaveBeenCalled();
      expect(peer.id).toBe("mock-peer-id");
    });

    it("should use custom auth endpoint and group ID", async () => {
      const options: PeerOptions = {
        pulsebeam: {
          insecureAuth: {
            ...baseInsecureOptions.pulsebeam?.insecureAuth!,
            authEndpoint: mockAuthEndpoint,
            groupId: mockGroupId
          }
        }
      };

      const peer = new Peer("test-peer", options);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(fetch).toHaveBeenCalledWith(
        mockAuthEndpoint,
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(`groupId=${mockGroupId}`)
        })
      );
    });

    it("should handle missing API key", () => {
      const options: PeerOptions = {
        pulsebeam: {
          insecureAuth: {
            apiSecret: "test-secret"
          } as any
        }
      };

      expect(() => new Peer(undefined, options))
        .toThrow("Authentication required");
    });

    it("should handle missing API secret", () => {
      const options: PeerOptions = {
        pulsebeam: {
          insecureAuth: {
            apiKey: "test-key"
          } as any
        }
      };

      expect(() => new Peer(undefined, options))
        .toThrow("Authentication required");
    });

    it("should handle auth endpoint failure", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
      
      await expect(new Peer("test-peer", baseInsecureOptions)).rejects.toThrow("Network error");
    });

    it("should handle non-200 auth response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        text: vi.fn().mockResolvedValue("Unauthorized")
      });

      await expect(new Peer("test-peer", baseInsecureOptions)).rejects.toThrow("Unauthorized");
    });

    it("should handle invalid auth response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue("")
      });

      await expect(new Peer("test-peer", baseInsecureOptions)).rejects.toThrow();
    });
  });

  describe("Common Auth Validation", () => {
    it("should throw when no auth provided", () => {
      expect(() => new Peer(undefined, {} as PeerOptions))
        .toThrow("Authentication required");
    });
  });
});