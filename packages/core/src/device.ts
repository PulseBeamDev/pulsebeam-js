import type { PlatformAdapter } from "./platform";

export interface DeviceState {
  videoInputDevices: MediaDeviceInfo[];
  audioInputDevices: MediaDeviceInfo[];
  selectedVideoId: string | null;
  selectedAudioId: string | null;
  hasPermission: boolean;
  error: Error | null;
  isScanning: boolean;
}

export type DeviceStateListener = (state: DeviceState) => void;

/**
 * Manages local hardware state, permissions, and device selection.
 * Acts as the "Store" for your DeviceSelector UI.
 */
export class DeviceManager {
  // The Source of Truth
  private state: DeviceState = {
    videoInputDevices: [],
    audioInputDevices: [],
    selectedVideoId: null,
    selectedAudioId: null,
    hasPermission: false,
    error: null,
    isScanning: false,
  };

  private listeners = new Set<DeviceStateListener>();
  private activeVideoTrack: MediaStreamTrack | null = null;
  private activeAudioTrack: MediaStreamTrack | null = null;

  constructor(
    private adapter: PlatformAdapter,
    // Callback to notify Session when track physically changes
    private onTrackChange: (kind: "video" | "audio", track: MediaStreamTrack | null) => void
  ) {
    this.handleDeviceChange = this.handleDeviceChange.bind(this);
  }

  /**
   * Start listening for device changes and perform initial scan.
   * Call this when your UI component mounts.
   */
  async init() {
    if (this.adapter.mediaDevices.addEventListener) {
      this.adapter.mediaDevices.addEventListener("devicechange", this.handleDeviceChange);
    }
    await this.scanDevices();
  }

  /**
   * Cleanup listeners and stop tracks.
   * Call this when your UI component unmounts.
   */
  dispose() {
    if (this.adapter.mediaDevices.removeEventListener) {
      this.adapter.mediaDevices.removeEventListener("devicechange", this.handleDeviceChange);
    }
    this.stopAll();
    this.listeners.clear();
  }

  // --- Public Actions ---

  /**
   * Selects a specific camera.
   * Handles stopping the old one and starting the new one.
   */
  async selectCamera(deviceId: string) {
    // Optimistic update
    this.updateState({ selectedVideoId: deviceId });
    try {
      await this.enableCamera(deviceId);
    } catch (e) {
      this.updateState({ error: this.normalizeError(e) });
    }
  }

  /**
   * Selects a specific microphone.
   */
  async selectMicrophone(deviceId: string) {
    this.updateState({ selectedAudioId: deviceId });
    try {
      await this.enableMicrophone(deviceId);
    } catch (e) {
      this.updateState({ error: this.normalizeError(e) });
    }
  }

  getState() {
    return this.state;
  }

  subscribe(listener: DeviceStateListener) {
    this.listeners.add(listener);
    listener(this.state); // Emit current state immediately
    return () => this.listeners.delete(listener);
  }


