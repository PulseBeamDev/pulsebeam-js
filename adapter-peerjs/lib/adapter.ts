import {
    Peer as PulseBeamPeer,
    createPeer as pulseBeamCreatePeer,
    ISession,
} from '@pulsebeam/peer';
import { jwtDecode } from "jwt-decode";

import {
    Peer as PeerJSPeer, 
    PeerEvents, 
    BaseConnectionEvents, 
    DataConnection as PeerJSDataConnection, 
    MediaConnection as PeerJSMediaConnection, 
    PeerJSOption as IPeerJSPeerOption,
    PeerOptions as PeerJSPeerOptions,
    PeerConnectOption, 
    ConnectionType, 
    SerializationType, 
    DataConnectionEvents, 
    MediaConnectionEvents, 
    PeerError, 
    DataConnectionErrorType, 
    BaseConnectionErrorType,
    UtilSupportsObj,
    AnswerOption,
    CallOption,
    PeerErrorType,
    SocketEventType,
    ServerMessageType,
    LogLevel,
} from './types';
export { 
    PeerEvents, 
    AnswerOption, 
    CallOption, 
    PeerConnectOption, 
    PeerError, 
    UtilSupportsObj, 
    DataConnectionErrorType, 
    BaseConnectionErrorType, 
    ConnectionType,
    PeerErrorType,
    SerializationType,
    SocketEventType,
    ServerMessageType,
    LogLevel,
}

export const GROUP_ID = 'default';

export interface ConnectOptions extends PeerConnectOption {
    serialization: SerializationType
}

