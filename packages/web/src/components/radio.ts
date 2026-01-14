import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/radio/radio.js';

/**
 * A pulsebeam radio button component.
 * 
 * @tag pb-radio
 * @event {Event} change - Dispatched when the checked state changes.
 */
@customElement('pb-radio')
export class Radio extends LitElement {
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

  /** Whether the radio button is checked. */
  @property({ type: Boolean }) checked = false;

  /** Whether the radio button is disabled. */
  @property({ type: Boolean }) disabled = false;

  /** The name of the radio group. */
  @property({ type: String }) name = '';

  /** The value associated with this radio button. */
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
    'pb-radio': Radio;
  }
}
