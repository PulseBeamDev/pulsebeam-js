import { ClientCore } from "./lib";

(async () => {
  const client = new ClientCore({
    sfuUrl: "http://localhost:3000/",
    maxDownstreams: 1,
  });

  await client.connect("default", `alice-${Math.round(Math.random() * 100)}`);

  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
  });

  client.publish(stream);
})();
