import { createPeer, type ISession, type Peer } from "@pulsebeam/peer";
import { create } from "zustand";
import { produce } from "immer";

const DEFAULT_GROUP = "cssbattles-demo";
const DEFAULT_CONNECT_TIMEOUT_MS = 3_000;

export interface Stats {
  charCount: number;
  matchPercentage: number
}

interface SessionProps {
  key: number;
  sess: ISession;
  remoteStream: MediaStream | null;
  loading: boolean;
  dataChannel: RTCDataChannel[];
  remoteStats: Stats | null  // Add a field to store remote stats
}


// Note: credentials expire, this example does not monitor for token expiry
// and renew. Peer with expired tokens will not be able to use PulseBeam
// See docs https://pulsebeam.dev/docs/guides/token/#troubleshooting
// or reachout for help.
export interface PeerState {
  ref: Peer | null;
  loading: boolean;
  sessions: Record<string, SessionProps>;
  localStream: MediaStream | null;
  setLocalStream: (_: MediaStream) => void;
  start: (peerId: string, token: string) => Promise<void>;
  stop: () => void;
  disconnect: () => void;
  connect: (otherPeerId: string) => void;
  peerId: string;
  handleStatsMessage: (peerId: string, stats: Stats) => void;
  broadcastStats: (message: Stats) => void;
}

export const usePeerStore = create<PeerState>((set, get) => ({
  ref: null,
  sessions: {},
  loading: false,
  localStream: null,
  peerId: "",
  // Current setup of Peer assumes that setLocalStream is called before connect
  setLocalStream: (localStream: MediaStream) => {
    set({ localStream });
  },
  start: async (peerId, token) => {
    if (!token) return;
    if (get().ref) return;
    if (get().loading) return;

    set({ loading: true });
    try {
      const p = await createPeer({
        token,
      });

      p.onsession = (s) => {
        // For you app consider your UI/UX in what you want to support
        // In this app, we support multiple sessions at a time.
        const id = `${s.other.peerId}:${s.other.connId}`;

        s.ontrack = ({ streams }) => {
          console.log("ontrack!!!")
          console.log(`${streams.length === 1}`)
          console.log("ontrack", streams[0]);
          set(produce((state: PeerState) => {
            state.sessions[id].remoteStream = streams[0];
            state.sessions[id].key = performance.now();
          }));
        };

        // Set up message handling for this channel
        const chan = s.createDataChannel("game-stats")
        chan.onmessage = (event) => {
          get().handleStatsMessage(s.other.peerId, event.data);
        };
        
        // Handle incoming data channels (peer might create them too)
        s.ondatachannel = (ev) => {
          console.log("Received data channel from peer");
          ev.channel.onmessage = (event) => {
            get().handleStatsMessage(s.other.peerId, event.data);
          };
        };

        s.onconnectionstatechange = () => {
          console.log(s.connectionState);
          console.log("s.connectionState");
          if (s.connectionState === "closed") {
            set((state) => {
              const { [id]: _, ...rest } = state.sessions;
              return { sessions: rest };
            });
          } else {
            const loading = s.connectionState !== "connected";
            set(produce((state: PeerState) => {
              state.sessions[id].loading = loading;
              state.sessions[id].key = performance.now();
            }));
          }
        };

        // if local stream is empty then connection won't be made
        // want user to start. then add local stream / dc
        // only then connect
        const localStream = get().localStream;
        if (localStream) {
          localStream.getTracks().forEach((track) =>
            s.addTrack(track, localStream)
          );
        }

        set(produce((state: PeerState) => {
          state.sessions[id] = {
            key: performance.now(),
            sess: s,
            loading: true,
            remoteStream: null,
            dataChannel: [chan],
            remoteStats: null,
          };
        }));
      };

      p.onstatechange = () => {
        if (p.state === "closed") get().stop();
      };

      set({ ref: p });
      p.start();
    } catch (error) {
      console.error("Error starting peer:", error);
    }

    set({ loading: false, peerId });
  },
  disconnect: () => {
    const sessions = Object.entries(get().sessions);
    sessions.map(([_, session])=>{
      session.sess.close(`User clicked 'End Battle'`)
    })
  },
  stop: () => {
    get().ref?.close();
    set({ ref: null });
  },
  connect: async (otherPeerId) => {
    set({ loading: true });
    const abort = new AbortController();
    const timeoutId = window.setTimeout(
      () => abort.abort(),
      DEFAULT_CONNECT_TIMEOUT_MS,
    );
    await get().ref?.connect(DEFAULT_GROUP, otherPeerId, abort.signal);
    window.clearTimeout(timeoutId);
    set({ loading: false });
  },
  handleStatsMessage: (peerId: string, message: any) => {
    // Update state based on received message
    // This could update UI elements showing opponent's stats
    console.log(`Received stats from ${peerId}:`, message);
    
    // Example: Update a new field in the sessions object to track remote stats
    set(produce((state: PeerState) => {
      const sessionKey = Object.keys(state.sessions).find(key => key.startsWith(peerId));
      if (sessionKey) {
        if (!state.sessions[sessionKey].remoteStats) {
          state.sessions[sessionKey].remoteStats = null;
        }
        state.sessions[sessionKey].remoteStats = JSON.parse(message);
      }
    }));
  },
   // Add a method to broadcast stats to all peers
  broadcastStats: (stats) => {
    const sessions = Object.values(get().sessions);
    sessions.forEach(session => {
      if (session.dataChannel && session.dataChannel.length > 0) {
        // Send to first available data channel
        const channel = session.dataChannel[0];
        if (channel.readyState === 'open') {
          channel.send(JSON.stringify(stats));
        }
      }
    });
  }
}));
