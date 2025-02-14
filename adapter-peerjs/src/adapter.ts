import {
    Peer as PulseBeamPeer,
    PeerOptions as PulseBeamPeerOptions,
    createPeer as pulseBeamCreatePeer,
    ISession,
} from '@pulsebeam/peer';
import { jwtDecode } from "jwt-decode";

import { Peer as PeerJSPeer, PeerEvents, DataConnection as PeerJSDataConnection, MediaConnection as PeerJSMediaConnection, PeerJSOption, PeerConnectOption, ConnectionType, SerializationType, Util as PeerJSUtil } from './types';

export const GROUP_ID = 'default';

export interface ConnectOptions extends PeerConnectOption {
    serialization: SerializationType
}

// Define types and interfaces to match PeerJS API as much as possible
export interface PulseBeamOptions extends PeerJSOption {
  /**
   * PulseBeam authentication configuration
   * @require Either token or insecureAuth
   */
  pulsebeam:
    | { 
        token: string
        insecureAuth?: never  // Block insecureAuth when token exists
        }
    | {
        insecureAuth: {
            apiKey: string // "kid_<...>",
            apiSecret: string  // "sk_<...>",
            authEndpoint?: string // override authEndpoint
            groupId?: string // optionally set groupId
        }
        token?: never  // Block token when insecureAuth exists
        }
}

export class Peer extends PeerJSPeer{
    private pulseBeamPeer: PulseBeamPeer | undefined;
    private groupId: string | undefined;
    private eventTargets: { [event in PeerEvents] : EventTarget };
    public connections: { [peerId: string]: (PeerJSDataConnection |PeerJSMediaConnection)[] } = {};

    constructor(id?: string, options?: PulseBeamOptions) {
        super();
       
        this.eventTargets = {}
        for (const e in PeerEvents){
            this.eventTargets [e] = new EventTarget()
        }

        if (!options) {
            throw('PeerConstructor: Options required');
        }

        try {
            (async () => {
                const token = await this.resolveToken(options, id)
                this.pulseBeamPeer = await pulseBeamCreatePeer({token})
            })();
        } catch (e) {
            throw(`Failed to create PulseBeam Peer: ${e.message}`);
        }

    }

    private async resolveToken(options: PulseBeamOptions, id?: string): Promise<string> {
        if (options.pulsebeam?.token) {
            // TODO: should we add an api for groupId in pulsebeam js sdk?
            const token = options.pulsebeam.token

            interface JwtClaims {
                gid: string;
                pid: string;
            }

            const decoded = jwtDecode<JwtClaims>(token);
            this.groupId= decoded.gid

            return new Promise(()=>token)
        }
        const peerId = id ? id : self.crypto.randomUUID();
        if (options.pulsebeam?.insecureAuth){ 
            console.warn('WARNING: Using insecure authentication method - for development only!');
            return this.createInsecureToken({...options.pulsebeam.insecureAuth, peerId: peerId});
        }
        throw new Error('Authentication required: Provide pulsebeam config');
    }

    private async createInsecureToken(options: {
        apiKey: string;
        apiSecret: string;
        peerId: string;
        authEndpoint?: string;
        groupId?: string;
    }): Promise<string> {
        this.groupId = options.groupId || GROUP_ID;
        const form = new URLSearchParams({
            apiKey: options.apiKey,
            apiSecret: options.apiSecret,
            peerId: options.peerId,
            groupId: this.groupId
        });
        const resp = await fetch(
            options.authEndpoint || "https://cloud.pulsebeam.dev/sandbox/token",
            {
            body: form,
            method: "POST",
            },
        );
        return resp.text();
    }

    public get destroyed(): boolean {
        if (!this.pulseBeamPeer) {return true}
        return this.pulseBeamPeer.state === 'closed'
    }

    // connect to peer with id
    // If you overrode the groupId on this peer, be sure the peer you
    // connect to is in the same group as this peer
    connect(id: string, options?: any): PeerJSDataConnection {
        if (!this.pulseBeamPeer) {
            throw(new Error("Peer not initialized yet."));
        }
        const dataConnection: DataConnection = new DataConnection(this, {
                ...options
            });
        this.pulseBeamPeer.onsession = (sess) => {
            dataConnection._setSession(sess)
            const config: any = {maxRetransmitts: 0}
            if (options?.reliable){ delete config["maxRetransmitts"] }
            if (options?.serialization){ config["protocol"] = options.serialization}
            const chOut = sess.createDataChannel(options?.label || "data", config);
            dataConnection._setChannel(chOut)
            const otherPeerId = sess.other.peerId;
            if (!this.connections[otherPeerId]) this.connections[otherPeerId] = [dataConnection]
            else this.connections[otherPeerId].concat(dataConnection)
        };
        const ac = new AbortController();
        // Initiate the connection
        try {
            if (!this.groupId) {
                throw(new Error("Error with groupId, check PulseBeam token"))
            }
            this.pulseBeamPeer.connect(this.groupId, id, ac.signal);
        } catch (error) {
            throw(error);
        }
        return dataConnection;
    };
    // private handleNewSession(session: ISession) {
    //     const peerId = session.otherpeerId; // Get the peerId from PulseBeam session info.
    //     const dataConnectionAdapter = new DataConnection(session, this); // Create a DataConnectionAdapter
    //     this.dataConnections[peerId] = dataConnectionAdapter;
    //     if (!this.connections[peerId]) {
    //         this.connections[peerId] = [];
    //     }
    //     this.connections[peerId].push(dataConnectionAdapter); // Add to connections map
    //     this.emit('connection', dataConnectionAdapter); // Emit 'connection' event with DataConnectionAdapter
    // }

