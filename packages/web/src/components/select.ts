import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

import { MdSelectOption } from '@material/web/select/select-option.js';
import '@material/web/select/outlined-select.js';

/**
 * A pulsebeam select component for choosing from a list of options.
 * 
 * @tag pb-select
 * @slot - The select options (pb-select-option elements).
 */
@customElement('pb-select')
export class Select extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: block;
        width: auto;
      }

      md-outlined-select {
        width: 100%;
      }
    `
  ];

  @property({ type: String }) label = '';
  @property({ type: String }) value = '';

  render() {
    return html`
      <md-outlined-select 
        .label="${this.label}" 
        .value="${this.value}"
        @change=${this._handleChange}
      >
        <slot></slot>
      </md-outlined-select>
    `;
  }

  private _handleChange(e: Event) {
    e.stopPropagation(); // Stop the material event to normalize the payload
    const target = e.target as any;
    this.value = target.value;

    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true,
      composed: true,
      detail: { value: this.value }
    }));
  }
}

/**
 * An option element for use within pb-select.
 * 
 * We must extend MdSelectOption. The md-outlined-select component inspects 
 * its children looking for specific class instances to handle navigation/selection.
 * If we wrapped this in ShadowDOM, the parent would not see it.
 */
@customElement('pb-select-option')
export class Option extends MdSelectOption {
  static override styles = [
    ...super.styles,
    pulseBeamStyles,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'pb-select': Select;
    'pb-select-option': Option;
  }
}
