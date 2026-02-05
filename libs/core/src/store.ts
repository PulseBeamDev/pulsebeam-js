import { map, onMount, type MapStore } from 'nanostores';
import {
  Participant,
  ParticipantEvent,
  type ParticipantConfig,
  type RemoteVideoTrack,
  type RemoteAudioTrack,
  type ConnectionState,
  type LocalStreamState
} from "./participant";
import type { PlatformAdapter } from './platform';

export interface ParticipantStoreState extends LocalStreamState {
  connectionState: ConnectionState;
  videoTracks: RemoteVideoTrack[];
  audioTracks: RemoteAudioTrack[];
  connect: Participant["connect"];
  publish: Participant["publish"];
  mute: Participant["mute"];
  close: () => void;
  participant: Participant;
}

export function createParticipantStore(adapter: PlatformAdapter, initialConfig: ParticipantConfig): MapStore<ParticipantStoreState> {
  let p: Participant;
  let unsubs: (() => void)[] = [];
  let currentConfig = initialConfig;

  const $store = map<ParticipantStoreState>({} as any);

  const setupInstance = (config: ParticipantConfig) => {
    p?.close();
    unsubs.forEach(u => u());

    p = new Participant(adapter, config);

    const initialState = {
      ...p.local,
      connectionState: p.state,
      videoTracks: [],
      audioTracks: [],
      participant: p,
      connect: (...args: any[]) => (p as any).connect(...args),
      publish: (...args: any[]) => (p as any).publish(...args),
      mute: (...args: any[]) => (p as any).mute(...args),
      close: () => setupInstance(currentConfig),
    };

    $store.set(initialState as any);

    unsubs = [
      p.on(ParticipantEvent.State, (s) => $store.setKey('connectionState', s)),
      p.on(ParticipantEvent.LocalStreamUpdate, (l) => $store.set({ ...$store.get(), ...l })),
      p.on(ParticipantEvent.VideoTrackAdded, ({ track }) => {
        const current = $store.get().videoTracks;
        if (!current.some(t => t.id === track.id)) $store.setKey('videoTracks', [...current, track]);
      }),
      p.on(ParticipantEvent.VideoTrackRemoved, ({ trackId }) => {
        $store.setKey('videoTracks', $store.get().videoTracks.filter(t => t.id !== trackId));
      }),
      p.on(ParticipantEvent.AudioTrackAdded, ({ track }) => {
        const current = $store.get().audioTracks;
        if (!current.some(t => t.id === track.id)) $store.setKey('audioTracks', [...current, track]);
      }),
      p.on(ParticipantEvent.AudioTrackRemoved, ({ trackId }) => {
        $store.setKey('audioTracks', $store.get().audioTracks.filter(t => t.id !== trackId));
      }),
    ];
  };

  setupInstance(initialConfig);

  onMount($store, () => {
    return () => {
      p.close();
      unsubs.forEach(u => u());
    };
  });

  return $store;
}
