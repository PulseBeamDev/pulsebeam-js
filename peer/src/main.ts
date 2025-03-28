import { createPeer, PeerStore } from "./lib.ts";

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
  const portal = new PeerStore(peer);

  const textDOM = document.getElementById("text")! as HTMLInputElement;
  const formDOM = document.getElementById("form")! as HTMLFormElement;
  const containerDOM = document.getElementById("container")!;

  formDOM.onsubmit = (e) => {
    e.preventDefault();

    const key = `${new Date().toISOString()} (${peerId})`;
    portal.$store.setKey(key, textDOM.value);
    textDOM.value = "";
  };

  portal.$store.listen(() => {
    // TODO: this is naive, this can be done more efficiently with a binary heap or bst.
    const snapshot = portal.$store.get();
    const messages = Object.entries(snapshot);

    messages.sort((a, b) => a[0].localeCompare(b[0]));
    containerDOM.innerHTML = "";
    for (const [dt, msg] of messages) {
      const msgDOM = document.createElement("p");
      msgDOM.textContent = `${dt}: ${msg}`;
      containerDOM.appendChild(msgDOM);
    }
  });
  portal.start();
})();
