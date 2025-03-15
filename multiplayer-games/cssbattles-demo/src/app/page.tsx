'use client'
import Image from "next/image";
import styles from "./page.module.css";
import React, { useEffect, useRef, useState } from 'react';
import {initializeApp} from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, User} from "firebase/auth";

import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollectionData } from 'react-firebase-hooks/firestore';

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
        "http://127.0.0.1:5000/cssbattles-demo/us-central1/getToken/",
        {
          method: "POST",
          headers: {
            'Authorization': 'Bearer '+ fToken
          }
        },
      );
      const t = await resp.text();
      setToken(t)
    }
    getToken()
  }, [user])

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header>
          <SignOut />
        </header>

        <section>
          {user ? <ChatRoom {...{token: token}}/> : <SignIn />}
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


const ChatRoom = (props: {token: string}) => {
    return <div>{props.token}</div>
}