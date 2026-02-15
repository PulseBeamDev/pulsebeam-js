import { map, onMount, type MapStore } from "nanostores";
import {
  Participant,
  ParticipantEvent,
  type ParticipantConfig,
  type RemoteVideoTrack,
  type RemoteAudioTrack,
  type ConnectionState,
  type LocalStreamState,
} from "./participant";
import type { PlatformAdapter } from "./platform";

export interface ParticipantState extends LocalStreamState {
  connectionState: ConnectionState;
  videoTracks: RemoteVideoTrack[];
  audioTracks: RemoteAudioTrack[];
}

export type ParticipantSnapshot = ParticipantState & {
  participant: Participant;
  connect: Participant["connect"];
  publish: Participant["publish"];
  mute: Participant["mute"];
  close: () => void;
  reset: (config: ParticipantConfig, force: boolean) => void;
};

export type ParticipantManager = MapStore<ParticipantSnapshot>;

function sameConfig(last: ParticipantConfig, cur: ParticipantConfig): boolean {
  return last.videoSlots === cur.videoSlots &&
    last.audioSlots === cur.audioSlots &&
    last.baseUrl === cur.baseUrl;
}

export function createParticipant(
  adapter: PlatformAdapter,
  initialConfig: ParticipantConfig
): ParticipantManager {
  let participant: Participant;
  let unsubs: Array<() => void> = [];

  // Helper to clear existing listeners and close the current instance
  const teardown = () => {
    unsubs.forEach((u) => u());
    unsubs = [];
    if (participant) participant.close();
  };

  const $store = map<ParticipantSnapshot>({
    connectionState: "new",
    videoTracks: [],
    audioTracks: [],
    audioMuted: false,
    videoMuted: false,
  } as any);

  const setup = (config: ParticipantConfig) => {
    teardown();
    participant = new Participant(adapter, config);

    // Bind event listeners
    unsubs = [
      participant.on(ParticipantEvent.State, (s) => $store.setKey("connectionState", s)),
      participant.on(ParticipantEvent.LocalStreamUpdate, (local) => {
        for (const [key, value] of Object.entries(local)) {
          $store.setKey(key as keyof ParticipantState, value);
        }
      }),
      participant.on(ParticipantEvent.VideoTrackAdded, ({ track }) =>
        $store.setKey("videoTracks", [...$store.get().videoTracks, track])),
      participant.on(ParticipantEvent.VideoTrackRemoved, ({ trackId }) =>
        $store.setKey("videoTracks", $store.get().videoTracks.filter(t => t.id !== trackId))),
      participant.on(ParticipantEvent.AudioTrackAdded, ({ track }) =>
        $store.setKey("audioTracks", [...$store.get().audioTracks, track])),
      participant.on(ParticipantEvent.AudioTrackRemoved, ({ trackId }) =>
        $store.setKey("audioTracks", $store.get().audioTracks.filter(t => t.id !== trackId))),
    ];

    // Update store with new instance and reset state
    $store.set({
      ...participant.local,
      connectionState: participant.state,
      videoTracks: [],
      audioTracks: [],
      participant,
      // Proxies to the current instance variable
      connect: (...args) => participant.connect(...args),
      publish: (...args) => participant.publish(...args),
      mute: (...args) => participant.mute(...args),
      close: () => setup(config),
      reset: (newConfig, force) => {
        if (force || !sameConfig(config, newConfig)) setup(newConfig);
      },
    });
  };

  onMount($store, () => {
    setup(initialConfig);
    return teardown;
  });

  return $store;
}

export interface DeviceState {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
  selectedCameraId: string;
  selectedMicrophoneId: string;
  selectedSpeakerId: string;
  hasPermissions: boolean;
  error: Error | null;
}

export type DeviceSnapshot = DeviceState & {
  promptPermissions: () => Promise<void>;
  refresh: () => Promise<void>;
  selectCamera: (id: string) => void;
  selectMicrophone: (id: string) => void;
  selectSpeaker: (id: string) => void;
};

export type DeviceManager = MapStore<DeviceSnapshot>;

