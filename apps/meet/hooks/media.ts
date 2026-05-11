import { useState, useEffect, useCallback, useRef } from 'react';

type DisplaySurfacePolicy = 'include' | 'exclude';

type ExtendedDisplayMediaStreamConstraints = MediaStreamConstraints & {
  audio?: boolean | (MediaTrackConstraints & {
    suppressLocalAudioPlayback?: boolean;
    restrictOwnAudio?: boolean;
  });
  controller?: object;
  systemAudio?: DisplaySurfacePolicy;
  windowAudio?: DisplaySurfacePolicy;
  selfBrowserSurface?: DisplaySurfacePolicy;
  surfaceSwitching?: DisplaySurfacePolicy;
};

declare global {
  interface Window {
    CaptureController?: new () => object;
  }
}

function createDisplayMediaConstraints(): ExtendedDisplayMediaStreamConstraints {
  const controller = typeof window !== 'undefined' && window.CaptureController
    ? new window.CaptureController()
    : undefined;

  return {
    audio: {
      autoGainControl: false,
      channelCount: { ideal: 2 },
      echoCancellation: false,
      noiseSuppression: false,
      suppressLocalAudioPlayback: false,
      // Allow capturing audio from the shared surface itself (tab/window/system).
      restrictOwnAudio: false,
    },
    video: {
      frameRate: { ideal: 30 },
      width: { max: 1920 },
      height: { max: 1200 },
    },
    controller,
    systemAudio: 'exclude',
    windowAudio: 'exclude',
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
  };
}

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
      let devs = await navigator.mediaDevices.enumerateDevices();
      devs = devs.filter(d => !!d.deviceId && !!d.label);
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
      const videoConstraints = {
        deviceId: vId ? { exact: vId } : undefined,
        // 'ideal' tells the browser what you want, but allows fallback
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        aspectRatio: { ideal: 1.7777777778 }, // 16:9
        frameRate: { ideal: 30 }
      };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: aId ? { deviceId: { exact: aId } } : true,
      });

      // Extract the REAL device IDs chosen by the browser
      const activeVideoId = stream.getVideoTracks()[0]?.getSettings().deviceId;
      const activeAudioId = stream.getAudioTracks()[0]?.getSettings().deviceId;

      // This clears the "Select Camera" placeholder immediately
      if (activeVideoId) setVideoDeviceId(activeVideoId);
      if (activeAudioId) setAudioDeviceId(activeAudioId);

      onStreamChange(stream);
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      }
    }
  }, [onStreamChange]);

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


type PublishClient = {
  publish: (stream: MediaStream, options?: { videoPreset?: 'motion' | 'detail'; audioPreset?: 'speech' | 'music' }) => void;
  unpublish: () => void;
};

export function useScreenShare(client: PublishClient) {
  const [isLoading, setIsLoading] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const start = async () => {
    try {
      setIsLoading(true);
      const stream = await navigator.mediaDevices.getDisplayMedia(createDisplayMediaConstraints());
      if (stream.getAudioTracks().length === 0) {
        console.warn("Screen share started without an audio track. Choose a source with audio and enable 'Share audio' in the picker.");
      }
      streamRef.current = stream;
      stream.getVideoTracks()[0].onended = stop;
      client.publish(stream, { videoPreset: 'detail', audioPreset: 'music' });
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const stop = () => {
    client.unpublish();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsLoading(false);
  };

  const isSharing = streamRef.current !== null;
  useEffect(() => {
    return stop;
  }, []);

  return { isSharing, isLoading: isLoading && !isSharing, start, stop };
}
