import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Session, type PlatformAdapter } from './index';
import { ClientMessageSchema } from './gen/signaling_pb';
import { fromBinary } from '@bufbuild/protobuf';

class MockMediaStreamTrack {
  kind: string;
  enabled = true;
  constructor(kind: string) { this.kind = kind; }
  stop() { }
  getSettings() { return { deviceId: 'mock-id' }; }
}

class MockMediaStream {
  tracks: MockMediaStreamTrack[] = [];
  constructor(tracks?: MockMediaStreamTrack[]) {
    this.tracks = tracks || [];
  }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
  getTracks() { return this.tracks; }
  removeTrack(t: any) { this.tracks = this.tracks.filter(x => x !== t); }
  addTrack(t: any) { this.tracks.push(t); }
}

class MockDataChannel {
  readyState = "open";
  binaryType = "blob";
  onmessage: ((ev: any) => void) | null = null;
  send = vi.fn();
}

class MockRTCPeerConnection {
  connectionState = "new";
  onconnectionstatechange: (() => void) | null = null;

  createDataChannel() { return new MockDataChannel(); }

  transceivers: any[] = [];
  addTransceiver(kind: string, init: any) {
    const t = {
      direction: init?.direction || 'sendrecv',
      mid: String(this.transceivers.length), // Simulate MID assignment
      sender: { replaceTrack: vi.fn().mockResolvedValue(undefined) },
      receiver: { track: new MockMediaStreamTrack(kind) }
    };
    this.transceivers.push(t);
    return t;
  }
  getTransceivers() { return this.transceivers; }

  createOffer() { return Promise.resolve({ sdp: "mock-offer" }); }
  setLocalDescription() { return Promise.resolve(); }
  setRemoteDescription() { return Promise.resolve(); }
  close() { this.connectionState = "closed"; }
}

const mockAdapter: PlatformAdapter = {
  RTCPeerConnection: MockRTCPeerConnection as any,
  MediaStream: MockMediaStream as any,
  fetch: vi.fn(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  mediaDevices: {
    getUserMedia: vi.fn().mockResolvedValue(new MockMediaStream([new MockMediaStreamTrack("video")])),
    enumerateDevices: vi.fn().mockResolvedValue([]),
  }
};

describe('Session Core', () => {
  let session: Session;

  beforeEach(() => {
    vi.clearAllMocks();
    session = new Session({
      videoSlots: 2,
      audioSlots: 2,
      adapter: mockAdapter
    });
  });

  it('initializes transceivers and data channel', () => {
    // 2 explicit downlink + 2 explicit uplink = 4
    // Plus any others depending on implementation details
    // Here we strictly check logic from constructor
    // videoSlots(2) + audioSlots(2) + sendVideo(1) + sendAudio(1) = 6 total
    const pc = (session as any).pc as MockRTCPeerConnection;
    expect(pc.transceivers.length).toBe(6);
    expect((session as any).dc).toBeInstanceOf(MockDataChannel);
  });

  it('connects to SFU', async () => {
    (mockAdapter.fetch as any).mockResolvedValue({
      ok: true,
      headers: { get: () => 'http://delete-url' },
      text: () => Promise.resolve('mock-answer')
    });

    const onEvent = vi.fn();
    session.onEvent = onEvent;

    session.connect('http://sfu', 'room1');

    // Allow promises to resolve
    await new Promise(r => setTimeout(r, 0));

    expect(mockAdapter.fetch).toHaveBeenCalledWith(
      'http://sfu/api/v1/rooms/room1',
      expect.objectContaining({ method: 'POST', body: 'mock-offer' })
    );
  });

  it('enables camera via DeviceManager', async () => {
    const track = await session.devices.enableCamera();
    expect(track.kind).toBe('video');
    expect(mockAdapter.mediaDevices.getUserMedia).toHaveBeenCalled();

    // Verify it updated the sender
    const pc = (session as any).pc as MockRTCPeerConnection;
    const videoSender = pc.transceivers.find(t => t.direction === 'sendonly' && t.receiver.track.kind === 'video');
    expect(videoSender.sender.replaceTrack).toHaveBeenCalledWith(track);
  });

  it('reconciles bandwidth when virtual slot height changes', async () => {
    const trackId = "remote-1";
    // Access private methods/props via 'any' for testing internals
    const vSlot = (session as any).getOrCreateVirtualSlot(trackId);

    (session as any).state.assignments.set("0", { mid: "0", trackId });
    vSlot.setHeight(720);
    await new Promise(r => setTimeout(r, 100));
    const dc = (session as any).dc as MockDataChannel;
    expect(dc.send).toHaveBeenCalled();

    const sentData = dc.send.mock.calls[0][0];
    const msg = fromBinary(ClientMessageSchema, sentData);

    expect(msg.payload.case).toBe('intent');
    if (msg.payload.case === 'intent') {
      const req = msg.payload.value.requests[0];
      expect(req.mid).toBe("0");
      expect(req.trackId).toBe(trackId);
      expect(req.height).toBe(720);
    }
  });
});
