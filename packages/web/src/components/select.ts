import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';

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

  @property({ type: String }) label = '';
  @property({ type: String }) value = '';

  render() {
    return html`
      <md-outlined-select label="${this.label}" value="${this.value}">
        <slot></slot>
      </md-outlined-select>
    `;
  }
}

@customElement('pb-option')
export class Option extends LitElement {
  static styles = [pulseBeamStyles];

  @property({ type: String }) value = '';
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
