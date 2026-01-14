<script lang="ts">
  import "./app.css";
  import "@pulsebeam/web/components/device-selector";
  import "@pulsebeam/web/components/button";

  let stream = $state<MediaStream>();

  function handleStreamChange(e: CustomEvent<{ stream: MediaStream }>) {
    console.log("New stream:", e.detail.stream);
    stream = e.detail.stream;
  }
</script>

<div class="min-h-screen bg-slate-50 p-8 flex flex-col items-center gap-8">
  <pb-device-selector onstream-change={handleStreamChange}></pb-device-selector>

  {#if stream}
    <div class="mt-8 text-center">
      <h2 class="text-xl font-bold mb-4">Stream Result (Application State)</h2>
      <div class="w-96 aspect-video bg-black rounded shadow-lg overflow-hidden">
        <video autoplay playsinline muted srcObject={stream}></video>
      </div>
      <p class="mt-2 text-slate-500 text-sm">
        Tracks: {stream.getTracks().map(t => `${t.kind}: ${t.label}`).join(', ')}
      </p>
    </div>
  {/if}
</div>
