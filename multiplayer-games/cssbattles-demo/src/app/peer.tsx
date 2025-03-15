'use client'
import { createPeer, type ISession, type Peer } from "@pulsebeam/peer";
import { create } from "zustand";
import { produce } from "immer";

const DEFAULT_GROUP = "cssbattles-demo";
const DEFAULT_CONNECT_TIMEOUT_MS = 100_000;

interface SessionProps {
  key: number;
  sess: ISession;
  remoteStream: MediaStream | null;
  loading: boolean;
}

export interface PeerState {
  ref: Peer | null;
  loading: boolean;
  session: SessionProps | null;
  start: (peerId: string, token: string) => Promise<void>;
  stop: () => void;
  connect: (otherPeerId: string) => void;
  peerId: string;
}

export const usePeerStore = create<PeerState>((set, get) => ({
  ref: null,
  session: null,
  loading: false,
  localStream: null,
  peerId: "",
  start: async (peerId, token) => {
    if (!token) return;
    console.log(token)
    if (get().ref) return;
    if (get().loading) return;

    set({ loading: true });
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const forceRelay = urlParams.get("forceRelay");

      const p = await createPeer({
        token,
        forceRelay: forceRelay != null,
      });

      p.onsession = (s) => {
        // For you app consider your UI/UX in what you want to support
        // In this app, we only support one sessions at a time.

        s.onconnectionstatechange = () => {
          console.log(s.connectionState);
          if (s.connectionState === "closed") {
            set((state) => {
              state.session = null;
              return { session: null };
            });
          } else {
            const loading = s.connectionState !== "connected";
            set(produce((state: PeerState) => {
                if (!state.session) {return;}
                state.session.loading = loading;
                state.session.key = performance.now();
            }));
          }
        };

        set(produce((state: PeerState) => {
          state.session = {
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
