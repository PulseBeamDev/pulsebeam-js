import { ClientCore } from "./lib";

(async () => {
  const client = new ClientCore({
    sfuUrl: "http://localhost:3000/",
    maxDownstreams: 1,
  });

  client.$state.listen((v) => console.log(v));
  client.$participants.listen((newValue, _, changed) => {
    // assign this to a video element
    console.log(changed);
  });
  await client.connect("default", `alice-${Math.round(Math.random() * 100)}`);

  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
  });

  client.publish(stream);
})();
