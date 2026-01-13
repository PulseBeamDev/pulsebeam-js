import { LitElement, html, css } from 'lit';
import type { TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../design-system';

export interface PbTableColumn<T = any> {
    header: string;
    accessor?: keyof T;
    render?: (item: T) => TemplateResult | string | number;
    width?: string;
    align?: 'left' | 'center' | 'right';
}

@customElement('pb-table')
export class PbTable extends LitElement {
    static styles = [
        pulseBeamStyles,
        css`
      :host {
        display: block;
        width: 100%;
        overflow-x: auto;
      }
      table { 
        width: 100%; 
        border-collapse: collapse; 
        font-size: 0.875rem; 
      }
      th { 
        text-align: left; 
        padding: 12px 20px; 
        background: #fff; 
        border-bottom: 1px solid var(--pb-border); 
        color: var(--pb-text-sec); 
        font-weight: 700; 
        font-size: 0.75rem; 
        text-transform: uppercase; 
        letter-spacing: 0.05em; 
      }
      td { 
        padding: 12px 20px; 
        border-bottom: 1px solid var(--pb-border); 
        color: var(--pb-text); 
        vertical-align: middle;
      }
      tr:last-child td { border-bottom: none; }
      tr:hover td { background: #f8fafc; }
    `
    ];

    @property({ type: Array }) columns: PbTableColumn[] = [];
    @property({ type: Array }) data: any[] = [];

    render() {
        return html`
      <table>
        <thead>
          <tr>
            ${this.columns.map(col => html`
              <th style="width: ${col.width || 'auto'}; text-align: ${col.align || 'left'}">
                ${col.header}
              </th>
            `)}
          </tr>
        </thead>
        <tbody>
          ${this.data.map(row => html`
            <tr>
              ${this.columns.map(col => html`
                <td style="text-align: ${col.align || 'left'}">
                  ${this._renderCell(row, col)}
                </td>
              `)}
            </tr>
          `)}
        </tbody>
      </table>
    `;
    }

    private _renderCell(row: any, col: PbTableColumn) {
        if (col.render) {
            return col.render(row);
        }
        if (col.accessor) {
            return row[col.accessor];
        }
        return '';
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'pb-table': PbTable;
    }
}
