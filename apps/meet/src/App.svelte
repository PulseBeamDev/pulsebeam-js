<script lang="ts">
  import "./app.css";
  import { WebAdapter, Session } from "@pulsebeam/web";
  import "@pulsebeam/web/components/card";
  import "@pulsebeam/web/components/button";
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

<pb-card class="w-lg">
  <video autoplay width="640" style="aspect-ratio: 16/9" srcobject={stream}
  ></video>
  <nav><pb-button>Hello</pb-button></nav>
</pb-card>
