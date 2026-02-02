import type { ActionReturn } from "svelte/action";
import {
  Participant as WebParticipant,
  ParticipantEvent,
  RemoteVideoTrack,
  RemoteAudioTrack,
  VideoBinder,
  AudioBinder,
  type ParticipantConfig
} from "@pulsebeam/web";
export * from "@pulsebeam/web";

export function attach(node: HTMLVideoElement, track: RemoteVideoTrack): ActionReturn<RemoteVideoTrack>;
export function attach(node: HTMLAudioElement, track: RemoteAudioTrack): ActionReturn<RemoteAudioTrack>;

export function attach(
  node: HTMLVideoElement | HTMLAudioElement,
  track: RemoteVideoTrack | RemoteAudioTrack
): ActionReturn<RemoteVideoTrack | RemoteAudioTrack> {
  if (node instanceof HTMLVideoElement && track instanceof RemoteVideoTrack) {
    const instance = new VideoBinder(node, track);
    instance.mount();
    return {
      update(newTrack) {
        if (newTrack instanceof RemoteVideoTrack) instance.update(newTrack);
      },
      destroy() {
        instance.unmount();
      },
    };
  }

  if (node instanceof HTMLAudioElement && track instanceof RemoteAudioTrack) {
    const instance = new AudioBinder(node, track);
    instance.mount();
    return {
      update(newTrack) {
        if (newTrack instanceof RemoteAudioTrack) instance.update(newTrack);
      },
      destroy() {
        instance.unmount();
      },
    };
  }

  throw new Error("Mismatch: Element and Track types do not correspond");
}

export class Participant {
  connectionState = $state("disconnected");
  videoTracks = $state<RemoteVideoTrack[]>([]);
  audioTracks = $state<RemoteAudioTrack[]>([]);
  private participant: WebParticipant;

  constructor(config: ParticipantConfig) {
    const p = new WebParticipant(config);
    p.on(ParticipantEvent.State, (s) => (this.connectionState = s));
    p.on(ParticipantEvent.VideoTrackAdded, ({ track }) => this.videoTracks.push(track));
    p.on(ParticipantEvent.VideoTrackRemoved, ({ trackId }) => {
      this.videoTracks = this.videoTracks.filter((t) => t.id !== trackId);
    });
    p.on(ParticipantEvent.AudioTrackAdded, ({ track }) => this.audioTracks.push(track));
    this.participant = p;
  }

  async connect(roomId: string) {
    await this.participant.connect(roomId);
  }

  publish(stream: MediaStream | null) {
    this.participant.publish(stream);
  }

  close() {
    this.participant?.close();
    this.videoTracks = [];
    this.audioTracks = [];
    this.connectionState = "disconnected";
  }
}
