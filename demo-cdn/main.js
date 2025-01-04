import handler from "serve-handler";
import http from "http";
import { App, PeerPolicy, PeerClaims } from "@pulsebeam/server/node";

// default values are only used for testing only!!
const appId = process.env["PULSEBEAM_APP_ID"] || "app_e66Jb4zkt66nvlUKMRTSZ";
const appSecret = process.env["PULSEBEAM_APP_SECRET"] ||
  "sk_7317736f8a8d075a03cdea6b6b76094ae424cbf619a8e9273e633daed3f55c38";
const app = new App(appId, appSecret);

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
