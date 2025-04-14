// @generated by protobuf-ts 2.9.4 with parameter client_generic
// @generated from protobuf file "signaling.proto" (package "pulsebeam.v1", syntax proto3)
// tslint:disable
import { ServiceType } from "@protobuf-ts/runtime-rpc";
import { MessageType } from "@protobuf-ts/runtime";
/**
 * @generated from protobuf message pulsebeam.v1.PrepareReq
 */
export interface PrepareReq {
}
/**
 * @generated from protobuf message pulsebeam.v1.PrepareResp
 */
export interface PrepareResp {
    /**
     * @generated from protobuf field: repeated pulsebeam.v1.IceServer ice_servers = 1;
     */
    iceServers: IceServer[];
}
/**
 * @generated from protobuf message pulsebeam.v1.IceServer
 */
export interface IceServer {
    /**
     * @generated from protobuf field: repeated string urls = 1;
     */
    urls: string[];
    /**
     * @generated from protobuf field: optional string username = 2;
     */
    username?: string;
    /**
     * @generated from protobuf field: optional string credential = 3;
     */
    credential?: string;
}
/**
 * @generated from protobuf message pulsebeam.v1.SendReq
 */
export interface SendReq {
    /**
     * @generated from protobuf field: pulsebeam.v1.Message msg = 1;
     */
    msg?: Message;
}
/**
 * @generated from protobuf message pulsebeam.v1.SendResp
 */
export interface SendResp {
}
/**
 * @generated from protobuf message pulsebeam.v1.RecvReq
 */
export interface RecvReq {
    /**
     * @generated from protobuf field: pulsebeam.v1.PeerInfo src = 1;
     */
    src?: PeerInfo;
}
/**
 * @generated from protobuf message pulsebeam.v1.RecvResp
 */
export interface RecvResp {
    /**
     * @generated from protobuf field: pulsebeam.v1.Message msg = 1;
     */
    msg?: Message;
}
/**
 * @generated from protobuf message pulsebeam.v1.PeerInfo
 */
export interface PeerInfo {
    /**
     * @generated from protobuf field: string group_id = 1;
     */
    groupId: string;
    /**
     * where this message is originated from. Special values: "SYSTEM"
     *
     * @generated from protobuf field: string peer_id = 2;
     */
    peerId: string;
    /**
     * used for deciding polite vs impolite. higher id wins. It also is used to detect connection breakages
     * WARNING, reserved values: 0-16
     *
     * @generated from protobuf field: uint32 conn_id = 3;
     */
    connId: number;
}
/**
 * Use small tag numbers (1-15) for fields that are frequently used or are performance-sensitive, even if they are optional.
 * Larger tag numbers (16 and above) can be used for fields that are optional and not frequently included in messages, as they will require more bytes to encode.
 * Avoid the 19000–19999 range, as it's reserved.
 * Consider future-proofing your schema by leaving gaps between field numbers to allow for extensions or new fields later.
 *
 * @generated from protobuf message pulsebeam.v1.Message
 */
export interface Message {
    /**
     * @generated from protobuf field: pulsebeam.v1.MessageHeader header = 1;
     */
    header?: MessageHeader;
    /**
     * payload will be treated as opaque in backend. Size limit is 10kB.
     *
     * @generated from protobuf field: pulsebeam.v1.MessagePayload payload = 2;
     */
    payload?: MessagePayload;
}
/**
 * @generated from protobuf message pulsebeam.v1.MessagePayload
 */
export interface MessagePayload {
    /**
     * @generated from protobuf oneof: payload_type
     */
    payloadType: {
        oneofKind: "signal";
        /**
         * @generated from protobuf field: pulsebeam.v1.Signal signal = 1;
         */
        signal: Signal;
    } | {
        oneofKind: "join";
        /**
         * @generated from protobuf field: pulsebeam.v1.Join join = 2;
         */
        join: Join;
    } | {
        oneofKind: "bye";
        /**
         * @generated from protobuf field: pulsebeam.v1.Bye bye = 3;
         */
        bye: Bye;
    } | {
        oneofKind: "ack";
        /**
         * @generated from protobuf field: pulsebeam.v1.Ack ack = 4;
         */
        ack: Ack;
    } | {
        oneofKind: "ping";
        /**
         * @generated from protobuf field: pulsebeam.v1.Ping ping = 5;
         */
        ping: Ping;
    } | {
        oneofKind: undefined;
    };
}
/**
 * @generated from protobuf message pulsebeam.v1.MessageHeader
 */
export interface MessageHeader {
    /**
     * @generated from protobuf field: pulsebeam.v1.PeerInfo src = 1;
     */
    src?: PeerInfo;
    /**
     * @generated from protobuf field: pulsebeam.v1.PeerInfo dst = 2;
     */
    dst?: PeerInfo;
    /**
     * @generated from protobuf field: uint32 seqnum = 7;
     */
    seqnum: number;
    /**
     * @generated from protobuf field: bool reliable = 8;
     */
    reliable: boolean; // true: tcp like, false: fire & forget
}
/**
 * @generated from protobuf message pulsebeam.v1.Signal
 */
