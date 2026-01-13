import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/textfield/outlined-text-field.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';

@customElement('pb-text-field')
export class TextField extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: block;
      }
      md-outlined-text-field {
        width: 100%;
        --md-outlined-text-field-container-shape: var(--pb-radius);
        --md-outlined-text-field-top-space: 8px;
        --md-outlined-text-field-bottom-space: 8px;
        --md-outlined-text-field-input-text-size: 13px;
        --md-outlined-text-field-input-text-font: var(--pb-font-mono);
        --md-outlined-text-field-outline-color: var(--pb-border);
        --md-outlined-text-field-focus-outline-color: var(--pb-blue);
      }
    `
  ];

  @property({ type: String }) label = '';
  @property({ type: String }) value = '';
  @property({ type: String }) placeholder = '';
  @property({ type: String }) type = 'text';
  @property({ type: Boolean }) readonly = false;
  @property({ type: String }) leadingIcon = '';
  @property({ type: String }) trailingIcon = '';

  render() {
    return html`
      <md-outlined-text-field
        label="${this.label}"
        value="${this.value}"
        placeholder="${this.placeholder}"
        type="${this.type}"
        ?readonly=${this.readonly}
      >
        ${this.leadingIcon ? html`<md-icon slot="leading-icon">${this.leadingIcon}</md-icon>` : ''}
        ${this.trailingIcon ? html`<md-icon slot="trailing-icon">${this.trailingIcon}</md-icon>` : ''}
        <slot name="trailing-action" slot="trailing-icon"></slot>
      </md-outlined-text-field>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-text-field': TextField;
  }
}
