import {
    Peer as PulseBeamPeer,
    PeerOptions as PulseBeamPeerOptions,
    createPeer as pulseBeamCreatePeer,
    ISession,
} from '@pulsebeam/peer';
import { jwtDecode } from "jwt-decode";

import { Peer as PeerJSPeer, PeerEvents, DataConnection as PeerJSDataConnection, MediaConnection as PeerJSMediaConnection, PeerJSOption, PeerConnectOption, ConnectionType, SerializationType, Util as PeerJSUtil, DataConnectionEvents, MediaConnectionEvents, PeerError, DataConnectionErrorType, PeerErrorType, BaseConnectionErrorType } from './types';

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

type PeerEventType = keyof PeerEvents;
// Helper type to extract event argument types
type PeerEventArgs<E extends PeerEventType> = 
  Parameters<PeerEvents[E]> extends [] ? never : Parameters<PeerEvents[E]>[0];

export class Peer extends PeerJSPeer{
    private pulseBeamPeer: PulseBeamPeer | undefined;
    private groupId: string | undefined;
    private eventTargets: Record<PeerEventType, EventTarget>;
    private _connections: { [peerId: string]: (MediaConnection|DataConnection)[] } = {};
    private _options: PulseBeamOptions | undefined;

    get id(){return this.pulseBeamPeer?.peerId || ""}
    get options(){return {...this._options}}
    get connections(){return this._connections}

