import { AccessToken, PeerClaims, PeerPolicy } from "@pulsebeam/server/node";

// default values are only used for testing only!!
const appId = process.env["PULSEBEAM_API_KEY"] || "kid_bc74ea55b2ffe97c";
const appSecret = process.env["PULSEBEAM_API_SECRET"] ||
  "sk_360e45d1d7cb3ea840789f56f6502b4154f22aa89b67b557fa9427363968ffe4";
const app = new AccessToken(appId, appSecret);

export function auth(url) {
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
