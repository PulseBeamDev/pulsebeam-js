import * as BinaryPack from "peerjs-js-binarypack";
import { EventEmitter, ValidEventTypes } from "eventemitter3";
declare class BinaryPackChunker {
    readonly chunkedMTU = 16300;
    chunk: (blob: ArrayBuffer) => {
        __peerData: number;
        n: number;
        total: number;
        data: Uint8Array;
    }[];
}
export interface UtilSupportsObj {
    /**
     * The current browser.
     * This property can be useful in determining whether two peers can connect.
     *
     * ```ts
     * if (util.browser === 'firefox') {
     *  // OK to peer with Firefox peers.
     * }
     * ```
     *
     * `util.browser` can currently have the values
     * `'firefox', 'chrome', 'safari', 'edge', 'Not a supported browser.', 'Not a browser.' (unknown WebRTC-compatible agent).
     */
    browser: boolean;
    webRTC: boolean;
    /**
     * True if the current browser supports media streams and PeerConnection.
     */
    audioVideo: boolean;
    /**
     * True if the current browser supports DataChannel and PeerConnection.
     */
    data: boolean;
    binaryBlob: boolean;
    /**
     * True if the current browser supports reliable DataChannels.
     */
    reliable: boolean;
}
export class Util extends BinaryPackChunker {
    noop(): void;
    readonly CLOUD_HOST = "0.peerjs.com";
    readonly CLOUD_PORT = 443;
    readonly chunkedBrowsers: {
        Chrome: number;
        chrome: number;
    };
    readonly defaultConfig: {
        iceServers: ({
            urls: string;
            username?: undefined;
            credential?: undefined;
        } | {
            urls: string[];
            username: string;
            credential: string;
        })[];
        sdpSemantics: string;
    };
    readonly browser: string;
    readonly browserVersion: number;
    pack: typeof BinaryPack.pack;
    unpack: typeof BinaryPack.unpack;
    /**
     * A hash of WebRTC features mapped to booleans that correspond to whether the feature is supported by the current browser.
     *
     * :::caution
     * Only the properties documented here are guaranteed to be present on `util.supports`
     * :::
     */
    readonly supports: UtilSupportsObj;
    validateId: (id: string) => boolean;
    randomToken: () => string;
    blobToArrayBuffer(blob: Blob, cb: (arg: ArrayBuffer | null) => void): FileReader;
    binaryStringToArrayBuffer(binary: string): ArrayBuffer | SharedArrayBuffer;
    isSecure(): boolean;
}
/**
 * Provides a variety of helpful utilities.
 *
 * :::caution
 * Only the utilities documented here are guaranteed to be present on `util`.
 * Undocumented utilities can be removed without warning.
 * We don't consider these to be breaking changes.
 * :::
 */
export const util: Util;
export enum LogLevel {
    /**
     * Prints no logs.
     */
    Disabled = 0,
    /**
     * Prints only errors.
     */
    Errors = 1,
    /**
     * Prints errors and warnings.
     */
    Warnings = 2,
    /**
     * Prints all logs.
     */
    All = 3
}
export enum ConnectionType {
    Data = "data",
    Media = "media"
}
export enum PeerErrorType {
    /**
     * The client's browser does not support some or all WebRTC features that you are trying to use.
     */
    BrowserIncompatible = "browser-incompatible",
    /**
     * You've already disconnected this peer from the server and can no longer make any new connections on it.
     */
    Disconnected = "disconnected",
    /**
     * The ID passed into the Peer constructor contains illegal characters.
     */
    InvalidID = "invalid-id",
    /**
     * The API key passed into the Peer constructor contains illegal characters or is not in the system (cloud server only).
     */
    InvalidKey = "invalid-key",
    /**
     * Lost or cannot establish a connection to the signalling server.
     */
    Network = "network",
    /**
     * The peer you're trying to connect to does not exist.
     */
    PeerUnavailable = "peer-unavailable",
    /**
     * PeerJS is being used securely, but the cloud server does not support SSL. Use a custom PeerServer.
     */
    SslUnavailable = "ssl-unavailable",
    /**
     * Unable to reach the server.
     */
    ServerError = "server-error",
    /**
     * An error from the underlying socket.
     */
    SocketError = "socket-error",
    /**
     * The underlying socket closed unexpectedly.
     */
    SocketClosed = "socket-closed",
    /**
     * The ID passed into the Peer constructor is already taken.
     *
     * :::caution
     * This error is not fatal if your peer has open peer-to-peer connections.
     * This can happen if you attempt to {@apilink Peer.reconnect} a peer that has been disconnected from the server,
     * but its old ID has now been taken.
     * :::
     */
    UnavailableID = "unavailable-id",
    /**
     * Native WebRTC errors.
     */
    WebRTC = "webrtc"
}
export enum BaseConnectionErrorType {
    NegotiationFailed = "negotiation-failed",
    ConnectionClosed = "connection-closed"
}
export enum DataConnectionErrorType {
    NotOpenYet = "not-open-yet",
    MessageToBig = "message-too-big"
}
export enum SerializationType {
    Binary = "binary",
    BinaryUTF8 = "binary-utf8",
    JSON = "json",
    None = "raw"
}
export enum SocketEventType {
    Message = "message",
    Disconnected = "disconnected",
    Error = "error",
    Close = "close"
}
export enum ServerMessageType {
    Heartbeat = "HEARTBEAT",
    Candidate = "CANDIDATE",
    Offer = "OFFER",
    Answer = "ANSWER",
    Open = "OPEN",// The connection to the server is open.
    Error = "ERROR",// Server error.
    IdTaken = "ID-TAKEN",// The selected ID is taken.
    InvalidKey = "INVALID-KEY",// The given API key cannot be found.
    Leave = "LEAVE",// Another peer has closed its connection to this peer.
    Expire = "EXPIRE"
}
/**
 * An abstraction on top of WebSockets to provide fastest
 * possible connection for peers.
 */
