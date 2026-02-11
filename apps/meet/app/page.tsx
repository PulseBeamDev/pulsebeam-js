"use client";

import { useState } from "react";
import { Lobby } from "../components/Lobby";
import { Room } from "../components/Room";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [page, setPage] = useState<"lobby" | "room">("lobby");

  const handleJoin = (id: string) => {
    setRoomId(id);
    setPage("room");
  };

  const handleLeave = () => {
    setPage("lobby");
    setLocalStream(null); // Reset stream on leave to force re-acquisition or just cleanup
  };

  if (page === "lobby" || !localStream) {
    return (
      <Lobby
        localStream={localStream}
        setLocalStream={setLocalStream}
        onJoin={handleJoin}
      />
    );
  }

  return <Room roomId={roomId} localStream={localStream} onLeave={handleLeave} />;
}
