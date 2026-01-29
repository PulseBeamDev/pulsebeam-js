export { };

declare global {
  type RTCPeerConnectionState =
    | "new"
    | "connecting"
    | "connected"
    | "disconnected"
    | "failed"
    | "closed";

  interface RTCSessionDescriptionInit {
    type: "offer" | "answer";
    sdp: string;
  }

  interface RTCRtpEncodingParameters {
    active?: boolean;
    maxBitrate?: number;
    scaleResolutionDownBy?: number;
    rid?: string;
    codec?: RTCRtpCodecParameters;
  }

  interface RTCRtpCodecParameters {
    // payloadType: number;
    mimeType: string;
    clockRate: number;
    channels?: number | undefined; // default = 1
    sdpFmtpLine?: string | undefined;
  }

  interface RTCRtpCapabilities {
    codecs: RTCRtpCodecCapability[];
    headerExtensions: RTCRtpHeaderExtensionCapability[];
  }

  interface RTCRtpCodecCapability {
    mimeType: string;
    sdpFmtpLine?: string;
  }

  interface RTCRtpReceiver {
    readonly track: MediaStreamTrack;
    readonly transport?: any;
    readonly rtcpTransport?: any;
  }

  interface RTCRtpSender {
    readonly track: MediaStreamTrack | null;
    readonly transport?: any;
    readonly rtcpTransport?: any;
    replaceTrack(track: MediaStreamTrack | null): Promise<void>;
    setParameters(parameters: RTCRtpSendParameters): Promise<void>;
    getParameters(): RTCRtpSendParameters;
  }

  interface RTCRtpSendParameters {
    encodings: RTCRtpEncodingParameters[];
    transactionId: string;
    degradationPreference?: string;
  }

  interface MediaStreamTrack {
    readonly id: string;
    readonly kind: "video" | "audio";
    readonly label: string;
    enabled: boolean;
    muted: boolean;
    readyState: "live" | "ended";

    stop(): void;
    getSettings(): MediaTrackSettings;
    getCapabilities?(): MediaTrackCapabilities;
    getConstraints?(): MediaTrackConstraints;
    applyConstraints(constraints?: MediaTrackConstraints): Promise<void>;
    clone(): MediaStreamTrack;

    onended: ((this: MediaStreamTrack, ev: Event) => any) | null;
    onmute: ((this: MediaStreamTrack, ev: Event) => any) | null;
    onunmute: ((this: MediaStreamTrack, ev: Event) => any) | null;
  }

  interface MediaTrackSettings {
    deviceId?: string;
    groupId?: string;
    width?: number;
    height?: number;
    aspectRatio?: number;
    frameRate?: number;
    facingMode?: string;
    resizeMode?: string;
    sampleRate?: number;
    sampleSize?: number;
    echoCancellation?: boolean;
    autoGainControl?: boolean;
    noiseSuppression?: boolean;
    latency?: number;
    channelCount?: number;
  }

  interface MediaStream {
    readonly id: string;
    readonly active: boolean;

    getTracks(): MediaStreamTrack[];
    getVideoTracks(): MediaStreamTrack[];
    getAudioTracks(): MediaStreamTrack[];

    addTrack(track: MediaStreamTrack): void;
    removeTrack(track: MediaStreamTrack): void;
    clone(): MediaStream;
    getTrackById(trackId: string): MediaStreamTrack | null;
  }

  type MediaDeviceKind = "audioinput" | "audiooutput" | "videoinput";

  interface MediaDeviceInfo {
    readonly deviceId: string;
    readonly kind: MediaDeviceKind;
    readonly label: string;
    readonly groupId: string;
    toJSON(): any;
  }

  type ConstrainBoolean = boolean | { exact: boolean };
  type ConstrainDOMString = string | string[] | { exact?: string | string[]; ideal?: string | string[] };
  type ConstrainULong = number | { min?: number; max?: number; exact?: number; ideal?: number };
  type ConstrainDouble = number | { min?: number; max?: number; exact?: number; ideal?: number };

  interface MediaTrackConstraints {
    deviceId?: ConstrainDOMString;
    groupId?: ConstrainDOMString;
    facingMode?: ConstrainDOMString;

    width?: ConstrainULong;
    height?: ConstrainULong;
    aspectRatio?: ConstrainDouble;
    frameRate?: ConstrainDouble;

    echoCancellation?: ConstrainBoolean;
    autoGainControl?: ConstrainBoolean;
    noiseSuppression?: ConstrainBoolean;
    latency?: ConstrainDouble;
    channelCount?: ConstrainULong;
  }

  interface MediaStreamConstraints {
    video?: boolean | MediaTrackConstraints;
    audio?: boolean | MediaTrackConstraints;
  }

  interface MediaDevices extends EventTarget {
    ondevicechange: ((this: MediaDevices, ev: Event) => any) | null;

    enumerateDevices(): Promise<MediaDeviceInfo[]>;
    getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>;
    getDisplayMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>;
  }

  interface Navigator {
    readonly mediaDevices: MediaDevices;
  }
}
