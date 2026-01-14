import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import './card';
import './select';
import './button';
import './icon';

@customElement('pb-device-selector')
export class DeviceSelector extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
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
      }

      .placeholder pb-icon {
        font-size: 48px;
        margin-bottom: 12px;
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

  @query('video') private videoElement?: HTMLVideoElement;

  async firstUpdated() {
    await this.refreshDevices();
    await this.startPreview();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopStream();
  }

  private async refreshDevices() {
    try {
      // Request permissions first to get labels
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();

      this.videoDevices = devices.filter(d => d.kind === 'videoinput');
      this.audioDevices = devices.filter(d => d.kind === 'audioinput');

      if (this.videoDevices.length > 0 && !this.selectedVideoId) {
        this.selectedVideoId = this.videoDevices[0].deviceId;
      }
      if (this.audioDevices.length > 0 && !this.selectedAudioId) {
        this.selectedAudioId = this.audioDevices[0].deviceId;
      }
    } catch (e) {
      this.error = "Could not access media devices. Please check permissions.";
      console.error(e);
    }
  }

  private async startPreview() {
    this.stopStream();

    if (!this.selectedVideoId && !this.selectedAudioId) return;

    try {
      const constraints: MediaStreamConstraints = {
        video: this.selectedVideoId ? { deviceId: { exact: this.selectedVideoId } } : false,
        audio: this.selectedAudioId ? { deviceId: { exact: this.selectedAudioId } } : false,
      };

      this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.videoElement) {
        this.videoElement.srcObject = this.currentStream;
      }

      this.dispatchEvent(new CustomEvent('stream-change', {
        detail: { stream: this.currentStream },
        bubbles: true,
        composed: true
      }));

      this.error = null;
    } catch (e) {
      this.error = "Failed to start preview with selected devices.";
      console.error(e);
    }
  }

  private stopStream() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
  }

  private handleVideoChange(e: Event) {
    this.selectedVideoId = (e.target as any).value;
    this.startPreview();
  }

  private handleAudioChange(e: Event) {
    this.selectedAudioId = (e.target as any).value;
    this.startPreview();
  }

  render() {
    return html`
      <pb-card header="Check your audio and video">
        <div class="preview-container">
          <video autoplay playsinline muted></video>
          ${this.error ? html`
            <div class="placeholder">
              <pb-icon icon="videocam_off"></pb-icon>
              <p>${this.error}</p>
              <pb-button variant="outlined" @click=${this.refreshDevices}>Retry</pb-button>
            </div>
          ` : !this.currentStream ? html`
            <div class="placeholder">
              <pb-icon icon="cached"></pb-icon>
              <p>Starting camera...</p>
            </div>
          ` : ''}
        </div>

        
        <div class="controls">
          <div class="device-item">
            <label>Camera</label>
            <pb-select value=${this.selectedVideoId} @change=${this.handleVideoChange}>
              ${this.videoDevices.map(d => html`
                <pb-select-option value=${d.deviceId} selected=${d.deviceId === this.selectedVideoId}>
                  ${d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                </pb-select-option>
              `)}
            </pb-select>
          </div>

          <div class="device-item">
            <label>Microphone</label>
            <pb-select value=${this.selectedAudioId} @change=${this.handleAudioChange}>
              ${this.audioDevices.map(d => html`
                <pb-select-option value=${d.deviceId}>${d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</pb-select-option>
              `)}
            </pb-select>
          </div>
        </div>

        <div slot="header-actions">
           <pb-button variant="icon" icon="settings"></pb-button>
        </div>
      </pb-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-device-selector': DeviceSelector;
  }
}
