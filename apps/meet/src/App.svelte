<script lang="ts">
  import { onMount } from "svelte";
  import "./app.css";
  import { Participant, ParticipantEvent } from "./lib/web";

  let stream = $state<MediaStream>();

  let participant = new Participant({
    videoSlots: 16,
    audioSlots: 3,
  });
  let state = $state(participant.state);

  participant.on(ParticipantEvent.State, (e) => (state = e));

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

  <h1>Status: {state}</h1>
  {#if state === "connected"}
    <div>Connected</div>
  {:else}
    <button onclick={handleConnect}>Connect</button>
  {/if}
{/if}
