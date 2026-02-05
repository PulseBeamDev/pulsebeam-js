import { useState } from "react";
import { useParticipant, Video, Audio, type ParticipantConfig } from "./lib";

const APP_CONFIG: ParticipantConfig = {
  videoSlots: 16,
  audioSlots: 8,
};

export default function MeetingRoom() {
  const [roomId, setRoomId] = useState("demo-room");

  const client = useParticipant(APP_CONFIG);

  const handleJoin = async () => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch (err) {
      console.error("Failed to join:", err);
      return;
    }

    client.publish(stream);
    client.connect(roomId);
  };

  const handleLeave = () => {
    client.close();
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Pulsebeam Room: {roomId}</h1>

      <p>
        Status: <strong>{client.connectionState}</strong>
      </p>

      {client.connectionState !== "connected" ? (
        <button onClick={handleJoin}>Join Meeting</button>
      ) : (
        <button
          onClick={handleLeave}
          style={{ background: "red", color: "white" }}
        >
          Leave Meeting
        </button>
      )}

      <hr />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "10px",
        }}
      >
        {client.videoTracks.map((track) => (
          <div
            key={track.id}
            style={{
              border: "1px solid #ccc",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <Video track={track} style={{ width: "100%", display: "block" }} />
            <p style={{ padding: "5px", margin: 0 }}>{track.participantId}</p>
          </div>
        ))}
      </div>

      {client.audioTracks.map((track) => (
        <Audio track={track} />
      ))}
    </div>
  );
}
