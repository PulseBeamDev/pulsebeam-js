import { useCallback, useEffect, useRef, useState } from "react";
import { usePeerStore } from "./peer.ts";

export default function App() {
  const peer = usePeerStore();

  return (
    <>
      {(!peer.localStream || !peer.ref) ? <JoinPage /> : <SessionPage />}
    </>
  );
}

function useSyncURLWithState(
  initialState: string | undefined,
  paramName: string,
): [string, (newValue: string) => void] {
  const [state, setState] = useState<string>(initialState || "");

  useEffect(() => {
    // Read initial state from URL on mount
    const searchParams = new URLSearchParams(window.location.search);
    const initialValueFromURL = searchParams.get(paramName);
    if (initialValueFromURL !== null) {
      setState(initialValueFromURL);
    } else if (initialState !== undefined) {
      setState(initialState);
    }

    // Listen for changes in the URL (e.g., back/forward button)
    const handlePopstate = () => {
      const newSearchParams = new URLSearchParams(window.location.search);
      const newValueFromURL = newSearchParams.get(paramName);
      if (newValueFromURL !== null) {
        setState(newValueFromURL);
      } else if (initialState !== undefined) {
        setState(initialState);
      } else {
        setState(""); // Or your desired default if no initial state
      }
    };

    window.addEventListener("popstate", handlePopstate);

    return () => {
      window.removeEventListener("popstate", handlePopstate);
    };
  }, [paramName, initialState]);

  const updateState = useCallback((newValue: string) => {
    setState(newValue);
    const searchParams = new URLSearchParams(window.location.search);
    if (newValue) {
      searchParams.set(paramName, newValue);
    } else {
      searchParams.delete(paramName); // Remove if value is empty
    }
    const newURL =
      `${window.location.pathname}?${searchParams.toString()}${window.location.hash}`;
    window.history.pushState(null, "", newURL);
  }, [paramName]);

  return [state, updateState];
}

function JoinPage() {
  const peer = usePeerStore();
  const [roomId, setRoomId] = useSyncURLWithState("", "roomId");
  const [peerId, setPeerId] = useState("");

  useEffect(() => {
    (async () => {
      const s = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      s.getAudioTracks().forEach((track) => track.enabled = false); // Mute by default
      peer.setLocalStream(s);
    })();
  }, []);

  return (
    <article style={{ height: "100vh" }}>
      <div
        className="vertical medium-width center-align auto-margin"
        style={{ height: "100%" }}
      >
        <VideoContainer
          className="no-padding"
          stream={peer.localStream}
          loading={false}
          title={peerId}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            peer.start(roomId, peerId);
          }}
        >
          <nav className="vertical">
            <div className="field border responsive">
              <input
                type="text"
                placeholder="Room Name"
                value={roomId}
                data-testid="src-groupId"
                onChange={(e) => setRoomId(e.target.value)}
              />
            </div>
            <div className="field border responsive">
              <input
                type="text"
                placeholder="Your Name"
                value={peerId}
                data-testid="src-peerId"
                onChange={(e) => setPeerId(e.target.value)}
              />
            </div>
            <button
              className="responsive small-round no-margin"
              type="submit"
              disabled={!peer.localStream || peer.loading ||
                peerId.length === 0 || roomId.length === 0}
              value="Ready"
              data-testid="btn-ready"
            >
              {peer.loading
                ? <progress className="circle small"></progress>
                : <span>Ready</span>}
            </button>
          </nav>
        </form>
      </div>
    </article>
  );
}

function SessionPage() {
  const peer = usePeerStore();
  const remoteStreams = Object.entries(peer.sessions);

  return (
    <div>
      {remoteStreams.length > 1 && (
        <nav className="left drawer medium-space">
          {remoteStreams.slice(1).map(([_, s]) => (
            <VideoContainer
              key={s.key}
              className="no-padding"
              title={s.sess.other.peerId}
              stream={s.remoteStream}
              loading={s.loading}
            />
          ))}
        </nav>
      )}

      <main className="responsive max grid">
        <VideoContainer
          className="s12 l6 no-padding"
          stream={peer.localStream}
          loading={false}
          title={peer.peerId}
        />
        {remoteStreams.length === 0
          ? (
            <div className="s12 l6 no-padding">
              {/* <ConnectForm /> */}
            </div>
          )
          : (
            <VideoContainer
              className="s12 l6 no-padding"
              title={remoteStreams[0][1].sess.other.peerId}
              stream={remoteStreams[0][1].remoteStream}
              loading={remoteStreams[0][1].loading}
            />
          )}
      </main>

      <nav className="bottom">
        <button
          className="secondary small-round"
          onClick={() => peer.toggleMute()}
          data-testid="btn-mute"
        >
          <i>{peer.isMuted ? "mic_off" : "mic"}</i>
          {peer.isMuted ? " Unmute" : " Mute"}
        </button>

        <button
          className="error small-round"
          data-testid="btn-endCall"
          onClick={() => peer.stop()}
        >
          <i>call_end</i>
          End Call
        </button>

        <a
          target="_blank"
          className="button secondary-container secondary-text small-round"
          href="https://github.com/PulseBeamDev/pulsebeam-js/tree/main/demo-react"
        >
          <i>code</i>
          Source Code
        </a>
      </nav>
    </div>
  );
}

function ConnectForm() {
  const [otherPeerId, setOtherPeerId] = useState("");
  const peer = usePeerStore();

  return (
    <form
      className="vertical medium-width center-align auto-margin"
      style={{ height: "100%" }}
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <nav className="vertical">
        <h3>Who to connect to?</h3>
        <div className="field border responsive">
          <input
            size={6}
            type="text"
            placeholder="Other Name"
            value={otherPeerId}
            data-testid="dst-peerId"
            onChange={(e) => setOtherPeerId(e.target.value)}
          />
        </div>
        <button
          className="responsive small-round"
          type="submit"
          data-testid="btn-connect"
          disabled={peer.loading || otherPeerId.length === 0}
        >
          {peer.loading
            ? <progress className="circle small"></progress>
            : <span>Connect</span>}
        </button>
      </nav>
    </form>
  );
}

interface VideoContainerProps {
  title: string;
  stream: MediaStream | null;
  loading: boolean;
  className: string;
}

function VideoContainer(props: VideoContainerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = props.stream;
    }
  }, [props.stream]);

  return (
    <article className={props.className}>
      {(props.stream === null || props.loading) && (
        <progress className="absolute top left circle"></progress>
      )}
      <video
        data-testid={props.title}
        className={props.loading ? "responsive large-opacity" : "responsive"}
        ref={videoRef}
        autoPlay
      />
      <div className="absolute bottom left right padding white-text">
        <nav>
          <h5>{props.title}</h5>
        </nav>
      </div>
    </article>
  );
}