export interface Signal {
    /**
     * @generated from protobuf field: uint32 generation_counter = 1;
     */
    generationCounter: number;
    /**
     * @generated from protobuf oneof: data
     */
    data: {
        oneofKind: "sdp";
        /**
         * @generated from protobuf field: pulsebeam.v1.Sdp sdp = 9;
         */
        sdp: Sdp;
    } | {
        oneofKind: "iceCandidate";
        /**
         * @generated from protobuf field: pulsebeam.v1.ICECandidate ice_candidate = 10;
         */
        iceCandidate: ICECandidate;
    } | {
        oneofKind: "iceCandidateBatch";
        /**
         * @generated from protobuf field: pulsebeam.v1.ICECandidateBatch ice_candidate_batch = 11;
         */
        iceCandidateBatch: ICECandidateBatch;
    } | {
        oneofKind: undefined;
    };
}
/**
 * @generated from protobuf message pulsebeam.v1.Sdp
 */
export interface Sdp {
    /**
     * @generated from protobuf field: pulsebeam.v1.SdpKind kind = 1;
     */
    kind: SdpKind;
    /**
     * @generated from protobuf field: string sdp = 2;
     */
    sdp: string;
}
/**
 * @generated from protobuf message pulsebeam.v1.ICECandidateBatch
 */
export interface ICECandidateBatch {
    /**
     * @generated from protobuf field: repeated pulsebeam.v1.ICECandidate candidates = 1;
     */
    candidates: ICECandidate[];
}
/**
 * @generated from protobuf message pulsebeam.v1.ICECandidate
 */
export interface ICECandidate {
    /**
     * @generated from protobuf field: string candidate = 1;
     */
    candidate: string;
    /**
     * @generated from protobuf field: optional uint32 sdp_m_line_index = 2;
     */
    sdpMLineIndex?: number;
    /**
     * @generated from protobuf field: optional string sdp_mid = 3;
     */
    sdpMid?: string;
    /**
     * @generated from protobuf field: optional string username = 4;
     */
    username?: string;
    /**
     * @generated from protobuf field: optional string password = 5;
     */
    password?: string;
}
/**
 * @generated from protobuf message pulsebeam.v1.Join
 */
export interface Join {
}
/**
 * @generated from protobuf message pulsebeam.v1.Bye
 */
export interface Bye {
}
/**
 * @generated from protobuf message pulsebeam.v1.Ack
 */
export interface Ack {
    /**
     * @generated from protobuf field: repeated pulsebeam.v1.AckRange ack_ranges = 1;
     */
    ackRanges: AckRange[];
}
/**
 * @generated from protobuf message pulsebeam.v1.Ping
 */
export interface Ping {
}
/**
 * @generated from protobuf message pulsebeam.v1.AckRange
 */
export interface AckRange {
    /**
     * @generated from protobuf field: uint32 seqnum_start = 1;
     */
    seqnumStart: number;
    /**
     * @generated from protobuf field: uint32 seqnum_end = 2;
     */
    seqnumEnd: number;
}
/**
 * reserved for headers
 *
 * @generated from protobuf message pulsebeam.v1.DataChannel
 */
export interface DataChannel {
    /**
     * @generated from protobuf oneof: payload
     */
    payload: {
        oneofKind: "heartbeat";
        /**
         * @generated from protobuf field: pulsebeam.v1.DataChannelHeartbeat heartbeat = 10;
         */
        heartbeat: DataChannelHeartbeat;
    } | {
        oneofKind: undefined;
    };
}
/**
 * @generated from protobuf message pulsebeam.v1.DataChannelHeartbeat
 */
export interface DataChannelHeartbeat {
}
/**
 * @generated from protobuf message pulsebeam.v1.AnalyticsReportReq
 */
export interface AnalyticsReportReq {
    /**
     * @generated from protobuf field: repeated pulsebeam.v1.AnalyticsEvent events = 1;
     */
    events: AnalyticsEvent[];
}
/**
 * @generated from protobuf message pulsebeam.v1.AnalyticsEvent
 */
export interface AnalyticsEvent {
    /**
     * @generated from protobuf field: pulsebeam.v1.AnalyticsTags tags = 1;
     */
    tags?: AnalyticsTags;
    /**
     * @generated from protobuf field: repeated pulsebeam.v1.AnalyticsMetrics metrics = 2;
     */
    metrics: AnalyticsMetrics[];
}
/**
 * @generated from protobuf message pulsebeam.v1.AnalyticsTags
 */
export interface AnalyticsTags {
    /**
     * @generated from protobuf field: pulsebeam.v1.PeerInfo src = 1;
     */
    src?: PeerInfo;
    /**
     * @generated from protobuf field: pulsebeam.v1.PeerInfo dst = 2;
     */
    dst?: PeerInfo;
}
/**
 * "scaled" = trunc(X * 10^3)
 *
 * @generated from protobuf message pulsebeam.v1.AnalyticsMetrics
 */
