import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("pulsebeam-connector")
export class PulsebeamConnector extends LitElement {
  @property({ type: Number })
  count = 0;

  render() {
    return html`
      <audio></audio>
      <audio></audio>
      <audio></audio>

      <slot></slot>
      <p class="read-the-docs">${this.docsHint}</p>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pulsebeam-connector": PulsebeamConnector;
  }
}
