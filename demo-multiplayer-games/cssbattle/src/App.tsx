import "./App.css";
import { useEffect, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import { useAuthState } from "react-firebase-hooks/auth";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { usePeerStore } from "./peer";
import { Battle, HEIGHT, WIDTH } from "./Battle";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAAV-HDCuh7F65_Ciixp1GHzqsouK93ARI",
  authDomain: "cssbattles-demo.firebaseapp.com",
  projectId: "cssbattles-demo",
  storageBucket: "cssbattles-demo.firebasestorage.app",
  messagingSenderId: "926315693165",
  appId: "1:926315693165:web:da03633bccaa3326d42b64",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export function App() {
  const peer = usePeerStore();
  const [user] = useAuthState(auth);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStream = peer.localStream;
  const streamCapturedRef = useRef(false);

  useEffect(() => {
    // This effect runs after render when the canvas is available
    const canvas = canvasRef.current;
    // Only proceed if canvas exists and stream hasn't been captured yet
    if (canvas && !streamCapturedRef.current) {
      try {
        console.log("Setting Local Stream to canvas");
        // 15 is normal FPS for screen sharing (24-30 for video call)
        peer.setLocalStream(canvas.captureStream(15));
        streamCapturedRef.current = true;
      } catch (error) {
        console.error("Error capturing stream:", error);
      }
    }
    // Cleanup function
    return () => {
      if (mediaStream) {
        // Stop all tracks when component unmounts
        mediaStream.getTracks().forEach((track) => track.stop());
        console.log("Stream tracks stopped");
      }
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }
    (async () => {
      // Get current firebase auth token
      const fToken = await user.getIdToken();
      // Use firebase auth token to call firebase fn to get PulseBeam token
      // Read about PulseBeam tokens -> https://pulsebeam.dev/docs/guides/token/
      const token = await getToken(fToken);
      // Start peer to be able to recieve and/or create connections
      peer.start(user.uid, token);
    })();
  }, [user]);

  return (
    <div>
      <div style={{ visibility: user ? "hidden" : "visible" }}>
        <SignIn />
      </div>
      <div style={{ visibility: user ? "visible" : "hidden" }} className="app">
        <header className="header" style={{ "gap": "2rem" }}>
          <SignOut />
          <br /> User: {user?.uid}
          <br /> Loading: {peer.loading ? "true" : "false"}
          <br /> NumSess: {Object.entries(peer.sessions).length}
          <br /> RemoteStream:{" "}
          {Object.entries(peer.sessions).map(([_, s]) => s.remoteStream + ", ")}
          <br /> PeerRef: {"" + peer.ref}
          <br />{" "}
          {(!peer.peerId || peer.peerId !== user?.uid) && "somethings amiss"}
          {" "}
          <br />
        </header>
        <canvas
          hidden={false}
          style={{ width: WIDTH, height: HEIGHT }}
          // style={{ display: "none" }}
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
        >
        </canvas>
        {(!peer.ref) ? "Loading..." : <SessionPage canvasRef={canvasRef} />}
      </div>
    </div>
  );
}

function SessionPage(
  props: { canvasRef: React.RefObject<HTMLCanvasElement | null> },
) {
  const peer = usePeerStore();
  const remoteStreams = Object.entries(peer.sessions);
  return (
    <div>
      {remoteStreams.length === 0
        ? (
          <div className="s12 l6 no-padding">
            <ConnectForm />
          </div>
        )
        : <Battle canvasRef={props.canvasRef} />}
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
            style={{ "padding": "1rem", "margin": "1rem" }}
            size={40}
            type="text"
            placeholder="Other Name"
            value={otherPeerId}
            data-testid="dst-peerId"
            onChange={(e) => setOtherPeerId(e.target.value)}
          />
        </div>
        <button
          style={{ background: "white", color: "black" }}
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

const getToken = async (fToken: string) => {
  const resp = await fetch(
    // TODO: replace this URL after firebase function is deployed
    // "https://getToken-kqiqetod2a-uc.a.run.app"
    "http://localhost:5000/cssbattles-demo/us-central1/getToken",
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + fToken,
      },
    },
  );
  const jsonToken = await resp.text();

  const token = JSON.parse(jsonToken).token;
  if (token !== "") return token;
  throw (new Error("fatal, error retrieving token, see logs"));
};

function SignIn() {
  const auth = getAuth();
  const signInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };
  return (
    <button
      style={{ background: "white", color: "black" }}
      onClick={signInWithGoogle}
    >
      Sign in with Google
    </button>
  );
}

function SignOut() {
  return (
    <button
      style={{ background: "white", color: "black" }}
      onClick={() => {
        const auth = getAuth();
        auth.signOut()
        const peer = usePeerStore();
        peer.stop();
      }}
    >
      Sign Out
    </button>
  );
}

export default App;