export interface AnalyticsMetrics {
    /**
     * @generated from protobuf field: sint64 timestamp_us = 1;
     */
    timestampUs: bigint;
    /**
     * @generated from protobuf field: optional pulsebeam.v1.EventType event_type = 2;
     */
    eventType?: EventType;
    /**
     * The overall derived quality score:
     * - 80-100: excellent
     * - 60-79: good
     * - 40-59: fair
     * - 20-39: poor
     * - 0-19: bad
     *
     * @generated from protobuf field: optional sint64 quality_score = 3;
     */
    qualityScore?: bigint;
    /**
     * @generated from protobuf field: optional sint64 rtt_us = 4;
     */
    rttUs?: bigint;
}
/**
 * @generated from protobuf message pulsebeam.v1.AnalyticsReportResp
 */
export interface AnalyticsReportResp {
}
/**
 * @generated from protobuf enum pulsebeam.v1.SdpKind
 */
export enum SdpKind {
    /**
     * @generated from protobuf enum value: SDP_KIND_UNSPECIFIED = 0;
     */
    UNSPECIFIED = 0,
    /**
     * @generated from protobuf enum value: SDP_KIND_OFFER = 1;
     */
    OFFER = 1,
    /**
     * @generated from protobuf enum value: SDP_KIND_ANSWER = 2;
     */
    ANSWER = 2,
    /**
     * @generated from protobuf enum value: SDP_KIND_PRANSWER = 3;
     */
    PRANSWER = 3,
    /**
     * @generated from protobuf enum value: SDP_KIND_ROLLBACK = 4;
     */
    ROLLBACK = 4
}
/**
 * @generated from protobuf enum pulsebeam.v1.EventType
 */
