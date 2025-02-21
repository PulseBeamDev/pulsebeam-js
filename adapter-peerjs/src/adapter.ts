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
    PeerJSOption, 
    PeerConnectOption, 
    ConnectionType, 
    SerializationType, 
    Util as PeerJSUtil, 
    DataConnectionEvents, 
    MediaConnectionEvents, 
    PeerError, 
    DataConnectionErrorType, 
    BaseConnectionErrorType,
    UtilSupportsObj,
    AnswerOption,
} from './types';

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
export class Peer extends PeerJSPeer{
    private pulseBeamPeer: PulseBeamPeer | undefined;
    private groupId: string | undefined;
    private eventTargets: Record<PeerEventType, EventTarget>;
    private sessions = new Map<string, ISession>(); // peerID -> session
    private pendingConnections = new Map<string, Array<() => void>>();
    private _options: PulseBeamOptions | undefined;

    get id(){return this.pulseBeamPeer?.peerId || ""}
    get options(){return {...this._options}}
    get connections(){return []}

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
        const dc = new DataConnection(this, {
            label: event.channel.label,
            serialization: event.channel.protocol as SerializationType
        });
        
        dc._setSession(session);
        dc._setChannel(event.channel);
        this.emit('connection', dc);
    }
    private handleIncomingMedia(session: ISession, event: RTCTrackEvent) {
        const mc = new MediaConnection(this);
        mc._setSession(session);
        mc._setTransceiver(event.transceiver)
        event.streams.forEach( (stream) => {
            mc.emit('stream', stream);
        })
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
    private async resolveToken(options: PulseBeamOptions, id?: string): Promise<string> {
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
        const dc = new DataConnection(this, options);
        
        this.getSession(peerId).then(session => {
            const channel = session.createDataChannel(options?.label || "data", config);
            dc._setSession(session);
            dc._setChannel(channel);
        }).catch(err => {
            dc.emit('error', err);
        });

        return dc;
    }

    call(peerId: string, stream: MediaStream): MediaConnection {
        const mc = new MediaConnection(this);
        
        this.getSession(peerId).then(session => {
            stream.getTracks().forEach(track => {
                session.addTrack(track, stream);
            });
            mc._setSession(session);
        }).catch(err => {
            mc.emit('error', err);
        });
        
        return mc;
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

    public _setChannel(chan: RTCDataChannel){
        this.channel = chan;
        chan.onmessage = (messageEvent) => {
            this.emit('data', messageEvent.data);
        };
        chan.onopen = () => {
            this.emit('open');
        };
        chan.onclose = () => {
            this.emit('close');
        };
        chan.onerror = (error) => {
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
			return;
		}
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.close();
        }
        if (this.open) {
            this.emit('close');
        }
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

export class MediaConnection extends PeerJSMediaConnection {
    private session: ISession | undefined;
    private sender: RTCRtpSender | undefined;
    private transceiver: RTCRtpTransceiver | undefined;
    private eventTargets: Record<MediaConnectionEventsType, EventTarget>;
    public metadata: any = null;
    private otherPeerId: string | undefined;

    public _setSession(sess: ISession){
        this.session = sess
        this.otherPeerId = sess.other.peerId;
    }
    public _setTransceiver(t: RTCRtpTransceiver){this.transceiver = t;}
    get type(){ return ConnectionType.Media }

    constructor(parentPeer: Peer, options?: any) {
        super(parentPeer.id, parentPeer, options)
        this.eventTargets = {
            stream: new EventTarget(),
            error: new EventTarget(),
            close: new EventTarget(),
            iceStateChanged: new EventTarget(),
            willCloseOnRemote: new EventTarget(),
        };
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

export class Util extends PeerJSUtil {
    public browser: string;
    public supports: UtilSupportsObj;

    constructor(){
        super()
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