// Define types and interfaces to match PeerJS API as much as possible
export class PeerOptions implements PeerJSPeerOptions, PeerJSOption {
    /**
     * Prints log messages depending on the debug level passed in.
     */
    debug?: LogLevel;
    /**
     * Server host. Defaults to `0.peerjs.com`.
     * Also accepts `'/'` to signify relative hostname.
     */
    host?: string;
    /**
     * Server port. Defaults to `443`.
     */
    port?: number;
    /**
     * The path where your self-hosted PeerServer is running. Defaults to `'/'`
     */
    path?: string;
    /**
     * API key for the PeerServer.
     * This is not used anymore.
     * @deprecated
     */
    key?: string;
    token?: string;
    /**
     * Configuration hash passed to RTCPeerConnection.
     * This hash contains any custom ICE/TURN server configuration.
     *
     * Defaults to {@apilink util.defaultConfig}
     */
    config?: RTCConfiguration;
    /**
     * Set to true `true` if you're using TLS.
     * :::danger
     * If possible *always use TLS*
     * :::
     */
    secure?: boolean;
    pingInterval?: number;
    referrerPolicy?: ReferrerPolicy;
    logFunction?: (logLevel: LogLevel, ...rest: any[]) => void;
    pulsebeam: { token: string; insecureAuth?: never; } | { insecureAuth: { apiKey: string; apiSecret: string; authEndpoint?: string; groupId?: string; }; token?: never; };
    constructor(token?: string, apiKey?: string, apiSecret?: string, authEndpoint?: string, groupId?: string){
        if (token){
            this.pulsebeam = {token: token}
        } else {
            if (!apiKey || !apiSecret){throw new Error("PeerOptions cannot be constructed with provided params, see docs")}
            this.pulsebeam = {insecureAuth: {
                apiKey,
                apiSecret, 
                authEndpoint, 
                groupId
            }}
        }
    }
}
interface PeerJSOption extends IPeerJSPeerOption {
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
export { PeerJSOption };

type PeerEventType = keyof PeerEvents;
type PeerEventParams<T extends PeerEventType> = 
  ArgumentMap<PeerEvents>[T];
// // Replicate the PeerJS's ArgumentMap logic
type ArgumentMap<T extends Record<string, any>> = {
  [K in keyof T]: T[K] extends (...args: any[]) => void 
    ? Parameters<T[K]> 
    : T[K] extends any[] 
      ? T[K] 
      : never;
};
interface PeerJSPeerCompatible {
    /**
     * The brokering ID of this peer
     *
     * If no ID was specified in {@apilink Peer | the constructor},
     * this will be `undefined` until the {@apilink PeerEvents | `open`} event is emitted.
     */
    get id(): string;
    get options(): PeerOptions;
    /**
     * Connects to the remote peer specified by id and returns a data connection.
     * @param peer The brokering ID of the remote peer (their {@apilink Peer.id}).
     * @param options for specifying details about Peer Connection
     */
    connect(peer: string, options?: PeerConnectOption): DataConnection;
    /**
     * Calls the remote peer specified by id and returns a media connection.
     * @param peer The brokering ID of the remote peer (their peer.id).
     * @param stream The caller's media stream
     * @param options Metadata associated with the connection, passed in by whoever initiated the connection.
     */
    call(peer: string, stream: MediaStream, options?: CallOption): MediaConnection;
    on<T extends keyof PeerEvents>(event: T, fn: (...args: { open: [id: string]; connection: [dataConnection: PeerJSDataConnection]; call: [mediaConnection: PeerJSMediaConnection]; close: []; disconnected: [currentId: string]; error: [error: PeerError<'disconnected' | 'browser-incompatible' | 'invalid-id' | 'invalid-key' | 'network' | 'peer-unavailable' | 'ssl-unavailable' | 'server-error' | 'socket-error' | 'socket-closed' | 'unavailable-id' | 'webrtc'>]; }[Extract<T, keyof PeerEvents>]) => void, context?: undefined): this;
        /**
     * Destroys the Peer: closes all active connections as well as the connection
     * to the server.
     *
     * :::caution
     * This cannot be undone; the respective peer object will no longer be able
     * to create or receive any connections, its ID will be forfeited on the server,
     * and all of its data and media connections will be closed.
     * :::
     */
    destroy(): void;
    /**
     * Disconnects the Peer's connection to the PeerServer. Does not close any
     *  active connections.
     * Warning: The peer can no longer create or accept connections after being
     *  disconnected. It also cannot reconnect to the server.
     */
    disconnect(): void;
    /** Attempts to reconnect with the same ID.
     *
     * Only {@apilink Peer.disconnect | disconnected peers} can be reconnected.
     * Destroyed peers cannot be reconnected.
     * If the connection fails (as an example, if the peer's old ID is now taken),
     * the peer's existing connections will not close, but any associated errors events will fire.
     */
    reconnect(): void;
    /**
     * A hash of all connections associated with this peer, keyed by the remote peer's ID.
     * @deprecated
     * Return type will change from Object to Map<string,[]>
     */
    get connections(): Object;
    /**
     * true if this peer and all of its connections can no longer be used.
     */
    get destroyed(): boolean;
    /**
     * false if there is an active connection to the PeerServer.
     */
    get disconnected(): boolean;
}
export class Peer implements PeerJSPeerCompatible {
    private pulseBeamPeer: PulseBeamPeer | undefined;
    private groupId: string | undefined;
    private eventTargets: Record<PeerEventType, EventTarget>;
    private sessions = new Map<string, ISession>(); // peerID -> session
    private pendingConnections = new Map<string, Array<() => void>>();
    public options: PeerOptions;

    get id(){return this.pulseBeamPeer?.peerId || ""}
    get connections(){return []}

