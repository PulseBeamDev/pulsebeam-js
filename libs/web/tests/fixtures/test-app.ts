import { createParticipant, createDeviceManager, createDisplayManager, VideoBinder, AudioBinder, type ParticipantConfig } from '../../src/lib';
import { MOCK_CONFIG } from './test-data';

// Global state
let participant: any = null;
let deviceManager: any = null;
let displayManager: any = null;
let publishedStream: MediaStream | null = null;
let videoBinders: Map<string, any> = new Map();
let audioBinders: Map<string, any> = new Map();

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
    participant = createParticipant(config);
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
    videoMutedEl.textContent = state.videoMuted.toString();
    audioMutedEl.textContent = state.audioMuted.toString();

    // Update button visibility
    const isLive = !['new', 'disconnected', 'closed'].includes(state.connectionState);
    joinButtonEl.style.display = isLive ? 'none' : 'inline-block';
    leaveButtonEl.style.display = isLive ? 'inline-block' : 'none';
    toggleVideoButtonEl.style.display = isLive ? 'inline-block' : 'none';
    toggleAudioButtonEl.style.display = isLive ? 'inline-block' : 'none';
    shareScreenButtonEl.style.display = isLive ? 'inline-block' : 'none';
    roomInputEl.disabled = isLive;

    // Update mute button labels
    toggleVideoButtonEl.textContent = state.videoMuted ? 'Unmute Video' : 'Mute Video';
    toggleAudioButtonEl.textContent = state.audioMuted ? 'Unmute Audio' : 'Mute Audio';

    // Render video tracks
    renderVideoTracks(state.videoTracks);
    renderAudioTracks(state.audioTracks);

    // Update window state for testing
    if ((window as any).__testState) {
        (window as any).__testState.connectionState = state.connectionState;
        (window as any).__testState.videoMuted = state.videoMuted;
        (window as any).__testState.audioMuted = state.audioMuted;
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
        participant.get().publish(stream);
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
    participant.get().mute({ video: !currentState.videoMuted });
}

function handleToggleAudio() {
    const currentState = participant.get();
    participant.get().mute({ audio: !currentState.audioMuted });
}

async function handleShareScreen() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        publishedStream = stream;
        participant.get().publish(stream, 'screen');
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