    constructor(id?: string, options?: PulseBeamOptions) {
        super();
        this._options = options;
       
        this.eventTargets = {
            open: new EventTarget(),
            connection: new EventTarget(),
            call: new EventTarget(),
            close: new EventTarget(),
            disconnected: new EventTarget(),
            error: new EventTarget(),
        };

        if (!options) {
            throw('PeerConstructor: Options required');
        }

        try {
            (async () => {
                const token = await this.resolveToken(options, id)
                this.pulseBeamPeer = await pulseBeamCreatePeer({token})
            })();
        } catch (e) {
            throw(`Failed to create PulseBeam Peer: ${e instanceof Error ? e.message : e}`);
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

//     Property 'connect' in type 'Peer' is not assignable to the same property in base type 'Peer'.
//   Type '(id: string, options?: any) => DataConnection' is not assignable to type '(peer: string, options?: PeerConnectOption | undefined) => DataConnection'.
//     Type 'import("/home/gabe/pulsebeam/pulsebeam-js/adapter-peerjs/src/adapter").DataConnection' is not assignable to type 'import("/home/gabe/pulsebeam/pulsebeam-js/adapter-peerjs/src/types").DataConnection'.
//       Property 'emit' is private in type 'DataConnection' but not in type 'DataConnection'
    // connect to peer with id
    // If you overrode the groupId on this peer, be sure the peer you
    // connect to is in the same group as this peer
    connect(id: string, options?: PeerConnectOption | undefined): DataConnection {
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
            if (!this._connections[otherPeerId]) this._connections[otherPeerId] = [dataConnection]
            else this._connections[otherPeerId].concat(dataConnection)
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

    call(id: string, stream: MediaStream, options?: any): MediaConnection {
        if (!this.pulseBeamPeer) {
            throw(new Error("Peer not initialized yet."));
        }
        const mediaConnection: MediaConnection = new MediaConnection(undefined, this, {
                ...options
            });
        this.pulseBeamPeer.onsession = (sess) => {
            mediaConnection._setSession(sess)
            const config: any = {maxRetransmitts: 0}
            if (options?.reliable){ delete config["maxRetransmitts"] }
            if (options?.serialization){ config["protocol"] = options.serialization}
            // const chOut = sess.createDataChannel(options?.label || "data", config);
            
            // Store connection in internal state
            const otherPeerId = sess.other.peerId;
            if (!this._connections[otherPeerId]) this._connections[otherPeerId] = [mediaConnection]
            else this._connections[otherPeerId].concat(mediaConnection)
        };
        const ac = new AbortController();
        // Initiate the connection
        try {
            this.pulseBeamPeer.connect(this.groupId, id, ac.signal);
        } catch (error) {
            throw(error);
        }
        return mediaConnection;
    }

    public on<E extends PeerEventType>(event: E, callback: PeerEvents[E]): void {
        const handler = (e: Event) => {
            const customEvent = e as CustomEvent<PeerEventArgs<E>>;
            // Type-safe argument passing
            if (customEvent.detail !== undefined) {
                (callback as any)(customEvent.detail);
            } else {
                (callback as any)();
            }
        };
        
        this.eventTargets[event].addEventListener(event, handler);
    }

    emit<E extends PeerEventType>(
        event: E,
        data?: PeerEventArgs<E>
    ): void {
        const eventInit = data !== undefined ? { detail: data } : undefined;
        const customEvent = new CustomEvent(event, eventInit);
        this.eventTargets[event].dispatchEvent(customEvent);
    }
    
    disconnect(): void {
        this.emit('disconnected');
    }

    reconnect(): void {
        // PulseBeam JS SDK reconnects automatically
    }

    get open(){
        if (!this.pulseBeamPeer) return false;
        if (this.pulseBeamPeer.state === 'new') return true;
        return false
    }
    get disconnected(){
        return this.destroyed
    }
    get destroyed(){
        if (!this.pulseBeamPeer) return true;
        if (this.pulseBeamPeer.state === 'closed') return true;
        return false
    }
    
    destroy(): void {
        if (!this.pulseBeamPeer) return;
        if (this.pulseBeamPeer.state === 'closed') return;

        this.disconnect()
        
        for (const peer in this._connections){
            for (const c in this._connections[peer]){
                // @ts-ignore
                c.close()
            }
        }
        this._connections = {};
    }
}

type DataConnectionEventsType = keyof DataConnectionEvents;
// Helper type to extract event argument types
type DataConnectionEventsArgs<E extends DataConnectionEventsType> = 
  Parameters<DataConnectionEvents[E]> extends [] ? never : Parameters<DataConnectionEvents[E]>[0];

export class DataConnection extends PeerJSDataConnection {
    private session: ISession | undefined; // Session can be undefined initially for outgoing connections
    private channel: RTCDataChannel | undefined; // undefined initally
    public label: string = ''; // PulseBeam doesn't seem to have labels like PeerJS, might need to generate or ignore.
    public metadata: any = null; // PulseBeam metadata handling?
    // public peer: string; // PulseBeam peerId of the remote peer
    public reliable: boolean = false; // Reliability setting? PulseBeam options for data channels?
    public serialization: string = 'binary'; // Serialization? PulseBeam handling?
    public bufferSize: number = 0; // Buffer size tracking if needed
    private eventTargets: Record<DataConnectionEventsType, EventTarget>;

    // TODO make compatible
    // Type 'DataConnection' is missing the following properties from type 'DataConnection':
    //  session, channel, bufferSize, eventTargets, and 5 more.ts(2345)
    
    _send() {}
    constructor(peer: Peer, options?: any) {
        super(peer.id, peer, options);
        this.eventTargets = {
            open: new EventTarget(),
            error: new EventTarget(),
            close: new EventTarget(),
            iceStateChanged: new EventTarget(),
            data: new EventTarget(),
        };
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
            this.emit('error', new PeerError(DataConnectionErrorType["NotOpenYet"], "Data channel not ready or open. Cannot send data."))
        }
        try {
             this.dataChannel.send(data); // Data might need to be serialized differently based on PeerJS serialization options.
        } catch (e) {
            // (method) RTCDataChannel.send(data: string) See error types in MDN Reference
            if (e instanceof DOMException){
                if (e.name === "InvalidStateError"){
                    this.emit('error', new PeerError(DataConnectionErrorType["NotOpenYet"], e))
                } else if (e.name === "NetworkError"){
                    this.emit('error', new PeerError(BaseConnectionErrorType["ConnectionClosed"], e))
                } else {
                    this.emit('error')
                }
            }
            if (e instanceof TypeError){
                this.emit('error', new PeerError(DataConnectionErrorType["MessageToBig"], e))
            }
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
        if (this.open) {
            this.emit('close');
        }
    }

    public on<E extends DataConnectionEventsType>(event: E, callback: DataConnectionEvents[E]): void {
        const handler = (e: Event) => {
            const customEvent = e as CustomEvent<DataConnectionEventsArgs<E>>;
            // Type-safe argument passing
            if (customEvent.detail !== undefined) {
                (callback as any)(customEvent.detail);
            } else {
                (callback as any)();
            }
        };
        
        this.eventTargets[event].addEventListener(event, handler);
    }

    emit<E extends DataConnectionEventsType>(
        event: E,
        data?: DataConnectionEventsArgs<E>
    ): void {
        const eventInit = data !== undefined ? { detail: data } : undefined;
        const customEvent = new CustomEvent(event, eventInit);
        this.eventTargets[event].dispatchEvent(customEvent);
    }
}

type MediaConnectionEventsType = keyof MediaConnectionEvents;
// Helper type to extract event argument types
type MediaConnectionEventsArgs<E extends MediaConnectionEventsType> = 
  Parameters<MediaConnectionEvents[E]> extends [] ? never : Parameters<MediaConnectionEvents[E]>[0];

export class MediaConnection extends PeerJSMediaConnection {
    private session: ISession | undefined;
    private eventTargets: Record<MediaConnectionEventsType, EventTarget>;
    public metadata: any = null;
    public peer: string;

    public _setSession(sess: ISession){this.session = sess}
    get type(){ return ConnectionType.Media }

    constructor(session: ISession | undefined, private parentPeer: Peer, options?: any) {
        super(parentPeer.id, parentPeer, options)
        //     constructor(peer: Peer, options?: any) {
        // super(peer.id, peer, options);
        this.eventTargets = {
            stream: new EventTarget(),
            error: new EventTarget(),
            close: new EventTarget(),
            iceStateChanged: new EventTarget(),
            willCloseOnRemote: new EventTarget(),
        };
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

    get open(){
        if (this.session){
            return this.session.connectionState === 'connected'
        }
        return false
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

    on<E extends MediaConnectionEventsType>(event: E, callback: MediaConnectionEvents[E]): void {
        const handler = (e: Event) => {
            const customEvent = e as CustomEvent<DataConnectionEventsArgs<E>>;
            // Type-safe argument passing
            if (customEvent.detail !== undefined) {
                (callback as any)(customEvent.detail);
            } else {
                (callback as any)();
            }
        };
        
        this.eventTargets[event].addEventListener(event, handler);
    }

    private emit<E extends MediaConnectionEventsType>(
        event: E,
        data?: MediaConnectionEventsArgs<E>
    ): void {
        const eventInit = data !== undefined ? { detail: data } : undefined;
        const customEvent = new CustomEvent(event, eventInit);
        this.eventTargets[event].dispatchEvent(customEvent);
    }
}
