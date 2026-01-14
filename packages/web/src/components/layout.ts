import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';
/**
 * The main layout component for the PulseBeam dashboard.
 * 
 * @tag pb-layout
 * @slot sidebar - The sidebar area where navigation is typically placed.
 * @slot header - The header area for top-level navigation and breadcrumbs.
 * @slot - Main content area of the application.
 */
@customElement('pb-layout')
export class Layout extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: grid;
        grid-template-columns: 240px 1fr;
        height: 100vh;
        width: 100%;
        overflow: hidden;
      }
      
      aside {
        grid-column: 1;
        grid-row: 1 / -1;
        overflow-y: auto;
      }
      
      main {
        grid-column: 2;
        grid-row: 1 / -1;
        display: grid;
        grid-template-rows: 60px 1fr;
        flex-direction: column;
        overflow: hidden;
        background-color: var(--pb-canvas);
        background-image: radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px);
        background-size: 24px 24px;
      }
      
      .content {
        overflow-y: auto;
        padding: 32px;
        display: block; /* Removed forced grid */
        height: 100%;
        box-sizing: border-box;
      }
      
      @media (max-width: 1200px) {
        /* simple responsive handling if needed */
      }
    `
  ];

  render() {
    return html`
      <aside>
        <slot name="sidebar"></slot>
      </aside>
      <main>
        <slot name="header"></slot>
        <div class="content">
          <slot></slot>
        </div>
      </main>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-layout': Layout;
  }
}
