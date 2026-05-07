import { useState, useEffect, useCallback, useRef } from 'react';

export function useMediaDevices(initialStream: MediaStream | null, onStreamChange: (s: MediaStream) => void) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDeviceId, setVideoDeviceId] = useState<string>("");
  const [audioDeviceId, setAudioDeviceId] = useState<string>("");
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // We use a ref for the latest state to avoid interval closure staleness
  const stateRef = useRef({ isMicOn, isCamOn });
  useEffect(() => {
    stateRef.current = { isMicOn, isCamOn };
  }, [isMicOn, isCamOn]);

  const refreshDevices = useCallback(async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      // Only update state if the device list actually changed to prevent unnecessary re-renders
      setDevices((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(devs)) return prev;
        return devs;
      });
    } catch (e) {
      console.error("Failed to enumerate devices", e);
    }
  }, []);

  // 1. Polling Logic with proper cleanup
  useEffect(() => {
    refreshDevices(); // Initial call
    const interval = setInterval(refreshDevices, 1000);
    return () => clearInterval(interval); // Cleanup
  }, [refreshDevices]);

  const startMedia = useCallback(async (vId?: string, aId?: string) => {
    try {
      if (initialStream) {
        initialStream.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: vId ? { deviceId: { exact: vId }, height: 720 } : { height: 720 },
        audio: aId ? { deviceId: { exact: aId } } : true,
      });

      // Apply the persistent UI states
      stream.getAudioTracks().forEach(t => t.enabled = stateRef.current.isMicOn);
      stream.getVideoTracks().forEach(t => t.enabled = stateRef.current.isCamOn);

      onStreamChange(stream);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [initialStream, onStreamChange]);

  const toggleAudio = () => {
    const newState = !isMicOn;
    setIsMicOn(newState);
    initialStream?.getAudioTracks().forEach(t => (t.enabled = newState));
  };

  const toggleVideo = () => {
    const newState = !isCamOn;
    setIsCamOn(newState);
    initialStream?.getVideoTracks().forEach(t => (t.enabled = newState));
  };

  return {
    devices,
    videoDeviceId,
    audioDeviceId,
    isMicOn,
    isCamOn,
    error,
    setVideoDeviceId: (id: string) => { setVideoDeviceId(id); startMedia(id, audioDeviceId); },
    setAudioDeviceId: (id: string) => { setAudioDeviceId(id); startMedia(videoDeviceId, id); },
    toggleAudio,
    toggleVideo,
    startMedia
  };
}
