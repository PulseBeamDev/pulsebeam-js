# PulseBeam Datachannel Example

### Run Demo
1. Install dependencies with `npm i`
2. Run with `npm start`
3. Go to your browser open two tabs: 
    - URL for first tab: `http://localhost:3000/?peerId=peer-29`
    - URL for second tab: `http://localhost:3000/`
4. On the second tab say `peer-29` in the first text box. Then click connect.
5. You can edit the text in the bottom text box. And see it synchronizing between the peers. 

This demo will work globally within the scope of your app-id (not just two tabs within the same browser!). So feel free to have the one peer on a different network or machine.

If desired, go to inspector, console to see logs on either tab

### So what happened?

`npm start` spun up an HTTP server.
Which serves `index.html` on http://localhost:3000/ and tokens from http://localhost:3000/auth.
`/auth` used `@pulsebeam/server` sdk to create tokens.
the `index.html` tells the browser to request a token from `/auth`.
then used `@pulsebeam/peer` sdk to create a peer with the token and talk to PulseBeam signaling servers.
Then the second browser connected to the first browser when you put 'peer-29' in the text box and clicked the 'connect' button.

1. Server Setup:

    - The code utilizes the `@pulsebeam/server` SDK to create a PulseBeam `App` instance. This app instance is identified by a unique `appId` and `appSecret` (obtained from your PulseBeam project).
    - An HTTP server is created using Node.js's `http` module. This server listens for incoming requests on port 3000.

2. Handling Requests:

    - The server uses the `serve-handler` library to handle incoming requests. This library serves static files from the current directory by default.
    
    - The server defines a handler function to handle requests specifically for the `/auth` endpoint.
    
    - When a request arrives at `/auth`, the code extracts the `groupId` and `peerId` parameters from the URL search query.
    
    - If either parameter is missing, the server responds with a 400 Bad Request error.
    
    - If the parameters are present, the code creates a `PeerClaims` object using the provided `groupId` and `peerId`. This object defines the permissions for the peer connection.
    
    - A `FirewallClaims` object is created, allowing any peer connections for this peer `(*, *)`. This is for demonstration purposes, and you might want to restrict connections in a real application.
    
    - The `PeerClaims` object is used along with the `FirewallClaims` to generate a token using the `App.createToken` method. This token grants temporary access to PulseBeam for the specified peer.
    
    - The generated token is sent back to the browser in the response.

3. Overall Functionality:

    - The first tab (http://localhost:3000/) opens the HTML page containing the PulseBeam client-side libraries (@pulsebeam/peer). This code fetches a token from the server at the /auth endpoint by providing its groupId (which can be anything) and a generated peerId.

    - The second tab (http://localhost:3000/?peerId=peer-29) opens the same HTML page but also specifies the peerId of the first peer (peer-29) in the URL search query.

    - Once the first peer receives the token from the server, it uses the PulseBeam peer library to connect to PulseBeam's signaling servers and establish a connection.

    - When the second peer enters the peerId of the first peer and clicks connect, its PulseBeam client-side library uses the token to connect to the same PulseBeam room as the first peer.

    - With both peers connected to the same PulseBeam room, they can exchange data through the data channel established by PulseBeam.