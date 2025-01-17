import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { AccessToken, PeerClaims, PeerPolicy } from "@pulsebeam/server/node";

// default values are only used for testing only!!
const appId = process.env["PULSEBEAM_API_KEY"] || "kid_bc74ea55b2ffe97c";
const appSecret = process.env["PULSEBEAM_API_SECRET"] ||
  "sk_360e45d1d7cb3ea840789f56f6502b4154f22aa89b67b557fa9427363968ffe4";
const app = new AccessToken(appId, appSecret);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // "/auth": {
      //   target: "http://localhost:8080",
      //   changeOrigin: true,
      //   secure: false,
      // },
      "/auth": {
        // https://github.com/angular/angular-cli/issues/26198
        target: "http://127.0.0.1:5173",
        bypass(req, res) {
          const url = new URL(req.url!, `http://${req.headers.host}`);
          if (url.pathname === "/auth") {
            const groupId = url.searchParams.get("groupId");
            const peerId = url.searchParams.get("peerId");

            if (!groupId || !peerId) {
              res.writeHead(400, { "Content-Type": "text/plain" });
              res.end("Bad Request - groupId and peerId are required");
              return;
            }

            const claims = new PeerClaims(groupId, peerId);
            const rule = new PeerPolicy("*", "*");
            claims.setAllowPolicy(rule);
            claims.setAllowPolicy(rule);

            const token = app.createToken(claims, 3600);
            res.writeHead(200, {
              "Content-Type": "text/plain; charset=utf-8",
            });
            res.end(token);
            return;
          }
        },
      },
    },
  },
});
