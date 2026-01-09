<script setup lang="ts">
import { ref, reactive, onBeforeUnmount, nextTick } from "vue";
import { Session, VirtualSlot, type SessionEvent } from "./lib";

// --- State ---
const session = ref<Session | null>(null);
const status = ref("Ready");
const isConnected = ref(false);
const isConnecting = ref(false);

const localVideo = ref<HTMLVideoElement | null>(null);
const remoteSlots = reactive<VirtualSlot[]>([]);

const controls = reactive({
  mic: true,
  cam: true,
  screen: false,
});

// --- Resize Observer (Signaling Trigger) ---
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const vSlot = (entry.target as any).__vSlot as VirtualSlot;
    if (vSlot) {
      vSlot.setHeight(entry.contentRect.height * window.devicePixelRatio);
    }
  }
});

// --- Actions ---
async function joinRoom() {
  if (isConnecting.value) return;
  isConnecting.value = true;
  status.value = "Connecting...";

  try {
    session.value = new Session({ videoSlots: 12, audioSlots: 3 });

    session.value.onEvent = (e: SessionEvent) => {
      if (e.type === "connected") {
        isConnected.value = true;
        status.value = "Live";
        startCamera();
      } else if (e.type === "closed") {
        leaveRoom();
      } else if (e.type === "track_added") {
        const vSlot = session.value!.getVirtualSlot(e.trackId);
        if (!remoteSlots.includes(vSlot)) remoteSlots.push(vSlot);
      } else if (e.type === "track_removed") {
        const idx = remoteSlots.findIndex((v: any) => v.trackId === e.trackId);
        if (idx !== -1) remoteSlots.splice(idx, 1);
      }
    };

    await session.value.connect("http://localhost:3000", "demo");
  } catch (e) {
    console.error(e);
    status.value = "Connection Failed";
    isConnecting.value = false;
  }
}

function leaveRoom() {
  session.value?.close();
  resizeObserver.disconnect();
  remoteSlots.splice(0);
  
  if (localVideo.value?.srcObject) {
    (localVideo.value.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    localVideo.value.srcObject = null;
  }

  session.value = null;
  isConnected.value = false;
  isConnecting.value = false;
  controls.screen = false;
  status.value = "Ready";
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true
    });
    session.value?.publish(stream);
    
    if (localVideo.value) {
      localVideo.value.srcObject = stream;
      localVideo.value.muted = true;
    }
  } catch (e) {
    console.error("Media error", e);
  }
}

async function toggleScreen() {
  if (!session.value) return;
  if (controls.screen) {
    // Revert to camera
    await startCamera();
    controls.screen = false;
  } else {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      session.value.publish(stream);
      if (localVideo.value) {
        localVideo.value.srcObject = stream;
      }
      controls.screen = true;
      // Handle user stopping share via browser UI
      stream.getVideoTracks()[0].onended = () => toggleScreen(); 
    } catch (e) {
      console.error(e);
    }
  }
}

// Vue Ref Binding
const bindRemote = (el: any, vSlot: VirtualSlot) => {
  if (!el) return;
  el.__vSlot = vSlot;
  if (el.srcObject !== vSlot.stream) el.srcObject = vSlot.stream;
  resizeObserver.observe(el);
};

