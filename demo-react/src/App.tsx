import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSyncURLWithState } from "./util.ts";
import { PeerStore } from "@pulsebeam/peer";
import { useStore } from "@nanostores/react";

const PeerContext = createContext<PeerStore | null>(null);

export default function App() {
  const [peer, setPeer] = useState<PeerStore | null>(null);

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
  const peerStoreRef = useRef(new PeerStore());
  const localStreams = useStore(peerStoreRef.current.$localStreams);

  useEffect(() => {
    peerStoreRef.current.addUserMedia({
      video: true,
      audio: true,
    });
  }, []);

  const onJoin = async () => {
    setLoading(true);
    try {
      // See https://pulsebeam.dev/docs/guides/token/#example-nodejs-http-server
      // For explanation of this token-serving method
      const resp = await fetch(
        `/auth?groupId=${roomId}&peerId=${peerId}`,
      );

      const token = await resp.text();
      await peerStoreRef.current.start({ token, baseUrl });
      props.onJoined(peerStoreRef.current);
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
          stream={localStreams["default"]}
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
  const remotePeersMap = useStore(peerStore.$remotePeers);
  const remotePeers = Object.entries(remotePeersMap);

  return (
    <div>
      {remotePeers.length > 1 && (
        <nav className="left drawer medium-space">
          {remotePeers.slice(1).map(([id, remote]) => (
            <VideoContainer
              key={id}
              className="no-padding"
              title={remote.info.peerId}
              stream={remote.$streams.get()[0]}
              loading={remote.$state.get() !== "connected"}
            />
          ))}
        </nav>
      )}

      <main className="responsive max grid">
        <VideoContainer
          className="s12 l6 no-padding"
          stream={peerStore.$localStreams.get()[0]}
          loading={false}
          title={peerStore.$peer.get()?.peerId || ""}
        />
        {remotePeers.length === 0
          ? (
            <div className="s12 l6 no-padding">
              {/* <ConnectForm /> */}
            </div>
          )
          : (
            <VideoContainer
              className="s12 l6 no-padding"
              title={remotePeers[0][1].info.peerId}
              stream={remotePeers[0][1].$streams.get()[0]}
              loading={remotePeers[0][1].$state.get() !== "connected"}
            />
          )}
      </main>

      <nav className="bottom">
        {/* <button */}
        {/*   className="secondary small-round" */}
        {/*   onClick={() => peer.toggleMute()} */}
        {/*   data-testid="btn-mute" */}
        {/* > */}
        {/*   <i>{peer.isMuted ? "mic_off" : "mic"}</i> */}
        {/*   {peer.isMuted ? " Unmute" : " Mute"} */}
        {/* </button> */}

        <button
          className="error small-round"
          data-testid="btn-endCall"
          onClick={() => peerStore.close()}
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
