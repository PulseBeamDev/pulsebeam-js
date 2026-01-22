<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    Participant,
    ParticipantEvent,
    binder,
    type RemoteTrack,
  } from "./lib/svelte";

  const API_URL = "https://demo.pulsebeam.dev";

  let page = $state<"lobby" | "room">("lobby");
  let roomId = $state<string>();
  let isBusy = $state(false);
  let errorMsg = $state<string | null>(null);

  let localStream = $state<MediaStream | null>(null);
  let activeParticipant = $state<Participant | null>(null);
  let connectionState = $state("disconnected");
  let tracks = $state<RemoteTrack[]>([]);

  onMount(async () => {
    try {
      isBusy = true;
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { height: 720, aspectRatio: 16 / 9 },
        audio: true,
      });
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      isBusy = false;
    }
  });

  onDestroy(() => {
    activeParticipant?.close();
  });

  async function join() {
    if (!roomId || !localStream) return;
    isBusy = true;
    errorMsg = null;

    try {
      const p = new Participant({ videoSlots: 16, audioSlots: 3 });

      p.on(ParticipantEvent.State, (s) => (connectionState = s));
      p.on(ParticipantEvent.TrackAdded, ({ track }) => tracks.push(track));
      p.on(ParticipantEvent.TrackRemoved, ({ trackId }) => {
        tracks = tracks.filter((t) => t.id !== trackId);
      });

      p.publish(localStream);
      await p.connect(API_URL, roomId);

      activeParticipant = p;
      page = "room";
    } catch (e: any) {
      errorMsg = e.message;
      activeParticipant?.close();
      activeParticipant = null;
    } finally {
      isBusy = false;
    }
  }

  function leave() {
    activeParticipant?.close();
    activeParticipant = null;
    tracks = [];
    connectionState = "disconnected";
    page = "lobby";
  }
</script>

<main class="container-fluid">
  {#if errorMsg}
    <div class="error-toast">
      {errorMsg}
      <button onclick={() => (errorMsg = null)}>✕</button>
    </div>
  {/if}

  {#if page === "lobby"}
    <div class="center-wrapper">
      <article class="lobby-card">
        <header><h3>Join Meeting</h3></header>

        <div class="video-preview">
          {#if localStream}
            <video srcObject={localStream} autoplay muted playsinline></video>
            <span class="badge">Preview</span>
          {:else}
            <div class="placeholder">
              {isBusy ? "Initializing..." : "No Camera"}
            </div>
          {/if}
        </div>

        <footer>
          <form
            onsubmit={(e) => {
              e.preventDefault();
              join();
            }}
          >
            <fieldset>
              <input
                type="text"
                bind:value={roomId}
                placeholder="Room ID"
                required
                disabled={isBusy}
              />
              <button
                type="submit"
                aria-busy={isBusy}
                disabled={isBusy || !localStream}
              >
                {isBusy ? "..." : "Join"}
              </button>
            </fieldset>
          </form>
        </footer>
      </article>
    </div>
  {:else}
    <div class="room-wrapper">
      <nav>
        <ul>
          <li><strong>{roomId}</strong></li>
          <li>
            <small data-status={connectionState}>{connectionState}</small>
          </li>
        </ul>
        <ul>
          <li>
            <button class="outline contrast" onclick={leave}>Leave</button>
          </li>
        </ul>
      </nav>

      <div class="grid-gallery" data-count={tracks.length + 1}>
        <div class="video-tile">
          {#if localStream}
            <video srcObject={localStream} autoplay muted playsinline></video>
          {/if}
          <span class="badge">You</span>
        </div>

        {#each tracks as item (item.id)}
          <div class="video-tile">
            <video use:binder={item as RemoteTrack} autoplay playsinline
            ></video>
            <span class="badge">{(item as RemoteTrack).participantId}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    height: 100vh;
    overflow: hidden;
  }

  main {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0;
    position: relative;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: #000;
  }

  /* Lobby */
  .center-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--pico-background-color);
  }
  .lobby-card {
    width: 100%;
    max-width: 480px;
    padding: 0;
  }
  .video-preview {
    aspect-ratio: 16/9;
    background: #111;
    position: relative;
  }
  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #666;
  }

  /* Room */
  .room-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0f0f0f;
  }
  nav {
    padding: 0.5rem 1rem;
    background: var(--pico-card-background-color);
    border-bottom: 1px solid var(--pico-muted-border-color);
  }
  [data-status="connected"] {
    color: var(--pico-ins-color);
    text-transform: capitalize;
  }
  [data-status="disconnected"],
  [data-status="closed"] {
    color: var(--pico-del-color);
  }

  /* Flex Gallery */
  .grid-gallery {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-content: center;
    gap: 1rem;
    padding: 1rem;
    overflow-y: auto;
  }

  .video-tile {
    position: relative;
    background: #222;
    border-radius: 8px;
    overflow: hidden;
    flex: 1 1 400px;
    aspect-ratio: 16/9;
    max-width: 800px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  }

  .grid-gallery[data-count="1"] .video-tile {
    flex: 0 1 auto;
    max-width: 100%;
    max-height: 80vh;
  }
  .grid-gallery[data-count="2"] .video-tile {
    max-width: 48%;
    min-width: 300px;
  }

  .badge {
    position: absolute;
    bottom: 8px;
    left: 8px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .error-toast {
    position: absolute;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--pico-del-color);
    color: white;
    padding: 0.5rem 1rem;
    z-index: 100;
    border-radius: 4px;
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  .error-toast button {
    background: none;
    border: none;
    color: white;
    padding: 0;
    cursor: pointer;
  }
</style>