    constructor(id: string | undefined, options: PeerOptions) {
        this.options = options;
       
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

        if (!this.pulseBeamPeer) throw(`Failed to init`);

        this.pulseBeamPeer.onstatechange = () => {
            if (this.pulseBeamPeer?.state === 'closed') {
                this.emit('close')
                // Should we emit on data / media children?
            }
        }
        // Create session handler that handles both data channels and media
        this.pulseBeamPeer.onsession = (session) => {
            const peerId = session.other.peerId;
            this.emit('open', peerId)
            this.sessions.set(peerId, session);
            
            // Handle incoming communication
            session.ondatachannel = (event) => this.handleIncomingDataChannel(session, event);
            session.ontrack = (event) => this.handleIncomingMedia(session, event);
            
            // Process pending connections
            this.processPending(peerId);

            session.onconnectionstatechange = () => {
                if (session.connectionState === 'closed') {
                    this.sessions.delete(session.other.peerId);
                    session.ondatachannel = null;
                    session.ontrack = null;
                    this.emit('close')
                    // Emit close on all media / data channels?
                }
            };
        };
    }
    private handleIncomingDataChannel(session: ISession, event: RTCDataChannelEvent) {
        const otherPeerId = session.other.peerId;
        const dc = new DataConnection(otherPeerId, this, event.channel, {
            label: event.channel.label,
            serialization: event.channel.protocol as SerializationType
        });
        // @ts-ignore
        this.emit('connection', dc);
    }
    private handleIncomingMedia(session: ISession, event: RTCTrackEvent) {
        const otherPeerId = session.other.peerId;
        const mc = new MediaConnection(otherPeerId, this);
        mc._setSession(session);
        mc._setTransceiver(event.transceiver)
        event.streams.forEach( (stream) => {
            mc.emit('stream', stream);
        })
        // @ts-ignore
        this.emit('call', mc);
    }

    private processPending(peerId: string) {
        const pending = this.pendingConnections.get(peerId) || [];
        while (pending.length > 0) pending.shift()!();
        this.pendingConnections.delete(peerId);
    }
    private async getSession(peerId: string): Promise<ISession> {
        // Existing session
        if (this.sessions.has(peerId)) {
            return this.sessions.get(peerId)!;
        }
        
        // New connection
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                this.pendingConnections.delete(peerId);
                controller.abort();
            };
            
            const controller = new AbortController();
            const pending = this.pendingConnections.get(peerId) || [];
            
            pending.push(() => {
                cleanup();
                resolve(this.sessions.get(peerId)!);
            });
            
            this.pendingConnections.set(peerId, pending);
            
            try {
                this.pulseBeamPeer!.connect(
                    this.groupId!,
                    peerId,
                    controller.signal
                );
            } catch (err) {
                cleanup();
                reject(err);
            }
        });
    }
    private async resolveToken(options: PeerJSOption, id?: string): Promise<string> {
        if (options.pulsebeam?.token) {
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
    connect(peerId: string, options?: PeerConnectOption): DataConnection {
        const config: any = {maxRetransmitts: 0}
        if (options?.reliable){ delete config["maxRetransmitts"] }
        if (options?.serialization){ config["protocol"] = options.serialization}
        let dc: DataConnection | undefined = undefined;
        
        this.getSession(peerId).then(session => {
            const channel = session.createDataChannel(options?.label || "data", config);
            const otherPeerId = session.other.peerId;
            const dc = new DataConnection(otherPeerId, this, channel, options);
            return dc
        })

        if (!dc) throw(new Error('Argh'))
        return dc;
    }

    call(peer: string, stream: MediaStream, options?: CallOption): MediaConnection {
        let mc: MediaConnection | undefined = undefined
        const peerId = peer; // Keep param names consistent with PeerJS, alias here for clarity
        this.getSession(peerId).then(session => {
            stream.getTracks().forEach(track => {
                session.addTrack(track, stream);
            });
            const otherPeerId = session.other.peerId;
            mc = new MediaConnection(otherPeerId, this, options);
            mc._setSession(session);
            return mc;
        })
        if (!mc) throw(new Error("AGH")) // TODO fix this
        else return mc
        // TODO: handle options
    }

    public on<T extends PeerEventType>(
        event: T,
        callback: (...args: PeerEventParams<T>) => void
    ): this {
        const handler = (e: Event) => {
            const customEvent = e as CustomEvent<PeerEventParams<T>>;
            if (customEvent.detail) {
                callback(...customEvent.detail);
            } else {
                (callback as () => void)();
            }
        };
        this.eventTargets[event].addEventListener(event, handler);
        return this;
    }

    emit<T extends PeerEventType>(
        event: T,
        ...args: PeerEventParams<T>
    ): boolean {
        const eventInit = args.length > 0 ? { detail: args } : undefined;
        const customEvent = new CustomEvent(event, eventInit);
        return this.eventTargets[event].dispatchEvent(customEvent);
    }

    // PulseBeam does not supply this functionality, mapping this to no-op
    disconnect(): void {
        this.emit('disconnected', this.id);
    }

    // PulseBeam JS SDK reconnects automatically, mapping this to no-op
    reconnect(): void {}

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
        this.pulseBeamPeer.close()
        this.emit('close')
    }
}

