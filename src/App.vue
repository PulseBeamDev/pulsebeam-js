<script setup lang="ts">
import { ref, onBeforeUnmount } from "vue";
import { Session } from "./lib";

const session = ref<Session | null>(null);
const status = ref<string>("Not connected");

const localVideo = ref<HTMLVideoElement | null>(null);
const remoteVideos = ref<HTMLVideoElement[]>([]);
const remoteAudios = ref<HTMLAudioElement[]>([]);

const connecting = ref(false);
const connected = ref(false);
const publishing = ref(false);

function setStatus(text: string) {
  status.value = text;
  console.log("[status]", text);
}

function initSlots() {
  remoteVideos.value = Array.from(
    document.querySelectorAll<HTMLVideoElement>("video[data-remote]")
  );
  remoteAudios.value = Array.from(
    document.querySelectorAll<HTMLAudioElement>("audio[data-remote]")
  );
}

async function connect() {
  if (session.value || connecting.value) return;

  connecting.value = true;
  setStatus("Connecting...");

  try {
    initSlots();

    session.value = new Session({
      videoSlots: remoteVideos.value,
      audioSlots: remoteAudios.value,
    });

    session.value.onEvent = (e) => {
      console.log("Event:", e);
      if (e.type === "connected") setStatus("Connected");
      if (e.type === "peer-joined") setStatus(`Peer joined: ${e.peerId}`);
      if (e.type === "closed") setStatus("Disconnected");
    };

    await session.value.connect("http://localhost:3000", "demo");

    connected.value = true;
    setStatus("Connected successfully");
  } catch (err) {
    console.error(err);
    setStatus("Connection failed");
    session.value = null;
  } finally {
    connecting.value = false;
  }
}

function close() {
  if (!session.value) return;

  setStatus("Closing…");

  try {
    session.value.close();
  } catch (err) {
    console.warn("Session close error:", err);
  }

  if (localVideo.value?.srcObject instanceof MediaStream) {
    localVideo.value.srcObject.getTracks().forEach((t) => t.stop());
  }

  if (localVideo.value) localVideo.value.srcObject = null;
  remoteVideos.value.forEach((v) => (v.srcObject = null));
  remoteAudios.value.forEach((a) => (a.srcObject = null));

  session.value = null;
  connected.value = false;
  publishing.value = false;
  status.value = "Disconnected";
}

onBeforeUnmount(() => {
  close();
});

async function publishCamera() {
  await publishStream(() =>
    navigator.mediaDevices.getUserMedia({ video: { height: 720 } })
  );
}

async function publishScreen() {
  await publishStream(() =>
    navigator.mediaDevices.getDisplayMedia({ video: { height: 720 } })
  );
}

async function publishStream(getStream: () => Promise<MediaStream>) {
  if (!session.value || publishing.value) return;

  publishing.value = true;
  setStatus("Starting stream...");

  try {
    const stream = await getStream();
    session.value.publish(stream);

    if (localVideo.value) {
      localVideo.value.srcObject = stream;
      await localVideo.value.play().catch(() => {});
    }

    setStatus("Publishing stream");
  } catch (err) {
    console.error(err);
    setStatus("Streaming error");
  } finally {
    publishing.value = false;
  }
}
</script>

<template>
  <main>
    <h1>pulsebeam-js</h1>

    <div class="status">{{ status }}</div>

    <section class="video-grid">
      <div class="video-box">
        <span class="label">Local</span>
        <video ref="localVideo" data-local autoplay muted></video>
      </div>

      <div class="video-box">
        <span class="label">Remote 1</span>
        <video data-remote autoplay></video>
      </div>

      <div class="video-box">
        <span class="label">Remote 2</span>
        <video data-remote autoplay></video>
      </div>

      <audio data-remote autoplay></audio>
    </section>

    <section class="controls">
      <button v-show="!connecting && !connected" @click="connect">
        {{ connecting ? "Connecting…" : connected ? "Connected" : "Connect" }}
      </button>

      <button v-show="connecting || connected" @click="close">
        Close
      </button>

      <button :disabled="!connected || publishing" @click="publishCamera">
        Camera
      </button>

      <button :disabled="!connected || publishing" @click="publishScreen">
        Screen
      </button>
    </section>
  </main>
</template>

<style scoped>
main {
  max-width: 900px;
  margin: 2rem auto;
  display: grid;
  gap: 1.5rem;
}

.status {
  padding: 0.5rem;
  background: var(--pico-muted-border);
  border-radius: 0.3rem;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.video-box {
  position: relative;
}

video {
  width: 100%;
  background: black;
  border-radius: 0.5rem;
}

.label {
  position: absolute;
  top: 0.4rem;
  left: 0.4rem;
  padding: 0.15rem 0.4rem;
  font-size: 0.75rem;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  border-radius: 0.25rem;
}

.controls {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}
</style>