declare class Socket extends EventEmitter {
    constructor(secure: any, host: string, port: number, path: string, key: string, pingInterval?: number);
    start(id: string, token: string): void;
    /** Exposed send for DC & Peer. */
    send(data: any): void;
    close(): void;
}
declare class ServerMessage {
    type: ServerMessageType;
    payload: any;
    src: string;
}
interface EventsWithError<ErrorType extends string> {
    error: (error: PeerError<`${ErrorType}`>) => void;
}
declare class EventEmitterWithError<ErrorType extends string, Events extends EventsWithError<ErrorType>> extends EventEmitter<Events, never> {
    /**
     * Emits a typed error message.
     *
     * @internal
     */
    emitError(type: ErrorType, err: string | Error): void;
}
/**
 * A PeerError is emitted whenever an error occurs.
 * It always has a `.type`, which can be used to identify the error.
 */
export class PeerError<T extends string> extends Error {
    /**
     * @internal
     */
    constructor(type: T, err: Error | string);
    type: T;
}
interface BaseConnectionEvents<ErrorType extends string = BaseConnectionErrorType> extends EventsWithError<ErrorType> {
    /**
     * Emitted when either you or the remote peer closes the connection.
     *
     * ```ts
     * connection.on('close', () => { ... });
     * ```
     */
    close: () => void;
    /**
     * ```ts
     * connection.on('error', (error) => { ... });
     * ```
     */
    error: (error: PeerError<`${ErrorType}`>) => void;
    iceStateChanged: (state: RTCIceConnectionState) => void;
}
declare abstract class BaseConnection<SubClassEvents extends ValidEventTypes, ErrorType extends string = never> extends EventEmitterWithError<ErrorType | BaseConnectionErrorType, SubClassEvents & BaseConnectionEvents<BaseConnectionErrorType | ErrorType>> {
    /**
     * The ID of the peer on the other end of this connection.
     */
    readonly peer: string;
    provider: Peer;
    readonly options: any;
    protected _open: boolean;
    /**
     * Any type of metadata associated with the connection,
     * passed in by whoever initiated the connection.
     */
    readonly metadata: any;
    connectionId: string;
    peerConnection: RTCPeerConnection;
    dataChannel: RTCDataChannel;
    abstract get type(): ConnectionType;
    /**
     * The optional label passed in or assigned by PeerJS when the connection was initiated.
     */
    label: string;
    /**
     * Whether the media connection is active (e.g. your call has been answered).
     * You can check this if you want to set a maximum wait time for a one-sided call.
     */
    get open(): boolean;
    protected constructor(
    /**
     * The ID of the peer on the other end of this connection.
     */
    peer: string, provider: Peer, options: any);
    abstract close(): void;
    /**
     * @internal
     */
    abstract handleMessage(message: ServerMessage): void;
    /**
     * Called by the Negotiator when the DataChannel is ready.
     * @internal
     * */
    abstract _initializeDataChannel(dc: RTCDataChannel): void;
}
interface DataConnectionEvents extends EventsWithError<DataConnectionErrorType | BaseConnectionErrorType>, BaseConnectionEvents<DataConnectionErrorType | BaseConnectionErrorType> {
    /**
     * Emitted when data is received from the remote peer.
     */
    data: (data: unknown) => void;
    /**
     * Emitted when the connection is established and ready-to-use.
     */
    open: () => void;
}
/**
 * Wraps a DataChannel between two Peers.
 */