// Helper type to extract event argument types
type DataConnectionEventsType = keyof DataConnectionEvents;
type DataConnectionEventParams<T extends DataConnectionEventsType> = 
  ArgumentMap<DataConnectionEvents>[T];
interface BaseConnectionCompatible {
    close(): void;
    get open(): boolean;
    /**
     * The optional label passed in or assigned by PeerJS when the connection was initiated.
     */
    readonly label: string;
    readonly options: any;
    readonly metadata: any;
    /**
     * The ID of the peer on the other end of this connection.
    */
   readonly peer: string;
   /**
    * For media connections, this is always 'media'.
    * For data connections, this is always 'data'.
   */
  get type(): ConnectionType;
  // Not supported - peerConnection: RTCPeerConnection;
}
interface PeerJSDataConnectionCompatible  extends BaseConnectionCompatible {
    /**
     * serialized by BinaryPack by default and sent to the remote peer.
     * @param data any type of data, including objects, strings, and blobs.
     * @param chunked 
     */
    send(data: any, chunked?: boolean): void | Promise<void>;
    /**
     * A reference to the RTCDataChannel object associated with the connection.
     */
    dataChannel: RTCDataChannel;
    /**
     * Whether the underlying data channels are reliable; defined when the connection was initiated.
    */
    readonly reliable: boolean;
    /**
     * The serialization format of the data sent over the connection. Can be binary (default), binary-utf8, json, or none.
     */
    readonly serialization: string;  // Test this, abstractness?
    /**
     * The number of messages queued to be sent once the browser buffer is no longer full.
     */
    get bufferSize(): number;
    on<T extends 'data' | 'open' | 'error' | 'close' | 'iceStateChanged'>(event: T, fn: (...args: { data: [data: unknown]; open: []; error: [error: PeerError<'not-open-yet' | 'message-too-big' | 'negotiation-failed' | 'connection-closed'>]; close: []; iceStateChanged: [state: RTCIceConnectionState]; }[Extract<T, 'data' | 'open' | 'error' | 'close' | 'iceStateChanged'>]) => void, context?: undefined): this;
}
export class DataConnection implements PeerJSDataConnectionCompatible {
    dataChannel: RTCDataChannel;
    public label: string = ''; // PulseBeam doesn't seem to have labels like PeerJS, might need to generate or ignore.
    public metadata: any = null; // PulseBeam metadata handling?
    // public peer: string; // PulseBeam peerId of the remote peer
    public reliable: boolean = false; // Reliability setting? PulseBeam options for data channels?
    public serialization: string = 'binary'; // Serialization? PulseBeam handling?
    public bufferSize: number = 0; // Buffer size tracking if needed
    private eventTargets: Record<DataConnectionEventsType, EventTarget>;
    readonly options: any;
    readonly peer: string;
    // TODO make compatible

    get open(): boolean {return true}  // TODO
    get type(){ return ConnectionType.Data }


