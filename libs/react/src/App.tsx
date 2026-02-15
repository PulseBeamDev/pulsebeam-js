import { useState, useEffect } from "react";
import { useParticipant, Video, Audio, type ParticipantConfig } from "./index";

const APP_CONFIG: ParticipantConfig = {
  videoSlots: 16,
  audioSlots: 8,
  baseUrl: "http://localhost:9999/api/v1"
};

export default function MeetingRoom() {
  const [instanceId] = useState(() => Math.random().toString(36).slice(2));
  const [roomId, setRoomId] = useState("demo-room");
  const main = useParticipant(APP_CONFIG);
  const screen = useParticipant({ ...APP_CONFIG, videoSlots: 0, audioSlots: 0 });

  useEffect(() => {
    console.log(`App [${instanceId}]: connectionState:`, main.connectionState);
  }, [main.connectionState, instanceId]);

  const join = async () => {
    console.log(`App [${instanceId}]: Joining room:`, roomId);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { height: 720 }, audio: true });
      main.publish(s);
      main.connect(roomId);
    } catch (e) {
      console.error(`App [${instanceId}]: Join failed:`, e);
    }
  };

  const leave = () => {
    console.log(`App [${instanceId}]: Leaving room`);
    main.close();
    screen.close();
  };

  // 'new' is the initial WebRTC state, before any join/connect action.
  // We treat it as decoupled from any room.
  const isLive = ["connected", "connecting", "joining", "failed", "closed"].includes(main.connectionState);
  const status = main.connectionState;

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
            data-muted={main.videoMuted}
            onClick={() => main.mute({ video: !main.videoMuted })}
          >
            {main.videoMuted ? "Unmute Cam" : "Mute Cam"}
          </button>

          <button
            data-testid="mic-mute-button"
            data-muted={main.audioMuted}
            onClick={() => main.mute({ audio: !main.audioMuted })}
          >
            {main.audioMuted ? "Unmute Mic" : "Mute Mic"}
          </button>
        </div>
      )}

      <div data-testid="video-grid" className="video-grid">
        {main.videoTracks.map(t => (
          <div key={t.id} data-testid={`video-slot-${t.participantId}`}>
            <Video track={t} />
            <span>{t.participantId}</span>
          </div>
        ))}
      </div>
      {main.audioTracks.map(t => <Audio key={t.id} track={t} />)}
    </div>
  );
}
