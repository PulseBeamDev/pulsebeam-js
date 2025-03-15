'use client'
import Image from "next/image";
import styles from "./page.module.css";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {initializeApp} from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, User} from "firebase/auth";
import { usePeerStore } from "./peer";
import html2canvas from 'html2canvas';
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

export default function Home() {
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
    <div className={styles.page}>
      <main className={styles.main}>
        <header>
          <SignOut />
        </header>
        Uid: {user?.uid}
        <section>
          {user ? <Room {...{token: token, peerId: user.uid}}/> : <SignIn />}
        </section>
      </main>
      <footer className={styles.footer}>
      </footer>
    </div>
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
  const [otherPeerId, setOtherPeerId] = useState("");
  const [dogImage, setDogImage] = useState(null);
  
  // Fetch a random dog image
  const fetchRandomDog = async () => {
    try {
      const response = await fetch("https://dog.ceo/api/breeds/image/random");
      const data = await response.json();
      
      if (data.status === "success") {
        setDogImage(data.message);
      }
    } catch (error) {
      console.error("Error fetching dog image:", error);
    }
  };
  
  // Handle connecting to another peer
  const handleConnect = (e: Event) => {
    e.preventDefault();
    
    if (!otherPeerId) return;
    
    peer.connect(otherPeerId);
    fetchRandomDog();
  };
  
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Dog Sync Session</h2>
        
        <button
          onClick={peer.stop}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
        >
          End Session
        </button>
      </div>
      
      {/* Connection status */}
      <div className="bg-gray-100 p-4 rounded">
        {remoteStreams.length !== 0 ? (
          <div className="text-green-500 font-medium">
            Connected to: {peer.sessions[0].sess.other.peerId}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-yellow-500 font-medium">
              Not connected to anyone yet
            </div>
            {/* @ts-ignore */}
            <form onSubmit={handleConnect} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter peer name to connect"
                value={otherPeerId}
                onChange={(e) => setOtherPeerId(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded"
                disabled={peer.loading}
              />
              
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                disabled={peer.loading || !otherPeerId}
              >
                {peer.loading ? (
                  <span>Connecting...</span>
                ) : (
                  <span>Connect</span>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
      
      {/* Image display area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* My dog */}
        <div className="bg-white p-4 rounded shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">My Dog</h3>
            
            <button
              onClick={fetchRandomDog}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              disabled={!peer.sessions[0]}
            >
              Get New Dog
            </button>
          </div>
          
          <div className="aspect-square bg-gray-100 rounded overflow-hidden">
            
            {dogImage ? (
              <img 
                src={dogImage} 
                alt="Random dog" 
                className="w-full h-full object-cover"
              />
              // here
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No dog image yet
              </div>
            )}
          </div>
        </div>
        
        {/* Their dog */}
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-xl font-semibold mb-4">Their Dog</h3>
          
          <div className="aspect-square bg-gray-100 rounded overflow-hidden">
            {remoteStreams.length === 0
          ? (
            <div className="s12 l6 no-padding">
                  "Waiting for dog image..." : 
                  "Connect to a peer first"
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
          </div>
        </div>
      </div>
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

// function Preview({ css }: { css: string }) {
//   const iframeRef = useRef<HTMLIFrameElement>(null);
//   const [snapshot, setSnapshot] = useState<string>("");

//   // Generate iframe content
//   useEffect(() => {
//     if (!iframeRef.current) return;

//     const htmlContent = `
//       <!DOCTYPE html>
//       <html>
//         <head>
//           <style>${css}</style>
//         </head>
//         <body>
//           <div class="target"></div>
//         </body>
//       </html>
//     `;

//     const blob = new Blob([htmlContent], { type: 'text/html' });
//     const url = URL.createObjectURL(blob);
    
//     iframeRef.current.src = url;

//     // Cleanup previous blob URL
//     return () => URL.revokeObjectURL(url);
//   }, [css]);

//   // Capture mechanism
//   const capture = useCallback(async () => {
//     if (
//       !iframeRef.current ||
//       !iframeRef.current.contentDocument ||
//       !iframeRef.current.contentDocument.body
//     ) {
//       console.error("Iframe content not available");
//       return null;
//     }

//     try {
//       const canvas = await html2canvas(iframeRef.current.contentDocument.body, {
//         useCORS: true,
//         foreignObjectRendering: true,
//         allowTaint: true,
//         logging: true,
//       });
//       return canvas.toDataURL('image/jpeg', 0.8);
//     } catch (error) {
//       console.error("Capture failed:", error);
//       return null;
//     }
//   }, []);

//   // // Example usage for parent component
//   // useImperativeHandle(ref, () => ({
//   //   capture
//   // }));

//   return (
//     <div className="preview-container">
//       <iframe 
//         ref={iframeRef}
//         style={{ width: '100%', height: '400px', border: 'none' }}
//         sandbox="allow-scripts allow-same-origin"
//       />
//       {snapshot && <img src={snapshot} alt="Preview snapshot" />}
//     </div>
//   );
// }
