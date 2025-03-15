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

// function SessionPage() {
//   const peer = usePeerStore();
//   const remoteStreams = peer.session;

//   return (
//     <div>
//       <main className="responsive max grid">
//         <ImageContainer
//           className="s12 l6 no-padding"

//         />
//         {!remoteStreams
//           ? (
//             <div className="s12 l6 no-padding">
//               <ConnectForm />
//             </div>
//           )
//           : (
//             <ImageContainer
//               className="s12 l6 no-padding"
//             />
//           )}
//       </main>

//       <nav className="bottom">
//         <button
//           className="error small-round"
//           data-testid="btn-endCall"
//           onClick={() => peer.stop()}
//         >
//           <i>call_end</i>
//           End Call
//         </button>

//         <a
//           target="_blank"
//           className="button secondary-container secondary-text small-round"
//           href="https://github.com/PulseBeamDev/pulsebeam-js/tree/main/multiplayer-games/cssbattles-demo"
//         >
//           <i>code</i>
//           Source Code
//         </a>
//       </nav>
//     </div>
//   );
// }
function SessionPage() {
  const peer = usePeerStore();
  const [otherPeerId, setOtherPeerId] = useState("");
  const [dogImage, setDogImage] = useState(null);
  const [remoteDogImage, setRemoteDogImage] = useState(null);
  const imageChannel = useRef(null);
  
  // Fetch a random dog image
  const fetchRandomDog = async () => {
    try {
      const response = await fetch("https://dog.ceo/api/breeds/image/random");
      const data = await response.json();
      
      if (data.status === "success") {
        setDogImage(data.message);
        
        // Send to peer if connected
        // if (peer.session && imageChannel.current && imageChannel.current.readyState === "open") {
        //   imageChannel.current.send(data.message);
        // }
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
  };
  
  // Set up data channel and event listeners when session is established
  useEffect(() => {
    if (!peer.session) return;
    
    // Create data channel for sending dog images
    const channel = peer.session.sess.createDataChannel("dogImages");
    // imageChannel.current = channel;
    
    channel.onopen = () => {
      console.log("Dog image channel opened");
      // Fetch initial dog when connected
      fetchRandomDog();
    };
    
    // Set up event listener for receiving dog images
    // @ts-ignore
    const handleDogImageReceived = (event) => {
      setRemoteDogImage(event.detail);
    };
    
    window.addEventListener('dog-image-received', handleDogImageReceived);
    
    return () => {
      window.removeEventListener('dog-image-received', handleDogImageReceived);
      if (channel && channel.readyState === "open") {
        channel.close();
      }
    };
  }, [peer.session]);
  
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
        {peer.session ? (
          <div className="text-green-500 font-medium">
            Connected to: {peer.session.sess.other.peerId}
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
              disabled={!peer.session}
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
            {remoteDogImage ? (
              <img 
                src={remoteDogImage} 
                alt="Peer's dog" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {peer.session ? 
                  "Waiting for dog image..." : 
                  "Connect to a peer first"
                }
              </div>
            )}
          </div>
        </div>
      </div>
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

interface ImageContainerProps {
  title: string;
  image: ImageData | null;
  loading: boolean;
  className: string;
}

// function ImageContainer(props: ImageContainerProps) {
//   const imageRef = useRef<HTMLImageElement | null>(null);

//   useEffect(() => {
//     if(!props.image) return;
//     if (imageRef.current) {
//       imageRef.current.src = props.image;
//     }
//   }, [props.image]);

//   return (
//     <article className={props.className}>
//       {(props.image === null || props.loading) && (
//         <progress className="absolute top left circle"></progress>
//       )}
//       <image
//         data-testid={props.title}
//         className={props.loading ? "responsive large-opacity" : "responsive"}
//         ref={imageRef}
//       />
//       <div className="absolute bottom left right padding white-text">
//         <nav>
//           <h5>{props.title}</h5>
//         </nav>
//       </div>
//     </article>
//   );
// }

// function Preview({ css }: {css: string}) {
//   const iframeRef = useRef<HTMLIFrameElement>();

//   useEffect(() => {
//     const blob = new Blob([`
//       <html>
//         <style>${css}</style>
//         <div class="target"></div>
//       </html>
//     `], { type: 'text/html' });
    
//     iframeRef.current.src = URL.createObjectURL(blob);
//   }, [css]);

//   const capture = () => {
//     if (!iframeRef.current.contentDocument){console.error("image rendering failed"); return;}
//     return html2canvas(iframeRef.current.contentDocument.body, {
//       useCORS: true,
//       foreignObjectRendering: true
//     }).then(canvas => canvas.toDataURL());
//   };

//   return <iframe ref={iframeRef} />;
// }
// function ImageContainer(props: ImageContainerProps) {
//   const imageRef = useRef<HTMLImageElement | null>(null);

//     useEffect(() => {
//     if (videoRef.current) {
//       videoRef.current.srcObject = props.stream;
//     }
//   }, [props.stream]);

//   useEffect(() => {
//     if (!props.image || !imageRef.current) return;
//       if (imageRef.current) {
//         imageRef.current.src = props.image!;
//       }
//     imageRef.current.src = props.image;
//   }, [props.image]);

//   return (
//     <article className={props.className}>
//       {(props.image === null || props.loading) && (
//         <progress className="absolute top left circle"></progress>
//       )}
//       <img
//         data-testid={props.title}
//         className={props.loading ? "responsive large-opacity" : "responsive"}
//         ref={imageRef}
//         alt={props.title}
//       />
//       <div className="absolute bottom left right padding white-text">
//         <nav>
//           <h5>{props.title}</h5>
//         </nav>
//       </div>
//     </article>
//   );
// }

function Preview({ css }: { css: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [snapshot, setSnapshot] = useState<string>("");

  // Generate iframe content
  useEffect(() => {
    if (!iframeRef.current) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${css}</style>
        </head>
        <body>
          <div class="target"></div>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    iframeRef.current.src = url;

    // Cleanup previous blob URL
    return () => URL.revokeObjectURL(url);
  }, [css]);

  // Capture mechanism
  const capture = useCallback(async () => {
    if (
      !iframeRef.current ||
      !iframeRef.current.contentDocument ||
      !iframeRef.current.contentDocument.body
    ) {
      console.error("Iframe content not available");
      return null;
    }

    try {
      const canvas = await html2canvas(iframeRef.current.contentDocument.body, {
        useCORS: true,
        foreignObjectRendering: true,
        allowTaint: true,
        logging: true,
      });
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error("Capture failed:", error);
      return null;
    }
  }, []);

  // // Example usage for parent component
  // useImperativeHandle(ref, () => ({
  //   capture
  // }));

  return (
    <div className="preview-container">
      <iframe 
        ref={iframeRef}
        style={{ width: '100%', height: '400px', border: 'none' }}
        sandbox="allow-scripts allow-same-origin"
      />
      {snapshot && <img src={snapshot} alt="Preview snapshot" />}
    </div>
  );
}
// interface Room {
//   id: string;
//   host: string; // UID
//   participants: string[];
//   targetImage: string; // Base64
// }
// function CodeBattle({ roomId }: {roomId: string}) {
//   const [css, setCss] = useState('');
//   const [opponentPreview, setOpponentPreview] = useState('');
//   const connectionRef = useRef<Connection>();

//   useEffect(() => {
//     initiateConnection(roomId, setOpponentPreview).then(conn => {
//       connectionRef.current = conn;
//     });

//     return () => connectionRef.current?.disconnect();
//   }, [roomId]);

//   // Snapshot every 2 seconds
//   useInterval(() => {
//     const dataUrl = captureIframeSnapshot();
//     connectionRef.current?.sendSnapshot(dataUrl);
//   }, 2000);

//   return (
//     <div className="battle-grid">
//       <CodeEditor value={css} onChange={setCss} />
//       <Preview css={css} />
//       <OpponentPreview src={opponentPreview} />
//     </div>
//   );
// }