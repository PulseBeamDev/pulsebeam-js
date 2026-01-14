import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/switch/switch.js';

/**
 * A pulsebeam switch component.
 * 
 * @tag pb-switch
 * @event {Event} change - Dispatched when the selected state changes.
 */
@customElement('pb-switch')
export class Switch extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
      }
    `
  ];

  /** Whether the switch is selected (on). */
  @property({ type: Boolean }) selected = false;

  /** Whether the switch is disabled. */
  @property({ type: Boolean }) disabled = false;

  /** Whether to show icons inside the switch handle. */
  @property({ type: Boolean }) icons = false;

  render() {
    return html`
      <md-switch
        ?selected=${this.selected}
        ?disabled=${this.disabled}
        ?icons=${this.icons}
        @change=${this._handleChange}
      ></md-switch>
    `;
  }

  private _handleChange(e: Event) {
    this.selected = (e.target as HTMLInputElement).checked;
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-switch': Switch;
  }
}
