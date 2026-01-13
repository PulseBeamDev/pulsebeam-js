import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/textfield/outlined-text-field.js';

@customElement('pb-textarea')
export class PbTextarea extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: block;
      }
      md-outlined-text-field {
        width: 100%;
        --md-outlined-text-field-container-shape: var(--pb-radius);
        --md-outlined-text-field-outline-color: var(--pb-border);
        --md-outlined-text-field-focus-outline-color: var(--pb-blue);
      }
    `
  ];

  @property({ type: String }) label = '';
  @property({ type: String }) value = '';
  @property({ type: String }) placeholder = '';
  @property({ type: Boolean }) readonly = false;
  @property({ type: Number }) rows = 3;

  render() {
    return html`
      <md-outlined-text-field
        type="textarea"
        label="${this.label}"
        value="${this.value}"
        placeholder="${this.placeholder}"
        rows="${this.rows}"
        ?readonly=${this.readonly}
      ></md-outlined-text-field>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-textarea': PbTextarea;
  }
}
