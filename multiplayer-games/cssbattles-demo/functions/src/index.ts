/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */


// firebase functions:config:set pulsebeam.api_key="kid_1ab07e24a2099113" pulsebeam.api_secret="sk_0472708838417ca86d445f2cb085ebcc90fc706a23a51f03b12921e17b83b1f9"
import {onRequest} from "firebase-functions/v2/https";
import * as functions from "firebase-functions"
import * as logger from "firebase-functions/logger";
import { AccessToken, PeerClaims, PeerPolicy } from "@pulsebeam/server/node";
import { getAuth } from "firebase-admin/auth";
import { initializeApp } from "firebase-admin/app";

initializeApp();

interface Env {
  PULSEBEAM_API_KEY: string;
  PULSEBEAM_API_SECRET: string;
}

const GROUP_ID = "cssbattles-demo";

// Generate a PulseBeam access token based on Firebase authentication status
export const getToken = onRequest(async (request, response) => {
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
        const uid = decodedToken.uid;
        const username = decodedToken.name || uid;
        
        logger.info(`Authenticated user: ${username}`, { uid });
        
        // Create PulseBeam token with authenticated user's info
        const claims = new PeerClaims(GROUP_ID, username);
        // Allow user to connect with other users in group
        const rule = new PeerPolicy(GROUP_ID, "*");
        claims.setAllowPolicy(rule);
        
        const env: Env = {
            PULSEBEAM_API_KEY: process.env.PULSEBEAM_API_KEY || functions.config().pulsebeam.api_key,
            PULSEBEAM_API_SECRET: process.env.PULSEBEAM_API_SECRET || functions.config().pulsebeam.api_secret
        }
        logger.info(`Env: ${env}`);
        
        if (!env.PULSEBEAM_API_KEY || !env.PULSEBEAM_API_SECRET) {
            logger.error("Missing PulseBeam API credentials");
            response.status(500).send({ error: "Server configuration error" });
            return;
        }
        
        const app = new AccessToken(
            env.PULSEBEAM_API_KEY,
            env.PULSEBEAM_API_SECRET
        );
        
        const token = app.createToken(claims, 3600); // 1 hour expiration
        
        response.status(200).send({ token });

    } catch (error) {
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