    call(id: string, stream: MediaStream, options?: any): PeerJSMediaConnection {
        if (!this.pulseBeamPeer) {
            throw(new Error("Peer not initialized yet."));
        }
        const dataConnection: DataConnection = new DataConnection(this, {
                ...options
            });
        this.pulseBeamPeer.onsession = (sess) => {
            dataConnection._setSession(sess)
            const config: any = {maxRetransmitts: 0}
            if (options?.reliable){ delete config["maxRetransmitts"] }
            if (options?.serialization){ config["protocol"] = options.serialization}
            const chOut = sess.createDataChannel(options?.label || "data", config);
            const otherPeerId = sess.otherPeerId;
        };
        const ac = new AbortController();
        // Initiate the connection
        try {
            this.pulseBeamPeer.connect(this.groupId, id, ac.signal);
        } catch (error) {
            throw(error);
        }
        return dataConnection;
    }

    on(event: PeerEvents, callback: (...args: any[]) => void): void {
        this.eventTargets[event].addEventListener(event, callback)
    }

    emit(event: PeerEvents, args?: any) {
        this.eventTargets[event].dispatchEvent(new Event(event, args))
    }

    disconnect(): void {
        if (!this.pulseBeamPeer) return;
        this.pulseBeamPeer.close(); // PulseBeam close should handle disconnection
        this.emit('disconnected'); // Emit 'disconnected' event
    }

    reconnect(): void {
        // PulseBeam does reconnect automatically
    }

    destroy(): void {
        if (!this.pulseBeamPeer) return;
        if (this.pulseBeamPeer.state === 'closed') return;

        this.pulseBeamPeer.close();
        
        for (const peer in this.connections){
            for (const c in this.connections[peer]){
                c.close()
            }
        }
        this.connections = {};
    }
}


export class DataConnection extends PeerJSDataConnection {
    private session: ISession | undefined; // Session can be undefined initially for outgoing connections
    private channel: RTCDataChannel | undefined; // undefined initally
    public label: string = ''; // PulseBeam doesn't seem to have labels like PeerJS, might need to generate or ignore.
    public metadata: any = null; // PulseBeam metadata handling?
    // public peer: string; // PulseBeam peerId of the remote peer
    public reliable: boolean = false; // Reliability setting? PulseBeam options for data channels?
    public serialization: string = 'binary'; // Serialization? PulseBeam handling?
    public bufferSize: number = 0; // Buffer size tracking if needed

    _send() {}
    constructor(peer: Peer, options?: any) {
        super(peer.id, peer, options);
    }
    
    public _setSession(sess: ISession){
        this.session = sess
    }

    public _setChannel(chan: RTCDataChannel){this.channel = chan}

    private initializeSessionEvents(session: ISession) {
        session.ondatachannel = (event) => {
            if (event.channel.label === '') { // Assuming default data channel if label is empty or based on some criteria.
                this.dataChannel = event.channel;
                this.dataChannel.onmessage = (messageEvent) => {
                    this.emit('data', messageEvent.data);
                };
                this.dataChannel.onopen = () => {
                    this.open = true;
                    this.emit('open');
                };
                this.dataChannel.onclose = () => {
                    this.open = false;
                    this.emit('close');
                };
                this.dataChannel.onerror = (error) => {
                    this.emit('error', error); // Map RTCDataChannel error to DataConnection 'error' event
                };
                this.peerConnection = session.getRTCPeerConnection(); // Assuming this method exists in ISession to get RTCPeerConnection. Check PulseBeam API
                 this.emit('open'); // Emit 'open' event when data channel is ready - check if this is the right moment.  Maybe on datachannel open event instead
            }
        };
        session.onconnectionstatechange = (event) => {
            if (session.connectionState() === 'closed' || session.connectionState() === 'failed' || session.connectionState() === 'disconnected') {
                if (this.open) { // Only close if it was open to prevent double 'close' events.
                    this.open = false;
                    this.emit('close'); // Emit 'close' event when connection state changes to closed/failed.
                }
            }
        };
    }


