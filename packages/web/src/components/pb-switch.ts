import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/switch/switch.js';

@customElement('pb-switch')
export class PbSwitch extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
      }
    `
  ];

  @property({ type: Boolean }) selected = false;
  @property({ type: Boolean }) disabled = false;
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
    'pb-switch': PbSwitch;
  }
}
