<script lang="ts">
  import { onMount } from "svelte";

  let { localStream = $bindable(), onJoin } = $props();

  let roomId = $state("");
  let errorMsg = $state<string | null>(null);

  onMount(async () => {
    if (!localStream) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { height: 720 },
          audio: true,
        });
      } catch (e: any) {
        errorMsg = e.message;
      }
    }
  });
</script>

<article>
  <header>Join Room</header>

  {#if errorMsg}
    <p style="color: var(--pico-del-color)">{errorMsg}</p>
  {/if}

  {#if localStream}
    <video srcObject={localStream} autoplay muted playsinline></video>
  {:else}
    <div aria-busy="true">Requesting Camera...</div>
  {/if}

  <form
    onsubmit={(e) => {
      e.preventDefault();
      if (roomId && localStream) onJoin(roomId);
    }}
  >
    <fieldset>
      <input type="text" bind:value={roomId} placeholder="Room ID" required />
      <button disabled={!localStream}>Join</button>
    </fieldset>
  </form>
</article>

<style>
  article {
    max-width: 400px;
    margin: auto;
  }
  video {
    width: 100%;
    border-radius: var(--pico-border-radius);
    margin-bottom: var(--pico-spacing);
    background: black;
  }
</style>
