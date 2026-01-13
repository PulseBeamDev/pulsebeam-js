import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/radio/radio.js';

@customElement('pb-radio')
export class PbRadio extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
      }
      md-radio {
        --md-radio-icon-color: var(--pb-border-dk);
        --md-radio-selected-icon-color: var(--pb-blue);
      }
    `
  ];

  @property({ type: Boolean }) checked = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: String }) name = '';
  @property({ type: String }) value = '';

  render() {
    return html`
      <md-radio
        ?checked=${this.checked}
        ?disabled=${this.disabled}
        name="${this.name}"
        value="${this.value}"
        @change=${this._handleChange}
      ></md-radio>
    `;
  }

  private _handleChange(e: Event) {
    this.checked = (e.target as HTMLInputElement).checked;
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-radio': PbRadio;
  }
}
