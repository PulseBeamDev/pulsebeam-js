import { AccessToken, PeerClaims, PeerPolicy } from "@pulsebeam/server/node";

let missingKeysError = false;
const appId = process.env["PULSEBEAM_API_KEY"] || "kid_<...>";
const appSecret = process.env["PULSEBEAM_API_SECRET"] || "sk_<...>";

if (appId === "kid_<...>" || appSecret === "sk_<...>") {
  missingKeysError = true;
  console.error(
    "ERROR: Keys not set see https://pulsebeam.dev/docs/getting-started/quick-start/",
  );
}

const app = new AccessToken(appId, appSecret);

export function auth(url) {
  if (missingKeysError) throw new Error("Keys are required to generate tokens");

  const groupId = url.searchParams.get("groupId");
  const peerId = url.searchParams.get("peerId");

  if (!groupId || !peerId) {
    throw new Error("groupId and peerId are required");
  }

  const claims = new PeerClaims(groupId, peerId);
  const rule = new PeerPolicy("*", "*");
  claims.setAllowPolicy(rule);
  claims.setAllowPolicy(rule);

  const token = app.createToken(claims, 3600);
  return token;
}
