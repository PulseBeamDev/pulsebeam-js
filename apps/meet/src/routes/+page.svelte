<script lang="ts">
import { WebAdapter, Session } from "@pulsebeam/web";
import { onMount } from "svelte";

let stream = $state<MediaStream>();

onMount(async () => {
  const session = new Session({
    videoSlots: 16,
    audioSlots: 3,
    adapter: WebAdapter,
  });

  session.connect("https://demo.pulsebeam.dev", "demo");
  stream = await navigator.mediaDevices.getUserMedia({ video: true });
  session.publish(stream);
});
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>
<video autoplay width=640 style="aspect-ratio: 16/9" srcobject={stream}>
</video>
