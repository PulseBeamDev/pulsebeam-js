import { createPeer, type ISession, type Peer } from "@pulsebeam/peer";
import { create } from "zustand";
import { produce } from "immer";

const DEFAULT_GROUP = "default";
const DEFAULT_CONNECT_TIMEOUT_MS = 3_000;

interface SessionProps {
  key: number;
  sess: ISession;
  remoteStream: MediaStream | null;
  loading: boolean;
}

interface PeerState {
  ref: Peer | null;
  loading: boolean;
  sessions: Record<string, SessionProps>;
  localStream: MediaStream | null;
  setLocalStream: (_: MediaStream) => void;
  start: (peerId: string) => Promise<void>;
  stop: () => void;
  connect: (otherPeerId: string) => void;
}

export const usePeerStore = create<PeerState>((set, get) => ({
  ref: null,
  sessions: {},
  loading: false,
  localStream: null,
  setLocalStream: (localStream: MediaStream) => {
    set({ localStream });
  },
  start: async (peerId) => {
    if (get().ref) return;
    if (get().loading) return;

    set({ loading: true });
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const forceRelay = urlParams.get("forceRelay");
      const baseUrl = urlParams.get("baseUrl");

      const resp = await fetch(
        `/auth?groupId=${DEFAULT_GROUP}&peerId=${peerId}`,
      );
      const token = await resp.text();
      const p = await createPeer({
        baseUrl: baseUrl || undefined,
        groupId: DEFAULT_GROUP,
        peerId,
        token,
        forceRelay: forceRelay != null,
      });

      p.onsession = (s) => {
        const id = `${s.otherPeerId}:${s.otherConnId}`;

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

    set({ loading: false });
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
