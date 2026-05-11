import { useState, useEffect } from "react";
import { useParticipant, Video, Audio } from "./index";

const APP_CONFIG = {
  videoSlots: 16,
  audioSlots: 8,
  baseUrl: "http://localhost:9999/api/v1"
};

export default function MeetingRoom() {
  const [instanceId] = useState(() => Math.random().toString(36).slice(2));
  const [roomId, setRoomId] = useState("demo-room");
  const client = useParticipant(APP_CONFIG);

  useEffect(() => {
    console.log(`App [${instanceId}]: connectionState:`, client.connectionState);
  }, [client.connectionState, instanceId]);

  const join = async () => {
    console.log(`App [${instanceId}]: Joining room:`, roomId);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { height: 720 }, audio: true });
      client.main.publish(s);
      client.connect(roomId);
    } catch (e) {
      console.error(`App [${instanceId}]: Join failed:`, e);
    }
  };

  const leave = () => {
    console.log(`App [${instanceId}]: Leaving room`);
    client.main.unpublish();
    client.aux.unpublish();
    client.close();
  };

  // 'new' is the initial WebRTC state, before any join/connect action.
  // We treat it as decoupled from any room.
  const isLive = ["connected", "connecting", "joining", "failed", "closed"].includes(client.connectionState);
  const status = client.connectionState;

  return (
    <div data-testid="meeting-container" data-instance-id={instanceId} className="test-app">
      <h1>Pulsebeam Test App</h1>

      <div className="status-box">
        Connection Status: <span data-testid="connection-status">{status}</span>
      </div>

      <div className="controls">
        <input
          data-testid="room-id-input"
          value={roomId}
          onChange={e => setRoomId(e.target.value)}
          disabled={isLive}
          placeholder="Room ID"
        />

        <button
          data-testid="join-leave-button"
          data-live={isLive}
          onClick={isLive ? leave : join}
        >
          {isLive ? "Leave" : "Join"}
        </button>
      </div>

      {isLive && (
        <div className="media-controls" data-testid="media-controls">
          <button
            data-testid="cam-mute-button"
            data-muted={client.main.videoMuted}
            onClick={() => client.main.mute({ video: !client.main.videoMuted })}
          >
            {client.main.videoMuted ? "Unmute Cam" : "Mute Cam"}
          </button>

          <button
            data-testid="mic-mute-button"
            data-muted={client.main.audioMuted}
            onClick={() => client.main.mute({ audio: !client.main.audioMuted })}
          >
            {client.main.audioMuted ? "Unmute Mic" : "Mute Mic"}
          </button>
        </div>
      )}

      <div data-testid="video-grid" className="video-grid">
        {client.videoTracks.map((t: any) => (
          <div key={t.id} data-testid={`video-slot-${t.participantId}`}>
            <Video track={t} />
            <span>{t.participantId}</span>
          </div>
        ))}
      </div>
      {client.audioTracks.map((t: any) => <Audio key={t.id} track={t} />)}
    </div>
  );
}
