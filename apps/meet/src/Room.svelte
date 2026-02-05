<script lang="ts">
  import { createParticipant, attach } from "@pulsebeam/svelte";
  import { onMount } from "svelte";

  interface Props {
    localStream: MediaStream;
    roomId: string;
    onLeave: () => void;
  }

  // const API_URL = "https://demo.pulsebeam.dev/api/v1";
  const API_URL = "http://localhost:3000/api/v1";
  let { localStream, roomId, onLeave }: Props = $props();

  const client = createParticipant({
    videoSlots: 16,
    audioSlots: 8,
    baseUrl: API_URL,
  });

  const screenClient = createParticipant({
    videoSlots: 0,
    audioSlots: 0,
    baseUrl: API_URL,
  });

  onMount(() => {
    $client.publish(localStream);
    $client.connect(roomId);
  });

  async function startScreenShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      stream.getVideoTracks()[0].onended = () => stopScreenShare();

      $screenClient.publish(stream);
      $screenClient.connect(roomId);
    } catch (e) {
      console.error("Screen share failed:", e);
    }
  }

  function stopScreenShare() {
    $screenClient.close();
  }

  const isSharing = $derived(
    $screenClient.connectionState === "connected" ||
      $screenClient.connectionState === "connecting",
  );
</script>

<nav>
  <ul>
    <li><strong>Room: {roomId}</strong></li>
  </ul>
  <ul>
    <li>
      {#if !isSharing}
        <button class="outline" onclick={startScreenShare}>Share Screen</button>
      {:else}
        <button class="outline secondary" onclick={stopScreenShare}
          >Stop Sharing</button
        >
      {/if}
    </li>
    <li><button class="contrast" onclick={onLeave}>Leave</button></li>
    <li>
      <button onclick={() => $client.connect(roomId)}>Reconnect</button>
    </li>
  </ul>
</nav>

{#if $client.connectionState !== "connected"}
  <span aria-busy="true">{$client.connectionState}</span>
{/if}

<div class="video-grid">
  <div class="video-card">
    <video srcObject={localStream} autoplay muted playsinline>
      <track kind="captions" />
    </video>
    <small>Me</small>
  </div>

  {#each $client.videoTracks as track (track.id)}
    <div class="video-card">
      <video use:attach={track} autoplay playsinline muted>
        <track kind="captions" />
      </video>
      <small>{track.participantId}</small>
    </div>
  {/each}
</div>

{#each $client.audioTracks as track (track.id)}
  <audio use:attach={track}></audio>
{/each}