export abstract class DataConnection extends BaseConnection<DataConnectionEvents, DataConnectionErrorType> {
    protected static readonly ID_PREFIX = "dc_";
    protected static readonly MAX_BUFFERED_AMOUNT: number;
    abstract readonly serialization: string;
    readonly reliable: boolean;
    get type(): ConnectionType;
    constructor(peerId: string, provider: Peer, options: any);
    /** Called by the Negotiator when the DataChannel is ready. */
    _initializeDataChannel(dc: RTCDataChannel): void;
    /**
     * Exposed functionality for users.
     */
    /** Allows user to close connection. */
    close(options?: {
        flush?: boolean;
    }): void;
    protected abstract _send(data: any, chunked: boolean): void | Promise<void>;
    /** Allows user to send data. */
    send(data: any, chunked?: boolean): void | Promise<void>;
    handleMessage(message: ServerMessage): Promise<void>;
}
export interface AnswerOption {
    /**
     * Function which runs before create answer to modify sdp answer message.
     */
    sdpTransform?: Function;
}
export interface PeerJSOption {
    key?: string;
    host?: string;
    port?: number;
    path?: string;
    secure?: boolean;
    token?: string;
    config?: RTCConfiguration;
    debug?: number;
    referrerPolicy?: ReferrerPolicy;
}
export interface PeerConnectOption {
    /**
     * A unique label by which you want to identify this data connection.
     * If left unspecified, a label will be generated at random.
     *
     * Can be accessed with {@apilink DataConnection.label}
     */
    label?: string;
    /**
     * Metadata associated with the connection, passed in by whoever initiated the connection.
     *
     * Can be accessed with {@apilink DataConnection.metadata}.
     * Can be any serializable type.
     */
    metadata?: any;
    serialization?: string;
    reliable?: boolean;
}
export interface CallOption {
    /**
     * Metadata associated with the connection, passed in by whoever initiated the connection.
     *
     * Can be accessed with {@apilink MediaConnection.metadata}.
     * Can be any serializable type.
     */
    metadata?: any;
    /**
     * Function which runs before create offer to modify sdp offer message.
     */
    sdpTransform?: Function;
}
interface MediaConnectionEvents extends BaseConnectionEvents<never> {
    /**
     * Emitted when a connection to the PeerServer is established.
     *
     * ```ts
     * mediaConnection.on('stream', (stream) => { ... });
     * ```
     */
    stream: (stream: MediaStream) => void;
    /**
     * Emitted when the auxiliary data channel is established.
     * After this event, hanging up will close the connection cleanly on the remote peer.
     * @beta
     */
    willCloseOnRemote: () => void;
}
/**
 * Wraps WebRTC's media streams.
 * To get one, use {@apilink Peer.call} or listen for the {@apilink PeerEvents | `call`} event.
 */
