import { useState } from "react";
import { useParticipant, Video, Audio, type ParticipantConfig } from "./lib";

const APP_CONFIG: ParticipantConfig = {
  videoSlots: 16, audioSlots: 8, baseUrl: "http://localhost:3000/api/v1"
};

export default function MeetingRoom() {
  const [roomId, setRoomId] = useState("demo-room");
  const main = useParticipant(APP_CONFIG);
  const screen = useParticipant({ ...APP_CONFIG, videoSlots: 0, audioSlots: 0 });

  const join = async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: { height: 720 }, audio: true });
    main.publish(s);
    main.connect(roomId);
  };

  const toggleScreen = async () => {
    if (screen.connectionState === "connected") return screen.close();
    const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    screen.publish(s);
    screen.connect(roomId);
    s.getVideoTracks()[0].onended = () => screen.close();
  };

  const isLive = main.connectionState === "connected";

  return (
    <main className="container">
      <hgroup>
        <h1>Pulsebeam</h1>
        <p>Status: <mark>{main.connectionState}</mark></p>
      </hgroup>

      <article>
        <fieldset role="group">
          <input value={roomId} onChange={e => setRoomId(e.target.value)} disabled={isLive} />
          <button onClick={() => isLive ? (main.close(), screen.close()) : join()} className={isLive ? "secondary" : ""}>
            {isLive ? "Leave" : "Join"}
          </button>
        </fieldset>

        {isLive && (
          <nav>
            <ul>
              <li><button className={main.videoMuted ? "outline" : ""} onClick={() => main.mute({ video: !main.videoMuted })}>Cam</button></li>
              <li><button className={main.audioMuted ? "outline" : ""} onClick={() => main.mute({ audio: !main.audioMuted })}>Mic</button></li>
            </ul>
            <ul>
              <li><button className="contrast" onClick={toggleScreen}>{screen.connectionState === "connected" ? "Stop Share" : "Share"}</button></li>
            </ul>
          </nav>
        )}
      </article>

      <div className="grid">
        {main.videoTracks.map(t => (
          <article key={t.id} style={{ padding: 0, overflow: "hidden", background: "#000" }}>
            <Video track={t} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover" }} />
            <footer><small>{t.participantId}</small></footer>
          </article>
        ))}
      </div>
      {main.audioTracks.map(t => <Audio key={t.id} track={t} />)}
    </main>
  );
}
