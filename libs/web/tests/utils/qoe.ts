/**
 * QoE stats normalization — the browser analog of the Rust simulator's
 * `VideoReceiveLog`. Pure module (no browser- or Node-only deps) so it can run in
 * BOTH places: the harness page (`window.__pb.getStats`, in Chromium) produces a
 * `QoeSnapshot`, and the Node-side matchers consume/diff it.
 *
 * We deliberately keep only the fields that make robust, tolerance-based QoE
 * assertions possible — never exact bitrate/fps.
 */

export interface InboundVideoStat {
  ssrc: number;
  framesDecoded: number;
  framesReceived: number;
  frameWidth: number;
  frameHeight: number;
  freezeCount: number;
  totalFreezesDuration: number;
  packetsReceived: number;
  packetsLost: number;
  bytesReceived: number;
}

export interface InboundAudioStat {
  ssrc: number;
  /** Cumulative audio energy — grows only while real (non-silent) audio plays. */
  totalAudioEnergy: number;
  audioLevel: number;
  concealedSamples: number;
  packetsReceived: number;
  bytesReceived: number;
}

export interface OutboundVideoStat {
  ssrc: number;
  rid?: string;
  framesEncoded: number;
  frameWidth: number;
  frameHeight: number;
  bytesSent: number;
  packetsSent: number;
}

export interface OutboundAudioStat {
  ssrc: number;
  bytesSent: number;
  packetsSent: number;
}

export interface QoeSnapshot {
  connectionState: string;
  inboundVideo: InboundVideoStat[];
  inboundAudio: InboundAudioStat[];
  outboundVideo: OutboundVideoStat[];
  outboundAudio: OutboundAudioStat[];
}

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Reduce an `RTCStatsReport` to a plain-JSON `QoeSnapshot`. Runs in the browser
 * (inside `page.evaluate` via `window.__pb.getStats`), so the result must be
 * structured-cloneable — hence plain numbers only.
 */
export function normalizeStatsReport(
  report: RTCStatsReport,
  connectionState: string,
): QoeSnapshot {
  const inboundVideo: InboundVideoStat[] = [];
  const inboundAudio: InboundAudioStat[] = [];
  const outboundVideo: OutboundVideoStat[] = [];
  const outboundAudio: OutboundAudioStat[] = [];

  report.forEach((s: any) => {
    if (s.type === 'inbound-rtp' && s.kind === 'video') {
      inboundVideo.push({
        ssrc: n(s.ssrc),
        framesDecoded: n(s.framesDecoded),
        framesReceived: n(s.framesReceived),
        frameWidth: n(s.frameWidth),
        frameHeight: n(s.frameHeight),
        freezeCount: n(s.freezeCount),
        totalFreezesDuration: n(s.totalFreezesDuration),
        packetsReceived: n(s.packetsReceived),
        packetsLost: n(s.packetsLost),
        bytesReceived: n(s.bytesReceived),
      });
    } else if (s.type === 'inbound-rtp' && s.kind === 'audio') {
      inboundAudio.push({
        ssrc: n(s.ssrc),
        totalAudioEnergy: n(s.totalAudioEnergy),
        audioLevel: n(s.audioLevel),
        concealedSamples: n(s.concealedSamples),
        packetsReceived: n(s.packetsReceived),
        bytesReceived: n(s.bytesReceived),
      });
    } else if (s.type === 'outbound-rtp' && s.kind === 'video') {
      outboundVideo.push({
        ssrc: n(s.ssrc),
        rid: s.rid,
        framesEncoded: n(s.framesEncoded),
        frameWidth: n(s.frameWidth),
        frameHeight: n(s.frameHeight),
        bytesSent: n(s.bytesSent),
        packetsSent: n(s.packetsSent),
      });
    } else if (s.type === 'outbound-rtp' && s.kind === 'audio') {
      outboundAudio.push({
        ssrc: n(s.ssrc),
        bytesSent: n(s.bytesSent),
        packetsSent: n(s.packetsSent),
      });
    }
  });

  return { connectionState, inboundVideo, inboundAudio, outboundVideo, outboundAudio };
}

// ── Aggregate helpers (Node-side, used by matchers) ─────────────────────────

/** Total decoded frames across all inbound video SSRCs. */
export const totalFramesDecoded = (s: QoeSnapshot): number =>
  s.inboundVideo.reduce((acc, v) => acc + v.framesDecoded, 0);

/** Largest received frame height across inbound video (best layer in flight). */
export const maxInboundFrameHeight = (s: QoeSnapshot): number =>
  s.inboundVideo.reduce((acc, v) => Math.max(acc, v.frameHeight), 0);

export const totalFreezeCount = (s: QoeSnapshot): number =>
  s.inboundVideo.reduce((acc, v) => acc + v.freezeCount, 0);

/** Cumulative audio energy across all inbound audio SSRCs. */
export const totalAudioEnergy = (s: QoeSnapshot): number =>
  s.inboundAudio.reduce((acc, a) => acc + a.totalAudioEnergy, 0);

export const totalOutboundVideoBytes = (s: QoeSnapshot): number =>
  s.outboundVideo.reduce((acc, v) => acc + v.bytesSent, 0);
