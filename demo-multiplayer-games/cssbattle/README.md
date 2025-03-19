# Getting Started

## Overview

This folder contains an POC for CSSBattle VS mode.

See hosted version at https://cssbattle-cae32.web.app

1. 'Frontend' (running locally described below) first asks a user to login. Login creates a Firebase auth user.
1. User calls Firebase function 'Backend' (running locally described below). Function generates PulseBeam Tokens for logged in users
1. Calls PulseBeam peer.start with token to allow incoming connections and/or create connections to others
1. Connect to another user who's peer has been started by entering their firebase user.uid
1. See user.uid in firebase auth console or by them sending it to you, it is rendered at the top of the page e.g. Top of page in Frontend says "User: FocdlDUGHGWKpgteCyZByzEYkZK2" the user.uid would be "FocdlDUGHGWKpgteCyZByzEYkZK2" 
1. After connect, you see rendering of css of other in realtime as well as their score.

See PulseBeam docs on tokens and security
- https://pulsebeam.dev/docs/concepts/terms/#token
- https://pulsebeam.dev/docs/guides/token/

Feel free to contact us to discuss anything! 
https://pulsebeam.dev/docs/community-and-support/support/

## Limitations

### Full mesh topology
Current UI allows for multiple connections. Although logic is not setup to do full mesh topology logic. e.g. 

### CSS Rendering

Rendering does not work as well as it does in CSS Arena.

For example, with sample css like https://github.com/jdegand/cssbattle/blob/main/Pilot%20Battle/AcidRain.html
 
This POC does not render it anywhere near correctly. 

On https://css-arena.org that sample css also does not render correctly. Therefore I am ignoring this, Kushagara, happy to help on this but I don't think it would be of any help to you for us to dive deeper on this since you probably have rendering well in hand.

Always happy to help though, so reach out anytime!

### Bug with iframe rendering and html-to-image

Essentially traversal implementation in html-to-image traverses the iframe subtree two times, creating two copies of child nodes and wrecks the outputted image. 

See comments + code in `Battle.tsx` on some hacks to get around this bug.

As well as this PR https://github.com/bubkoo/html-to-image/pull/434 

There are several open issues in the repo as well about iframe rendering.

## Backend

Setup and serve locally with:
```
cd functions

echo "PULSEBEAM_API_KEY=kid_<...>" > .env
echo "PULSEBEAM_API_SECRET=sk_<...>" >> .env

nvm use
npm install
npm start
```

Deploy to firebase
```bash
firebase deploy --only functions
```
## Frontend

```
npm install
npm run dev
```
