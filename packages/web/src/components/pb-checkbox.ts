import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/checkbox/checkbox.js';

@customElement('pb-checkbox')
export class PbCheckbox extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
      }
      md-checkbox {
        --md-checkbox-outline-color: var(--pb-border-dk);
        --md-checkbox-selected-container-color: var(--pb-blue);
      }
    `
  ];

  @property({ type: Boolean }) checked = false;
  @property({ type: Boolean }) disabled = false;

  render() {
    return html`
      <md-checkbox
        ?checked=${this.checked}
        ?disabled=${this.disabled}
        @change=${this._handleChange}
      ></md-checkbox>
    `;
  }

  private _handleChange(e: Event) {
    this.checked = (e.target as HTMLInputElement).checked;
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-checkbox': PbCheckbox;
  }
}
