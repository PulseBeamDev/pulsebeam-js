<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { PulsebeamClient, type ClientStatus } from "./lib";

  let client: PulsebeamClient;
  let clientStatus: ClientStatus = "new";
  let errorMsg: string | null = null;
  let localVidTrack: MediaStreamTrack | null = null;
  let remoteVidTrack: MediaStreamTrack | null = null; // Simplification: only one remote track

  let localVideoEl: HTMLVideoElement;
  let remoteVideoEl: HTMLVideoElement;

  const sfuUrl = "http://localhost:3000";
  const roomId = "tiny-room";
  const participantId = `user-${Math.random().toString(36).slice(2, 7)}`;

  let unsubs: Array<() => void> = [];

  function setupClient() {
    if (client) client.disconnect(); // Disconnect previous if any
    client = new PulsebeamClient(sfuUrl, 1); // Max 1 downstream for simplicity

    unsubs.push(client.status.subscribe((v) => (clientStatus = v)));
    unsubs.push(client.errorMsg.subscribe((v) => (errorMsg = v)));
    unsubs.push(
      client.localVideo.subscribe((track) => {
        localVidTrack = track;
        if (localVideoEl)
          localVideoEl.srcObject = track ? new MediaStream([track]) : null;
      }),
    );
    // Simplified remote track handling: find the first video track
    unsubs.push(
      client.remoteTracks.subscribe((tracks) => {
        const firstRemote = Object.values(tracks).find(
          (rt) => rt?.kind === "video" && rt.track,
        );
        remoteVidTrack = firstRemote?.track || null;
        console.log(remoteVidTrack);
        if (remoteVideoEl)
          remoteVideoEl.srcObject = remoteVidTrack
            ? new MediaStream([remoteVidTrack])
            : null;
      }),
    );
  }

  onMount(() => {
    setupClient();
  });

  onDestroy(() => {
    unsubs.forEach((unsub) => unsub());
    client?.disconnect();
  });

  async function connect() {
    if (clientStatus === "new") await client.connect(roomId, participantId);
  }
  function disconnectAndReset() {
    unsubs.forEach((unsub) => unsub()); // Unsubscribe from old client stores
    unsubs = [];
    setupClient(); // Creates new client, status becomes 'new'
  }
  async function publish() {
    if (clientStatus !== "connected") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      await client.publish(stream.getVideoTracks()[0]);
    } catch (e) {
      client.errorMsg.set("Cam access failed");
    }
  }
  function subscribeFirstVideo() {
    if (clientStatus !== "connected") return;
    const available = client.availableTracks.get();
    const firstVid = Object.values(available).find((t) => t.kind === "video");
    if (firstVid) client.subscribe(firstVid.remoteTrackId, "video");
  }
</script>

<main>
  <div style="margin-bottom: 10px;">
    Status: <strong>{clientStatus}</strong>
    {#if errorMsg}<span style="color: red; margin-left: 10px;"
        >Error: {errorMsg}</span
      >{/if}
  </div>

  <div style="margin-bottom: 10px;">
    <button on:click={connect} disabled={clientStatus !== "new"}>Connect</button
    >
    <button on:click={disconnectAndReset} disabled={clientStatus === "new"}
      >Disconnect & Reset</button
    >
  </div>

  {#if clientStatus === "connected"}
    <div style="margin-bottom: 10px;">
      <button on:click={publish} disabled={!!localVidTrack}
        >Publish Video</button
      >
      <button on:click={subscribeFirstVideo} disabled={!!remoteVidTrack}
        >Subscribe to 1st Video</button
      >
    </div>
  {/if}

  <h1>{participantId}</h1>
  <div style="display: flex; gap: 10px;">
    <div>
      <p>Local Video</p>
      <video
        bind:this={localVideoEl}
        autoplay
        playsinline
        muted
        width="160"
        height="120"
        style="border:1px solid #ccc; background:#333;"
      ></video>
    </div>
    <div>
      <p>Remote Video</p>
      <video
        bind:this={remoteVideoEl}
        autoplay
        playsinline
        width="160"
        height="120"
        style="border:1px solid #ccc; background:#333;"
      >
        <track kind="captions" />
      </video>
    </div>
  </div>
</main>
