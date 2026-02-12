import { useEffect, useState } from "react";
import { useParticipant, Video, Audio } from "@pulsebeam/react";
import {
  Button,
  Badge,
  Separator,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn
} from "@pulsebeam/ui";
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
  const spotlightTrack = client.videoTracks.find((t: any) => t.id === spotlightId);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-neutral-950 text-white overflow-hidden font-sans">
        {/* Sleek Top Bar */}
        <nav className="h-16 px-6 border-b border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-xl z-20">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="h-8 gap-2 bg-white/5 border-white/10 px-3 py-1 rounded-full">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium tracking-tight text-neutral-300">Room: <span className="text-white">{roomId}</span></span>
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("rounded-full transition-all hover:bg-white/10", isSharing && "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30")}
                  onClick={isSharing ? stopScreenShare : startScreenShare}
                >
                  {isSharing ? <MonitorOff className="w-4 h-4 mr-2" /> : <Monitor className="w-4 h-4 mr-2" />}
                  {isSharing ? "Stop sharing" : "Share screen"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isSharing ? "Stop screen sharing" : "Share your screen with others"}</p>
              </TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6 bg-white/10 mx-2" />

            <Button variant="destructive" size="sm" className="rounded-full px-6 shadow-lg shadow-red-900/20 font-semibold" onClick={onLeave}>
              <PhoneOff className="w-4 h-4 mr-2" /> End session
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-neutral-500 hover:text-white rounded-full" onClick={() => client.connect(roomId)}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reconnect</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </nav>

        {/* Main Workspace */}
        <main className="flex-1 flex overflow-hidden p-6 gap-6 bg-gradient-to-br from-neutral-950 to-neutral-900">

          {/* Spotlight Area (Large View) */}
          <div className="flex-[3] relative rounded-[2rem] overflow-hidden bg-black shadow-2xl border border-white/5 ring-1 ring-white/10">
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
            <div className="absolute top-8 left-8">
              <Badge className="bg-black/60 backdrop-blur-2xl border-white/10 px-4 py-2 h-10 rounded-2xl flex gap-3 shadow-2xl">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
                <span className="text-xs font-bold uppercase tracking-[0.15em] text-white">
                  {spotlightId === "local" ? "You (Spotlight)" : `Participant: ${spotlightTrack?.participantId}`}
                </span>
              </Badge>
            </div>

            {/* Floating Controls for Local User */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4 p-2.5 bg-black/60 backdrop-blur-2xl rounded-[2rem] border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={client.audioMuted ? "destructive" : "secondary"}
                    className="rounded-2xl h-14 w-14 transition-all hover:scale-105 active:scale-95"
                    onClick={toggleMic}
                  >
                    {client.audioMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{client.audioMuted ? "Unmute microphone" : "Mute microphone"}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={client.videoMuted ? "destructive" : "secondary"}
                    className="rounded-2xl h-14 w-14 transition-all hover:scale-105 active:scale-95"
                    onClick={toggleCam}
                  >
                    {client.videoMuted ? <VideoOff className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{client.videoMuted ? "Turn on camera" : "Turn off camera"}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Participant Sidebar */}
          <aside className="flex-1 flex flex-col gap-6 min-w-[280px]">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Participants</p>
              <Badge variant="secondary" className="bg-neutral-800 text-neutral-400 text-[9px] px-2 py-0 h-4">
                {client.videoTracks.length + 1}
              </Badge>
            </div>

            <ScrollArea className="flex-1 -mr-4 pr-4">
              <div className="flex flex-col gap-4">
                {/* Local Thumbnail (if not spotlighted) */}
                {spotlightId !== "local" && (
                  <button
                    onClick={() => setSpotlightId("local")}
                    className="relative aspect-video rounded-3xl overflow-hidden group border-2 border-transparent hover:border-blue-500 transition-all shrink-0 bg-neutral-900 ring-1 ring-white/5"
                  >
                    <video
                      ref={(el) => { if (el) el.srcObject = localStream }}
                      autoPlay muted playsInline
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all grayscale-[0.5] group-hover:grayscale-0"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60 group-hover:opacity-20 transition-opacity" />
                    <div className="absolute bottom-3 left-3">
                      <Badge variant="secondary" className="bg-black/40 backdrop-blur-md text-[10px] px-2 py-0 h-5 border-white/5">You</Badge>
                    </div>
                  </button>
                )}

                {/* Remote Thumbnails */}
                {client.videoTracks.map((track: any) => (
                  spotlightId !== track.id && (
                    <button
                      key={track.id}
                      onClick={() => setSpotlightId(track.id)}
                      className="relative aspect-video rounded-3xl overflow-hidden group border-2 border-transparent hover:border-blue-500 transition-all shrink-0 bg-neutral-800 ring-1 ring-white/5"
                    >
                      <Video track={track} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/40 backdrop-blur-[2px]">
                        <Maximize2 className="w-8 h-8 text-white/80" />
                      </div>
                      <div className="absolute bottom-3 left-3">
                        <Badge variant="secondary" className="bg-black/40 backdrop-blur-md text-[10px] px-2 py-0 h-5 border-white/5">
                          {track.participantId}
                        </Badge>
                      </div>
                    </button>
                  )
                ))}
              </div>
            </ScrollArea>
          </aside>
        </main>

        {/* Background Audio */}
        {client.audioTracks.map((track: any) => (
          <Audio key={track.id} track={track} />
        ))}
      </div>
    </TooltipProvider>
  );
}