    /**
     * 
     * @param peer other peer id - the id of the peer on the other end of the connection, the non-local peer
     * @param provider parent peer, peer that this DataConnection belongs to
     * @param options options on the DataConnection
     */
    constructor(peer: string, provider: Peer, dataChannel: RTCDataChannel, options?: any) {
        this.peer = peer
        this.dataChannel = dataChannel;
        this.options = options || {}
        this.eventTargets = {
            open: new EventTarget(),
            error: new EventTarget(),
            close: new EventTarget(),
            iceStateChanged: new EventTarget(),
            data: new EventTarget(),
        };
    }
    
    private setChanEvents(){
        this.dataChannel.onmessage = (messageEvent) => {
            this.emit('data', messageEvent.data);
        };
        this.dataChannel.onopen = () => {
            this.emit('open');
        };
        this.dataChannel.onclose = () => {
            this.emit('close');
        };
        this.dataChannel.onerror = (error) => {
            const err = error.error;
            console.error(`RTC Error Recieved: ${err}`)
            // PeerJS typing does not allow many types, this one matches best
            this.emit('error', new PeerError(DataConnectionErrorType["NotOpenYet"], err));
        };
        // if (this.session?.connectionState === 'connected' && chan.readyState === 'open'){
        //      this.emit('open');
        // }
        // if (this.session?.connectionState === 'closed' || chan.readyState === 'closed'){
        //     this.emit('close')
        // }
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
                if (e.name === "NetworkError"){
                    this.emit('error', new PeerError(BaseConnectionErrorType["ConnectionClosed"], e))
                    return
                } else {
                    this.emit('error', new PeerError(DataConnectionErrorType["NotOpenYet"], e))
                    return
                }
            }
            if (e instanceof TypeError){
                this.emit('error', new PeerError(DataConnectionErrorType["MessageToBig"], e))
                return
            }
            this.emit('error', new PeerError(DataConnectionErrorType["NotOpenYet"], "unknown error"))
        }
    }

    close(options? : {flush?: boolean }): void {
        if (options?.flush) {
			this.send({
				__peerData: {
					type: "close",
				},
			});
		}
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.close();
        }
        this.emit('close');
    }
    public on<T extends DataConnectionEventsType>(
        event: T,
        callback: (...args: DataConnectionEventParams<T>) => void
    ): this {
        const handler = (e: Event) => {
            const customEvent = e as CustomEvent<DataConnectionEventParams<T>>;
            if (customEvent.detail) {
                callback(...customEvent.detail);
            } else {
                (callback as () => void)();
            }
        };
        this.eventTargets[event].addEventListener(event, handler);
        return this;
    }

    emit<T extends DataConnectionEventsType>(
        event: T,
        ...args: DataConnectionEventParams<T>
    ): boolean {
        const eventInit = args.length > 0 ? { detail: args } : undefined;
        const customEvent = new CustomEvent(event, eventInit);
        return this.eventTargets[event].dispatchEvent(customEvent);
    }
}
// Helper type to extract event argument types
type MediaConnectionEventsType = keyof MediaConnectionEvents;
type MediaConnectionEventParams<T extends MediaConnectionEventsType> = 
  ArgumentMap<MediaConnectionEvents & BaseConnectionEvents<BaseConnectionErrorType>>[T];
interface PeerJSMediaConnectionCompatible extends BaseConnectionCompatible {
    answer(stream?: MediaStream, options?: AnswerOption): void;
    on<T extends 'stream' | 'willCloseOnRemote' | 'close' | 'error' | 'iceStateChanged'>(event: T, fn: (...args: { stream: [stream: MediaStream]; willCloseOnRemote: []; close: []; error: [error: PeerError<'negotiation-failed' | 'connection-closed'>]; iceStateChanged: [state: RTCIceConnectionState]; }[Extract<T, 'stream' | 'willCloseOnRemote' | 'close' | 'error' | 'iceStateChanged'>]) => void, context?: undefined): this;
}
export class MediaConnection implements PeerJSMediaConnectionCompatible {
    private session: ISession | undefined;
    private sender: RTCRtpSender | undefined;
    private transceiver: RTCRtpTransceiver | undefined;
    private eventTargets: Record<MediaConnectionEventsType, EventTarget>;
    readonly peer: string;
    metadata: any = null;
    readonly label: string;
    readonly options: any;

