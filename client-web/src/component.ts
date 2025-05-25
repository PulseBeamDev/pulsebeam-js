import { html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { consume, createContext, provide } from "@lit/context";
import { ClientCore } from "./lib";
import type { ParticipantMeta } from "./lib/core";

const clientContext = createContext<ClientCore>(Symbol("client"));

@customElement("pulsebeam-context")
export class PulsebeamContext extends LitElement {
  @provide({ context: clientContext })
  @property({ attribute: false })
  value!: ClientCore;

  @query("slot")
  slotEl!: HTMLSlotElement;

  private audioElements: HTMLAudioElement[] = [];

  firstUpdated() {
    this.audioElements = Array.from(this.renderRoot.querySelectorAll("audio"));
    console.log("Audio elements:", this.audioElements);
  }

  render() {
    return html`
      <audio></audio>
      <audio></audio>
      <audio></audio>

      <slot></slot>
    `;
  }
}

@customElement("pulsebeam-video")
export class PulsebeamVideo extends LitElement {
  @property({ attribute: false })
  participantMeta?: ParticipantMeta;

  @consume({ context: clientContext, subscribe: true })
  client?: ClientCore;

  @query("video")
  videoEl!: HTMLVideoElement;

  firstUpdated() {
    if (!this.client) {
      console.warn("No client context available");
      return;
    }

    if (!this.participantMeta) {
      console.warn("No participant specified on <pulsebeam-video>");
      return;
    }

    this.client.subscribeVideo(this.videoEl, this.participantMeta);
  }

  render() {
    return html`<video autoplay muted playsinline></video>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pulsebeam-context": PulsebeamContext;
    "pulsebeam-video": PulsebeamVideo;
  }
}
