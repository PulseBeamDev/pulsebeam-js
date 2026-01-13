import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';

export type ButtonVariant = 'filled' | 'outlined' | 'icon';

@customElement('pb-button')
export class Button extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: inline-flex;
      }
    `
  ];

  @property({ type: String }) variant: ButtonVariant = 'filled';
  @property({ type: Boolean }) disabled = false;
  @property({ type: String }) icon = '';
  @property({ type: String }) type = 'button';

  render() {
    if (this.variant === 'icon') {
      return html`
        <md-icon-button ?disabled=${this.disabled} type=${this.type}>
          <md-icon>${this.icon}</md-icon>
        </md-icon-button>
      `;
    }

    if (this.variant === 'outlined') {
      return html`
        <md-outlined-button ?disabled=${this.disabled} type=${this.type}>
          ${this.icon ? html`<md-icon slot="icon">${this.icon}</md-icon>` : ''}
          <slot></slot>
        </md-outlined-button>
      `;
    }

    return html`
      <md-filled-button ?disabled=${this.disabled} type=${this.type}>
        ${this.icon ? html`<md-icon slot="icon">${this.icon}</md-icon>` : ''}
        <slot></slot>
      </md-filled-button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-button': Button;
  }
}
