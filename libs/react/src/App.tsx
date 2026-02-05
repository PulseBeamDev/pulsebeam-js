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

  const isLive = mainClient.connectionState === "connected";

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
      alert("Could not access media devices.");
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

      // Auto-close if user clicks "Stop Sharing" in browser UI
      stream.getVideoTracks()[0].onended = () => screenClient.close();
    } catch (err) {
      console.error("Screen share failed:", err);
    }
  };

  const stopScreenShare = () => screenClient.close();

  return (
    <main className="container">
      <hgroup>
        <h1>Pulsebeam Room</h1>
        <p>
          Status: <mark>{mainClient.connectionState}</mark>
        </p>
      </hgroup>

      <article>
        <header>
          <fieldset role="group">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={isLive}
              placeholder="Room ID"
            />
            {!isLive ? (
              <button
                onClick={startMeeting}
                aria-busy={mainClient.connectionState === "connecting"}
              >
                Join
              </button>
            ) : (
              <button className="secondary" onClick={leaveMeeting}>
                Leave
              </button>
            )}
          </fieldset>
        </header>

        {isLive && (
          <nav>
            <ul>
              <li>
                <button
                  className={mainClient.videoMuted ? "outline" : ""}
                  onClick={() => mainClient.mute({ video: !mainClient.videoMuted })}
                >
                  {mainClient.videoMuted ? "Start Camera" : "Stop Camera"}
                </button>
              </li>
              <li>
                <button
                  className={mainClient.audioMuted ? "outline" : ""}
                  onClick={() => mainClient.mute({ audio: !mainClient.audioMuted })}
                >
                  {mainClient.audioMuted ? "Unmute Mic" : "Mute Mic"}
                </button>
              </li>
            </ul>
            <ul>
              <li>
                {screenClient.connectionState !== "connected" ? (
                  <button className="contrast" onClick={startScreenShare}>
                    Share Screen
                  </button>
                ) : (
                  <button className="secondary outline" onClick={stopScreenShare}>
                    Stop Sharing
                  </button>
                )}
              </li>
            </ul>
          </nav>
        )}
      </article>

      {/* Video Gallery */}
      <div className="grid">
        {mainClient.videoTracks.map((track) => (
          <article key={track.id} style={{ padding: 0, overflow: "hidden", backgroundColor: "#000" }}>
            <Video track={track} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover" }} />
            <footer style={{ padding: "var(--pico-spacing)", fontSize: "0.8rem" }}>
              {track.participantId || "Remote Participant"}
            </footer>
          </article>
        ))}
      </div>

      {/* Hidden Audio Elements */}
      {mainClient.audioTracks.map((track) => (
        <Audio key={track.id} track={track} />
      ))}
    </main>
  );
}
