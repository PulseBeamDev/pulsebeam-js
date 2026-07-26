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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@pulsebeam/ui";
import {
  Monitor, MonitorOff, Mic, MicOff, Video as VideoIcon,
  VideoOff, PhoneOff, RotateCcw, Loader2, Gauge
} from "lucide-react";
import { LocalVideo } from "./LocalVideo";
import { useScreenShare } from "@/hooks/media";

// Conferencing QoS: the spotlight is what the user is watching, so it wins
// bandwidth under contention and stays watchable; thumbnails yield first but
// keep a small floor so they never go blank.
const SPOTLIGHT_QOS = { priority: 200, minHeight: 360 };
const THUMBNAIL_QOS = { priority: 10, minHeight: 90 };

// Fixed latency modes (one-way from adaptive). Once chosen, the playout-delay
// extension is sticky — there is no wire "unset" in libwebrtc; returning to
// true adaptive requires a new session.
const LATENCY_MODES: { label: string; min: number; max: number; description: string; hint: string }[] = [
  {
    label: "Smooth",
    min: 400, max: 800,
    description: "400–800 ms",
    hint: "Maximum jitter resilience — absorbs heavy packet bursts. Best for unstable networks, webinars, and one-way live events where a few hundred milliseconds of delay is acceptable.",
  },
  {
    label: "Balanced",
    min: 100, max: 200,
    description: "100–200 ms",
    hint: "Low latency with solid jitter resilience — good for conversations, meetings, and live Q&A on typical home or office networks.",
  },
  {
    label: "Zero-latency",
    min: 0, max: 0,
    description: "No buffer · render-as-received",
    hint: "Bypasses the jitter buffer entirely — each frame is rendered the moment it arrives. For cloud gaming and remote desktop. Will stutter on any packet loss or reorder.",
  },
];

interface RoomProps {
  roomId: string;
  apiURL?: string;
  localStream: MediaStream;
  onLeave: () => void;
}

export function Room({ roomId, apiURL, localStream, onLeave }: RoomProps) {
  const [spotlightId, setSpotlightId] = useState<string | "local">("local");

  const client = useParticipant(useMemo(() => ({ baseUrl: apiURL }), [apiURL]));
  const screen = useScreenShare(client.aux);

  const [latencyMode, setLatencyMode] = useState<string | null>(null);

  // Auto-connect and publish
  useEffect(() => { client.connect(roomId); }, [roomId]);
  useEffect(() => {
    client.main.publish(localStream, { videoPreset: "motion", audioPreset: "speech" });
  }, [localStream]);

  const handleLatencyChange = (label: string) => {
    if (client.latencyLocked && latencyMode === null) return;
    const m = LATENCY_MODES.find(x => x.label === label);
    if (!m) return;
    client.setLatency(m.min, m.max);
    setLatencyMode(label);
  };

  // Handle spotlight fallback if participant leaves
  useEffect(() => {
    if (spotlightId !== "local" && !client.videoTracks.some((t: any) => t.id === spotlightId)) {
      setSpotlightId("local");
    }
  }, [client.videoTracks, spotlightId]);

  const spotlightTrack = client.videoTracks.find((t: any) => t.id === spotlightId);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background overflow-hidden font-sans">
        <RoomHeader
          roomId={roomId}
          state={client.connectionState}
          screen={screen}
          latencyMode={latencyMode}
          latencyLocked={client.latencyLocked}
          onLatencyChange={handleLatencyChange}
          onLeave={onLeave}
          onReconnect={() => client.connect(roomId)}
        />

        <main className="flex-1 flex overflow-hidden p-4 gap-4">
          {/* Spotlight Area */}
          <Card className="flex-[3] relative bg-black flex items-center justify-center overflow-hidden">
            <div className="w-full aspect-video">
              {spotlightId === "local" ? (
                <LocalVideo stream={localStream} mirror className="w-full h-full object-contain" />
              ) : (
                spotlightTrack && (
                  <Video
                    track={spotlightTrack}
                    priority={SPOTLIGHT_QOS.priority}
                    minHeight={SPOTLIGHT_QOS.minHeight}
                    className="w-full h-full object-contain"
                  />
                )
              )}

              <SpotlightBadge
                label={spotlightId === "local" ? "You" : `Participant: ${spotlightTrack?.participantId}`}
              />

              <MediaControls
                audioMuted={client.main.audioMuted}
                videoMuted={client.main.videoMuted}
                onToggleMic={() => client.main.mute({ audio: !client.main.audioMuted })}
                onToggleCam={() => client.main.mute({ video: !client.main.videoMuted })}
              />
            </div>
          </Card>

          {/* Sidebar */}
          <aside className="flex-1 flex flex-col gap-3 max-w-[280px]">
            <ParticipantSidebar
              tracks={client.videoTracks}
              localStream={localStream}
              spotlightId={spotlightId}
              onSelect={setSpotlightId}
            />
          </aside>
        </main>

        {client.audioTracks.map((t: any) => <Audio key={t.id} track={t} />)}
      </div>
    </TooltipProvider>
  );
}


function RoomHeader({ roomId, state, screen, latencyMode, latencyLocked, onLatencyChange, onLeave, onReconnect }: {
  roomId: string;
  state: string;
  screen: { isSharing: boolean; isLoading: boolean; start: () => void; stop: () => void };
  latencyMode: string | null;
  latencyLocked: boolean;
  onLatencyChange: (label: string) => void;
  onLeave: () => void;
  onReconnect: () => void;
}) {
  const activeHint = latencyMode === null
    ? "Auto — browser manages the jitter buffer adaptively. This is the initial session state; selecting any other mode is permanent until reconnect."
    : LATENCY_MODES.find(m => m.label === latencyMode)?.hint ?? "Latency";

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
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Select
                value={latencyMode ?? "auto"}
                onValueChange={(v) => v !== "auto" && onLatencyChange(v)}
              >
                <SelectTrigger className="h-7 text-xs border-muted bg-muted/50 w-44 gap-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" disabled={latencyLocked}>
                    <div className="flex flex-col">
                      <span>Auto</span>
                      <span className={cn("text-[10px] text-muted-foreground", latencyLocked && "text-destructive/70")}>
                        {latencyLocked ? "Locked — reconnect to restore" : "Adaptive · browser managed"}
                      </span>
                    </div>
                  </SelectItem>
                  {LATENCY_MODES.map((m) => (
                    <SelectItem key={m.label} value={m.label}>
                      <div className="flex flex-col">
                        <span>{m.label}</span>
                        <span className="text-[10px] text-muted-foreground">{m.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 text-xs">
            {activeHint}
          </TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-4 mx-1" />
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
              <LocalVideo stream={localStream} className="w-full h-full object-contain opacity-90" />
              <div className="absolute bottom-1.5 left-1.5">
                <Badge variant="secondary" className="bg-black/40 text-[8px] h-3.5 backdrop-blur-sm border-none text-white">You</Badge>
              </div>
            </div>
          )}

          {/* Remote Thumbnails */}
          {tracks.map((track) => (
            spotlightId !== track.id && (
              <div key={track.id} className="relative aspect-video rounded-lg overflow-hidden group cursor-pointer border-2 border-transparent hover:border-primary bg-muted" onClick={() => onSelect(track.id)}>
                <Video
                  track={track}
                  priority={THUMBNAIL_QOS.priority}
                  minHeight={THUMBNAIL_QOS.minHeight}
                  className="w-full h-full object-contain"
                />
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
