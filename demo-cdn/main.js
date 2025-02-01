import handler from "serve-handler";
import http from "http";
import { auth } from "@pulsebeam/demo-server";

const server = http.createServer((req, res) => {
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
      console.log(e)
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad Request - groupId and peerId are required");
    }
    return;
  }

  // You pass two more arguments for config and middleware
  // More details here: https://github.com/vercel/serve-handler#options
  return handler(req, res);
});

server.listen(3000, () => {
  console.log("Running at http://localhost:3000");
});