    public _setSession(sess: ISession){
        this.session = sess
    }
    public _setTransceiver(t: RTCRtpTransceiver){this.transceiver = t;}
    get type(){ return ConnectionType.Media }

    constructor(otherPeerId: string, parentPeer: Peer, options?: any) {
        this.label = options.label || "";
        this.metadata = options.metadata || {}
        this.eventTargets = {
            stream: new EventTarget(),
            error: new EventTarget(),
            close: new EventTarget(),
            iceStateChanged: new EventTarget(),
            willCloseOnRemote: new EventTarget(),
        };
        this.peer = otherPeerId
    }

    answer(stream?: MediaStream, options?: AnswerOption): void {
        if (options?.sdpTransform){
            console.error("MediaConnectionAdapter does not support sdpTransform.");
            return;
            // Let us know if you need this supported https://pulsebeam.dev/docs/community-and-support/support/
        }
         if (!this.session) {
             console.error("MediaConnectionAdapter not properly initialized with a session.");
             return;
         }
        if (stream) {
            stream.getTracks().forEach(track => {
                this.sender = this.session?.addTrack(track, stream);
            });
        }
    }

    get open(){
        if (this.session){
            return this.session.connectionState === 'connected'
        }
        return false
    }

    close(): void {
        // Cleanup media stream
        if (this.open){
            try {
                this.transceiver?.stop()
            } catch (error) {
                console.error(`Error closing Media Connection (in): ${error}`)
            }
            if (this.session && this.sender) {
                try {
                    this.session.removeTrack(this.sender)
                } catch (error) {
                    console.error(`Error closing Media Connection (outgoing): ${error}`)
                }
            }
            this.emit('close');
        }
    }

    public on<T extends MediaConnectionEventsType>(
        event: T,
        callback: (...args: MediaConnectionEventParams<T>) => void
    ): this {
        const handler = (e: Event) => {
            const customEvent = e as CustomEvent<MediaConnectionEventParams<T>>;
            if (customEvent.detail) {
                callback(...customEvent.detail);
            } else {
                (callback as () => void)();
            }
        };
        this.eventTargets[event].addEventListener(event, handler);
        return this;
    }

    emit<T extends MediaConnectionEventsType>(
        event: T,
        ...args: MediaConnectionEventParams<T>
    ): boolean {
        const eventInit = args.length > 0 ? { detail: args } : undefined;
        const customEvent = new CustomEvent(event, eventInit);
        return this.eventTargets[event].dispatchEvent(customEvent);
    }
}

interface PeerJSUtilCompatible {
    readonly browser: string;
    readonly supports: UtilSupportsObj;
}
export class Util implements PeerJSUtilCompatible {
    readonly browser: string;
    readonly supports: UtilSupportsObj;

    constructor(){
        //  The current browser. util.browser can currently have the values 'firefox', 'chrome', 'safari', 'edge', 'Not a supported browser.', 'Not a browser.' (unknown WebRTC-compatible agent). 
        this.browser = 'Firefox'
        // A hash of WebRTC features mapped to booleans that correspond to 
        // whether the feature is supported by the current browser. 
        this.supports = {
            browser: true,
            webRTC: true,
            /**
             * True if the current browser supports media streams and PeerConnection.
             */
            audioVideo: true,
            /**
             * True if the current browser supports DataChannel and PeerConnection.
             */
            data: true,
            /**
             *  True if the current browser supports binary DataChannels.  
             */
            binaryBlob:true,
            // @ts-ignore PeerJS docs say this should be here, mismatch in PeerJS docs & code.
            binary: true,
            /**
             * True if the current browser supports reliable DataChannels.
             */
            reliable: true,
        }
    }
}