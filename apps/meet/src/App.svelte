<script lang="ts">
  import { onMount } from "svelte";
  import "./app.css";
  import { WebSession } from "./lib/web";
  import type { DeviceState } from "./lib/web";

  let stream = $state<MediaStream>();
  let devices = $state<DeviceState>();

  let session = new WebSession({
    videoSlots: 16,
    audioSlots: 3,
  });

  session.devices.subscribe((state) => {
    devices = state;
  });

  onMount(async () => {
    await session.devices.init();
    await session.devices.enableCamera();
  });
</script>

{#if !devices}
  <h1>Initializing</h1>
{:else}
  <div>{devices.isScanning}</div>
  <div>{JSON.stringify(devices)}</div>
{/if}
