import { createDeviceManager, createDisplayManager, VideoBinder, AudioBinder, BrowserAdapter } from '../../src/lib';
import { createParticipant as createCoreParticipant, type ParticipantConfig, type PlatformAdapter, type DataPublisher, type OrderedTopicPublisher } from '@pulsebeam/core';
import { MOCK_CONFIG } from './test-data';
import { normalizeStatsReport, type QoeSnapshot } from '../utils/qoe';

// ── Stats-capturing adapter ────────────────────────────────────────────────
// The SDK keeps its RTCPeerConnection private, so we reach getStats() through the
// PlatformAdapter seam: wrap BrowserAdapter's RTCPeerConnection to record every
// instance the SDK creates (a fresh one is built per reconnect). getStats() then
// reads from the most-recently-connected pc. Zero production-code changes.
const capturedPCs: RTCPeerConnection[] = [];
const BasePC = BrowserAdapter.RTCPeerConnection;
class CapturingPC extends (BasePC as { new(config?: RTCConfiguration): RTCPeerConnection }) {
  constructor(config?: RTCConfiguration) {
    super(config);
    capturedPCs.push(this as unknown as RTCPeerConnection);
  }
}
const statsAdapter: PlatformAdapter = {
  ...BrowserAdapter,
  RTCPeerConnection: CapturingPC as unknown as PlatformAdapter['RTCPeerConnection'],
  // Diagnostic: surface non-2xx handshake bodies (the SDK discards them). Test-only.
  fetch: async (input: string, init?: RequestInit) => {
    const res = await BrowserAdapter.fetch(input, init);
    if (!res.ok) {
      try {
        const body = await res.clone().text();
        console.error(`[Harness fetch] ${init?.method ?? 'GET'} ${input} -> ${res.status}: ${body}`);
      } catch { /* ignore */ }
    }
    return res;
  },
};

/** The live pc for stats: prefer a connected one, else the most recent. */
function activePC(): RTCPeerConnection | null {
  const live = [...capturedPCs].reverse().find(
    (pc) => pc.connectionState === 'connected' || pc.connectionState === 'connecting',
  );
  return live ?? capturedPCs[capturedPCs.length - 1] ?? null;
}

// Global state
let participant: any = null;
let deviceManager: any = null;
let displayManager: any = null;
let publishedStream: MediaStream | null = null;
let videoBinders: Map<string, any> = new Map();
let audioBinders: Map<string, any> = new Map();

// Topic pub/sub state — publishers and received-data buffers survive across pbCreate
// because they are reset inside pbCreate/pbClose.
const topicPublishers = new Map<string, DataPublisher | OrderedTopicPublisher>();
const topicReceivedData = new Map<string, number[][]>();

// DOM elements
const connectionStateEl = document.getElementById('connection-state')!;
const videoTrackCountEl = document.getElementById('video-track-count')!;
const audioTrackCountEl = document.getElementById('audio-track-count')!;
const videoMutedEl = document.getElementById('video-muted')!;
const audioMutedEl = document.getElementById('audio-muted')!;
const roomInputEl = document.getElementById('room-input') as HTMLInputElement;
const joinButtonEl = document.getElementById('join-button')!;
const leaveButtonEl = document.getElementById('leave-button')!;
const toggleVideoButtonEl = document.getElementById('toggle-video-button')!;
const toggleAudioButtonEl = document.getElementById('toggle-audio-button')!;
const shareScreenButtonEl = document.getElementById('share-screen-button')!;
const videoGridEl = document.getElementById('video-grid')!;
const audioTracksEl = document.getElementById('audio-tracks')!;

// Initialize participant with default config
function initParticipant(config: ParticipantConfig = MOCK_CONFIG) {
  participant = createCoreParticipant(statsAdapter, config);
  deviceManager = createDeviceManager();
  displayManager = createDisplayManager();

  // Subscribe to state changes
  participant.subscribe((state: any) => {
    console.log('[TestApp] State Update:', state);
    updateUI(state);
  });

  // Expose to window for testing
  (window as any).__testState = {
    participant,
    deviceManager,
    displayManager,
    getPublishedStream: () => publishedStream,
  };
}

