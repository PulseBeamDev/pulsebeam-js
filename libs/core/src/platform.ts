export interface PlatformAdapter {
  /** The RTCPeerConnection constructor */
  RTCPeerConnection: new (config?: RTCConfiguration) => RTCPeerConnection;
  /** The MediaStream constructor */
  MediaStream: new (tracks?: MediaStreamTrack[]) => MediaStream;
  getCapabilities: (kind: string) => RTCRtpCapabilities | null;
  /** Fetch implementation */
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  /** Timer functions */
  setTimeout: (fn: () => void, ms: number) => any;
  clearTimeout: (id: any) => void;
  mediaDevices: MediaDevices;
}
