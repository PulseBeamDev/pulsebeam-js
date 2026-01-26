import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/checkbox/checkbox.js';

/**
 * A pulsebeam checkbox component.
 * 
 * @tag pb-checkbox
 * @event {Event} change - Dispatched when the checked state changes.
 */
@customElement('pb-checkbox')
export class Checkbox extends LitElement {
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

  /** Whether the checkbox is checked. */
  @property({ type: Boolean }) checked = false;

  /** Whether the checkbox is disabled. */
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
    'pb-checkbox': Checkbox;
  }
}
