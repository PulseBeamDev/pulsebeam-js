import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

export const getToken = async (fToken: string) => {
      const resp = await fetch(
        "http://localhost:5000/cssbattles-demo/us-central1/getToken/",
        {
          method: "POST",
          headers: {
            'Authorization': 'Bearer '+ fToken
          }
        },
      );
      const jsonToken = await resp.text();
      
      const token = JSON.parse(jsonToken).token
      if (token !== "") return token
      throw(new Error("fatal, error retrieving token, see logs"))
}

export function SignIn() {
  const auth = getAuth();
  const signInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  }
  return <button onClick={signInWithGoogle}>Sign in with Google</button>
}

export function SignOut() {
  const auth = getAuth();
  if (!auth.currentUser) return <></>
  return <button onClick={() => auth.signOut()}>Sign Out</button>
}