import { useState } from "react";
import { useParticipant, Video, Audio, type ParticipantConfig } from "./lib";

const APP_CONFIG: ParticipantConfig = {
  videoSlots: 16,
  audioSlots: 8,
  baseUrl: "http://localhost:3000/api/v1",
};

export default function MeetingRoom() {
  const [roomId, setRoomId] = useState("demo-room");

  const mainClient = useParticipant(APP_CONFIG);
  const screenClient = useParticipant({ ...APP_CONFIG, videoSlots: 0, audioSlots: 0 });

  const startMeeting = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      mainClient.publish(stream);
      mainClient.connect(roomId);
    } catch (err) {
      console.error("Failed to join:", err);
      alert("Failed to access camera/microphone");
    }
  };

  const leaveMeeting = () => {
    mainClient.close();
    screenClient.close();
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      screenClient.publish(stream);
      screenClient.connect(roomId);

      // Stop automatically if user ends screen share via browser UI
      stream.getVideoTracks()[0].onended = () => screenClient.close();
    } catch (err) {
      console.error("Screen share failed", err);
      alert("Failed to start screen share");
    }
  };

  const stopScreenShare = () => screenClient.close();

  const isConnectingOrConnected =
    mainClient.connectionState === "connecting" ||
    mainClient.connectionState === "connected";

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Pulsebeam Room</h1>

      <div style={{ marginBottom: "10px" }}>
        <label>
          Room:{" "}
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            disabled={isConnectingOrConnected}
            style={{ padding: "4px", fontSize: "14px" }}
          />
        </label>
      </div>

      <p>Status: <strong>{mainClient.connectionState}</strong></p>

      {mainClient.connectionState !== "connected" ? (
        <button
          onClick={startMeeting}
          disabled={mainClient.connectionState === "connecting"}
        >
          Join Meeting
        </button>
      ) : (
        <>
          <button onClick={leaveMeeting} style={{ background: "red", color: "white", marginRight: "10px" }}>
            Leave Meeting
          </button>
          {screenClient.connectionState !== "connected" ? (
            <button onClick={startScreenShare}>Start Screen Share</button>
          ) : (
            <button onClick={stopScreenShare}>Stop Screen Share</button>
          )}
        </>
      )}

      <hr />
      <button onClick={() => mainClient.mute({ video: !mainClient.videoMuted })}>{mainClient.videoMuted ? "Unmute" : "Mute"}</button>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "10px",
      }}>
        {mainClient.videoTracks.map(track => (
          <div key={track.id} style={{ border: "1px solid #ccc", borderRadius: "8px", overflow: "hidden" }}>
            <Video track={track} style={{ width: "100%", display: "block" }} />
            <p style={{ padding: "5px", margin: 0 }}>{track.participantId}</p>
          </div>
        ))}
      </div>

      {mainClient.audioTracks.map(track => <Audio key={track.id} track={track} />)}
    </div>
  );
}
