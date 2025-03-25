import { Portal } from "./lib.ts";
import { createPeer } from "@pulsebeam/peer";

(async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const baseUrl = urlParams.get("baseUrl");
  const groupId = urlParams.get("groupId") || "";
  const peerId = urlParams.get("peerId") || "";

  // See https://pulsebeam.dev/docs/guides/token/#example-nodejs-http-server
  // For explanation of this token-serving method
  const resp = await fetch(
    `/auth?groupId=${groupId}&peerId=${peerId}`,
  );
  const token = await resp.text();

  const peer = await createPeer({
    baseUrl: baseUrl || undefined,
    token,
  });
  const portal = new Portal(peer);

  portal.$store.listen((value) => {
    console.log(JSON.stringify(value, null, 2));
  });

  setInterval(() => {
    portal.$store.setKey(peerId, Math.random());
  }, 1000);
})();
