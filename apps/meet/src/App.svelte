<script lang="ts">
  import { onMount } from "svelte";
  import { Participant, attach } from "./lib/participant.svelte";

  const API_URL = "https://demo.pulsebeam.dev";

  let page = $state<"lobby" | "room">("lobby");
  let roomId = $state<string>();
  let isBusy = $state(false);
  let errorMsg = $state<string | null>(null);
  let localStream = $state<MediaStream | null>(null);

  let participant = new Participant({ videoSlots: 16, audioSlots: 8 });

  onMount(async () => {
    try {
      isBusy = true;
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      isBusy = false;
    }
  });

  async function join() {
    if (!roomId || !localStream) return;
    isBusy = true;
    try {
      participant.publish(localStream);
      participant.join(API_URL, roomId);
      page = "room";
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      isBusy = false;
    }
  }

  function leave() {
    participant.leave();
    page = "lobby";
  }
</script>

{#if errorMsg}
  <div style="color:red">{errorMsg}</div>
{/if}

{#if page === "lobby"}
  <form
    onsubmit={(e) => {
      e.preventDefault();
      join();
    }}
  >
    {#if localStream}
      <video srcObject={localStream} autoplay muted playsinline></video>
    {/if}
    <input type="text" bind:value={roomId} placeholder="Room ID" required />
    <button disabled={isBusy || !localStream}>Join</button>
  </form>
{:else}
  <button
    onclick={leave}
    style="position: fixed; top: 10px; left: 10px; z-index: 99;">Leave</button
  >

  <div class="grid">
    {#if localStream}
      <video srcObject={localStream} autoplay muted playsinline></video>
    {/if}

    {#each participant.videoTracks as item (item.id)}
      <video use:attach={item} autoplay muted playsinline></video>
      <p>{item.participantId}</p>
    {/each}
  </div>

  {#each participant.audioTracks as item}
    <audio use:attach={item}></audio>
  {/each}
{/if}

<style>
  :global(body) {
    margin: 0;
    height: 100vh;
    overflow: hidden;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    height: 100%;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: #000;
  }
</style>
