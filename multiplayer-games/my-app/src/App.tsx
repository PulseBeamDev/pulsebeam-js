import './App.css'
import { useState, useEffect, useRef } from 'react'
import { Battle } from './Battle';
import {initializeApp} from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup} from "firebase/auth";
import { usePeerStore } from "./peer";
import { useAuthState } from 'react-firebase-hooks/auth';

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
  const [user] = useAuthState(auth);
  const [token, setToken] = useState("");
  useEffect(()=>{
    if (!user) {
      setToken("");
      return;
    }
    const getToken = async () => {
      const fToken = await user.getIdToken()
      const resp = await fetch(
        "http://localhost:5000/cssbattles-demo/us-central1/getToken/",
        {
          method: "POST",
          headers: {
            'Authorization': 'Bearer '+ fToken
          }
        },
      );
      const t = await resp.text();
      
      setToken(JSON.parse(t).token)
    }
    getToken()
  }, [user])

  return (
    <>
      <SignOut />
      {user ? 
        (<div>
          Uid: {user?.uid}
          <Room {...{token: token, peerId: user.uid}}/>
        </div>) : 
        <SignIn />
      }
    </>
  );
}

function SignIn() {
  const auth = getAuth();
  const signInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  }
  return (
    <div>
      <button onClick={signInWithGoogle}>Sign in with Google</button>
    </div>
  )

}
function SignOut() {
  return auth.currentUser && (
    <button onClick={() => auth.signOut()}>Sign Out</button>
  )
}

const Room = (props: {token: string, peerId: string}) => {
  const peer = usePeerStore();

  return (
    <>
      <br/>
      Loading: {peer.loading ? "true" : "false"}
      <br/>
      PeerID: {peer.peerId}
      <br/>
      NumSess: {Object.entries(peer.sessions).length}
      <br/>
      {(!peer.ref) ? <JoinPage token={props.token} peerId={props.peerId}/> : <SessionPage />}
    </>
  )
}

function JoinPage({token, peerId}: {token: string, peerId: string}) {
  const peer = usePeerStore();
  useEffect(()=>{
    peer.start(peerId, token)
  }, [token])
  return <></>
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