// Update UI based on state
function updateUI(state: any) {
  connectionStateEl.textContent = state.connectionState;
  videoTrackCountEl.textContent = state.videoTracks.length.toString();
  audioTrackCountEl.textContent = state.audioTracks.length.toString();
  videoMutedEl.textContent = state.main.videoMuted.toString();
  audioMutedEl.textContent = state.main.audioMuted.toString();

  // Update button visibility
  const isLive = !['new', 'disconnected', 'closed'].includes(state.connectionState);
  joinButtonEl.style.display = isLive ? 'none' : 'inline-block';
  leaveButtonEl.style.display = isLive ? 'inline-block' : 'none';
  toggleVideoButtonEl.style.display = isLive ? 'inline-block' : 'none';
  toggleAudioButtonEl.style.display = isLive ? 'inline-block' : 'none';
  shareScreenButtonEl.style.display = isLive ? 'inline-block' : 'none';
  roomInputEl.disabled = isLive;

  // Update mute button labels
  toggleVideoButtonEl.textContent = state.main.videoMuted ? 'Unmute Video' : 'Mute Video';
  toggleAudioButtonEl.textContent = state.main.audioMuted ? 'Unmute Audio' : 'Mute Audio';

  // Render video tracks
  renderVideoTracks(state.videoTracks);
  renderAudioTracks(state.audioTracks);

  // Update window state for testing
  if ((window as any).__testState) {
    (window as any).__testState.connectionState = state.connectionState;
    (window as any).__testState.videoMuted = state.main.videoMuted;
    (window as any).__testState.audioMuted = state.main.audioMuted;
    (window as any).__testState.videoTrackCount = state.videoTracks.length;
    (window as any).__testState.audioTrackCount = state.audioTracks.length;
    (window as any).__testState.publishedStream = publishedStream;
  }
}

// Render video tracks
function renderVideoTracks(tracks: any[]) {
  // Remove tracks that no longer exist
  const currentIds = new Set(tracks.map(t => t.id));
  for (const [id, binder] of videoBinders.entries()) {
    if (!currentIds.has(id)) {
      binder.unmount();
      videoBinders.delete(id);
      const container = document.querySelector(`[data-track-id="${id}"]`);
      if (container) container.remove();
    }
  }

  // Add or update tracks
  for (const track of tracks) {
    if (!videoBinders.has(track.id)) {
      const container = document.createElement('div');
      container.className = 'video-container';
      container.setAttribute('data-testid', `video-track-${track.id}`);
      container.setAttribute('data-track-id', track.id);
      container.setAttribute('data-participant-id', track.participantId);

      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;

      const label = document.createElement('span');
      label.className = 'participant-label';
      label.textContent = track.participantId;

      container.appendChild(video);
      container.appendChild(label);
      videoGridEl.appendChild(container);

      const binder = new VideoBinder(video, track);
      binder.mount();
      videoBinders.set(track.id, binder);
    }
  }
}

// Render audio tracks
function renderAudioTracks(tracks: any[]) {
  // Remove tracks that no longer exist
  const currentIds = new Set(tracks.map(t => t.id));
  for (const [id, binder] of audioBinders.entries()) {
    if (!currentIds.has(id)) {
      binder.unmount();
      audioBinders.delete(id);
      const audio = document.querySelector(`[data-audio-id="${id}"]`);
      if (audio) audio.remove();
    }
  }

  // Add or update tracks
  for (const track of tracks) {
    if (!audioBinders.has(track.id)) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('data-testid', `audio-track-${track.id}`);
      audio.setAttribute('data-audio-id', track.id);
      audioTracksEl.appendChild(audio);

      const binder = new AudioBinder(audio, track);
      binder.mount();
      audioBinders.set(track.id, binder);
    }
  }
}

// Event handlers
async function handleJoin() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true,
    });
    publishedStream = stream;
    console.log('[TestApp] Publishing stream');
    participant.get().main.publish(stream);
    console.log('[TestApp] Connecting to room:', roomInputEl.value);
    participant.get().connect(roomInputEl.value);
  } catch (error) {
    console.error('Failed to join:', error);
  }
}

function handleLeave() {
  participant.get().close();
  if (publishedStream) {
    publishedStream.getTracks().forEach(track => track.stop());
    publishedStream = null;
  }
}

function handleToggleVideo() {
  const currentState = participant.get();
  console.log('[TestApp] Toggling video from:', currentState.videoMuted);
  participant.get().main.mute({ video: !currentState.main.videoMuted });
}

function handleToggleAudio() {
  const currentState = participant.get();
  participant.get().main.mute({ audio: !currentState.main.audioMuted });
}

async function handleShareScreen() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    publishedStream = stream;
    participant.get().aux.publish(stream, { videoPreset: 'detail' });
  } catch (error) {
    console.error('Failed to share screen:', error);
  }
}

// Attach event listeners
joinButtonEl.addEventListener('click', handleJoin);
leaveButtonEl.addEventListener('click', handleLeave);
toggleVideoButtonEl.addEventListener('click', handleToggleVideo);
toggleAudioButtonEl.addEventListener('click', handleToggleAudio);
shareScreenButtonEl.addEventListener('click', handleShareScreen);

// Initialize on load
initParticipant();

// Expose init function for testing
(window as any).__initParticipant = initParticipant;

// ── Imperative harness API (window.__pb) ────────────────────────────────────
// The stable contract for E2E tests: drives @pulsebeam/core directly, never the
// demo UI. Every method returns structured-cloneable JSON so `page.evaluate` can
// read it back. Remote tracks are still rendered via VideoBinder/AudioBinder
// (renderVideoTracks/renderAudioTracks) so real decoding happens and inbound
// getStats() advances.

