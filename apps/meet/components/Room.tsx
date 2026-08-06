import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useParticipant, Video, Audio } from "@pulsebeam/react";
import {
  Button,
  Badge,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Card,
  Select,
  SelectContent,
  SelectGroup,
  SelectItemWithDescription,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Input,
  ScrollArea,
  cn,
} from "@pulsebeam/ui";
import {
  Monitor, MonitorOff, Mic, MicOff, Video as VideoIcon,
  VideoOff, PhoneOff, RotateCcw, Loader2, Gauge, MessageCircle, Send, SmilePlus,
} from "lucide-react";
import { LocalVideo } from "./LocalVideo";
import { useScreenShare } from "@/hooks/media";
import { useChat, useReactions } from "@/hooks/topics";

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
  const [chatOpen, setChatOpen] = useState(false);

  const client = useParticipant(useMemo(() => ({ baseUrl: apiURL }), [apiURL]));
  const screen = useScreenShare(client.aux);

  const participant = client.participant ?? null;
  const myId = client.participantId ?? null;
  const { messages, sendMessage } = useChat(participant, myId);
  const { reactions, sendReaction } = useReactions(participant, myId);

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
      <div className="flex h-dvh flex-col overflow-hidden bg-background font-sans">
        <RoomHeader
          roomId={roomId}
          state={client.connectionState}
          screen={screen}
          chatOpen={chatOpen}
          latencyMode={latencyMode}
          latencyLocked={client.latencyLocked}
          onLatencyChange={handleLatencyChange}
          onLeave={onLeave}
          onReconnect={() => client.connect(roomId)}
          onToggleChat={() => setChatOpen((v) => !v)}
        />

        <main className="meet-room-main flex min-h-0 flex-1 overflow-hidden">
          {/* Spotlight Area */}
          <Card className="meet-spotlight relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
            <div className="meet-spotlight-frame relative w-full">
              {spotlightId === "local" ? (
                <LocalVideo stream={localStream} mirror className="h-full w-full object-contain" />
              ) : (
                spotlightTrack && (
                  <Video
                    track={spotlightTrack}
                    priority={SPOTLIGHT_QOS.priority}
                    minHeight={SPOTLIGHT_QOS.minHeight}
                    className="h-full w-full object-contain"
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
                onReaction={sendReaction}
              />

              <ReactionsOverlay reactions={reactions} />
            </div>
          </Card>

          {/* Sidebar */}
          <aside className="meet-participants flex shrink-0 flex-col">
            <ParticipantSidebar
              tracks={client.videoTracks}
              localStream={localStream}
              spotlightId={spotlightId}
              onSelect={setSpotlightId}
            />
          </aside>

          {/* Chat panel */}
          {chatOpen && (
            <aside className="flex w-72 shrink-0 flex-col border-l bg-card">
              <ChatPanel messages={messages} onSend={sendMessage} />
            </aside>
          )}
        </main>

        {client.audioTracks.map((t: any) => <Audio key={t.id} track={t} />)}
      </div>
    </TooltipProvider>
  );
}


function RoomHeader({ roomId, state, screen, chatOpen, latencyMode, latencyLocked, onLatencyChange, onLeave, onReconnect, onToggleChat }: {
  roomId: string;
  state: string;
  screen: { isSharing: boolean; isLoading: boolean; start: () => void; stop: () => void };
  chatOpen: boolean;
  latencyMode: string | null;
  latencyLocked: boolean;
  onLatencyChange: (label: string) => void;
  onLeave: () => void;
  onReconnect: () => void;
  onToggleChat: () => void;
}) {
  const activeHint = latencyMode === null
    ? "Auto — browser manages the jitter buffer adaptively. This is the initial session state; selecting any other mode is permanent until reconnect."
    : LATENCY_MODES.find(m => m.label === latencyMode)?.hint ?? "Latency";

  return (
    <header className="meet-room-header z-20 flex shrink-0 items-center justify-between gap-2 border-b bg-card/50 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2">
        <Badge variant="outline" className="gap-2 px-2 py-0.5">
          <div className={cn("h-1.5 w-1.5 rounded-full", state === "connected" ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
          <span className="meet-room-name truncate text-xs font-medium text-muted-foreground">Room: <span className="text-foreground">{roomId}</span></span>
        </Badge>

        {(state === "connecting" || screen.isLoading) && (
          <Badge variant="secondary" className="meet-connection-status hidden gap-2 animate-in fade-in slide-in-from-left-2">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-xs font-medium">{screen.isLoading ? "Starting screen..." : "Connecting..."}</span>
          </Badge>
        )}
      </div>

      <div className="meet-room-actions flex items-center gap-1">
        <div className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 cursor-default">
                <Gauge className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="meet-latency-label text-xs text-muted-foreground select-none">Latency</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-64 text-xs">
              {activeHint}
            </TooltipContent>
          </Tooltip>
          <Select
            value={latencyMode ?? "auto"}
            onValueChange={(v) => v !== "auto" && onLatencyChange(v)}
          >
            <SelectTrigger
              size="sm"
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-6 px-0 text-xs font-medium min-w-[72px] gap-1"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="min-w-52">
              <SelectGroup>
                <SelectLabel>Adaptive</SelectLabel>
                <SelectItemWithDescription
                  value="auto"
                  description={latencyLocked ? "Reconnect to restore" : "Browser managed"}
                  disabled={latencyLocked}
                >
                  {latencyLocked ? "Auto (session locked)" : "Auto"}
                </SelectItemWithDescription>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Fixed</SelectLabel>
                {LATENCY_MODES.map((m) => (
                  <SelectItemWithDescription
                    key={m.label}
                    value={m.label}
                    description={m.description}
                  >
                    {m.label}
                  </SelectItemWithDescription>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <Button
          variant="ghost" size="sm"
          className={cn("h-8 rounded-md px-2.5", screen.isSharing && "bg-primary/10 text-primary")}
          onClick={screen.isSharing ? screen.stop : screen.start}
        >
          {screen.isSharing ? <MonitorOff className="mr-1.5 h-4 w-4" /> : <Monitor className="mr-1.5 h-4 w-4" />}
          <span className="text-xs">{screen.isSharing ? "Stop" : "Share"}</span>
        </Button>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <Button
          variant="ghost" size="sm"
          className={cn("h-8 rounded-md px-2.5", chatOpen && "bg-primary/10 text-primary")}
          onClick={onToggleChat}
        >
          <MessageCircle className="mr-1.5 h-4 w-4" />
          <span className="text-xs">Chat</span>
        </Button>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <Button variant="destructive" size="sm" className="h-8 px-2.5 text-xs" onClick={onLeave}>
          <PhoneOff className="mr-1.5 h-3.5 w-3.5" /> <span>End</span>
        </Button>
        <Button variant="ghost" size="icon" className="meet-reconnect h-8 w-8" onClick={onReconnect}>
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      </div>
    </header>
  );
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "👏", "🔥"];

function MediaControls({ audioMuted, videoMuted, onToggleMic, onToggleCam, onReaction }: {
  audioMuted: boolean; videoMuted: boolean; onToggleMic: () => void; onToggleCam: () => void;
  onReaction: (emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2 rounded-xl border border-white/10 bg-black/60 p-1.5 shadow-2xl backdrop-blur-md sm:bottom-6 sm:gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant={audioMuted ? "destructive" : "secondary"} className="h-11 w-11 sm:h-10 sm:w-10" onClick={onToggleMic}>
            {audioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>{audioMuted ? "Unmute" : "Mute"}</p></TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant={videoMuted ? "destructive" : "secondary"} className="h-11 w-11 sm:h-10 sm:w-10" onClick={onToggleCam}>
            {videoMuted ? <VideoOff className="w-4 h-4" /> : <VideoIcon className="w-4 h-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent><p>{videoMuted ? "Camera on" : "Camera off"}</p></TooltipContent>
      </Tooltip>

      <div className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="secondary" className="h-11 w-11 sm:h-10 sm:w-10" onClick={() => setPickerOpen((v) => !v)}>
              <SmilePlus className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>React</p></TooltipContent>
        </Tooltip>
        {pickerOpen && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex gap-1 rounded-xl border border-white/10 bg-black/80 px-2 py-1.5 backdrop-blur-md">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className="text-xl transition-transform hover:scale-125 active:scale-110"
                onClick={() => { onReaction(emoji); setPickerOpen(false); }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
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

      <div className="meet-participant-scroll min-h-0 flex-1">
        <div className="meet-participant-list flex gap-2">
          {/* Local Thumbnail (Only show if not in spotlight) */}
          {spotlightId !== "local" && (
            <div className="meet-participant-tile relative aspect-video shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-transparent hover:border-primary" onClick={() => onSelect("local")}>
              <LocalVideo stream={localStream} className="w-full h-full object-contain opacity-90" />
              <div className="absolute bottom-1.5 left-1.5">
                <Badge variant="secondary" className="bg-black/40 text-[8px] h-3.5 backdrop-blur-sm border-none text-white">You</Badge>
              </div>
            </div>
          )}

          {/* Remote Thumbnails */}
          {tracks.map((track) => (
            spotlightId !== track.id && (
              <div key={track.id} className="meet-participant-tile relative aspect-video shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-transparent bg-muted hover:border-primary" onClick={() => onSelect(track.id)}>
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
      </div>
    </>
  );
}

function SpotlightBadge({ label }: { label: string }) {
  return (
    <div className="absolute left-2 top-2 sm:left-4 sm:top-4">
      <Badge className="flex h-7 max-w-48 gap-2 truncate rounded-lg border-white/10 bg-black/60 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-md sm:h-8 sm:max-w-none sm:px-3 sm:py-1.5 sm:text-[10px]">
        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
        {label}
      </Badge>
    </div>
  );
}

function ReactionsOverlay({ reactions }: { reactions: { id: string; emoji: string }[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {reactions.map((r) => (
        <span
          key={r.id}
          className="absolute bottom-24 animate-[floatUp_3s_ease-out_forwards] text-4xl"
          style={{ left: `${20 + Math.random() * 60}%` }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}

function ChatPanel({ messages, onSend }: {
  messages: { id: string; sender: string; text: string; self: boolean }[];
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = useCallback(() => {
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  }, [draft, onSend]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Chat</span>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3 py-2">
        <div className="flex flex-col gap-2">
          {messages.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">No messages yet</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col gap-0.5", m.self ? "items-end" : "items-start")}>
              <span className="px-1 text-[10px] text-muted-foreground">
                {m.self ? "You" : m.sender}
              </span>
              <div className={cn(
                "max-w-[85%] rounded-2xl px-3 py-1.5 text-sm",
                m.self ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
              )}>
                {m.text}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex gap-2 border-t px-3 py-2">
        <Input
          className="h-8 text-sm"
          placeholder="Message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button size="icon" className="h-8 w-8 shrink-0" onClick={submit}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
