import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/textfield/outlined-text-field.js';

/**
 * @tag pb-textarea
 */
@customElement('pb-textarea')
export class Textarea extends LitElement {
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

  /** @attribute */
  @property({ type: String }) label = '';
  /** @attribute */
  @property({ type: String }) value = '';
  /** @attribute */
  @property({ type: String }) placeholder = '';
  /** @attribute */
  @property({ type: Boolean }) readonly = false;
  /** @attribute */
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
    'pb-textarea': Textarea;
  }
}
