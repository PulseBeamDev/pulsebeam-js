<script lang="ts">
  import { onMount } from "svelte";
  import { Session, type VirtualSlot } from "./lib";

  let stream = $state<MediaStream | null>(null);

  async function getCamera() {
    stream = await navigator.mediaDevices.getUserMedia({
      video: true,
    });
  }

  onMount(async () => {
    await getCamera();
  });
</script>

<div>
  {#if stream}
    <video srcobject={stream} autoplay width="640" height="480"> </video>
  {/if}
  <button class="">Get Started</button>
</div>
