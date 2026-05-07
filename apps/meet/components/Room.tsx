import { useEffect, useState, useMemo } from "react";
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
  Card,
  cn,
} from "@pulsebeam/ui";
import {
  Monitor, MonitorOff, Mic, MicOff, Video as VideoIcon,
  VideoOff, PhoneOff, RotateCcw, Loader2
} from "lucide-react";
import { LocalVideo } from "./LocalVideo";
import { useScreenShare } from "@/hooks/media";

interface RoomProps {
  roomId: string;
  apiURL?: string;
  localStream: MediaStream;
  onLeave: () => void;
}

export function Room({ roomId, apiURL, localStream, onLeave }: RoomProps) {
  const [spotlightId, setSpotlightId] = useState<string | "local">("local");

  const mainClient = useParticipant(useMemo(() => ({ baseUrl: apiURL }), [apiURL]));
  const screen = useScreenShare(roomId, apiURL);

  // Auto-connect and publish
  useEffect(() => { mainClient.connect(roomId); }, [roomId]);
  useEffect(() => { mainClient.publish(localStream); }, [localStream]);

  // Handle spotlight fallback if participant leaves
  useEffect(() => {
    if (spotlightId !== "local" && !mainClient.videoTracks.some(t => t.id === spotlightId)) {
      setSpotlightId("local");
    }
  }, [mainClient.videoTracks, spotlightId]);

  const spotlightTrack = mainClient.videoTracks.find(t => t.id === spotlightId);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background overflow-hidden font-sans">
        <RoomHeader
          roomId={roomId}
          state={mainClient.connectionState}
          screen={screen}
          onLeave={onLeave}
          onReconnect={() => mainClient.connect(roomId)}
        />

        <main className="flex-1 flex overflow-hidden p-4 gap-4">
          {/* Spotlight Area */}
          <Card className="flex-[3] relative bg-black flex items-center justify-center overflow-hidden">
            <div className="w-full aspect-video">
              {spotlightId === "local" ? (
                <LocalVideo stream={localStream} mirror className="w-full h-full object-contain" />
              ) : (
                spotlightTrack && <Video track={spotlightTrack} className="w-full h-full object-contain" />
              )}

              <SpotlightBadge
                label={spotlightId === "local" ? "You" : `Participant: ${spotlightTrack?.participantId}`}
              />

              <MediaControls
                audioMuted={mainClient.audioMuted}
                videoMuted={mainClient.videoMuted}
                onToggleMic={() => mainClient.mute({ audio: !mainClient.audioMuted })}
                onToggleCam={() => mainClient.mute({ video: !mainClient.videoMuted })}
              />
            </div>
          </Card>

          {/* Sidebar */}
          <aside className="flex-1 flex flex-col gap-3 max-w-[280px]">
            <ParticipantSidebar
              tracks={mainClient.videoTracks}
              localStream={localStream}
              spotlightId={spotlightId}
              onSelect={setSpotlightId}
            />
          </aside>
        </main>

        {mainClient.audioTracks.map(t => <Audio key={t.id} track={t} />)}
      </div>
    </TooltipProvider>
  );
}


function RoomHeader({ roomId, state, screen, onLeave, onReconnect }: {
  roomId: string;
  state: string;
  screen: { isSharing: boolean; isLoading: boolean; start: () => void; stop: () => void };
  onLeave: () => void;
  onReconnect: () => void;
}) {
  return (
    <header className="h-14 px-4 border-b flex justify-between items-center bg-card/50 backdrop-blur-md z-20">
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="gap-2 px-2 py-0.5">
          <div className={cn("h-1.5 w-1.5 rounded-full", state === "connected" ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
          <span className="text-xs font-medium text-muted-foreground">Room: <span className="text-foreground">{roomId}</span></span>
        </Badge>

        {(state === "connecting" || screen.isLoading) && (
          <Badge variant="secondary" className="gap-2 animate-in fade-in slide-in-from-left-2">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-xs font-medium">{screen.isLoading ? "Starting screen..." : "Connecting..."}</span>
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost" size="sm"
          className={cn("rounded-md h-8 px-3", screen.isSharing && "bg-primary/10 text-primary")}
          onClick={screen.isSharing ? screen.stop : screen.start}
        >
          {screen.isSharing ? <MonitorOff className="w-4 h-4 mr-2" /> : <Monitor className="w-4 h-4 mr-2" />}
          <span className="text-xs">{screen.isSharing ? "Stop" : "Share"}</span>
        </Button>
        <Separator orientation="vertical" className="h-4 mx-1" />
        <Button variant="destructive" size="sm" className="h-8 px-4 text-xs" onClick={onLeave}>
          <PhoneOff className="w-3.5 h-3.5 mr-1.5" /> End
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onReconnect}>
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      </div>
    </header>
  );
}

function MediaControls({ audioMuted, videoMuted, onToggleMic, onToggleCam }: {
  audioMuted: boolean; videoMuted: boolean; onToggleMic: () => void; onToggleCam: () => void;
}) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 p-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant={audioMuted ? "destructive" : "secondary"} className="h-10 w-10" onClick={onToggleMic}>
            {audioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>{audioMuted ? "Unmute" : "Mute"}</p></TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant={videoMuted ? "destructive" : "secondary"} className="h-10 w-10" onClick={onToggleCam}>
            {videoMuted ? <VideoOff className="w-4 h-4" /> : <VideoIcon className="w-4 h-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>{videoMuted ? "Camera on" : "Camera off"}</p></TooltipContent>
      </Tooltip>
    </div>
  );
}

function ParticipantSidebar({ tracks, localStream, spotlightId, onSelect }: {
  tracks: any[]; localStream: MediaStream; spotlightId: string; onSelect: (id: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Participants</p>
        <Badge variant="secondary" className="text-[9px] h-4">{tracks.length + 1}</Badge>
      </div>

      <ScrollArea className="flex-1 -mr-2 pr-2">
        <div className="flex flex-col gap-2">
          {/* Local Thumbnail (Only show if not in spotlight) */}
          {spotlightId !== "local" && (
            <div className="relative aspect-video rounded-lg overflow-hidden group cursor-pointer border-2 border-transparent hover:border-primary" onClick={() => onSelect("local")}>
              <LocalVideo stream={localStream} className="w-full h-full object-cover opacity-90" />
              <div className="absolute bottom-1.5 left-1.5">
                <Badge variant="secondary" className="bg-black/40 text-[8px] h-3.5 backdrop-blur-sm border-none text-white">You</Badge>
              </div>
            </div>
          )}

          {/* Remote Thumbnails */}
          {tracks.map((track) => (
            spotlightId !== track.id && (
              <div key={track.id} className="relative aspect-video rounded-lg overflow-hidden group cursor-pointer border-2 border-transparent hover:border-primary bg-muted" onClick={() => onSelect(track.id)}>
                <Video track={track} className="w-full h-full object-cover" />
                <div className="absolute bottom-1.5 left-1.5">
                  <Badge variant="secondary" className="bg-black/40 text-[8px] h-3.5 border-none text-white">{track.participantId}</Badge>
                </div>
              </div>
            )
          ))}
        </div>
      </ScrollArea>
    </>
  );
}

function SpotlightBadge({ label }: { label: string }) {
  return (
    <div className="absolute top-4 left-4">
      <Badge className="bg-black/60 backdrop-blur-md border-white/10 px-3 py-1.5 h-8 rounded-lg flex gap-2 text-[10px] font-bold uppercase tracking-wider text-white">
        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
        {label}
      </Badge>
    </div>
  );
}
