import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import './icon';

/**
 * A pulsebeam stat card for displaying key metrics with a trend indicator.
 * 
 * @tag pb-stat-card
 */
@customElement('pb-stat-card')
export class StatCard extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: block;
        background: var(--pb-paper);
        border: 1px solid var(--pb-border);
        border-radius: var(--pb-radius);
        box-shadow: 0 1px 2px rgba(0,0,0,0.02);
      }
      
      .stat-content {
        padding: 24px;
        display: flex;
        flex-direction: column;
      }

      .label {
        font-size: 0.75rem; 
        font-weight: 700; 
        color: var(--pb-text-dim); 
        text-transform: uppercase; 
        letter-spacing: 0.05em;
      }

      .value {
        font-family: var(--pb-font-mono); 
        font-size: 1.75rem; 
        font-weight: 600; 
        letter-spacing: -0.04em; 
        margin-top: 12px; 
        color: var(--pb-ink); 
        line-height: 1;
      }

      .meta {
        font-size: 0.8125rem; 
        font-weight: 600; 
        margin-top: 8px; 
        display: flex; 
        align-items: center; 
        gap: 4px;
      }

      .trend-up { color: #16a34a; }
      .trend-down { color: #dc2626; }
      .trend-neutral { color: var(--pb-text-sub); }
    `
  ];

  /** The label text for the metric. */
  @property({ type: String }) label = '';

  /** The value of the metric. */
  @property({ type: String }) value = '';

  /** The trend text (e.g., "+12%"). */
  @property({ type: String }) trend = '';

  /** The direction of the trend. */
  @property({ type: String }) trendDirection: 'up' | 'down' | 'neutral' = 'neutral';

  render() {
    let icon = 'remove';
    if (this.trendDirection === 'up') icon = 'trending_up';
    if (this.trendDirection === 'down') icon = 'trending_down';

    return html`
      <div class="stat-content">
        <div class="label">${this.label}</div>
        <div class="value">${this.value}</div>
        <div class="meta trend-${this.trendDirection}">
           <pb-icon icon="${icon}" style="font-size:16px"></pb-icon> ${this.trend}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-stat-card': StatCard;
  }
}