interface PublishOpts { video?: boolean; audio?: boolean; }
interface SubscribeOpts { height?: number; minHeight?: number; priority?: number; }

async function pbCreate(config: Partial<ParticipantConfig> = {}) {
  if (participant) {
    try { participant.get().close(); } catch { /* already closed */ }
  }
  if (publishedStream) {
    publishedStream.getTracks().forEach((t) => t.stop());
    publishedStream = null;
  }
  topicPublishers.clear();
  topicReceivedData.clear();
  capturedPCs.length = 0;
  initParticipant({ ...MOCK_CONFIG, ...config } as ParticipantConfig);
}

async function pbPublish(opts: PublishOpts = { video: true, audio: true }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: opts.video ? { width: 1280, height: 720 } : false,
    audio: opts.audio ?? false,
  });
  publishedStream = stream;
  participant.get().main.publish(stream);
}

function pbUnpublish() {
  participant.get().main.unpublish();
  if (publishedStream) {
    publishedStream.getTracks().forEach((t) => t.stop());
    publishedStream = null;
  }
}

function pbConnect(room: string) {
  participant.get().connect(room);
}

function pbClose() {
  participant.get().close();
  if (publishedStream) {
    publishedStream.getTracks().forEach((t) => t.stop());
    publishedStream = null;
  }
}

function pbMute(opts: { video?: boolean; audio?: boolean }) {
  participant.get().main.mute(opts);
}

/** Explicitly subscribe to a discovered publisher's video track(s) at a height. */
function pbSubscribe(participantId: string, opts: SubscribeOpts = {}): number {
  const tracks = (participant.get().videoTracks as any[]).filter(
    (t) => t.participantId === participantId,
  );
  for (const t of tracks) {
    if (opts.height !== undefined) t.setHeight(opts.height);
    if (opts.minHeight !== undefined) t.setMinHeight(opts.minHeight);
    if (opts.priority !== undefined) t.setPriority(opts.priority);
  }
  return tracks.length;
}

function pbGetState() {
  const s = participant.get();
  return {
    connectionState: s.connectionState as string,
    videoTracks: (s.videoTracks as any[]).map((t) => ({
      id: t.id, participantId: t.participantId, height: t.height, paused: t.paused,
    })),
    audioTracks: (s.audioTracks as any[]).map((t) => ({ id: t.id })),
    videoMuted: s.main.videoMuted as boolean,
    audioMuted: s.main.audioMuted as boolean,
  };
}

async function pbGetStats(): Promise<QoeSnapshot> {
  const pc = activePC();
  const connectionState = participant?.get()?.connectionState ?? 'new';
  if (!pc) {
    return { connectionState, inboundVideo: [], inboundAudio: [], outboundVideo: [], outboundAudio: [] };
  }
  return normalizeStatsReport(await pc.getStats(), connectionState);
}

/**
 * Declare a topic publisher and/or subscriber on the current participant.
 * `mode: 'latest'` = unreliable/fire-and-forget; `mode: 'ordered'` = reliable+NACK.
 * Received payloads accumulate in `getReceivedData(name)`.
 */
function pbDeclareTopic(name: string, mode: 'latest' | 'ordered') {
  const raw = participant.get().participant;
  const t = raw.topic(name);

  // Publisher
  const pub = mode === 'ordered' ? t.publisher().ordered() : t.publisher().latest();
  topicPublishers.set(name, pub);

  // Subscriber — collect received payloads
  if (!topicReceivedData.has(name)) topicReceivedData.set(name, []);
  const buf = topicReceivedData.get(name)!;
  const sub = mode === 'ordered' ? t.subscriber().ordered() : t.subscriber().latest();

  if (mode === 'ordered') {
    (async () => {
      for await (const delivery of sub as AsyncIterable<any>) {
        if (delivery.type === 'message') {
          buf.push(Array.from(delivery.payload as Uint8Array));
        }
      }
    })().catch(() => { /* closed */ });
  } else {
    (async () => {
      for await (const payload of sub as AsyncIterable<Uint8Array>) {
        buf.push(Array.from(payload));
      }
    })().catch(() => { /* closed */ });
  }
}

function pbPublishData(name: string, payload: number[]) {
  const pub = topicPublishers.get(name);
  if (!pub) throw new Error(`No publisher for topic: ${name}`);
  pub.send(new Uint8Array(payload));
}

function pbGetReceivedData(name: string): number[][] {
  return topicReceivedData.get(name) ?? [];
}

function pbClearReceivedData(name: string) {
  topicReceivedData.set(name, []);
}

(window as any).__pb = {
  create: pbCreate,
  connect: pbConnect,
  publish: pbPublish,
  unpublish: pbUnpublish,
  close: pbClose,
  mute: pbMute,
  subscribe: pbSubscribe,
  getState: pbGetState,
  getStats: pbGetStats,
  declareTopic: pbDeclareTopic,
  publishData: pbPublishData,
  getReceivedData: pbGetReceivedData,
  clearReceivedData: pbClearReceivedData,
};
