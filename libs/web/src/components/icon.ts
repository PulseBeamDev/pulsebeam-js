import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/icon/icon.js';

/**
 * A wrapper component for material design icons.
 * 
 * @tag pb-icon
 */
@customElement('pb-icon')
export class Icon extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
    `
  ];

  /** The name of the material icon to display. */
  @property({ type: String }) icon = '';

  render() {
    return html`<md-icon>${this.icon}</md-icon>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-icon': Icon;
  }
}
