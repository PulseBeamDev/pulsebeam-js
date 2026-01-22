type DeviceState = {
  videoDevices: MediaDeviceInfo[];
  audioDevices: MediaDeviceInfo[];
  selectedVideoId: string | null;
  selectedAudioId: string | null;
  currentStream: MediaStream | null;
  error: string | null;
  isLoading: boolean;
};

type Listener = (state: DeviceState) => void;

export class DeviceManager {
  private state: DeviceState = {
    videoDevices: [],
    audioDevices: [],
    selectedVideoId: null,
    selectedAudioId: null,
    currentStream: null,
    error: null,
    isLoading: false,
  };

  private listeners = new Set<Listener>();

  constructor() {
    this.handleDeviceChange = this.handleDeviceChange.bind(this);
  }

  async init() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      this.update({ error: "Browser not supported" });
      return;
    }
    navigator.mediaDevices.addEventListener("devicechange", this.handleDeviceChange);
    await this.refreshDevices();
  }

  dispose() {
    navigator.mediaDevices?.removeEventListener("devicechange", this.handleDeviceChange);
    this.stopStream();
    this.listeners.clear();
  }

  async selectVideo(deviceId: string) {
    if (this.state.selectedVideoId === deviceId) return;
    this.update({ selectedVideoId: deviceId });
    await this.startPreview();
  }

  async selectAudio(deviceId: string) {
    if (this.state.selectedAudioId === deviceId) return;
    this.update({ selectedAudioId: deviceId });
    await this.startPreview();
  }

  getStream() {
    return this.state.currentStream;
  }

  private async refreshDevices() {
    this.update({ isLoading: true, error: null });

    try {
      const tmpStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      tmpStream.getTracks().forEach(t => t.stop()); // Close immediately

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      const audioDevices = devices.filter((d) => d.kind === "audioinput");

      let { selectedVideoId, selectedAudioId } = this.state;

      if (videoDevices.length > 0 && !selectedVideoId) {
        selectedVideoId = videoDevices[0].deviceId;
      }
      if (audioDevices.length > 0 && !selectedAudioId) {
        selectedAudioId = audioDevices[0].deviceId;
      }

      this.update({
        videoDevices,
        audioDevices,
        selectedVideoId,
        selectedAudioId
      });

      if (selectedVideoId || selectedAudioId) {
        await this.startPreview();
      }

    } catch (e: any) {
      this.handleError(e);
    } finally {
      this.update({ isLoading: false });
    }
  }

  private async startPreview() {
    this.stopStream();
    this.update({ isLoading: true, error: null });

    try {
      const { selectedVideoId, selectedAudioId } = this.state;
      if (!selectedVideoId && !selectedAudioId) return;

      const constraints: MediaStreamConstraints = {
        video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : false,
        audio: selectedAudioId ? { deviceId: { exact: selectedAudioId } } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.update({ currentStream: stream });

    } catch (e: any) {
      this.handleError(e);
    } finally {
      this.update({ isLoading: false });
    }
  }

  private stopStream() {
    this.state.currentStream?.getTracks().forEach((t) => t.stop());
    this.update({ currentStream: null });
  }

  private handleDeviceChange() {
    // Re-run the refresh logic to remove unplugged devices
    this.refreshDevices();
  }

  private handleError(e: any) {
    let msg = "Could not access devices.";
    if (e.name === "NotAllowedError") msg = "Permissions denied.";
    else if (e.name === "NotFoundError") msg = "Device not found.";
    this.update({ error: msg });
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state); // Emit current state immediately
    return () => this.listeners.delete(listener);
  }

  private update(partial: Partial<DeviceState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l(this.state));
  }
}
