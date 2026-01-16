<script lang="ts">
  import { onMount } from "svelte";
  import "./app.css";
  import { Participant, ParticipantEvent, binder } from "./lib/svelte";
  import type { Slot } from "@pulsebeam/core";

  let localStream = $state<MediaStream>();
  let remoteSlots = $state<Slot[]>([]);

  const participant = new Participant({
    videoSlots: 16,
    audioSlots: 3,
  });

  let connection = $state(participant.state);
  participant.on(ParticipantEvent.State, (s) => (connection = s));
  participant.on(ParticipantEvent.SlotAdded, (e) => {
    remoteSlots.push(e.slot);
  });

  participant.on(ParticipantEvent.SlotRemoved, (e) => {
    remoteSlots = remoteSlots.filter((s) => s.id !== e.slotId);
  });

  onMount(async () => {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    participant.publish(localStream);
  });

  async function handleConnect() {
    await participant.connect("http://localhost:3000", "demo");
  }
</script>

{#if !localStream}
  <h1>Initializing Camera...</h1>
{:else}
  <div class="video-layout">
    <section>
      <h2>Local (You)</h2>
      <video srcObject={localStream} autoplay muted width="320"></video>
    </section>

    <section>
      <h2>Room Status: {connection}</h2>

      {#if connection === "connected"}
        <div class="grid">
          {#each remoteSlots as slot (slot.id)}
            <div class="remote-video">
              <video use:binder={slot} autoplay playsinline></video>
              <p>{slot.id} ({slot.track.kind})</p>
            </div>
          {/each}
        </div>
      {:else if connection === "closed"}
        <p class="error">Error: {participant.error}</p>
        <button onclick={handleConnect}>Retry</button>
      {:else}
        <button onclick={handleConnect} disabled={connection === "connecting"}>
          {connection === "connecting" ? "Connecting..." : "Join Room"}
        </button>
      {/if}
    </section>
  </div>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1rem;
  }
  .remote-video video {
    width: 100%;
    background: #222;
    border-radius: 8px;
  }
  .error {
    color: red;
  }
</style>
