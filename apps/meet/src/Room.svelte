<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Participant, attach } from "./lib/participant.svelte";

  const API_URL = "https://demo.pulsebeam.dev";

  let { localStream, roomId, onLeave } = $props();

  const client = new Participant({ videoSlots: 16, audioSlots: 8 });
  let screenClient = $state<Participant | null>(null);
  let errorMsg = $state<string | null>(null);

  onMount(async () => {
    try {
      client.publish(localStream);
      await client.join(API_URL, roomId);
    } catch (e: any) {
      errorMsg = e.message;
    }
  });

  onDestroy(() => {
    client.leave();
    screenClient?.leave();
  });

  async function startScreenShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      screenClient = new Participant({ videoSlots: 0, audioSlots: 0 });
      stream.getVideoTracks()[0].onended = () => stopScreenShare();
      screenClient.publish(stream);
      await screenClient.join(API_URL, roomId);
    } catch (e) {
      console.error(e);
    }
  }

  function stopScreenShare() {
    screenClient?.leave();
    screenClient = null;
  }
</script>

<nav>
  <ul>
    <li><strong>Room: {roomId}</strong></li>
  </ul>
  <ul>
    <li>
      {#if !screenClient}
        <button class="outline" onclick={startScreenShare}>Share Screen</button>
      {:else}
        <button class="outline secondary" onclick={stopScreenShare}
          >Stop Sharing</button
        >
      {/if}
    </li>
    <li><button class="contrast" onclick={onLeave}>Leave</button></li>
  </ul>
</nav>

{#if errorMsg}
  <article style="background-color: var(--pico-del-color); color: white;">
    {errorMsg}
    <footer><button class="contrast" onclick={onLeave}>Go Back</button></footer>
  </article>
{/if}

<div class="video-grid">
  <div class="video-card">
    <video srcObject={localStream} autoplay muted playsinline></video>
    <small>Me</small>
  </div>

  {#each client.videoTracks as track (track.id)}
    <div class="video-card">
      <video use:attach={track}></video>
      <small>{track.participantId}</small>
    </div>
  {/each}
</div>

{#each client.audioTracks as track}
  <audio use:attach={track}></audio>
{/each}

<style>
  .video-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--pico-spacing);
    width: 100%;
    height: 100%;
  }

  .video-card {
    position: relative;
    background: black;
    border-radius: var(--pico-border-radius);
    overflow: hidden;
    aspect-ratio: 16/9;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  small {
    position: absolute;
    bottom: 5px;
    left: 10px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
  }
</style>
