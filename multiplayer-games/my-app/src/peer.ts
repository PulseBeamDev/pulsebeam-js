import { createPeer, type ISession, type Peer } from "@pulsebeam/peer";
import { create } from "zustand";
import { produce } from "immer";

const DEFAULT_GROUP = "cssbattles-demo";
const DEFAULT_CONNECT_TIMEOUT_MS = 3_000;

interface SessionProps {
  key: number;
  sess: ISession;
  remoteStream: MediaStream | null;
  loading: boolean;
}

export interface PeerState {
  ref: Peer | null;
  loading: boolean;
  sessions: Record<string, SessionProps>;
  localStream: MediaStream | null;
  setLocalStream: (_: MediaStream) => void;
  start: (peerId: string, token: string) => Promise<void>;
  stop: () => void;
  connect: (otherPeerId: string) => void;
  peerId: string;
}

export const usePeerStore = create<PeerState>((set, get) => ({
  ref: null,
  sessions: {},
  loading: false,
  localStream: null,
  peerId: "",
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
        baseUrl: "http://localhost:3000/twirp",
        token,
      });

      p.onsession = (s) => {
        // For you app consider your UI/UX in what you want to support
        // In this app, we support multiple sessions at a time.
        const id = `${s.other.peerId}:${s.other.connId}`;

        s.ontrack = ({ streams }) => {
          console.log("ontrack", streams[0]);
          set(produce((state: PeerState) => {
            state.sessions[id].remoteStream = streams[0];
            state.sessions[id].key = performance.now();
          }));
        };

        s.onconnectionstatechange = () => {
          console.log(s.connectionState);
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
}));
