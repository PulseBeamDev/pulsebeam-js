import { AccessToken, PeerClaims, PeerPolicy } from "@pulsebeam/server/workerd";

// This is an example Cloudflare Page Function for Serving PulseBeam Tokens
// For more details, see
//  https://pulsebeam.dev/docs/guides/token/#cloudflare-page-functions

interface Env {
  PULSEBEAM_API_KEY: string;
  PULSEBEAM_API_SECRET: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const groupId = url.searchParams.get("groupId");
  const peerId = url.searchParams.get("peerId");

  if (!groupId || !peerId) {
    throw new Error("groupId and peerId are required");
  }

  const claims = new PeerClaims(groupId, peerId);
  const rule = new PeerPolicy("*", "*");
  claims.setAllowPolicy(rule);
  claims.setAllowPolicy(rule);

  const app = new AccessToken(
    context.env.PULSEBEAM_API_KEY,
    context.env.PULSEBEAM_API_SECRET,
  );
  const token = app.createToken(claims, 3600);
  return new Response(token);
};
