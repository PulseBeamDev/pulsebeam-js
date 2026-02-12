import { useEffect, useState, useMemo, useRef } from "react";
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
  cn
} from "@pulsebeam/ui";
import {
  Monitor, MonitorOff, Mic, MicOff, Video as VideoIcon,
  VideoOff, PhoneOff, RotateCcw, Maximize2, Loader2
} from "lucide-react";

interface RoomProps {
  roomId: string;
  localStream: MediaStream;
  onLeave: () => void;
}

const API_URL = "http://localhost:3000/api/v1";

export function Room({ roomId, localStream, onLeave }: RoomProps) {
  const [spotlightId, setSpotlightId] = useState<string | "local">("local");
  const [isScreenShareLoading, setIsScreenShareLoading] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const sidebarLocalVideoRef = useRef<HTMLVideoElement>(null);

  // Memoize configurations to prevent unnecessary resets
  const clientConfig = useMemo(() => ({
    videoSlots: 16,
    audioSlots: 8,
    // baseUrl: API_URL,
  }), []);

  const screenClientConfig = useMemo(() => ({
    videoSlots: 0,
    audioSlots: 0,
    // baseUrl: API_URL,
  }), []);

  const client = useParticipant(clientConfig);
  const screenClient = useParticipant(screenClientConfig);

  const isSharing = screenClient.connectionState === "connected" || screenClient.connectionState === "connecting";

  useEffect(() => {
    client.connect(roomId);
  }, [roomId]);

  useEffect(() => {
    client.publish(localStream);
  }, [localStream]);

  useEffect(() => {
    if (spotlightId !== "local") {
      const isPresent = client.videoTracks.some((t: any) => t.id === spotlightId);
      if (!isPresent) {
        setSpotlightId("local");
      }
    }
  }, [client.videoTracks, spotlightId]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }
  }, [localStream, spotlightId]);

  useEffect(() => {
    if (sidebarLocalVideoRef.current && localStream) {
      if (sidebarLocalVideoRef.current.srcObject !== localStream) {
        sidebarLocalVideoRef.current.srcObject = localStream;
      }
    }
  }, [localStream, spotlightId]);

  const startScreenShare = async () => {
    try {
      setIsScreenShareLoading(true);
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      stream.getVideoTracks()[0].onended = () => stopScreenShare();
      screenClient.publish(stream);
      screenClient.connect(roomId);
    } catch (e) {
      console.error("Screen share failed:", e);
      setIsScreenShareLoading(false);
    }
  };

  const stopScreenShare = () => {
    screenClient.close();
    setIsScreenShareLoading(false);
  };

  // Clear loading state when screen share connects
  useEffect(() => {
    if (screenClient.connectionState === "connected") {
      setIsScreenShareLoading(false);
    }
  }, [screenClient.connectionState]);

  const toggleMic = () => client.mute({ audio: !client.audioMuted });
  const toggleCam = () => client.mute({ video: !client.videoMuted });

  // Find the track currently in spotlight
  const spotlightTrack = client.videoTracks.find((t: any) => t.id === spotlightId);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-300">
        {/* Header */}
        <header className="h-14 px-4 border-b flex justify-between items-center bg-card/50 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-2 px-2 py-0.5 rounded-md">
              <div className={cn(
                "h-1.5 w-1.5 rounded-full",
                client.connectionState === "connected" ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"
              )} />
              <span className="text-xs font-medium text-muted-foreground">
                Room: <span className="text-foreground">{roomId}</span>
              </span>
            </Badge>

            {/* Connection Status */}
            {client.connectionState === "connecting" && (
              <Badge variant="secondary" className="gap-2 px-2 py-0.5 rounded-md animate-in fade-in slide-in-from-left-2">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span className="text-xs font-medium">Connecting...</span>
              </Badge>
            )}

            {/* Screen Share Status */}
            {isScreenShareLoading && (
              <Badge variant="secondary" className="gap-2 px-2 py-0.5 rounded-md animate-in fade-in slide-in-from-left-2">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span className="text-xs font-medium">Starting screen share...</span>
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("rounded-md h-8 transition-all px-3", isSharing && "bg-primary/10 text-primary hover:bg-primary/20")}
                  onClick={isSharing ? stopScreenShare : startScreenShare}
                >
                  {isSharing ? <MonitorOff className="w-4 h-4 mr-2" /> : <Monitor className="w-4 h-4 mr-2" />}
                  <span className="text-xs">{isSharing ? "Stop" : "Share"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isSharing ? "Stop screen sharing" : "Share your screen"}</p>
              </TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-4 bg-border mx-1" />

            <Button variant="destructive" size="sm" className="rounded-md h-8 px-4 font-medium text-xs shadow-sm" onClick={onLeave}>
              <PhoneOff className="w-3.5 h-3.5 mr-1.5" /> End
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-md" onClick={() => client.connect(roomId)}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                <p>Reconnect</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex overflow-hidden p-4 gap-4 bg-dot-pattern">

          {/* Spotlight Area - Optimized for 16:9 camera resolution */}
          <Card className="flex-[3] relative bg-black shadow-lg border-border/40 p-0 overflow-hidden group/spotlight ring-0 flex items-center justify-center">
            <div className="w-full aspect-video max-h-full">
              {spotlightId === "local" ? (
                <video
                  ref={localVideoRef}
                  autoPlay muted playsInline
                  className="w-full h-full object-contain mirror"
                />
              ) : (
                spotlightTrack && <Video track={spotlightTrack} className="w-full h-full object-contain" />
              )}

              {/* Spotlight Status Label */}
              <div className="absolute top-4 left-4">
                <Badge className="bg-black/60 backdrop-blur-md border-white/10 px-3 py-1.5 h-8 rounded-lg flex gap-2 text-[10px] font-bold uppercase tracking-wider text-white shadow-xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {spotlightId === "local" ? "You (Spotlight)" : `Participant: ${spotlightTrack?.participantId}`}
                </Badge>
              </div>

              {/* Action Bar - Glassmorphic Dark */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 p-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant={client.audioMuted ? "destructive" : "secondary"}
                      className="rounded-lg h-10 w-10 transition-transform active:scale-90"
                      onClick={toggleMic}
                    >
                      {client.audioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{client.audioMuted ? "Unmute" : "Mute"}</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant={client.videoMuted ? "destructive" : "secondary"}
                      className="rounded-lg h-10 w-10 transition-transform active:scale-90"
                      onClick={toggleCam}
                    >
                      {client.videoMuted ? <VideoOff className="w-4 h-4" /> : <VideoIcon className="w-4 h-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{client.videoMuted ? "Camera on" : "Camera off"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </Card>

          {/* Sidebar - Smaller participant thumbnails */}
          <aside className="flex-1 flex flex-col gap-3 min-w-[200px] max-w-[280px]">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Participants</p>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 rounded-sm border-none shadow-none">
                {client.videoTracks.length + 1}
              </Badge>
            </div>

            <ScrollArea className="flex-1 -mr-2 pr-2">
              <div className="flex flex-col gap-2">
                {/* Local Thumbnail */}
                {spotlightId !== "local" && (
                  <Card
                    asChild
                    className="relative aspect-video p-0 rounded-lg overflow-hidden group cursor-pointer border-transparent hover:border-primary transition-all ring-0"
                  >
                    <button onClick={() => setSpotlightId("local")}>
                      <video
                        ref={sidebarLocalVideoRef}
                        autoPlay muted playsInline
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-1.5 left-1.5">
                        <Badge variant="secondary" className="bg-black/40 text-white text-[8px] px-1.5 h-3.5 border-none backdrop-blur-sm">You</Badge>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/10">
                        <Maximize2 className="w-4 h-4 text-white/80" />
                      </div>
                    </button>
                  </Card>
                )}

                {/* Remote Thumbnails */}
                {client.videoTracks.map((track: any) => (
                  spotlightId !== track.id && (
                    <Card
                      key={track.id}
                      asChild
                      className="relative aspect-video p-0 rounded-lg overflow-hidden group cursor-pointer border-transparent hover:border-primary transition-all bg-muted ring-0"
                    >
                      <button onClick={() => setSpotlightId(track.id)}>
                        <Video track={track} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/10">
                          <Maximize2 className="w-4 h-4 text-white/80" />
                        </div>
                        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-1.5 left-1.5">
                          <Badge variant="secondary" className="bg-black/40 text-white text-[8px] px-1.5 h-3.5 border-none backdrop-blur-sm">
                            {track.participantId}
                          </Badge>
                        </div>
                      </button>
                    </Card>
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
