import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@pulsebeam/ui";
import { Button } from "@pulsebeam/ui";
import { Input } from "@pulsebeam/ui";
import { useEffect, useRef, useState } from "react";

interface LobbyProps {
    onJoin: (roomId: string) => void;
    localStream: MediaStream | null;
    setLocalStream: (stream: MediaStream) => void;
}

export function Lobby({ onJoin, localStream, setLocalStream }: LobbyProps) {
    const [roomId, setRoomId] = useState("");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!localStream) {
            navigator.mediaDevices
                .getUserMedia({
                    video: { height: 720 },
                    audio: true,
                })
                .then(setLocalStream)
                .catch((e) => setErrorMsg(e.message));
        }
    }, [localStream, setLocalStream]);

    useEffect(() => {
        if (videoRef.current && localStream) {
            videoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (roomId && localStream) {
            onJoin(roomId);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Join Room</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {errorMsg && <p className="text-destructive text-sm">{errorMsg}</p>}

                    <div className="aspect-video bg-muted rounded-md overflow-hidden relative">
                        {localStream ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                Requesting Camera...
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            placeholder="Room ID"
                            required
                        />
                        <Button type="submit" className="w-full" disabled={!localStream || !roomId}>
                            Join
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
