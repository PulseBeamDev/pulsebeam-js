import { ClientCore } from "./lib";

(async () => {
  const client = new ClientCore({
    sfuUrl: "http://localhost:3000/",
    maxDownstreams: 1,
  });

  const videos: Record<string, HTMLVideoElement> = {};
  client.$state.listen((v) => console.log(v));
  client.$participants.listen((newValue, _, changed) => {
    const video = videos[changed] || document.createElement("video");
    const participant = newValue[changed].get();
    client.subscribe(video, participant);
    videos[changed] = video;
  });
  await client.connect("default", `alice-${Math.round(Math.random() * 100)}`);

  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
  });

  client.publish(stream);
})();