    send(data: any): void {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            console.warn("Data channel not ready or open. Cannot send data.");
            return; // Or throw an error? Check PeerJS behavior.
        }
        try {
             this.dataChannel.send(data); // Data might need to be serialized differently based on PeerJS serialization options.
        } catch (error) {
            this.emit('error', error); // Map send error to DataConnection 'error' event
        }
    }
    close(options? : {flush?: boolean }): void {
        if (options?.flush) {
			this.send({
				__peerData: {
					type: "close",
				},
			});
			return;
		}
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.close();
        }
        if (this.session) {
            this.session.close(); // Close PulseBeam session as well.
        }
        if (this.open) {

            this.emit('close');
        }
    }

    on(event: DataConnectionEvent, callback: (...args: any[]) => void): void {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event]!.push(callback);
    }

    private emit(event: DataConnectionEvent, ...args: any[]) {
        this.eventListeners[event]?.forEach(callback => callback(...args));
    }


}


export class MediaConnectionAdapter extends PeerJSMediaConnection {
    // ... (Implement MediaConnectionAdapter if media calls are needed, similar to DataConnectionAdapter)
    private session: ISession | undefined;
    private eventListeners: { [event in MediaConnectionEvent]?: ((...args: any[]) => void)[] } = {};
    public open: boolean = false;
    public metadata: any = null;
    public peer: string;
    public type: 'media' = 'media';

    constructor(session: ISession | undefined, private parentPeer: Peer) {
        this.session = session;
        if (session) {
             this.peer = session.other().peerId;
             this.initializeSessionEvents(session);
        } else {
            this.peer = 'unknown';
        }
    }

     private initializeSessionEvents(session: ISession) {
        session.ontrack = (event) => {
            this.emit('stream', event.streams[0] || event.track.streams[0]); // Assuming first stream is relevant, or track.streams[0]
            this.open = true; // Consider when MediaConnection is truly 'open' in PulseBeam context
        };
        session.onconnectionstatechange = (event) => {
             if (session.connectionState() === 'closed' || session.connectionState() === 'failed' || session.connectionState() === 'disconnected') {
                if (this.open) {
                    this.open = false;
                    this.emit('close');
                }
            }
        };
     }


    answer(stream?: MediaStream, options?: any): void {
         if (!this.session) {
             console.warn("MediaConnectionAdapter not properly initialized with a session.");
             return;
         }
        if (stream) {
            stream.getTracks().forEach(track => {
                this.session?.addTrack(track, stream); // Add tracks from the provided stream to the session
            });
        }
        this.open = true; // Consider when MediaConnection is 'open' after answering. Check PulseBeam flow
    }
    close(): void {
         if (this.session) {
            this.session.close();
        }
        if (this.open) {
            this.open = false;
            this.emit('close');
        }
        // Remove from parent peer connections if needed.
        if (this.parentPeer.connections[this.peer]) {
             this.parentPeer.connections[this.peer] = this.parentPeer.connections[this.peer].filter(conn => conn !== this);
             if (this.parentPeer.connections[this.peer].length === 0) {
                 delete this.parentPeer.connections[this.peer];
             }
        }
    }
    on(event: MediaConnectionEvent, callback: (...args: any[]) => void): void {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event]!.push(callback);
    }

    private emit(event: MediaConnectionEvent, ...args: any[]) {
        this.eventListeners[event]?.forEach(callback => callback(...args));
    }
}


// Example usage (Conceptual - adjust based on your actual needs)
export async function exampleUsage() {
    const pulsebeamOptions: PeerJSOption = {
        groupId: 'test-group', // Replace with your group ID
        peerId: 'peerjs-adapter-peer1', // Optional, or let PulseBeam generate
        token: 'YOUR_PULSEBEAM_TOKEN', // Replace with your PulseBeam token
        debug: 3, // Enable debug logging level 3
    };

    const peer = new Peer(pulsebeamOptions);

    peer.on('open', (id) => {
        console.log('PeerJS Peer opened with ID:', id);

        const connectToPeerId = 'peerjs-adapter-peer2'; // Replace with the peerId you want to connect to in the same group
        const dc = peer.connect(connectToPeerId);

        dc.on('open', () => {
            console.log('Data channel opened');
            dc.send('Hello from PeerJS Adapter!');
        });

        dc.on('data', (data) => {
            console.log('Data received:', data);
        });

        dc.on('close', () => {
            console.log('Data channel closed');
        });

        dc.on('error', (err) => {
            console.error('Data channel error:', err);
        });
    });

    peer.on('connection', (dataConnection: DataConnection) => {
        console.log('Incoming connection from:', dataConnection.peer);

        dataConnection.on('data', (data) => {
            console.log('Received data on incoming connection:', data);
            dataConnection.send('Hello back from incoming!');
        });

        dataConnection.on('open', () => {
            console.log('Incoming data channel opened');
        });
        dataConnection.on('close', () => {
            console.log('Incoming data channel closed');
        });

        dataConnection.on('error', (err) => {
            console.error('Incoming data channel error:', err);
        });
    });


    peer.on('disconnected', () => {
        console.log('Peer disconnected from server');
    });

    peer.on('close', () => {
        console.log('Peer closed');
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
    });

    // To connect from another Peer instance (e.g., standard PulseBeam or another PeerJS adapter instance)
    // You would use the 'peerjs-adapter-peer2' (or whatever peerId you set) as the target peerId
}

// Run example usage (uncomment to test)
// exampleUsage();