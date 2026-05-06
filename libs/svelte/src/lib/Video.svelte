<script lang="ts">
  import { onDestroy } from "svelte";
  import { type RemoteVideoTrack } from "./participant.svelte.ts";
  import { PAUSED_PLACEHOLDER_SVG } from "@pulsebeam/web";

  export let track: RemoteVideoTrack | null = null;
  export let className = "";
  export let style = "";

  let paused = false;
  let previousTrack: RemoteVideoTrack | null = null;

  $: if (track !== previousTrack) {
    if (previousTrack) {
      previousTrack.onPausedChange = undefined;
    }

    previousTrack = track;

    if (track) {
      paused = track.paused;
      track.onPausedChange = (value: boolean) => {
        paused = value;
      };
    } else {
      paused = false;
    }
  }

  onDestroy(() => {
    if (previousTrack) {
      previousTrack.onPausedChange = undefined;
    }
  });
</script>

<div class={className} style={`position:relative;${style}`}>
  {#if track}
    <video>
      use:attach={track}
      style={`width:100%;height:100%;opacity:${paused ? 0 : 1};transition:opacity 120ms ease`}
    </video>
  {/if}

  {#if paused}
    <div
      style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background-color:#1a1a1a;pointer-events:none;"
    >
      <img
        src={PAUSED_PLACEHOLDER_SVG}
        alt="Paused placeholder"
        aria-hidden="true"
        style="opacity:0.5;height:100%"
      />
    </div>
  {/if}
</div>
