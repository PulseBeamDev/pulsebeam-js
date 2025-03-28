import { createPeer, PeerStore } from "@pulsebeam/peer";
import { createContext, useState } from "react";

const PeerContext = createContext(null);

export function PulseBeamPeer() {
  const [store, setStore] = useState<PeerStore>(null);
  return (
    // <PeerContext.Provider value= { ""} >
    // </PeerContext.Provider>
  );
}
