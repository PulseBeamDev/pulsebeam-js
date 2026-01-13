import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/chips/assist-chip.js';

/**
 * @tag pb-tag
 */
@customElement('pb-tag')
export class Tag extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: inline-flex;
      }
      md-assist-chip {
        --md-assist-chip-container-shape: var(--pb-radius);
        --md-assist-chip-container-height: 24px;
        --md-assist-chip-label-text-weight: 600;
        --md-assist-chip-outline-color: var(--pb-border-dk);
      }
    `
  ];

  /** @attribute */
  @property({ type: String }) label = '';

  render() {
    return html`
      <md-assist-chip label="${this.label}"></md-assist-chip>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-tag': Tag;
  }
}
