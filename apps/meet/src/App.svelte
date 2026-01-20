<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    Participant,
    ParticipantEvent,
    binder,
    RemoteTrack,
  } from "./lib/svelte";

  const participant = new Participant({ videoSlots: 16, audioSlots: 3 });

  let state = $state(participant.state);
  let participantId = $state<string>();
  let tracks = $state<RemoteTrack[]>([]);

  const cleanup = [
    participant.on(ParticipantEvent.State, (s) => (state = s)),
    participant.on(ParticipantEvent.TrackAdded, ({ track }) =>
      tracks.push(track),
    ),
    participant.on(ParticipantEvent.TrackRemoved, ({ trackId }) => {
      tracks = tracks.filter((t) => t.id !== trackId);
    }),
  ];

  onDestroy(() => cleanup.forEach((off) => off()));

  const streamPromise = navigator.mediaDevices
    .getUserMedia({ video: { height: 720 }, audio: true })
    .then((stream) => {
      participant.publish(stream);
      return stream;
    });

  async function connect() {
    try {
      participantId = await participant.connect(
        "http://localhost:3000",
        "demo",
      );
    } catch (e) {
      console.error(e);
    }
  }
</script>

<main class="container">
  {#await streamPromise}
    <article aria-busy="true">Initializing Camera...</article>
  {:then localStream}
    <div class="grid">
      <article>
        <header><strong>Local ({participantId || "You"})</strong></header>
        <video srcObject={localStream} autoplay muted></video>
      </article>

      <article>
        <header>
          <strong>Status: {state}</strong>
        </header>

        {#if state === "connected"}
          <div class="video-grid">
            {#each tracks as track (track.id)}
              <div class="remote-video">
                <video use:binder={track} autoplay playsinline></video>
                <small>{track.participantId}</small>
              </div>
            {/each}
          </div>
        {:else if state === "closed" || participant.error}
          <div class="headings">
            <h4 style="color: var(--pico-del-color)">Error</h4>
            <p>{participant.error || "Connection closed"}</p>
            <button onclick={connect} class="contrast">Retry</button>
          </div>
        {:else}
          <button
            onclick={connect}
            aria-busy={state === "connecting"}
            disabled={state === "connecting"}
          >
            {state === "connecting" ? "Connecting..." : "Join Room"}
          </button>
        {/if}
      </article>
    </div>
  {:catch err}
    <article>
      <header style="color: var(--pico-del-color)">
        <strong>Camera Error</strong>
      </header>
      {err.message}
    </article>
  {/await}
</main>

<style>
  video {
    width: 100%;
    border-radius: var(--pico-border-radius);
    background: #000;
  }

  .video-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }
</style>
