import { useEffect, useRef, useState } from "react";
import { usePeerStore } from "./peer.ts";

export default function App() {
  const [peerId, setPeerId] = useState("");
  const [otherPeerId, setOtherPeerId] = useState("");
  const peer = usePeerStore();

  useEffect(() => {
    (async () => {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      peer.setLocalStream(s);
    })();
  }, []);

  return (
    <>
      <nav className="bottom">
        {(!peer.localStream || !peer.ref)
          ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                peer.start(peerId);
              }}
              className="responsive"
            >
              <nav className="center-align">
                <div className="field small border round">
                  <input
                    size={6}
                    type="text"
                    placeholder="You"
                    value={peerId}
                    onChange={(e) => setPeerId(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!peer.localStream || peer.loading}
                  value="Go Live"
                >
                  {peer.loading
                    ? <progress className="circle small"></progress>
                    : <span>Go Live</span>}
                </button>
              </nav>
            </form>
          )
          : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                peer.connect(otherPeerId);
              }}
            >
              <nav className="max center-align">
                <div className="field small border round">
                  <input
                    size={6}
                    type="text"
                    placeholder="Other"
                    value={otherPeerId}
                    onChange={(e) => setOtherPeerId(e.target.value)}
                  />
                </div>
                <button type="submit" disabled={peer.loading}>
                  {peer.loading
                    ? <progress className="circle small"></progress>
                    : <span>Connect</span>}
                </button>
                <button className="secondary" onClick={() => peer.stop()}>
                  Stop
                </button>
              </nav>
            </form>
          )}
      </nav>

      <main className="responsive max grid">
        <VideoContainer
          className="s12 m6 no-padding"
          stream={peer.localStream}
          loading={false}
          title={peerId}
        />
        {Object.entries(peer.sessions).map(([_, s]) => (
          <VideoContainer
            key={s.key}
            className="s12 m6 no-padding"
            title={s.sess.other.peerId}
            stream={s.remoteStream}
            loading={s.loading}
          />
        ))}
      </main>
    </>
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

  const loading = props.loading || props.stream === null;
  return (
    <article className={props.className}>
      {loading ? <progress className="circle large"></progress> : (
        <video
          data-testid={props.title}
          className="responsive max"
          ref={videoRef}
          autoPlay
        />
      )}
      <div className="absolute bottom left right padding white-text">
        <nav>
          <h5>{props.title}</h5>
        </nav>
      </div>
    </article>
  );
}
