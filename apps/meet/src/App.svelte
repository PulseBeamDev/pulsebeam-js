<script lang="ts">
  import Lobby from "./Lobby.svelte";
  import Room from "./Room.svelte";

  let page = $state<"lobby" | "room">("lobby");
  let roomId = $state("");
  let localStream = $state<MediaStream | null>(null);

  function handleJoin(id: string) {
    roomId = id;
    page = "room";
  }

  function handleLeave() {
    page = "lobby";
    localStream = null;
  }
</script>

<main class="container-fluid">
  {#if page === "lobby" || !localStream}
    <Lobby bind:localStream onJoin={handleJoin} />
  {:else}
    <Room {localStream} {roomId} onLeave={handleLeave} />
  {/if}
</main>

<style>
  :global(body > main) {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
</style>
