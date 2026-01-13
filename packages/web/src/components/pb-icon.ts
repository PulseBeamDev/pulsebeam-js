import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import '@material/web/icon/icon.js';

@customElement('pb-icon')
export class PbIcon extends LitElement {
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

  @property({ type: String }) icon = '';

  render() {
    return html`<md-icon>${this.icon}</md-icon>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-icon': PbIcon;
  }
}
