import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Participant as WebParticipant,
  ParticipantEvent,
  RemoteVideoTrack,
  RemoteAudioTrack,
  VideoBinder,
  AudioBinder,
  type ParticipantConfig,
  type LocalStreamState,
} from "@pulsebeam/web";

export * from "@pulsebeam/web";

/**
 * Internal helper to handle the mounting logic for tracks
 */
function useTrackBinder<T extends HTMLVideoElement | HTMLAudioElement>(
  track: RemoteVideoTrack | RemoteAudioTrack,
  BinderClass: typeof VideoBinder | typeof AudioBinder
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const instance = new (BinderClass as any)(node, track);
    instance.mount();

    return () => instance.unmount();
  }, [track, BinderClass]);

  return ref;
}

/**
 * Declarative Video Component
 */
export const Video = ({
  track,
  ...props
}: { track: RemoteVideoTrack } & React.VideoHTMLAttributes<HTMLVideoElement>) => {
  const ref = useTrackBinder<HTMLVideoElement>(track, VideoBinder);
  return <video ref={ref} autoPlay playsInline {...props} />;
};

/**
 * Declarative Audio Component
 */
export const Audio = ({
  track,
  ...props
}: { track: RemoteAudioTrack } & React.AudioHTMLAttributes<HTMLAudioElement>) => {
  const ref = useTrackBinder<HTMLAudioElement>(track, AudioBinder);
  return <audio ref={ref} autoPlay {...props} />;
};

type ConnectionState = string;

/**
 * Participant Hook
 */
export function useParticipant(config: ParticipantConfig) {
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const [instanceKey, setInstanceKey] = useState(0);

  const participant = useMemo(
    () => new WebParticipant(configRef.current),
    [instanceKey]
  );

  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [videoTracks, setVideoTracks] = useState<RemoteVideoTrack[]>([]);
  const [audioTracks, setAudioTracks] = useState<RemoteAudioTrack[]>([]);
  const [local, setLocal] = useState(participant.local);

  useEffect(() => {
    const onState = (s: ConnectionState) => setConnectionState(s);
    const onVideoAdded = ({ track }: { track: RemoteVideoTrack }) =>
      setVideoTracks((prev) => (prev.some((t) => t.id === track.id) ? prev : [...prev, track]));
    const onVideoRemoved = ({ trackId }: { trackId: string }) =>
      setVideoTracks((prev) => prev.filter((t) => t.id !== trackId));
    const onAudioAdded = ({ track }: { track: RemoteAudioTrack }) =>
      setAudioTracks((prev) => (prev.some((t) => t.id === track.id) ? prev : [...prev, track]));
    const onAudioRemoved = ({ trackId }: { trackId: string }) =>
      setAudioTracks((prev) => prev.filter((t) => t.id !== trackId));
    const onLocalStreamUpdate = (data: LocalStreamState) => setLocal(data);

    participant.on(ParticipantEvent.State, onState);
    participant.on(ParticipantEvent.VideoTrackAdded, onVideoAdded);
    participant.on(ParticipantEvent.VideoTrackRemoved, onVideoRemoved);
    participant.on(ParticipantEvent.AudioTrackAdded, onAudioAdded);
    participant.on(ParticipantEvent.AudioTrackRemoved, onAudioRemoved);
    participant.on(ParticipantEvent.LocalStreamUpdate, onLocalStreamUpdate);

    return () => {
      participant.off(ParticipantEvent.State, onState);
      participant.off(ParticipantEvent.VideoTrackAdded, onVideoAdded);
      participant.off(ParticipantEvent.VideoTrackRemoved, onVideoRemoved);
      participant.off(ParticipantEvent.AudioTrackAdded, onAudioAdded);
      participant.off(ParticipantEvent.AudioTrackRemoved, onAudioRemoved);
      participant.off(ParticipantEvent.LocalStreamUpdate, onLocalStreamUpdate);
    };
  }, [participant]);

  const connect = useCallback(
    (...args: Parameters<WebParticipant["connect"]>) => participant.connect(...args),
    [participant]
  );

  const publish = useCallback(
    (...args: Parameters<WebParticipant["publish"]>) => participant.publish(...args),
    [participant]
  );

  const mute = useCallback(
    (...args: Parameters<WebParticipant["mute"]>) => participant.mute(...args),
    [participant]
  );

  const close = useCallback(() => {
    participant.close();
    setVideoTracks([]);
    setAudioTracks([]);
    setConnectionState("closed");
    setInstanceKey((k) => k + 1); // create fresh participant next time
  }, [participant]);

  return {
    ...local,
    participant,
    connectionState,
    videoTracks,
    audioTracks,
    connect,
    publish,
    mute,
    close,
  };
}

