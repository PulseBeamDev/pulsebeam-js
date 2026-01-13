import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';

/**
 * @tag pb-select
 * @slot - The select options (pb-option elements)
 */
@customElement('pb-select')
export class Select extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: block;
      }
      md-outlined-select {
        width: 100%;
        --md-outlined-select-container-shape: var(--pb-radius);
        --md-outlined-select-outline-color: var(--pb-border);
        --md-outlined-select-focus-outline-color: var(--pb-blue);
      }
    `
  ];

  /** @attribute */
  @property({ type: String }) label = '';
  /** @attribute */
  @property({ type: String }) value = '';

  render() {
    return html`
      <md-outlined-select label="${this.label}" value="${this.value}">
        <slot></slot>
      </md-outlined-select>
    `;
  }
}

/**
 * @tag pb-option
 */
@customElement('pb-option')
export class Option extends LitElement {
  static styles = [pulseBeamStyles];

  /** @attribute */
  @property({ type: String }) value = '';
  /** @attribute */
  @property({ type: Boolean }) selected = false;

  render() {
    return html`
      <md-select-option value="${this.value}" ?selected=${this.selected}>
        <div slot="headline"><slot></slot></div>
      </md-select-option>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-select': Select;
    'pb-option': Option;
  }
}
