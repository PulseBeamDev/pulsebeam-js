import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { App, FirewallClaims, PeerClaims } from "@pulsebeam/server/node";

// default values are only used for testing only!!
const appId = process.env["PULSEBEAM_APP_ID"] || "app_e66Jb4zkt66nvlUKMRTSZ";
const appSecret = process.env["PULSEBEAM_APP_SECRET"] ||
  "sk_7317736f8a8d075a03cdea6b6b76094ae424cbf619a8e9273e633daed3f55c38";
const app = new App(appId, appSecret);

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
        target: "http://127.0.0.1:4173",
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
            const rule = new FirewallClaims("*", "*");
            claims.setAllowIncoming0(rule);
            claims.setAllowOutgoing0(rule);

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
