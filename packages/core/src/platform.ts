export interface PlatformAdapter {
  /** The RTCPeerConnection constructor */
  RTCPeerConnection: new (config?: RTCConfiguration) => RTCPeerConnection;
  /** The MediaStream constructor */
  MediaStream: new (tracks?: MediaStreamTrack[]) => MediaStream;
  /** Fetch implementation */
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  /** Timer functions */
  setTimeout: (fn: () => void, ms: number) => any;
  clearTimeout: (id: any) => void;
  /** Abstracted MediaDevices */
  mediaDevices: {
    getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
    enumerateDevices(): Promise<MediaDeviceInfo[]>;
    getDisplayMedia?(constraints: MediaStreamConstraints): Promise<MediaStream>;
    addEventListener?(event: string, handler: EventListener): void;
    removeEventListener?(event: string, handler: EventListener): void;
  };
}
