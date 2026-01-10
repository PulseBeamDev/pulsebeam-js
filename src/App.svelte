<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  // Assuming these are in the same directory or accessible via paths
  import { Session, type VirtualSlot } from "./lib";

  // --- State Management ---
  let session: Session;
  let status: "new" | "connecting" | "connected" | "closed" = "new";
  let error: string | null = null;
  let roomId = "creative-collab";
  let localStream: MediaStream | null = null;
  let slots: VirtualSlot[] = [];

  // --- Lifecycle & Library Logic ---
  onMount(() => {
    session = new Session({ videoSlots: 12, audioSlots: 12 });

    session.onEvent = (event) => {
      if (event.type === "connecting") status = "connecting";
      if (event.type === "connected") status = "connected";
      if (event.type === "closed") {
        status = "closed";
        error = event.error?.message || "Connection lost";
      }
      if (event.type === "slot_added") {
        slots = [...slots, event.slot];
      }
      if (event.type === "slot_removed") {
        slots = slots.filter((s) => s.id !== event.slotId);
      }
    };
  });

  async function join() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      session.publish(localStream);
      session.connect("https://your-sfu-endpoint.com", roomId);
    } catch (e) {
      error = "Camera/Mic access denied";
    }
  }

  function leave() {
    session?.close();
    localStream?.getTracks().forEach((t) => t.stop());
    location.reload(); // Simplest way to reset state
  }

  // --- Action for Video Elements ---
  // This handles both the stream binding and the SFU height reporting
  function videoContainer(node: HTMLElement, slot: VirtualSlot | null) {
    const video = node.querySelector("video") as HTMLVideoElement;

    if (slot) {
      video.srcObject = slot.stream;
      const obs = new ResizeObserver((entries) => {
        for (let entry of entries) {
          slot.setHeight(entry.contentRect.height);
        }
      });
      obs.observe(node);
      return { destroy: () => obs.disconnect() };
    } else if (localStream) {
      video.srcObject = localStream;
    }
  }
</script>

<main class="app-container">
  {#if status === "new" || status === "closed"}
    <div class="hero">
      <div class="badge">v1.0 Stable</div>
      <h1>Minimal Meeting</h1>
      <p>Clean, lightweight, and end-to-end encrypted.</p>

      <div class="join-box">
        <input type="text" bind:value={roomId} placeholder="Enter Room ID" />
        <button on:click={join} class="btn-primary">
          {status === "new" ? "Joining..." : "Join Room"}
        </button>
      </div>
      {#if error}<p class="error-text">{error}</p>{/if}
    </div>
  {:else}
    <div class="view-viewport">
      <header class="room-header">
        <div class="room-info">
          <span class="dot" class:live={status === "connected"}></span>
          <span class="room-id">{roomId}</span>
        </div>
        <div class="count">{slots.length + 1} Participants</div>
      </header>

      <div class="video-grid" class:single={slots.length === 0}>
        <div class="video-tile" use:videoContainer={null}>
          <video autoplay playsinline muted class="mirrored"></video>
          <div class="label">You</div>
        </div>

        {#each slots as slot (slot.id)}
          <div class="video-tile" use:videoContainer={slot}>
            <video autoplay playsinline></video>
            <div class="label">User {slot.id.slice(0, 4)}</div>
          </div>
        {/each}
      </div>

      <footer class="controls">
        <div class="glass-bar">
          <button class="icon-btn" title="Toggle Mic">
            <svg viewBox="0 0 24 24" width="20" fill="currentColor"
              ><path
                d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
              /><path
                d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
              /></svg
            >
          </button>
          <button class="icon-btn" title="Toggle Camera">
            <svg viewBox="0 0 24 24" width="20" fill="currentColor"
              ><path
                d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
              /></svg
            >
          </button>
          <div class="divider"></div>
          <button class="icon-btn danger" on:click={leave} title="Leave">
            <svg viewBox="0 0 24 24" width="20" fill="currentColor"
              ><path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z"
              /></svg
            >
          </button>
        </div>
      </footer>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family:
      "Inter",
      -apple-system,
      sans-serif;
    background: #fafafa;
    color: #1a1a1a;
  }

  .app-container {
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* --- Hero / Setup Styles --- */
  .hero {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 2rem;
  }

  .badge {
    background: #e5e7eb;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  h1 {
    font-size: 3rem;
    margin: 0;
    letter-spacing: -2px;
  }
  p {
    color: #666;
    margin-bottom: 2rem;
  }

  .join-box {
    display: flex;
    gap: 10px;
    background: white;
    padding: 8px;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
    border: 1px solid #eee;
  }

  input {
    border: none;
    padding: 12px 16px;
    font-size: 1rem;
    outline: none;
    width: 200px;
  }

  .btn-primary {
    background: #000;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  /* --- Video Grid Styles --- */
  .view-viewport {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
    gap: 20px;
  }

  .room-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .room-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }

  .dot {
    width: 8px;
    height: 8px;
    background: #ccc;
    border-radius: 50%;
  }
  .dot.live {
    background: #10b981;
    box-shadow: 0 0 10px #10b981;
  }

  .video-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 16px;
  }

  .video-grid.single {
    grid-template-columns: 1fr;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  }

  .video-tile {
    background: #000;
    border-radius: 24px;
    position: relative;
    overflow: hidden;
    aspect-ratio: 16 / 9;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .mirrored {
    transform: scaleX(-1);
  }

  .label {
    position: absolute;
    bottom: 16px;
    left: 16px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 4px 12px;
    border-radius: 8px;
    font-size: 13px;
    backdrop-filter: blur(8px);
  }

  /* --- Controls --- */
  .controls {
    display: flex;
    justify-content: center;
    padding-bottom: 20px;
  }

  .glass-bar {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(0, 0, 0, 0.05);
    padding: 10px 20px;
    border-radius: 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  }

  .icon-btn {
    background: none;
    border: none;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #444;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #000;
  }
  .icon-btn.danger {
    color: #ef4444;
  }
  .icon-btn.danger:hover {
    background: #fee2e2;
  }

  .divider {
    width: 1px;
    height: 24px;
    background: #ddd;
    margin: 0 4px;
  }
  .error-text {
    color: #ef4444;
    font-size: 14px;
    margin-top: 10px;
  }
</style>