onBeforeUnmount(leaveRoom);
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header>
      <div class="brand">
        <div class="logo"></div>
        <span>PulseBeam</span>
      </div>
      <div class="status-badge" :class="{ live: isConnected, error: status.includes('Failed') }">
        <div class="dot"></div>
        {{ status }}
      </div>
    </header>

    <!-- Lobby View -->
    <div v-if="!isConnected" class="lobby">
      <div class="card">
        <h2>Join Meeting</h2>
        <p>Enter the demo room to start streaming.</p>
        <button @click="joinRoom" :disabled="isConnecting">
          {{ isConnecting ? 'Connecting...' : 'Join Room' }}
        </button>
      </div>
    </div>

    <!-- Active Room View -->
    <div v-else class="room">
      <div class="grid">
        <!-- Local User -->
        <div class="video-tile local">
          <video ref="localVideo" autoplay playsinline muted></video>
          <div class="tile-label">You</div>
        </div>

        <!-- Remote Users -->
        <div v-for="slot in remoteSlots" :key="(slot as any).trackId" class="video-tile">
          <video :ref="el => bindRemote(el, slot)" autoplay playsinline></video>
          <div class="tile-label">User {{ (slot as any).trackId.substring(0,4) }}</div>
        </div>
      </div>

      <!-- Controls Bar -->
      <div class="controls">
        <button class="icon-btn" :class="{ active: !controls.mic }" @click="controls.mic = !controls.mic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path v-if="controls.mic" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path v-if="controls.mic" d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <path v-if="controls.mic" d="M12 19v4"/>
            <path v-if="controls.mic" d="M8 23h8"/>
            <line v-if="!controls.mic" x1="1" y1="1" x2="23" y2="23"/>
            <path v-if="!controls.mic" d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
            <path v-if="!controls.mic" d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
            <line v-if="!controls.mic" x1="12" y1="19" x2="12" y2="23"/>
            <line v-if="!controls.mic" x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>

        <button class="icon-btn" :class="{ active: !controls.cam }" @click="controls.cam = !controls.cam">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path v-if="controls.cam" d="M23 7l-7 5 7 5V7z"/>
            <rect v-if="controls.cam" x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            <path v-if="!controls.cam" d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/>
            <line v-if="!controls.cam" x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        </button>

        <button class="icon-btn" :class="{ active: controls.screen }" @click="toggleScreen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </button>

        <div class="separator"></div>

        <button class="leave-btn" @click="leaveRoom">
          Leave
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Variables */
:root {
  --bg: #0f1115;
  --surface: #1a1d21;
  --surface-hover: #24272b;
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --danger: #ef4444;
  --danger-hover: #dc2626;
  --text: #f3f4f6;
  --text-muted: #9ca3af;
}

/* Reset & Layout */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: #0f1115;
  color: #f3f4f6;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  overflow: hidden;
}

/* Header */
header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid #2d2d2d;
  background: #1a1d21;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  font-size: 18px;
}

.logo {
  width: 24px;
  height: 24px;
  background: #6366f1;
  border-radius: 6px;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #9ca3af;
  padding: 4px 12px;
  background: #24272b;
  border-radius: 99px;
}

.dot {
  width: 8px;
  height: 8px;
  background: #6b7280;
  border-radius: 50%;
}

.status-badge.live { color: #10b981; background: rgba(16, 185, 129, 0.1); }
.status-badge.live .dot { background: #10b981; box-shadow: 0 0 8px #10b981; }
.status-badge.error .dot { background: #ef4444; }

/* Lobby */
.lobby {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card {
  background: #1a1d21;
  padding: 40px;
  border-radius: 16px;
  text-align: center;
  border: 1px solid #2d2d2d;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  width: 100%;
}

.card h2 { margin-bottom: 8px; }
.card p { color: #9ca3af; margin-bottom: 24px; }

.card button {
  width: 100%;
  padding: 12px;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.card button:hover:not(:disabled) { background: #4f46e5; }
.card button:disabled { opacity: 0.7; cursor: not-allowed; }

/* Active Room */
.room {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.grid {
  flex: 1;
  padding: 24px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  grid-auto-rows: minmax(200px, 1fr);
  gap: 16px;
  overflow-y: auto;
}

.video-tile {
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  aspect-ratio: 16/9;
  border: 1px solid #2d2d2d;
}

.video-tile video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.video-tile.local video {
  transform: scaleX(-1);
}

.tile-label {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: rgba(0, 0, 0, 0.7);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

/* Controls */
.controls {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #1a1d21;
  border-top: 1px solid #2d2d2d;
}

.icon-btn {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #24272b;
  border: none;
  color: #f3f4f6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn svg { width: 20px; height: 20px; }
.icon-btn:hover { background: #323539; }

.icon-btn.active {
  background: #ef4444;
  color: white;
}

.separator {
  width: 1px;
  height: 32px;
  background: #2d2d2d;
  margin: 0 12px;
}

.leave-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0 24px;
  height: 48px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
}

.leave-btn:hover { background: #dc2626; }
</style>

