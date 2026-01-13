import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../design-system';

@customElement('pb-card')
export class PbCard extends LitElement {
    static styles = [
        pulseBeamStyles,
        css`
      :host {
        display: block;
        background: var(--pb-paper);
        border: 1px solid var(--pb-border);
        border-radius: var(--pb-radius);
        box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        overflow: hidden;
        height: fit-content;
      }

      header {
        height: 44px; 
        padding: 0 20px;
        border-bottom: 1px solid var(--pb-border);
        background: #fafbfc;
        display: flex; align-items: center; justify-content: space-between;
      }

      h3 {
        margin: 0; 
        font-size: 0.8125rem; 
        font-weight: 700; 
        color: var(--pb-text); 
        text-transform: uppercase; 
        letter-spacing: 0.05em;
      }

      .content {
        padding: 20px; 
        display: flex; 
        flex-direction: column; 
        gap: 16px;
      }
      
      /* If no header, we might want to adjust padding or styling, 
         but adhering to the dashboard look, usually cards have headers or just content. */
    `
    ];

    @property({ type: String }) header = '';

    render() {
        return html`
      ${this.header
                ? html`
            <header>
              <h3>${this.header}</h3>
              <slot name="header-actions"></slot>
            </header>`
                : html`<slot name="header-full"></slot>`
            }
      <div class="content">
        <slot></slot>
      </div>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'pb-card': PbCard;
    }
}
