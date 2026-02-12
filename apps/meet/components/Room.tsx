import { useEffect, useState } from "react";
import { useParticipant, Video, Audio } from "@pulsebeam/react";
import { Button, cn } from "@pulsebeam/ui";
import {
  Monitor, MonitorOff, Mic, MicOff, Video as VideoIcon,
  VideoOff, PhoneOff, RotateCcw, Maximize2
} from "lucide-react";

interface RoomProps {
  roomId: string;
  localStream: MediaStream;
  onLeave: () => void;
}

const API_URL = "http://localhost:3000/api/v1";

export function Room({ roomId, localStream, onLeave }: RoomProps) {
  const [spotlightId, setSpotlightId] = useState<string | "local">("local");

  const client = useParticipant({
    videoSlots: 16,
    audioSlots: 8,
    // baseUrl: API_URL,
  });

  const screenClient = useParticipant({
    videoSlots: 0,
    audioSlots: 0,
    // baseUrl: API_URL,
  });

  const isSharing = screenClient.connectionState === "connected" || screenClient.connectionState === "connecting";

  useEffect(() => {
    client.connect(roomId);
  }, [roomId]);

  useEffect(() => {
    client.publish(localStream);
  }, [localStream]);

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      stream.getVideoTracks()[0].onended = () => stopScreenShare();
      screenClient.publish(stream);
      screenClient.connect(roomId);
    } catch (e) {
      console.error("Screen share failed:", e);
    }
  };

  const stopScreenShare = () => screenClient.close();
  const toggleMic = () => client.mute({ audio: !client.audioMuted });
  const toggleCam = () => client.mute({ video: !client.videoMuted });

  // Find the track currently in spotlight
  const spotlightTrack = client.videoTracks.find(t => t.id === spotlightId);

  return (
    <div className="flex flex-col h-screen bg-neutral-950 text-white overflow-hidden">
      {/* Sleek Top Bar */}
      <nav className="h-16 px-6 border-b border-white/10 flex justify-between items-center bg-black/20 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="font-medium tracking-tight">Room: <span className="text-neutral-400">{roomId}</span></h1>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className={cn("rounded-full transition-all", isSharing && "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20")}
            onClick={isSharing ? stopScreenShare : startScreenShare}
          >
            {isSharing ? <MonitorOff className="w-4 h-4 mr-2" /> : <Monitor className="w-4 h-4 mr-2" />}
            {isSharing ? "Stop" : "Share"}
          </Button>

          <div className="h-6 w-[1px] bg-white/10 mx-2" />

          <Button variant="destructive" className="rounded-full px-6 shadow-lg shadow-red-900/20" onClick={onLeave}>
            <PhoneOff className="w-4 h-4 mr-2" /> End
          </Button>

          <Button variant="ghost" size="icon" className="text-neutral-500 hover:text-white" onClick={() => client.connect(roomId)}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </nav>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4">

        {/* Spotlight Area (Large View) */}
        <div className="flex-[3] relative rounded-3xl overflow-hidden bg-neutral-900 shadow-2xl border border-white/5">
          {spotlightId === "local" ? (
            <video
              ref={(el) => { if (el) el.srcObject = localStream }}
              autoPlay muted playsInline
              className="w-full h-full object-cover mirror"
            />
          ) : (
            spotlightTrack && <Video track={spotlightTrack} className="w-full h-full object-contain" />
          )}

          {/* Spotlight Label */}
          <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            <span className="text-sm font-semibold uppercase tracking-wider">
              {spotlightId === "local" ? "You (Spotlight)" : `Participant: ${spotlightTrack?.participantId}`}
            </span>
          </div>

          {/* Floating Controls for Local User */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 p-2 bg-black/60 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl">
            <Button size="icon" variant={client.audioMuted ? "destructive" : "secondary"} className="rounded-2xl h-12 w-12" onClick={toggleMic}>
              {client.audioMuted ? <MicOff /> : <Mic />}
            </Button>
            <Button size="icon" variant={client.videoMuted ? "destructive" : "secondary"} className="rounded-2xl h-12 w-12" onClick={toggleCam}>
              {client.videoMuted ? <VideoOff /> : <VideoIcon />}
            </Button>
          </div>
        </div>

        {/* Participant Sidebar */}
        <aside className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-[0.2em] mb-1">Participants</p>

          {/* Local Thumbnail (if not spotlighted) */}
          {spotlightId !== "local" && (
            <button
              onClick={() => setSpotlightId("local")}
              className="relative aspect-video rounded-2xl overflow-hidden group border-2 border-transparent hover:border-blue-500 transition-all shrink-0"
            >
              <video
                ref={(el) => { if (el) el.srcObject = localStream }}
                autoPlay muted playsInline
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
              <div className="absolute bottom-2 left-2 text-[10px] bg-black/60 px-2 py-0.5 rounded-lg">You</div>
            </button>
          )}

          {/* Remote Thumbnails */}
          {client.videoTracks.map((track: any) => (
            spotlightId !== track.id && (
              <button
                key={track.id}
                onClick={() => setSpotlightId(track.id)}
                className="relative aspect-video rounded-2xl overflow-hidden group border-2 border-transparent hover:border-blue-500 transition-all shrink-0 bg-neutral-800"
              >
                <Video track={track} className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                  <Maximize2 className="w-6 h-6 text-white" />
                </div>
                <div className="absolute bottom-2 left-2 text-[10px] bg-black/60 px-2 py-0.5 rounded-lg">
                  {track.participantId}
                </div>
              </button>
            )
          ))}
        </aside>
      </main>

      {/* Background Audio */}
      {client.audioTracks.map((track: any) => (
        <Audio key={track.id} track={track} />
      ))}
    </div>
  );
}
