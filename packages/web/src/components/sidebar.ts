import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { pulseBeamStyles } from '../theme';

@customElement('pb-sidebar')
export class Sidebar extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--pb-paper);
        border-right: 1px solid var(--pb-border);
        padding: 20px 16px; 
        gap: 32px;
      }
      
      .brand {
        display: flex; align-items: center; gap: 10px;
        font-weight: 800; font-size: 1.1rem; letter-spacing: -0.02em;
        color: var(--pb-ink); padding-left: 8px;
      }
    `
  ];

  render() {
    return html`
      <div class="brand">
         <slot name="brand"></slot>
      </div>
      <nav style="display: flex; flex-direction: column; gap: 4px;">
         <slot></slot>
      </nav>
    `;
  }
}

@customElement('pb-sidebar-group')
export class SidebarGroup extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: flex; 
        flex-direction: column; 
        gap: 4px;
        margin-bottom: 24px;
      }
      h6 {
        margin: 0 0 8px 12px;
        font-size: 0.75rem; font-weight: 700; color: var(--pb-text-dim);
        text-transform: uppercase; letter-spacing: 0.05em;
      }
    `
  ];

  @property({ type: String }) title = '';

  render() {
    return html`
      <h6>${this.title}</h6>
      <slot></slot>
    `;
  }
}

@customElement('pb-sidebar-item')
export class SidebarItem extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: block;
      }
      a {
        display: flex; align-items: center; gap: 10px; padding: 8px 12px;
        border-radius: var(--pb-radius);
        font-size: 0.875rem; font-weight: 600; color: var(--pb-text-sec);
        transition: all 0.1s; border: 1px solid transparent;
        cursor: pointer;
        text-decoration: none;
      }
      a:hover { background: var(--pb-canvas); color: var(--pb-text); }
      a.active { background: var(--pb-blue); color: white; border-color: var(--pb-blue); }
    `
  ];

  @property({ type: Boolean }) active = false;
  @property({ type: String }) href = '#';
  @property({ type: String }) icon = '';

  render() {
    return html`
      <a href="${this.href}" class="${this.active ? 'active' : ''}">
        ${this.icon ? html`<md-icon>${this.icon}</md-icon>` : ''}
        <slot></slot>
      </a>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'pb-sidebar': Sidebar;
    'pb-sidebar-group': SidebarGroup;
    'pb-sidebar-item': SidebarItem;
  }
}