export class MediaConnection extends BaseConnection<MediaConnectionEvents> {
    readonly label: string;
    /**
     * For media connections, this is always 'media'.
     */
    get type(): ConnectionType;
    get localStream(): MediaStream;
    get remoteStream(): MediaStream;
    constructor(peerId: string, provider: Peer, options: any);
    /** Called by the Negotiator when the DataChannel is ready. */
    _initializeDataChannel(dc: RTCDataChannel): void;
    addStream(remoteStream: any): void;
    /**
     * @internal
     */
    handleMessage(message: ServerMessage): void;
    /**
     * When receiving a {@apilink PeerEvents | `call`} event on a peer, you can call
     * `answer` on the media connection provided by the callback to accept the call
     * and optionally send your own media stream.

     *
     * @param stream A WebRTC media stream.
     * @param options
     * @returns
     */
    answer(stream?: MediaStream, options?: AnswerOption): void;
    /**
     * Exposed functionality for users.
     */
    /**
     * Closes the media connection.
     */
    close(): void;
}
export abstract class BufferedConnection extends DataConnection {
    get bufferSize(): number;
    _initializeDataChannel(dc: RTCDataChannel): void;
    protected abstract _handleDataMessage(e: MessageEvent): void;
    protected _bufferedSend(msg: ArrayBuffer): void;
    close(options?: {
        flush?: boolean;
    }): void;
}
export class PeerOptions implements PeerJSOption {
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
    config?: any;
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
    serializers?: SerializerMapping;
}
export interface SerializerMapping {
    [key: string]: new (peerId: string, provider: Peer, options: any) => DataConnection;
}
export interface PeerEvents {
    /**
     * Emitted when a connection to the PeerServer is established.
     *
     * You may use the peer before this is emitted, but messages to the server will be queued. <code>id</code> is the brokering ID of the peer (which was either provided in the constructor or assigned by the server).<span class='tip'>You should not wait for this event before connecting to other peers if connection speed is important.</span>
     */
    open: (id: string) => void;
    /**
     * Emitted when a new data connection is established from a remote peer.
     */
    connection: (dataConnection: DataConnection) => void;
    /**
     * Emitted when a remote peer attempts to call you.
     */
    call: (mediaConnection: MediaConnection) => void;
    /**
     * Emitted when the peer is destroyed and can no longer accept or create any new connections.
     */
    close: () => void;
    /**
     * Emitted when the peer is disconnected from the signalling server
     */
    disconnected: (currentId: string) => void;
    /**
     * Errors on the peer are almost always fatal and will destroy the peer.
     *
     * Errors from the underlying socket and PeerConnections are forwarded here.
     */
    error: (error: PeerError<`${PeerErrorType}`>) => void;
}
/**
 * A peer who can initiate connections with other peers.
 */
export class Peer extends EventEmitterWithError<PeerErrorType, PeerEvents> {
    protected readonly _serializers: SerializerMapping;
    /**
     * The brokering ID of this peer
     *
     * If no ID was specified in {@apilink Peer | the constructor},
     * this will be `undefined` until the {@apilink PeerEvents | `open`} event is emitted.
     */
    get id(): string;
    get options(): PeerOptions;
    get open(): boolean;
    /**
     * @internal
     */
    get socket(): Socket;
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
    /**
     * A peer can connect to other peers and listen for connections.
     */
    constructor();
    /**
     * A peer can connect to other peers and listen for connections.
     * @param options for specifying details about PeerServer
     */
    constructor(options: PeerOptions);
    /**
     * A peer can connect to other peers and listen for connections.
     * @param id Other peers can connect to this peer using the provided ID.
     *     If no ID is given, one will be generated by the brokering server.
     * The ID must start and end with an alphanumeric character (lower or upper case character or a digit). In the middle of the ID spaces, dashes (-) and underscores (_) are allowed. Use {@apilink PeerOptions.metadata } to send identifying information.
     * @param options for specifying details about PeerServer
     */
    constructor(id: string, options?: PeerOptions);
    /**
     * Retrieve messages from lost message store
     * @internal
     */
    _getMessages(connectionId: string): ServerMessage[];
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
    _removeConnection(connection: DataConnection | MediaConnection): void;
    /** Retrieve a data/media connection for this peer. */
    getConnection(peerId: string, connectionId: string): null | DataConnection | MediaConnection;
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
     * Get a list of available peer IDs. If you're running your own server, you'll
     * want to set allow_discovery: true in the PeerServer options. If you're using
     * the cloud server, email team@peerjs.com to get the functionality enabled for
     * your key.
     */
    listAllPeers(cb?: (_: any[]) => void): void;
}
/**
 * @experimental
 */
export class MsgPackPeer extends Peer {
    _serializers: SerializerMapping;
}
export abstract class StreamConnection extends DataConnection {
    protected writer: WritableStreamDefaultWriter<Uint8Array>;
    protected _rawReadStream: ReadableStream<ArrayBuffer>;
    protected constructor(peerId: string, provider: Peer, options: any);
    _initializeDataChannel(dc: any): void;
}
export class MsgPack extends StreamConnection {
    readonly serialization = "MsgPack";
    constructor(peerId: string, provider: Peer, options: any);
    protected _send(data: any): Promise<void>;
}
export default Peer;

//# sourceMappingURL=types.d.ts.map
