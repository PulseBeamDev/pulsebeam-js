import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';

export type ButtonVariant = 'filled' | 'outlined' | 'icon';

/**
 * A pulsebeam button component that wraps material design buttons.
 * 
 * @tag pb-button
 * @slot - The button's label or content.
 */
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

  /**
   * The visual variant of the button.
   * @type {'filled' | 'outlined' | 'icon'}
   */
  @property({ type: String }) variant: ButtonVariant = 'filled';

  /** Whether the button is disabled. */
  @property({ type: Boolean }) disabled = false;

  /** The material icon name to display. */
  @property({ type: String }) icon = '';

  /** The HTML button type. */
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
