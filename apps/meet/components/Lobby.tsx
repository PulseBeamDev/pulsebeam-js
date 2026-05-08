import { Card, CardContent } from "@pulsebeam/ui";
import { Button } from "@pulsebeam/ui";
import { Input } from "@pulsebeam/ui";
import { useEffect, useRef, useState } from "react";
import { MediaPreview } from "./MediaPreview";
import { DeviceSelector } from "./DeviceSelector";
import { useMediaDevices } from "@/hooks/media";

interface LobbyProps {
  onJoin: (roomId: string, apiURL?: string) => void;
  localStream: MediaStream | null;
  setLocalStream: (stream: MediaStream) => void;
}

export function Lobby({ onJoin, localStream, setLocalStream }: LobbyProps) {
  const [roomId, setRoomId] = useState("");
  const [apiURL, setApiURL] = useState("http://localhost:7070/api/v1");
  const [isJoining, _setIsJoining] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const media = useMediaDevices(localStream, setLocalStream);

  // Initial trigger
  useEffect(() => {
    if (!localStream) media.startMedia();
  }, []);

  // Video preview sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !localStream) return;

    // Re-assign srcObject if it's different or missing
    if (video.srcObject !== localStream) {
      video.srcObject = localStream;
    }

    if (media.isCamOn) {
      // Chrome workaround: Explicitly call play() when unmuting video
      // to wake up the rendering engine
      video.play().catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.warn("Video preview failed to start:", err);
      });
    }
  }, [localStream, media.isCamOn]); // isCamOn is a vital dependency here

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-xl shadow-2xl">
        <CardContent className="pt-6 space-y-6">
          <MediaPreview
            videoRef={videoRef}
            isCamOn={media.isCamOn}
            isMicOn={media.isMicOn}
            onToggleCam={media.toggleVideo}
            onToggleMic={media.toggleAudio}
            hasStream={!!localStream}
          />

          <div className="grid grid-cols-2 gap-4">
            <DeviceSelector
              label="Camera"
              value={media.videoDeviceId}
              devices={media.devices.filter(d => d.kind === 'videoinput')}
              onValueChange={media.setVideoDeviceId}
            />
            <DeviceSelector
              label="Microphone"
              value={media.audioDeviceId}
              devices={media.devices.filter(d => d.kind === 'audioinput')}
              onValueChange={media.setAudioDeviceId}
            />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); onJoin(roomId, apiURL); }} className="space-y-4 pt-4 border-t">
            <Input value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="Room ID" required />
            <Input value={apiURL} onChange={e => setApiURL(e.target.value)} placeholder="API URL (optional)" />
            <Button type="submit" className="w-full" disabled={!localStream || isJoining}>Join Room</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
