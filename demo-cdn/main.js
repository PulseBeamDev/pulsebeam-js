import handler from "serve-handler";
import http from "http";
import { AccessToken, PeerClaims, PeerPolicy } from "@pulsebeam/server/node";

// default values are only used for testing only!!
const apiKey = process.env["PULSEBEAM_API_KEY"] || "kid_bc74ea55b2ffe97c";
const apiSecret = process.env["PULSEBEAM_API_SECRET"] ||
  "sk_360e45d1d7cb3ea840789f56f6502b4154f22aa89b67b557fa9427363968ffe4";
const app = new AccessToken(apiKey, apiSecret);

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/auth") {
    const groupId = url.searchParams.get("groupId");
    const peerId = url.searchParams.get("peerId");

    if (!groupId || !peerId) {
      response.writeHead(400, { "Content-Type": "text/plain" });
      // Note: depends on your application logic, for this sample, we
      // require this information from the request. Other apps may want
      // to define this server side.
      response.end("Bad Request - groupId and peerId are required");
      return;
    }

    const claims = new PeerClaims(groupId, peerId);
    const policy = new PeerPolicy("*", "*");
    claims.setAllowPolicy(policy);

    const token = app.createToken(claims, 3600);
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(token);
    return;
  }

  // You pass two more arguments for config and middleware
  // More details here: https://github.com/vercel/serve-handler#options
  return handler(request, response);
});

server.listen(3000, () => {
  console.log("Running at http://localhost:3000");
});
