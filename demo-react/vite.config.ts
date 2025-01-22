import { defineConfig, UserConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { auth } from "@pulsebeam/demo-server";

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const config: UserConfig = {
    plugins: [react()],
    server: {
      proxy: {},
    },
  };

  if (mode !== "production") {
    config.server!.proxy!["/auth"] = {
      // https://github.com/angular/angular-cli/issues/26198
      target: "http://127.0.0.1:5173",
      bypass(req, res) {
        // URL requires a base url...
        const url = new URL(req.url!, `http://${req.headers.host}`);
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
      },
    };
  }

  return config;
});
