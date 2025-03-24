import { createPeer, type ISession, type Peer } from "@pulsebeam/peer";
import { create } from "zustand";
import { produce } from "immer";

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
  start: (groupId: string, peerId: string) => Promise<void>;
  stop: () => void;
  peerId: string;
  isMuted: boolean;
  toggleMute: () => void;
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
  start: async (groupId, peerId) => {
    if (get().ref) return;
    if (get().loading) return;

    set({ loading: true });
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const forceRelay = urlParams.get("forceRelay");
      const baseUrl = urlParams.get("baseUrl");
      const isDevelopment = urlParams.get("development");

      // See https://pulsebeam.dev/docs/ for learning about token management
      let token;
      if (isDevelopment !== null) {
        // WARNING!
        // PLEASE ONLY USE THIS FOR TESTING ONLY. FOR PRODUCTION,
        // YOU MUST USE YOUR OWN AUTH SERVER TO GENERATE THE TOKEN.
        const form = new URLSearchParams({
          apiKey: "kid_<...>",
          apiSecret: "sk_<...>",
          groupId: groupId,
          peerId: peerId,
        });
        if (
          form.get("apiKey") === "kid_<...>" ||
          form.get("appSecret") === "sk_<...>"
        ) {
          console.error(
            "ERROR: Keys not set see https://pulsebeam.dev/docs/getting-started/quick-start/",
          );
        }
        // See https://pulsebeam.dev/docs/getting-started/what-happened/
        // For explanation of this token-serving method
        const resp = await fetch(
          "https://cloud.pulsebeam.dev/sandbox/token",
          {
            body: form,
            method: "POST",
          },
        );
        token = await resp.text();
      } else {
        // See https://pulsebeam.dev/docs/guides/token/#example-nodejs-http-server
        // For explanation of this token-serving method
        const resp = await fetch(
          `/auth?groupId=${groupId}&peerId=${peerId}`,
        );
        token = await resp.text();
      }

      const p = await createPeer({
        baseUrl: baseUrl || undefined,
        token,
        forceRelay: forceRelay != null,
      });

      p.onsession = (s) => {
        // For you app consider your UI/UX in what you want to support
        // In this app, we only support multiple sessions at a time.
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
  isMuted: true,
  toggleMute: () => {
    set(produce((state: PeerState) => {
      const isMuted = !state.isMuted;
      state.localStream?.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
      state.isMuted = isMuted;
    }));
  },
}));
