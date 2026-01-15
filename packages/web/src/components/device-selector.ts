import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import './card';
import './select';
import './button';
import './icon';
import { repeat } from 'lit/directives/repeat.js';

@customElement('pb-device-selector')
export class DeviceSelector extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        width: 100%;
        display: block;
        max-width: 600px;
        margin: 0 auto;
      }

      .preview-container {
        width: 100%;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: var(--pb-radius);
        overflow: hidden;
        position: relative;
        margin-bottom: 24px;
        border: 1px solid var(--pb-border);
      }

      video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transform: scaleX(-1); /* Mirror for more natural selfie view */
      }

      .controls {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .device-item {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      label {
        font-size: 12px;
        font-weight: 700;
        color: var(--pb-text-dim);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .placeholder {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        text-align: center;
        padding: 20px;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
      }

      .placeholder pb-icon {
        font-size: 48px;
        margin-bottom: 12px;
        opacity: 0.7;
      }

      .placeholder p {
        margin: 0 0 16px 0;
        max-width: 300px;
      }

      .loading {
        opacity: 0.5;
      }
    `
  ];

  @state() private videoDevices: MediaDeviceInfo[] = [];
  @state() private audioDevices: MediaDeviceInfo[] = [];

  @state() private selectedVideoId = '';
  @state() private selectedAudioId = '';

  @state() private currentStream: MediaStream | null = null;
  @state() private error: string | null = null;
  @state() private isLoading = false;

  @query('video') private videoElement?: HTMLVideoElement;

  private permissionDenied = false;
  private deviceChangeListener?: () => void;

  async connectedCallback() {
    super.connectedCallback();

    // Listen for device changes (plugging/unplugging devices)
    this.deviceChangeListener = () => this.handleDeviceChange();
    navigator.mediaDevices?.addEventListener('devicechange', this.deviceChangeListener);

    await this.initialize();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopStream();

    if (this.deviceChangeListener) {
      navigator.mediaDevices?.removeEventListener('devicechange', this.deviceChangeListener);
    }
  }

  protected override firstUpdated(_changedProperties: PropertyValues): void {
    super.firstUpdated(_changedProperties);

    // Start preview after render if we have devices selected
    if (this.selectedVideoId || this.selectedAudioId) {
      this.startPreview();
    }
  }

  private async initialize() {
    // Check if mediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.error = "Your browser doesn't support camera/microphone access.";
      return;
    }

    await this.refreshDevices();
  }

  private async handleDeviceChange() {
    // Device was plugged in or unplugged
    const previousVideoId = this.selectedVideoId;
    const previousAudioId = this.selectedAudioId;

    await this.refreshDevices();

    // If previously selected device is gone, switch to first available
    const videoStillExists = this.videoDevices.some(d => d.deviceId === previousVideoId);
    const audioStillExists = this.audioDevices.some(d => d.deviceId === previousAudioId);

    if (!videoStillExists && this.videoDevices.length > 0) {
      this.selectedVideoId = this.videoDevices[0].deviceId;
    }
    if (!audioStillExists && this.audioDevices.length > 0) {
      this.selectedAudioId = this.audioDevices[0].deviceId;
    }

    // Restart preview if device changed
    if (!videoStillExists || !audioStillExists) {
      await this.startPreview();
    }
  }

  private async refreshDevices() {
    try {
      this.isLoading = true;

      // Try to get initial permission - use broad constraints for compatibility
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });

      // Stop the permission-requesting stream immediately
      stream.getTracks().forEach(track => track.stop());

      // Now enumerate devices (labels will be available after permission)
      const devices = await navigator.mediaDevices.enumerateDevices();

      this.videoDevices = devices.filter(d => d.kind === 'videoinput');
      this.audioDevices = devices.filter(d => d.kind === 'audioinput');

      // Select defaults if nothing selected
      if (this.videoDevices.length > 0 && !this.selectedVideoId) {
        this.selectedVideoId = this.videoDevices[0].deviceId;
      }
      if (this.audioDevices.length > 0 && !this.selectedAudioId) {
        this.selectedAudioId = this.audioDevices[0].deviceId;
      }

      this.permissionDenied = false;
      this.error = null;

    } catch (e: any) {
      console.error('Device enumeration error:', e);

      // Handle different error types
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        this.permissionDenied = true;
        this.error = "Camera and microphone access denied. Please grant permissions.";
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        this.error = "No camera or microphone found on this device.";
      } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
        this.error = "Camera or microphone is already in use by another application.";
      } else if (e.name === 'OverconstrainedError') {
        this.error = "Could not satisfy device constraints.";
      } else if (e.name === 'SecurityError') {
        this.error = "Access denied due to security settings. Try using HTTPS.";
      } else {
        this.error = "Could not access media devices. Please check permissions.";
      }
    } finally {
      this.isLoading = false;
    }
  }

  private async startPreview() {
    if (!this.selectedVideoId && !this.selectedAudioId) {
      return;
    }

    // Don't start if we already have an error
    if (this.permissionDenied) {
      return;
    }

    this.isLoading = true;

    try {
      // Build constraints with fallbacks
      const constraints: MediaStreamConstraints = {};

      if (this.selectedVideoId) {
        constraints.video = {
          deviceId: { exact: this.selectedVideoId },
          // Add common constraints for better compatibility
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        };
      }

      if (this.selectedAudioId) {
        constraints.audio = {
          deviceId: { exact: this.selectedAudioId },
          // Add audio constraints
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        };
      }

      // Get new stream
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Update video element
      if (this.videoElement) {
        this.videoElement.srcObject = newStream;

        // Ensure video plays (required on some mobile browsers)
        try {
          await this.videoElement.play();
        } catch (playError) {
          console.warn('Video autoplay failed:', playError);
        }
      }

      // Stop old stream after new one is attached
      this.stopStream();

      // Update state
      this.currentStream = newStream;

      // Dispatch event for parent components
      this.dispatchEvent(new CustomEvent('stream-change', {
        detail: { stream: this.currentStream },
        bubbles: true,
        composed: true
      }));

      this.error = null;

    } catch (e: any) {
      console.error('Preview start error:', e);

      // More specific error messages
      if (e.name === 'NotAllowedError') {
        this.error = "Permission denied. Please allow camera/microphone access.";
      } else if (e.name === 'NotFoundError') {
        this.error = "Selected device not found. It may have been unplugged.";
      } else if (e.name === 'NotReadableError') {
        this.error = "Device is already in use or unavailable.";
      } else if (e.name === 'OverconstrainedError') {
        // Try again with relaxed constraints
        this.error = "Device doesn't support requested settings. Trying fallback...";
        await this.startPreviewWithFallback();
        return;
      } else {
        this.error = "Failed to start preview. Please try again.";
      }
    } finally {
      this.isLoading = false;
    }
  }

  private async startPreviewWithFallback() {
    try {
      // Simplified constraints without exact device ID
      const constraints: MediaStreamConstraints = {
        video: this.selectedVideoId ? true : false,
        audio: this.selectedAudioId ? true : false
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.videoElement) {
        this.videoElement.srcObject = newStream;
        await this.videoElement.play().catch(() => { });
      }

      this.stopStream();
      this.currentStream = newStream;

      this.dispatchEvent(new CustomEvent('stream-change', {
        detail: { stream: this.currentStream },
        bubbles: true,
        composed: true
      }));

      this.error = null;
    } catch (e) {
      console.error('Fallback preview failed:', e);
      this.error = "Could not start preview with any settings.";
    } finally {
      this.isLoading = false;
    }
  }

  private stopStream() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
  }

  private handleVideoChange(e: Event) {
    const newValue = (e.target as any).value;
    if (newValue !== this.selectedVideoId) {
      this.selectedVideoId = newValue;
      this.startPreview();
    }
  }

  private handleAudioChange(e: Event) {
    const newValue = (e.target as any).value;
    if (newValue !== this.selectedAudioId) {
      this.selectedAudioId = newValue;
      this.startPreview();
    }
  }

  private async handleRetry() {
    this.error = null;
    this.permissionDenied = false;
    await this.refreshDevices();
    await this.startPreview();
  }

  render() {
    const hasDevices = this.videoDevices.length > 0 || this.audioDevices.length > 0;

    return html`
      <div class="preview-container">
        <video autoplay playsinline muted ?hidden=${!!this.error}></video>
        
        ${this.error ? html`
          <div class="placeholder">
            <pb-icon class="theme-dark" icon="videocam_off"></pb-icon>
            <p>${this.error}</p>
            <pb-button 
              variant="outlined" 
              class="theme-dark" 
              @click=${this.handleRetry}
              ?disabled=${this.isLoading}>
              ${this.isLoading ? 'Retrying...' : 'Retry'}
            </pb-button>
          </div>
        ` : this.isLoading ? html`
          <div class="placeholder loading">
            <pb-icon class="theme-dark" icon="cached"></pb-icon>
            <p>Initializing devices...</p>
          </div>
        ` : ''}
      </div>

      ${hasDevices ? html`
        <div class="controls">
          ${this.videoDevices.length > 0 ? html`
            <div class="device-item">
              <label>Camera</label>
              <pb-select 
                .value=${this.selectedVideoId} 
                @change=${this.handleVideoChange}
                ?disabled=${this.isLoading}>
                ${repeat(this.videoDevices, (d) => d.deviceId, (d) => html`
                  <pb-select-option 
                    .value=${d.deviceId} 
                    ?selected=${d.deviceId === this.selectedVideoId}>
                    ${d.label || `Camera ${this.videoDevices.indexOf(d) + 1}`}
                  </pb-select-option>
                `)}
              </pb-select>
            </div>
          ` : ''}

          ${this.audioDevices.length > 0 ? html`
            <div class="device-item">
              <label>Microphone</label>
              <pb-select 
                .value=${this.selectedAudioId} 
                @change=${this.handleAudioChange}
                ?disabled=${this.isLoading}>
                ${repeat(this.audioDevices, (d) => d.deviceId, (d) => html`
                  <pb-select-option 
                    .value=${d.deviceId} 
                    ?selected=${d.deviceId === this.selectedAudioId}>
                    ${d.label || `Microphone ${this.audioDevices.indexOf(d) + 1}`}
                  </pb-select-option>
                `)}
              </pb-select>
            </div>
          ` : ''}
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-device-selector': DeviceSelector;
  }
}
