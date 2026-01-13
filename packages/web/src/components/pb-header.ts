import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

@customElement('pb-header')
export class PbHeader extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--pb-paper);
        opacity: 0.95;
        backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--pb-border);
        padding: 0 32px;
        height: 60px;
        width: 100%;
      }
    `
  ];

  render() {
    return html`
      <div class="start">
        <slot name="start"></slot>
      </div>
      <div class="end">
        <slot name="end"></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-header': PbHeader;
  }
}