export function createDeviceManager(adapter: PlatformAdapter): DeviceManager {
  const $store = map<DeviceSnapshot>({
    cameras: [],
    microphones: [],
    speakers: [],
    selectedCameraId: "",
    selectedMicrophoneId: "",
    selectedSpeakerId: "",
    hasPermissions: false,
    error: null,
    promptPermissions: async () => { },
    refresh: async () => { },
    selectCamera: () => { },
    selectMicrophone: () => { },
    selectSpeaker: () => { },
  });

  const validateId = (id: string, list: MediaDeviceInfo[]): string => {
    if (!list.length) return "";
    return list.some((d) => d.deviceId === id) ? id : list[0]!.deviceId;
  };

  const updateList = async () => {
    try {
      const devices = await adapter.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === "videoinput");
      const microphones = devices.filter((d) => d.kind === "audioinput");
      const speakers = devices.filter((d) => d.kind === "audiooutput");
      const hasPermissions = devices.some((d) => d.label.length > 0);

      const current = $store.get();

      // Only set if changed
      if (JSON.stringify(current.cameras) !== JSON.stringify(cameras))
        $store.setKey("cameras", cameras);
      if (JSON.stringify(current.microphones) !== JSON.stringify(microphones))
        $store.setKey("microphones", microphones);
      if (JSON.stringify(current.speakers) !== JSON.stringify(speakers))
        $store.setKey("speakers", speakers);
      if (current.hasPermissions !== hasPermissions)
        $store.setKey("hasPermissions", hasPermissions);

      const nextCameraId = hasPermissions ? validateId(current.selectedCameraId, cameras) : current.selectedCameraId;
      if (current.selectedCameraId !== nextCameraId)
        $store.setKey("selectedCameraId", nextCameraId);

      const nextMicId = hasPermissions ? validateId(current.selectedMicrophoneId, microphones) : current.selectedMicrophoneId;
      if (current.selectedMicrophoneId !== nextMicId)
        $store.setKey("selectedMicrophoneId", nextMicId);

      const nextSpeakerId = hasPermissions ? validateId(current.selectedSpeakerId, speakers) : current.selectedSpeakerId;
      if (current.selectedSpeakerId !== nextSpeakerId)
        $store.setKey("selectedSpeakerId", nextSpeakerId);
    } catch (err) {
      $store.setKey("error", err instanceof Error ? err : new Error(String(err)));
    }
  };

  const promptPermissions = async () => {
    try {
      const stream = await adapter.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      $store.setKey("error", err instanceof Error ? err : new Error(String(err)));
    } finally {
      await updateList();
    }
  };

  $store.setKey("promptPermissions", promptPermissions);
  $store.setKey("refresh", updateList);
  $store.setKey("selectCamera", (id) => $store.setKey("selectedCameraId", id));
  $store.setKey("selectMicrophone", (id) => $store.setKey("selectedMicrophoneId", id));
  $store.setKey("selectSpeaker", (id) => $store.setKey("selectedSpeakerId", id));

  onMount($store, () => {
    updateList();
    const cb = () => updateList();
    adapter.mediaDevices.addEventListener("devicechange", cb);
    return () => adapter.mediaDevices.removeEventListener("devicechange", cb);
  });

  return $store;
}

export interface DisplayState {
  displays: MediaStream[];
  isSharing: boolean;
  error: Error | null;
}

export type DisplaySnapshot = DisplayState & {
  startCapture: (options?: MediaStreamConstraints) => Promise<MediaStream | null>;
  stopCapture: (streamId: string) => void;
  stopAll: () => void;
};

export type DisplayManager = MapStore<DisplaySnapshot>;

export function createDisplayManager(adapter: PlatformAdapter): DisplayManager {
  const $store = map<DisplaySnapshot>({
    displays: [],
    isSharing: false,
    error: null,
    startCapture: async () => null,
    stopCapture: () => { },
    stopAll: () => { },
  });

  const stopTracks = (stream: MediaStream) => stream.getTracks().forEach((t) => t.stop());

  const startCapture: DisplaySnapshot["startCapture"] = async (options) => {
    try {
      const stream = await adapter.mediaDevices.getDisplayMedia(options);
      const [videoTrack] = stream.getVideoTracks();

      if (videoTrack) {
        videoTrack.addEventListener("ended", () => stopCapture(stream.id));
      }

      const next = [...$store.get().displays, stream];
      $store.setKey("displays", next);
      $store.setKey("isSharing", true);

      return stream;
    } catch (err) {
      $store.setKey("error", err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  };

  const stopCapture: DisplaySnapshot["stopCapture"] = (streamId) => {
    const list = $store.get().displays;
    const stream = list.find((s) => s.id === streamId);
    if (!stream) return;

    stopTracks(stream);
    const next = list.filter((s) => s.id !== streamId);
    $store.setKey("displays", next);
    $store.setKey("isSharing", next.length > 0);
  };

  const stopAll: DisplaySnapshot["stopAll"] = () => {
    $store.get().displays.forEach(stopTracks);
    $store.setKey("displays", []);
    $store.setKey("isSharing", false);
  };

  $store.setKey("startCapture", startCapture);
  $store.setKey("stopCapture", stopCapture);
  $store.setKey("stopAll", stopAll);

  return $store;
}
