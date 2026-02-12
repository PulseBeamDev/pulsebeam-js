import { useEffect, useState } from "react";
import { useParticipant, Video, Audio } from "@pulsebeam/react";
import { Button } from "@pulsebeam/ui";
import { Monitor, MonitorOff, Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, RotateCcw } from "lucide-react";

interface RoomProps {
  roomId: string;
  localStream: MediaStream;
  onLeave: () => void;
}

const API_URL = "http://localhost:3000/api/v1";

export function Room({ roomId, localStream, onLeave }: RoomProps) {
  const client = useParticipant({
    videoSlots: 16,
    audioSlots: 8,
    baseUrl: API_URL,
  });

  const screenClient = useParticipant({
    videoSlots: 0,
    audioSlots: 0,
    baseUrl: API_URL,
  });

  // Derived state for screen sharing
  const isSharing = screenClient.connectionState === "connected" || screenClient.connectionState === "connecting";

  // Initial connection
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

  const stopScreenShare = () => {
    screenClient.close();
  };

  const toggleMic = () => {
    client.mute({ audio: !client.audioMuted });
  };

  const toggleCam = () => {
    client.mute({ video: !client.videoMuted });
  }


  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header/Nav */}
      <nav className="p-4 border-b flex justify-between items-center">
        <div className="font-bold text-lg">Room: {roomId}</div>
        <div className="flex gap-2">
          <Button variant={isSharing ? "secondary" : "outline"} onClick={isSharing ? stopScreenShare : startScreenShare}>
            {isSharing ? <MonitorOff className="w-4 h-4 mr-2" /> : <Monitor className="w-4 h-4 mr-2" />}
            {isSharing ? "Stop Sharing" : "Share Screen"}
          </Button>
          <Button variant="destructive" onClick={onLeave}><PhoneOff className="w-4 h-4 mr-2" /> Leave</Button>
          {/* Reconnect button for robustness/debugging */}
          <Button variant="ghost" size="icon" onClick={() => client.connect(roomId)} title="Reconnect"><RotateCcw className="w-4 h-4" /></Button>
        </div>
      </nav>

      {/* Connection Status Overlay */}
      {client.connectionState !== "connected" && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm z-50">
          Status: {client.connectionState}
        </div>
      )}


      {/* Video Grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Local User */}
          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden shadow-sm ring-1 ring-border">
            <video
              ref={(el) => { if (el) el.srcObject = localStream }}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs">Me</div>
            <div className="absolute bottom-2 right-2 flex gap-1">
              <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full hover:bg-white/20 text-white" onClick={toggleMic}>
                {client.audioMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full hover:bg-white/20 text-white" onClick={toggleCam}>
                {client.videoMuted ? <VideoOff className="h-3 w-3" /> : <VideoIcon className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {/* Remote Users */}
          {client.videoTracks.map((track: any) => (
            <div key={track.id} className="relative aspect-video bg-muted rounded-lg overflow-hidden shadow-sm ring-1 ring-border">
              <Video track={track} className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs">{track.participantId}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Audio Elements */}
      {client.audioTracks.map((track: any) => (
        <Audio key={track.id} track={track} />
      ))}
    </div>
  );
}
