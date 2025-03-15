import './App.css'
import { useState, useEffect, useRef } from 'react'
import { initializeApp } from 'firebase/app';
import { getAuth } from "firebase/auth";
import { useAuthState } from 'react-firebase-hooks/auth';
import { getToken, SignIn, SignOut } from './Auth';
import { usePeerStore } from "./peer";
import { Battle } from './Battle';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAAV-HDCuh7F65_Ciixp1GHzqsouK93ARI",
  authDomain: "cssbattles-demo.firebaseapp.com",
  projectId: "cssbattles-demo",
  storageBucket: "cssbattles-demo.firebasestorage.app",
  messagingSenderId: "926315693165",
  appId: "1:926315693165:web:c66e12077e3cca17d42b64"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export function App() {
  const peer = usePeerStore();
  const [user] = useAuthState(auth);

  useEffect(()=>{
    if (!user) {
      return;
    }
    (async () => {
      // Get current firebase auth token
      const fToken = await user.getIdToken()
      // Use firebase auth token to call firebase fn to get PulseBeam token
      // Read about PulseBeam tokens -> https://pulsebeam.dev/docs/guides/token/
      const token = await getToken(fToken)
      // Start peer to be able to recieve and/or create connections
      peer.start(user.uid, token)
    })()
  }, [user])
  
  if (!user) return <SignIn/>
  return <div>
    <SignOut />
    <br/>
    Uid: {user?.uid}
    <br/>
    Loading: {peer.loading ? "true" : "false"}
    <br/>
    NumSess: {Object.entries(peer.sessions).length}
    <br/>
    {(!peer.peerId || peer.peerId !== user?.uid)&&"somethings amiss"}
    <br/>
    {(!peer.ref) ? "Loading..." : <SessionPage />}
  </div>
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
        {remoteStreams.length === 0
          ? (
            <div className="s12 l6 no-padding">
              <ConnectForm />
            </div>
          )
          : (
            <div>
              <Battle/>
              <VideoContainer
                className="s12 l6 no-padding"
                title={peer.peerId}
                stream={peer.localStream}
                loading={false}
              />
              <VideoContainer
                className="s12 l6 no-padding"
                title={remoteStreams[0][1].sess.other.peerId}
                stream={remoteStreams[0][1].remoteStream}
                loading={remoteStreams[0][1].loading}
              />
            </div>
          )}
      </main>

      <nav className="bottom">
        <button
          className="error small-round"
          data-testid="btn-endBattle"
          onClick={() => peer.stop()}
        >
          <i>battle_end</i>
          End Battle
        </button>

        <a
          target="_blank"
          className="button secondary-container secondary-text small-round"
          href="https://github.com/PulseBeamDev/pulsebeam-js/tree/main/multiplayer-games/cssbattles-demo"
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
        peer.connect(otherPeerId);
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

export default App;