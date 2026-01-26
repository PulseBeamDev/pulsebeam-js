import { LitElement, html, css } from 'lit';
import type { TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

export interface TableColumn<T = any> {
  header: string;
  accessor?: keyof T;
  render?: (item: T) => TemplateResult | string | number;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * A pulsebeam data table component.
 * 
 * @tag pb-table
 */
@customElement('pb-table')
export class Table extends LitElement {
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
        border-bottom: 1px solid var(--pb-border); 
        color: var(--pb-text-sub); 
        font-weight: 700; 
        font-size: 0.75rem; 
        text-transform: uppercase; 
        letter-spacing: 0.05em; 
        background: transparent;
      }
      td { 
        padding: 12px 20px; 
        border-bottom: 1px solid var(--pb-border); 
        color: var(--pb-text); 
        vertical-align: middle;
      }
      tr:last-child td { border-bottom: none; }
      tr:hover td { background: var(--pb-canvas); }
    `
  ];

  /** The column definitions for the table. */
  @property({ type: Array }) columns: TableColumn[] = [];

  /** The data to display in the table. */
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

  private _renderCell(row: any, col: TableColumn) {
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
    'pb-table': Table;
  }
}
