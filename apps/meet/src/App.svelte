<script lang="ts">
  import { onMount } from "svelte";
  import "./app.css";
  import { Participant, type ParticipantEvent } from "./lib/web";

  let stream = $state<MediaStream>();
  let state = $state<ParticipantEvent>({ type: "new" });

  let participant = new Participant({
    videoSlots: 16,
    audioSlots: 3,
  });

  participant.onEvent = (e) => (state = e);

  onMount(async () => {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    participant.publish(stream);
  });

  async function handleConnect() {
    await participant.connect("http://localhost:3000", "demo");
  }
</script>

{#if !stream}
  <h1>Initializing</h1>
{:else}
  <video srcobject={stream} autoplay width="640" height="480"></video>

  {#if state.type === "connected"}
    <div>Connected</div>
  {:else}
    <button onclick={handleConnect}>Connect</button>
  {/if}
{/if}
