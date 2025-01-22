import handler from "serve-handler";
import http from "http";
import { auth } from "@pulsebeam/demo-server";

const server = http.createServer((request, response) => {
  // URL requires a base url...
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/auth") {
    try {
      const token = auth(url);
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end(token);
    } catch (e) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad Request - groupId and peerId are required");
    }
  }

  // You pass two more arguments for config and middleware
  // More details here: https://github.com/vercel/serve-handler#options
  return handler(request, response);
});

server.listen(3000, () => {
  console.log("Running at http://localhost:3000");
});