export enum EventType {
    /**
     * Default value, should always be the first
     *
     * @generated from protobuf enum value: UNKNOWN_EVENT = 0;
     */
    UNKNOWN_EVENT = 0,
    /**
     * --- ICE Candidate Events (Range: 1000 - 1099) ---
     *
     * Base for ICE candidate related events
     *
     * @generated from protobuf enum value: EVENT_ICE_CANDIDATE_BASE = 1000;
     */
    EVENT_ICE_CANDIDATE_BASE = 1000,
    /**
     * ICE gathering process initiated
     *
     * @generated from protobuf enum value: EVENT_ICE_CANDIDATE_GATHERING_STARTED = 1001;
     */
    EVENT_ICE_CANDIDATE_GATHERING_STARTED = 1001,
    /**
     * A reflexive ICE candidate was discovered
     *
     * @generated from protobuf enum value: EVENT_ICE_CANDIDATE_LOCAL_REFLEXIVE_FOUND = 1002;
     */
    EVENT_ICE_CANDIDATE_LOCAL_REFLEXIVE_FOUND = 1002,
    /**
     * A host ICE candidate was discovered
     *
     * @generated from protobuf enum value: EVENT_ICE_CANDIDATE_LOCAL_HOST_FOUND = 1003;
     */
    EVENT_ICE_CANDIDATE_LOCAL_HOST_FOUND = 1003,
    /**
     * A server-reflexive (STUN) ICE candidate was discovered
     *
     * @generated from protobuf enum value: EVENT_ICE_CANDIDATE_LOCAL_SRFLX_FOUND = 1004;
     */
    EVENT_ICE_CANDIDATE_LOCAL_SRFLX_FOUND = 1004,
    /**
     * A peer-reflexive ICE candidate was discovered (less common)
     *
     * @generated from protobuf enum value: EVENT_ICE_CANDIDATE_LOCAL_PRFLX_FOUND = 1005;
     */
    EVENT_ICE_CANDIDATE_LOCAL_PRFLX_FOUND = 1005,
    /**
     * An ICE candidate from the remote peer was received
     *
     * @generated from protobuf enum value: EVENT_ICE_CANDIDATE_REMOTE_RECEIVED = 1006;
     */
    EVENT_ICE_CANDIDATE_REMOTE_RECEIVED = 1006,
    /**
     * ICE candidate pair succeeded in establishing a connection
     *
     * @generated from protobuf enum value: EVENT_ICE_CANDIDATE_PAIRING_SUCCESS = 1007;
     */
    EVENT_ICE_CANDIDATE_PAIRING_SUCCESS = 1007,
    /**
     * ICE candidate pair failed to establish a connection
     *
     * @generated from protobuf enum value: EVENT_ICE_CANDIDATE_PAIRING_FAILED = 1008;
     */
    EVENT_ICE_CANDIDATE_PAIRING_FAILED = 1008,
    /**
     * The ICE connection state has changed (e.g., connecting, connected, failed)
     *
     * @generated from protobuf enum value: EVENT_ICE_CANDIDATE_CONNECTION_STATE_CHANGED = 1009;
     */
    EVENT_ICE_CANDIDATE_CONNECTION_STATE_CHANGED = 1009,
    /**
     * ICE gathering process finished
     *
     * @generated from protobuf enum value: EVENT_ICE_CANDIDATE_GATHERING_COMPLETED = 1010;
     */
    EVENT_ICE_CANDIDATE_GATHERING_COMPLETED = 1010,
    /**
     * The best ICE candidate pair was selected for communication
     *
     * @generated from protobuf enum value: EVENT_ICE_CANDIDATE_SELECTED_PAIR = 1011;
     */
    EVENT_ICE_CANDIDATE_SELECTED_PAIR = 1011,
    /**
     * --- Signaling Events (Range: 2000 - 2099) ---
     *
     * Base for signaling related events
     *
     * @generated from protobuf enum value: EVENT_SIGNALING_BASE = 2000;
     */
    EVENT_SIGNALING_BASE = 2000,
    /**
     * A signaling offer (e.g., SDP) was created locally
     *
     * @generated from protobuf enum value: EVENT_SIGNALING_OFFER_CREATED = 2001;
     */
    EVENT_SIGNALING_OFFER_CREATED = 2001,
    /**
     * A signaling offer was sent to the remote peer
     *
     * @generated from protobuf enum value: EVENT_SIGNALING_OFFER_SENT = 2002;
     */
    EVENT_SIGNALING_OFFER_SENT = 2002,
    /**
     * A signaling offer was received from the remote peer
     *
     * @generated from protobuf enum value: EVENT_SIGNALING_OFFER_RECEIVED = 2003;
     */
    EVENT_SIGNALING_OFFER_RECEIVED = 2003,
    /**
     * A signaling answer (e.g., SDP) was created locally
     *
     * @generated from protobuf enum value: EVENT_SIGNALING_ANSWER_CREATED = 2004;
     */
    EVENT_SIGNALING_ANSWER_CREATED = 2004,
    /**
     * A signaling answer was sent to the remote peer
     *
     * @generated from protobuf enum value: EVENT_SIGNALING_ANSWER_SENT = 2005;
     */
    EVENT_SIGNALING_ANSWER_SENT = 2005,
    /**
     * A signaling answer was received from the remote peer
     *
     * @generated from protobuf enum value: EVENT_SIGNALING_ANSWER_RECEIVED = 2006;
     */
    EVENT_SIGNALING_ANSWER_RECEIVED = 2006,
    /**
     * A signal indicating that negotiation is required
     *
     * @generated from protobuf enum value: EVENT_SIGNALING_NEGOTIATION_NEEDED = 2007;
     */
    EVENT_SIGNALING_NEGOTIATION_NEEDED = 2007,
    /**
     * A request to restart ICE negotiation was initiated
     *
     * @generated from protobuf enum value: EVENT_SIGNALING_ICE_RESTART_TRIGGERED = 2008;
     */
    EVENT_SIGNALING_ICE_RESTART_TRIGGERED = 2008,
    /**
     * Signaling connection established
     *
     * @generated from protobuf enum value: EVENT_SIGNALING_CONNECTED = 2009;
     */
    EVENT_SIGNALING_CONNECTED = 2009,
    /**
     * Signaling connection lost
     *
     * @generated from protobuf enum value: EVENT_SIGNALING_DISCONNECTED = 2010;
     */
    EVENT_SIGNALING_DISCONNECTED = 2010,
    /**
     * --- User Interaction Events (Range: 3000 - 3099) ---
     *
     * Base for user interaction events
     *
     * @generated from protobuf enum value: EVENT_USER_INTERACTION_BASE = 3000;
     */
    EVENT_USER_INTERACTION_BASE = 3000,
    /**
     * A user joined the communication session
     *
     * @generated from protobuf enum value: EVENT_USER_JOINED_SESSION = 3001;
     */
    EVENT_USER_JOINED_SESSION = 3001,
    /**
     * A user left the communication session
     *
     * @generated from protobuf enum value: EVENT_USER_LEFT_SESSION = 3002;
     */
    EVENT_USER_LEFT_SESSION = 3002,
    /**
     * A user muted their audio
     *
     * @generated from protobuf enum value: EVENT_USER_MUTED_AUDIO = 3003;
     */
    EVENT_USER_MUTED_AUDIO = 3003,
    /**
     * A user unmuted their audio
     *
     * @generated from protobuf enum value: EVENT_USER_UNMUTED_AUDIO = 3004;
     */
    EVENT_USER_UNMUTED_AUDIO = 3004,
    /**
     * A user muted their video
     *
     * @generated from protobuf enum value: EVENT_USER_MUTED_VIDEO = 3005;
     */
    EVENT_USER_MUTED_VIDEO = 3005,
    /**
     * A user unmuted their video
     *
     * @generated from protobuf enum value: EVENT_USER_UNMUTED_VIDEO = 3006;
     */
    EVENT_USER_UNMUTED_VIDEO = 3006,
    /**
     * A user started sharing their screen
     *
     * @generated from protobuf enum value: EVENT_USER_SCREEN_SHARE_STARTED = 3007;
     */
    EVENT_USER_SCREEN_SHARE_STARTED = 3007,
    /**
     * A user stopped sharing their screen
     *
     * @generated from protobuf enum value: EVENT_USER_SCREEN_SHARE_STOPPED = 3008;
     */
    EVENT_USER_SCREEN_SHARE_STOPPED = 3008,
    /**
     * A user sent a text message
     *
     * @generated from protobuf enum value: EVENT_USER_INPUT_TEXT_MESSAGE_SENT = 3009;
     */
    EVENT_USER_INPUT_TEXT_MESSAGE_SENT = 3009,
    /**
     * A user received a text message
     *
     * @generated from protobuf enum value: EVENT_USER_INPUT_TEXT_MESSAGE_RECEIVED = 3010;
     */
    EVENT_USER_INPUT_TEXT_MESSAGE_RECEIVED = 3010,
    /**
     * --- Media Handling Events (Range: 4000 - 4099) ---
     *
     * Base for media handling events
     *
     * @generated from protobuf enum value: EVENT_MEDIA_HANDLING_BASE = 4000;
     */
    EVENT_MEDIA_HANDLING_BASE = 4000,
    /**
     * A local audio track was added
     *
     * @generated from protobuf enum value: EVENT_MEDIA_LOCAL_AUDIO_TRACK_ADDED = 4001;
     */
    EVENT_MEDIA_LOCAL_AUDIO_TRACK_ADDED = 4001,
    /**
     * A local video track was added
     *
     * @generated from protobuf enum value: EVENT_MEDIA_LOCAL_VIDEO_TRACK_ADDED = 4002;
     */
    EVENT_MEDIA_LOCAL_VIDEO_TRACK_ADDED = 4002,
    /**
     * A remote audio track was added
     *
     * @generated from protobuf enum value: EVENT_MEDIA_REMOTE_AUDIO_TRACK_ADDED = 4003;
     */
    EVENT_MEDIA_REMOTE_AUDIO_TRACK_ADDED = 4003,
    /**
     * A remote video track was added
     *
     * @generated from protobuf enum value: EVENT_MEDIA_REMOTE_VIDEO_TRACK_ADDED = 4004;
     */
    EVENT_MEDIA_REMOTE_VIDEO_TRACK_ADDED = 4004,
    /**
     * A local audio track was removed
     *
     * @generated from protobuf enum value: EVENT_MEDIA_LOCAL_AUDIO_TRACK_REMOVED = 4005;
     */
    EVENT_MEDIA_LOCAL_AUDIO_TRACK_REMOVED = 4005,
    /**
     * A local video track was removed
     *
     * @generated from protobuf enum value: EVENT_MEDIA_LOCAL_VIDEO_TRACK_REMOVED = 4006;
     */
    EVENT_MEDIA_LOCAL_VIDEO_TRACK_REMOVED = 4006,
    /**
     * A remote audio track was removed
     *
     * @generated from protobuf enum value: EVENT_MEDIA_REMOTE_AUDIO_TRACK_REMOVED = 4007;
     */
    EVENT_MEDIA_REMOTE_AUDIO_TRACK_REMOVED = 4007,
    /**
     * A remote video track was removed
     *
     * @generated from protobuf enum value: EVENT_MEDIA_REMOTE_VIDEO_TRACK_REMOVED = 4008;
     */
    EVENT_MEDIA_REMOTE_VIDEO_TRACK_REMOVED = 4008,
    /**
     * Audio playback started
     *
     * @generated from protobuf enum value: EVENT_MEDIA_AUDIO_PLAYBACK_STARTED = 4009;
     */
    EVENT_MEDIA_AUDIO_PLAYBACK_STARTED = 4009,
    /**
     * Video playback started
     *
     * @generated from protobuf enum value: EVENT_MEDIA_VIDEO_PLAYBACK_STARTED = 4010;
     */
    EVENT_MEDIA_VIDEO_PLAYBACK_STARTED = 4010,
    /**
     * Audio playback stopped
     *
     * @generated from protobuf enum value: EVENT_MEDIA_AUDIO_PLAYBACK_STOPPED = 4011;
     */
    EVENT_MEDIA_AUDIO_PLAYBACK_STOPPED = 4011,
    /**
     * Video playback stopped
     *
     * @generated from protobuf enum value: EVENT_MEDIA_VIDEO_PLAYBACK_STOPPED = 4012;
     */
    EVENT_MEDIA_VIDEO_PLAYBACK_STOPPED = 4012,
    /**
     * --- Error Reporting Events (Range: 5000 - 5099) ---
     *
     * Base for error reporting events
     *
     * @generated from protobuf enum value: EVENT_ERROR_REPORTING_BASE = 5000;
     */
    EVENT_ERROR_REPORTING_BASE = 5000,
    /**
     * An error occurred with the signaling connection
     *
     * @generated from protobuf enum value: EVENT_ERROR_SIGNALING_CONNECTION_FAILED = 5001;
     */
    EVENT_ERROR_SIGNALING_CONNECTION_FAILED = 5001,
    /**
     * An error occurred with the ICE connection
     *
     * @generated from protobuf enum value: EVENT_ERROR_ICE_CONNECTION_FAILED = 5002;
     */
    EVENT_ERROR_ICE_CONNECTION_FAILED = 5002,
    /**
     * An error occurred while capturing audio
     *
     * @generated from protobuf enum value: EVENT_ERROR_MEDIA_CAPTURE_AUDIO_FAILED = 5003;
     */
    EVENT_ERROR_MEDIA_CAPTURE_AUDIO_FAILED = 5003,
    /**
     * An error occurred while capturing video
     *
     * @generated from protobuf enum value: EVENT_ERROR_MEDIA_CAPTURE_VIDEO_FAILED = 5004;
     */
    EVENT_ERROR_MEDIA_CAPTURE_VIDEO_FAILED = 5004,
    /**
     * An error occurred while capturing screen
     *
     * @generated from protobuf enum value: EVENT_ERROR_MEDIA_CAPTURE_SCREEN_FAILED = 5005;
     */
    EVENT_ERROR_MEDIA_CAPTURE_SCREEN_FAILED = 5005,
    /**
     * An error occurred during SDP negotiation
     *
     * @generated from protobuf enum value: EVENT_ERROR_SDP_NEGOTIATION_FAILED = 5006;
     */
    EVENT_ERROR_SDP_NEGOTIATION_FAILED = 5006,
    /**
     * A general or uncategorized error
     *
     * @generated from protobuf enum value: EVENT_ERROR_OTHER = 5099;
     */
    EVENT_ERROR_OTHER = 5099,
    /**
     * --- Performance Monitoring Events (Range: 6000 - 6099) ---
     *
     * Base for performance monitoring events
     *
     * @generated from protobuf enum value: EVENT_PERFORMANCE_MONITORING_BASE = 6000;
     */
    EVENT_PERFORMANCE_MONITORING_BASE = 6000,
    /**
     * Round Trip Time (RTT) measurement
     *
     * @generated from protobuf enum value: EVENT_PERFORMANCE_RTT_MEASUREMENT = 6001;
     */
    EVENT_PERFORMANCE_RTT_MEASUREMENT = 6001,
    /**
     * Report on packet loss
     *
     * @generated from protobuf enum value: EVENT_PERFORMANCE_PACKET_LOSS_REPORT = 6002;
     */
    EVENT_PERFORMANCE_PACKET_LOSS_REPORT = 6002,
    /**
     * Measurement of jitter
     *
     * @generated from protobuf enum value: EVENT_PERFORMANCE_JITTER_MEASUREMENT = 6003;
     */
    EVENT_PERFORMANCE_JITTER_MEASUREMENT = 6003,
    /**
     * Estimated bandwidth has changed
     *
     * @generated from protobuf enum value: EVENT_PERFORMANCE_BANDWIDTH_ESTIMATION_CHANGED = 6004;
     */
    EVENT_PERFORMANCE_BANDWIDTH_ESTIMATION_CHANGED = 6004,
    /**
     * --- Application Specific Events
     *
     * EVENT_FEATURE_X_ENABLED = 7001;
     * EVENT_FEATURE_Y_TRIGGERED = 7002;
     *
     * @generated from protobuf enum value: EVENT_APPLICATION_SPECIFIC_BASE = 7000;
     */
    EVENT_APPLICATION_SPECIFIC_BASE = 7000
}
// @generated message type with reflection information, may provide speed optimized methods
class PrepareReq$Type extends MessageType<PrepareReq> {
    constructor() {
        super("pulsebeam.v1.PrepareReq", []);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.PrepareReq
 */
export const PrepareReq = new PrepareReq$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PrepareResp$Type extends MessageType<PrepareResp> {
    constructor() {
        super("pulsebeam.v1.PrepareResp", [
            { no: 1, name: "ice_servers", kind: "message", repeat: 1 /*RepeatType.PACKED*/, T: () => IceServer }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.PrepareResp
 */
export const PrepareResp = new PrepareResp$Type();
// @generated message type with reflection information, may provide speed optimized methods
class IceServer$Type extends MessageType<IceServer> {
    constructor() {
        super("pulsebeam.v1.IceServer", [
            { no: 1, name: "urls", kind: "scalar", repeat: 2 /*RepeatType.UNPACKED*/, T: 9 /*ScalarType.STRING*/ },
            { no: 2, name: "username", kind: "scalar", opt: true, T: 9 /*ScalarType.STRING*/ },
            { no: 3, name: "credential", kind: "scalar", opt: true, T: 9 /*ScalarType.STRING*/ }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.IceServer
 */
export const IceServer = new IceServer$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SendReq$Type extends MessageType<SendReq> {
    constructor() {
        super("pulsebeam.v1.SendReq", [
            { no: 1, name: "msg", kind: "message", T: () => Message }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.SendReq
 */
export const SendReq = new SendReq$Type();
// @generated message type with reflection information, may provide speed optimized methods
class SendResp$Type extends MessageType<SendResp> {
    constructor() {
        super("pulsebeam.v1.SendResp", []);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.SendResp
 */
export const SendResp = new SendResp$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecvReq$Type extends MessageType<RecvReq> {
    constructor() {
        super("pulsebeam.v1.RecvReq", [
            { no: 1, name: "src", kind: "message", T: () => PeerInfo }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.RecvReq
 */
export const RecvReq = new RecvReq$Type();
// @generated message type with reflection information, may provide speed optimized methods
class RecvResp$Type extends MessageType<RecvResp> {
    constructor() {
        super("pulsebeam.v1.RecvResp", [
            { no: 1, name: "msg", kind: "message", T: () => Message }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.RecvResp
 */
export const RecvResp = new RecvResp$Type();
// @generated message type with reflection information, may provide speed optimized methods
class PeerInfo$Type extends MessageType<PeerInfo> {
    constructor() {
        super("pulsebeam.v1.PeerInfo", [
            { no: 1, name: "group_id", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 2, name: "peer_id", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 3, name: "conn_id", kind: "scalar", T: 13 /*ScalarType.UINT32*/ }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.PeerInfo
 */
export const PeerInfo = new PeerInfo$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Message$Type extends MessageType<Message> {
    constructor() {
        super("pulsebeam.v1.Message", [
            { no: 1, name: "header", kind: "message", T: () => MessageHeader },
            { no: 2, name: "payload", kind: "message", T: () => MessagePayload }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.Message
 */
export const Message = new Message$Type();
// @generated message type with reflection information, may provide speed optimized methods
class MessagePayload$Type extends MessageType<MessagePayload> {
    constructor() {
        super("pulsebeam.v1.MessagePayload", [
            { no: 1, name: "signal", kind: "message", oneof: "payloadType", T: () => Signal },
            { no: 2, name: "join", kind: "message", oneof: "payloadType", T: () => Join },
            { no: 3, name: "bye", kind: "message", oneof: "payloadType", T: () => Bye },
            { no: 4, name: "ack", kind: "message", oneof: "payloadType", T: () => Ack },
            { no: 5, name: "ping", kind: "message", oneof: "payloadType", T: () => Ping }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.MessagePayload
 */
export const MessagePayload = new MessagePayload$Type();
// @generated message type with reflection information, may provide speed optimized methods
class MessageHeader$Type extends MessageType<MessageHeader> {
    constructor() {
        super("pulsebeam.v1.MessageHeader", [
            { no: 1, name: "src", kind: "message", T: () => PeerInfo },
            { no: 2, name: "dst", kind: "message", T: () => PeerInfo },
            { no: 7, name: "seqnum", kind: "scalar", T: 13 /*ScalarType.UINT32*/ },
            { no: 8, name: "reliable", kind: "scalar", T: 8 /*ScalarType.BOOL*/ }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.MessageHeader
 */
export const MessageHeader = new MessageHeader$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Signal$Type extends MessageType<Signal> {
    constructor() {
        super("pulsebeam.v1.Signal", [
            { no: 1, name: "generation_counter", kind: "scalar", T: 13 /*ScalarType.UINT32*/ },
            { no: 9, name: "sdp", kind: "message", oneof: "data", T: () => Sdp },
            { no: 10, name: "ice_candidate", kind: "message", oneof: "data", T: () => ICECandidate },
            { no: 11, name: "ice_candidate_batch", kind: "message", oneof: "data", T: () => ICECandidateBatch }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.Signal
 */
export const Signal = new Signal$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Sdp$Type extends MessageType<Sdp> {
    constructor() {
        super("pulsebeam.v1.Sdp", [
            { no: 1, name: "kind", kind: "enum", T: () => ["pulsebeam.v1.SdpKind", SdpKind, "SDP_KIND_"] },
            { no: 2, name: "sdp", kind: "scalar", T: 9 /*ScalarType.STRING*/ }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.Sdp
 */
export const Sdp = new Sdp$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ICECandidateBatch$Type extends MessageType<ICECandidateBatch> {
    constructor() {
        super("pulsebeam.v1.ICECandidateBatch", [
            { no: 1, name: "candidates", kind: "message", repeat: 1 /*RepeatType.PACKED*/, T: () => ICECandidate }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.ICECandidateBatch
 */
export const ICECandidateBatch = new ICECandidateBatch$Type();
// @generated message type with reflection information, may provide speed optimized methods
class ICECandidate$Type extends MessageType<ICECandidate> {
    constructor() {
        super("pulsebeam.v1.ICECandidate", [
            { no: 1, name: "candidate", kind: "scalar", T: 9 /*ScalarType.STRING*/ },
            { no: 2, name: "sdp_m_line_index", kind: "scalar", opt: true, T: 13 /*ScalarType.UINT32*/ },
            { no: 3, name: "sdp_mid", kind: "scalar", opt: true, T: 9 /*ScalarType.STRING*/ },
            { no: 4, name: "username", kind: "scalar", opt: true, T: 9 /*ScalarType.STRING*/ },
            { no: 5, name: "password", kind: "scalar", opt: true, T: 9 /*ScalarType.STRING*/ }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.ICECandidate
 */
export const ICECandidate = new ICECandidate$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Join$Type extends MessageType<Join> {
    constructor() {
        super("pulsebeam.v1.Join", []);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.Join
 */
export const Join = new Join$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Bye$Type extends MessageType<Bye> {
    constructor() {
        super("pulsebeam.v1.Bye", []);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.Bye
 */
export const Bye = new Bye$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Ack$Type extends MessageType<Ack> {
    constructor() {
        super("pulsebeam.v1.Ack", [
            { no: 1, name: "ack_ranges", kind: "message", repeat: 1 /*RepeatType.PACKED*/, T: () => AckRange }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.Ack
 */
export const Ack = new Ack$Type();
// @generated message type with reflection information, may provide speed optimized methods
class Ping$Type extends MessageType<Ping> {
    constructor() {
        super("pulsebeam.v1.Ping", []);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.Ping
 */
export const Ping = new Ping$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AckRange$Type extends MessageType<AckRange> {
    constructor() {
        super("pulsebeam.v1.AckRange", [
            { no: 1, name: "seqnum_start", kind: "scalar", T: 13 /*ScalarType.UINT32*/ },
            { no: 2, name: "seqnum_end", kind: "scalar", T: 13 /*ScalarType.UINT32*/ }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.AckRange
 */
export const AckRange = new AckRange$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DataChannel$Type extends MessageType<DataChannel> {
    constructor() {
        super("pulsebeam.v1.DataChannel", [
            { no: 10, name: "heartbeat", kind: "message", oneof: "payload", T: () => DataChannelHeartbeat }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.DataChannel
 */
export const DataChannel = new DataChannel$Type();
// @generated message type with reflection information, may provide speed optimized methods
class DataChannelHeartbeat$Type extends MessageType<DataChannelHeartbeat> {
    constructor() {
        super("pulsebeam.v1.DataChannelHeartbeat", []);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.DataChannelHeartbeat
 */
export const DataChannelHeartbeat = new DataChannelHeartbeat$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AnalyticsReportReq$Type extends MessageType<AnalyticsReportReq> {
    constructor() {
        super("pulsebeam.v1.AnalyticsReportReq", [
            { no: 1, name: "events", kind: "message", repeat: 1 /*RepeatType.PACKED*/, T: () => AnalyticsEvent }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.AnalyticsReportReq
 */
export const AnalyticsReportReq = new AnalyticsReportReq$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AnalyticsEvent$Type extends MessageType<AnalyticsEvent> {
    constructor() {
        super("pulsebeam.v1.AnalyticsEvent", [
            { no: 1, name: "tags", kind: "message", T: () => AnalyticsTags },
            { no: 2, name: "metrics", kind: "message", repeat: 1 /*RepeatType.PACKED*/, T: () => AnalyticsMetrics }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.AnalyticsEvent
 */
export const AnalyticsEvent = new AnalyticsEvent$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AnalyticsTags$Type extends MessageType<AnalyticsTags> {
    constructor() {
        super("pulsebeam.v1.AnalyticsTags", [
            { no: 1, name: "src", kind: "message", T: () => PeerInfo },
            { no: 2, name: "dst", kind: "message", T: () => PeerInfo }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.AnalyticsTags
 */
export const AnalyticsTags = new AnalyticsTags$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AnalyticsMetrics$Type extends MessageType<AnalyticsMetrics> {
    constructor() {
        super("pulsebeam.v1.AnalyticsMetrics", [
            { no: 1, name: "timestamp_us", kind: "scalar", T: 18 /*ScalarType.SINT64*/, L: 0 /*LongType.BIGINT*/ },
            { no: 2, name: "event_type", kind: "enum", opt: true, T: () => ["pulsebeam.v1.EventType", EventType] },
            { no: 3, name: "quality_score", kind: "scalar", opt: true, T: 18 /*ScalarType.SINT64*/, L: 0 /*LongType.BIGINT*/ },
            { no: 4, name: "rtt_us", kind: "scalar", opt: true, T: 18 /*ScalarType.SINT64*/, L: 0 /*LongType.BIGINT*/ }
        ]);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.AnalyticsMetrics
 */
export const AnalyticsMetrics = new AnalyticsMetrics$Type();
// @generated message type with reflection information, may provide speed optimized methods
class AnalyticsReportResp$Type extends MessageType<AnalyticsReportResp> {
    constructor() {
        super("pulsebeam.v1.AnalyticsReportResp", []);
    }
}
/**
 * @generated MessageType for protobuf message pulsebeam.v1.AnalyticsReportResp
 */
export const AnalyticsReportResp = new AnalyticsReportResp$Type();
/**
 * @generated ServiceType for protobuf service pulsebeam.v1.Signaling
 */
export const Signaling = new ServiceType("pulsebeam.v1.Signaling", [
    { name: "Prepare", options: {}, I: PrepareReq, O: PrepareResp },
    { name: "Send", options: {}, I: SendReq, O: SendResp },
    { name: "Recv", serverStreaming: true, options: {}, I: RecvReq, O: RecvResp },
    { name: "AnalyticsReport", options: {}, I: AnalyticsReportReq, O: AnalyticsReportResp }
]);
