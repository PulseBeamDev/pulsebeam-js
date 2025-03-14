import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { AccessToken, PeerClaims, PeerPolicy } from "@pulsebeam/server/node";
import { getAuth } from "firebase-admin/auth";
import { initializeApp } from "firebase-admin/app";
initializeApp();
const GROUP_ID = "cssbattles-demo";
// Generate a PulseBeam access token based on Firebase authentication status
export const getToken = onRequest({ cors: true }, async (request, response) => {
    logger.info("Creating PulseBeam token", { structuredData: true });
    try {
        // Get authorization header
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            response.status(401).send({ error: "Authentication required" });
            return;
        }
        // Extract Firebase ID token
        const idToken = authHeader.split('Bearer ')[1];
        // Verify Firebase ID token
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const username = decodedToken.uid;
        logger.info(`Authenticated user: ${username}`);
        // Create PulseBeam token with authenticated user's info
        const claims = new PeerClaims(GROUP_ID, username);
        // Allow user to connect with other users in group
        const rule = new PeerPolicy(GROUP_ID, "*");
        claims.setAllowPolicy(rule);
        // Use .env file for secrets as per
        // https://firebase.google.com/docs/functions/config-env?gen=2nd
        const env = {
            PULSEBEAM_API_KEY: process.env.PULSEBEAM_API_KEY,
            PULSEBEAM_API_SECRET: process.env.PULSEBEAM_API_SECRET
        };
        if (!env.PULSEBEAM_API_KEY || !env.PULSEBEAM_API_SECRET) {
            logger.error("Missing PulseBeam API credentials");
            response.status(500).send({ error: "Server configuration error" });
            return;
        }
        const app = new AccessToken(env.PULSEBEAM_API_KEY, env.PULSEBEAM_API_SECRET);
        const token = app.createToken(claims, 3600); // 1 hour expiration
        response.status(200).send({ token });
    }
    catch (error) {
        logger.error("Error", error);
        response.status(500).send({ error: "Internal server error" });
    }
    // logger.info("Hello logs!", {structuredData: true});
    // const url = new URL(context.request.url);
    // const groupId = url.searchParams.get("groupId");
    // const peerId = url.searchParams.get("peerId");
    // if (!groupId || !peerId) {
    //     throw new Error("groupId and peerId are required");
    // }
    // const claims = new PeerClaims(groupId, peerId);
    // const rule = new PeerPolicy("*", "*");
    // claims.setAllowPolicy(rule);
    // claims.setAllowPolicy(rule);
    // const app = new AccessToken(
    //     context.env.PULSEBEAM_API_KEY,
    //     context.env.PULSEBEAM_API_SECRET,
    // );
    // const token = app.createToken(claims, 3600);
    // return new Response(token);
    // response.send({"message": "Hello from Firebase!"});
});
//# sourceMappingURL=index.js.map