  private async scanDevices() {
    this.updateState({ isScanning: true, error: null });

    try {
      let devices = await this.adapter.mediaDevices.enumerateDevices();

      const hasLabels = devices.some((d) => d.label !== "");

      if (!hasLabels && !this.state.hasPermission) {
        try {
          const warmUpStream = await this.adapter.mediaDevices.getUserMedia({ audio: true, video: true });
          warmUpStream.getTracks().forEach((t) => t.stop());
          this.updateState({ hasPermission: true });
          // Re-enumerate now that we have permission
          devices = await this.adapter.mediaDevices.enumerateDevices();
        } catch (e) {
          // Permission denied is a valid state, don't crash, just report it
          const err = this.normalizeError(e);
          this.updateState({ error: err, hasPermission: false, isScanning: false });
          return;
        }
      } else if (hasLabels) {
        this.updateState({ hasPermission: true });
      }

      // 3. Filter & Sort
      const videoInputDevices = devices.filter((d) => d.kind === "videoinput");
      const audioInputDevices = devices.filter((d) => d.kind === "audioinput");

      // 4. Handle "Device Unplugged" logic
      // If currently selected device is gone, fall back to the first available
      let { selectedVideoId, selectedAudioId } = this.state;

      if (videoInputDevices.length > 0) {
        const stillExists = videoInputDevices.some(d => d.deviceId === selectedVideoId);
        if (!stillExists || !selectedVideoId) {
          selectedVideoId = videoInputDevices[0]!.deviceId;
          // Auto-reconnect if we were active
          if (this.activeVideoTrack) await this.enableCamera(selectedVideoId);
        }
      }

      if (audioInputDevices.length > 0) {
        const stillExists = audioInputDevices.some(d => d.deviceId === selectedAudioId);
        if (!stillExists || !selectedAudioId) {
          selectedAudioId = audioInputDevices[0]!.deviceId;
          if (this.activeAudioTrack) await this.enableMicrophone(selectedAudioId);
        }
      }

      this.updateState({
        videoInputDevices,
        audioInputDevices,
        selectedVideoId,
        selectedAudioId,
        isScanning: false,
      });

    } catch (e) {
      this.updateState({ error: this.normalizeError(e), isScanning: false });
    }
  }

  async enableCamera(deviceId?: string): Promise<MediaStreamTrack> {
    const targetId = deviceId || this.state.selectedVideoId;

    // Constraints logic
    const constraints: MediaTrackConstraints = targetId
      ? { deviceId: { exact: targetId } }
      : {};

    const stream = await this.adapter.mediaDevices.getUserMedia({ video: constraints });
    const newTrack = stream.getVideoTracks()[0];

    if (!newTrack) throw new Error("No video track found");

    // Hot-swap
    if (this.activeVideoTrack) this.activeVideoTrack.stop();
    this.activeVideoTrack = newTrack;
    this.updateState({ selectedVideoId: newTrack.getSettings().deviceId || targetId });

    // Notify Session
    this.onTrackChange("video", newTrack);
    return newTrack;
  }

  private async enableMicrophone(deviceId?: string): Promise<MediaStreamTrack> {
    const targetId = deviceId || this.state.selectedAudioId;
    const constraints: MediaTrackConstraints = targetId
      ? { deviceId: { exact: targetId } }
      : {};

    const stream = await this.adapter.mediaDevices.getUserMedia({ audio: constraints });
    const newTrack = stream.getAudioTracks()[0];

    if (!newTrack) throw new Error("No audio track found");

    if (this.activeAudioTrack) this.activeAudioTrack.stop();
    this.activeAudioTrack = newTrack;
    this.updateState({ selectedAudioId: newTrack.getSettings().deviceId || targetId });

    this.onTrackChange("audio", newTrack);
    return newTrack;
  }

  stopAll() {
    this.muteCamera();
    this.muteMicrophone();
  }

  muteCamera() {
    if (this.activeVideoTrack) {
      this.activeVideoTrack.stop();
      this.activeVideoTrack = null;
      this.onTrackChange("video", null);
    }
  }

  muteMicrophone() {
    if (this.activeAudioTrack) {
      this.activeAudioTrack.stop();
      this.activeAudioTrack = null;
      this.onTrackChange("audio", null);
    }
  }

  // Helper to handle auto-refresh on plug/unplug
  private handleDeviceChange() {
    this.scanDevices();
  }

  private updateState(partial: Partial<DeviceState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(l => l(this.state));
  }

  private normalizeError(e: any): Error {
    if (e instanceof Error) return e;

    let msg = "Unknown device error";
    if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
      msg = "Camera/Microphone permissions denied.";
    } else if (e.name === 'NotFoundError') {
      msg = "Device not found.";
    } else if (e.name === 'NotReadableError') {
      msg = "Device is in use by another app.";
    }
    return new Error(msg);
  }
}
