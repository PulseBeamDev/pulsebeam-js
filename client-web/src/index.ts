import type { PulsebeamVideo } from "./component";
import { ClientCore } from "./lib";
export * from "./component";

const context = document.querySelector("pulsebeam-context");

(async () => {
  const client = new ClientCore({
    sfuUrl: "http://localhost:3000/",
    maxDownstreams: 1,
  });
  context!.value = client;

  const videos: Record<string, PulsebeamVideo> = {};
  client.$state.listen((v) => console.log(v));
  client.$participants.listen(async (newValue, _, changed) => {
    // Create a new pulsebeam-video element if not already present
    let video = videos[changed];
    if (video) {
      return;
    }

    video = document.createElement("pulsebeam-video") as PulsebeamVideo;
    videos[changed] = video;
    await video.updateComplete;

    // Set participantMeta on the pulsebeam-video element
    const participantMeta = newValue[changed].get(); // Get the metadata for the participant
    video.participantMeta = participantMeta;
    console.log(participantMeta);

    // Append the video to the DOM
    context!.appendChild(video);
  });
  await client.connect("default", `alice-${Math.round(Math.random() * 100)}`);

  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
  });

  client.publish(stream);
})();
