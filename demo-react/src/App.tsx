import {
  createContext,
  FormEvent,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSyncURLWithState } from "./util.ts";
import { createPeer, PeerStore } from "@pulsebeam/peer";
import { useStore } from "@nanostores/react";

const PeerContext = createContext<PeerStore | null>(null);

export default function App() {
  const [peer, setPeer] = useState<PeerStore | null>(null);
  // useStore(peer.$state);
  // const uninitialized = peer === null || peer.$state;

  return (
    <PeerContext.Provider value={peer}>
      {peer === null ? <JoinPage onJoined={setPeer} /> : <SessionPage />}
    </PeerContext.Provider>
  );
}

interface JoinPageProps {
  onJoined: (peer: PeerStore) => void;
}

function JoinPage(props: JoinPageProps) {
  const [loading, setLoading] = useState(false);
  const [baseUrl, setBaseUrl] = useSyncURLWithState("", "baseUrl");
  const [roomId, setRoomId] = useSyncURLWithState("", "roomId");
  const [peerId, setPeerId] = useSyncURLWithState("", "peerId");
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    (async () => {
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setStream(localStream);
    })();
  }, []);

  const onJoin = async () => {
    if (!stream) return;

    setLoading(true);
    try {
      // See https://pulsebeam.dev/docs/guides/token/#example-nodejs-http-server
      // For explanation of this token-serving method
      const resp = await fetch(
        `/auth?groupId=${roomId}&peerId=${peerId}`,
      );

      const token = await resp.text();
      const peer = await createPeer({ token, baseUrl });
      const peerStore = new PeerStore(peer);
      peerStore.$streams.setKey("default", stream);
      props.onJoined(peerStore);
    } finally {
      setLoading(false);
    }
  };

  return (
    <article style={{ height: "100vh" }}>
      <div
        className="vertical medium-width center-align auto-margin"
        style={{ height: "100%" }}
      >
        <VideoContainer
          className="no-padding"
          stream={stream}
          loading={false}
          title={peerId}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onJoin();
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
              disabled={loading ||
                peerId.length === 0 || roomId.length === 0}
              value="Ready"
              data-testid="btn-ready"
            >
              {loading
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
  const peerStore = useContext(PeerContext)!;
  const localStreams = useStore(peerStore.$streams);
  const remotePeersMap = useStore(peerStore.$remotePeers);
  const remotePeers = Object.values(remotePeersMap);
  const [muted, setMuted] = useState(false);
  const [hideChat, setHideChat] = useState(false);

  return (
    <div>
      <nav className="bottom">
        <button
          className="circle transparent"
          onClick={() => {
            peerStore.mute(!muted);
            setMuted(!muted);
          }}
          data-testid="btn-mute"
        >
          <i className="large">{muted ? "mic_off" : "mic"}</i>
        </button>

        <button
          className="circle transparent"
          onClick={() => setHideChat(!hideChat)}
        >
          <i className="large">chat</i>
        </button>

        <button
          className="error"
          data-testid="btn-endCall"
          onClick={() => peerStore.close()}
        >
          <i className="large">call_end</i>
        </button>

        <a
          target="_blank"
          className="button"
          href="https://github.com/PulseBeamDev/pulsebeam-js/tree/main/demo-react"
        >
          <i className="large">code</i>
        </a>
      </nav>

      <ChatDialog hidden={hideChat} />

      <main className="grid">
        <VideoContainer
          className="s3"
          title={peerStore.peer.peerId || ""}
          stream={localStreams["default"]}
          loading={false}
        >
        </VideoContainer>
        {remotePeers.map((remote) => (
          <VideoContainer
            className="s3"
            key={remote.info.peerId}
            title={remote.info.peerId}
            stream={remote.streams[0]}
            loading={remote.state !== "connected"}
          >
          </VideoContainer>
        ))}
      </main>
    </div>
  );
}

interface ChatDialogProps {
  hidden: boolean;
}

function ChatDialog(props: ChatDialogProps) {
  const peerStore = useContext(PeerContext)!;
  const [text, setText] = useState("");
  const history = useStore(peerStore.$kv);
  const sortedHistory = Object.entries(history).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();

    const key = `${Date.now()}:${peerStore.peer.peerId}`;
    peerStore.$kv.setKey(key, text);
    setText("");
  };

  return (
    <dialog className={`right vertical ${props.hidden || "active"}`}>
      <h5>Chat</h5>

      <nav className="vertical scroll" style={{ height: "100%" }}>
        {sortedHistory.map(([key, text]) => {
          const [ts, peerId] = key.split(":");
          const date = new Date(Number.parseInt(ts));

          return (
            <nav>
              <button className="circle capitalize">
                {peerId.substring(0, 1)}
              </button>
              <div className="max">
                <h6 className="small">{peerId}</h6>
                <div>{text}</div>

                <label>{date.toLocaleTimeString()}</label>
              </div>
            </nav>
          );
        })}
      </nav>

      <nav>
        <form className="field round fill row" onSubmit={onSubmit}>
          <input onChange={(e) => setText(e.target.value)} value={text} />
          <button
            type="submit"
            className="transparent circle"
            disabled={text === ""}
          >
            <i className="front">send</i>
          </button>
        </form>
      </nav>
    </dialog>
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
