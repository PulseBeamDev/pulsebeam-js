import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';

import 'material-symbols/outlined.css';
import '@fontsource/inter';

// Material Web Components
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/switch/switch.js';
import '@material/web/slider/slider.js';
import '@material/web/tabs/tabs.js';
import '@material/web/tabs/primary-tab.js';
import '@material/web/chips/assist-chip.js';

declare global {
  interface HTMLElementTagNameMap {
    'pb-dashboard': Dashboard
  }
}

@customElement('pb-dashboard')
export class Dashboard extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--md-sys-color-surface, #f9f9fb);
      color: var(--md-sys-color-on-surface, #1f1f1f);
      font-family: Inter, system-ui, sans-serif;

      --md-ref-typeface-brand: Inter;
      --md-ref-typeface-plain: Inter;

      --md-sys-typescale-headline-font: Inter;
      --md-sys-typescale-title-font: Inter;
    }

    /* Layout Primitives */
    .layout { max-width: 1400px; margin: 0 auto; padding: 24px; display: flex; flex-direction: column; gap: 24px; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 64px; background: var(--md-sys-color-surface-container-low, #fff); }
    .row { display: flex; gap: 16px; align-items: center; }
    .grid { display: grid; gap: 24px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
    .col-2 { grid-column: span 2; }
    
    @media (max-width: 1000px) { .col-2 { grid-column: span 1; } }

    /* Material-like Card container since Material Web lacks a specific <md-card> layout currently */
    .card {
      background: var(--md-sys-color-surface-container-low, #fff);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid var(--md-sys-color-outline-variant, #e0e0e0);
      display: flex; flex-direction: column; gap: 16px;
    }

    /* Minimal Table Styling */
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { color: var(--md-sys-color-on-surface-variant, #777); font-weight: 500; padding: 12px 8px; border-bottom: 1px solid #eee; }
    td { padding: 12px 8px; border-bottom: 1px solid #eee; }
    .status-active { color: #16a34a; font-weight: 500; }
    
    /* Utilities */
    .text-xl { font-size: 1.5rem; font-weight: 700; margin: 0; }
    .text-sm { font-size: 0.875rem; color: var(--md-sys-color-on-surface-variant); margin: 0; }
    .spacer { flex: 1; }
  `;

  @property({ type: Array }) sessions = [
    { id: "sess_01", user: "Alice Dev", role: "Pub", codec: "VP8", bitrate: "2.4 Mbps", status: "Active" },
    { id: "sess_02", user: "Bob Ops", role: "Sub", codec: "H.264", bitrate: "1.1 Mbps", status: "Active" },
    { id: "sess_03", user: "Charlie QA", role: "Sub", codec: "AV1", bitrate: "800 Kbps", status: "Pending" },
  ];

  @state() _tab = 0;

  render() {
    return html`
      <!-- Header -->
      <header class="header">
        <div class="row">
          <img src="https://pulsebeam.dev/favicon.svg" height="32" alt="Logo" />
          <span style="font-weight: 700; font-size: 1.1rem;">PulseBeam</span>
        </div>
        <nav class="row">
          <md-text-button>Overview</md-text-button>
          <md-text-button>Nodes</md-text-button>
          <md-text-button>Usage</md-text-button>
        </nav>
        <div class="row">
          <md-outlined-button>Docs</md-outlined-button>
          <md-icon-button><md-icon>account_circle</md-icon></md-icon-button>
        </div>
      </header>

      <main class="layout">
        <!-- Hero -->
        <div class="row" style="justify-content: space-between">
          <div>
            <h1 class="text-xl">System Overview</h1>
            <p class="text-sm">Manage WebRTC clusters and media flows.</p>
          </div>
          <div class="row">
            <md-outlined-button><md-icon slot="icon">settings</md-icon>Configure</md-outlined-button>
            <md-filled-button><md-icon slot="icon">dns</md-icon>Deploy Node</md-filled-button>
          </div>
        </div>

        <!-- Stats -->
        <div class="grid">
          ${this.renderStat("Active Connections", "1,248", "group", "+12% from last hour")}
          ${this.renderStat("Network Egress", "4.8 Gbps", "activity_zone", "85% capacity")}
          ${this.renderStat("SFU Health", "Operational", "shield", "Uptime: 99.99%", true)}
        </div>

        <div class="grid">
          <!-- Table Card -->
          <div class="card col-2">
            <div class="row" style="justify-content: space-between">
              <div>
                <h3 style="margin:0">Live Sessions</h3>
                <p class="text-sm">Real-time view of Node-01</p>
              </div>
              <md-icon-button><md-icon>more_vert</md-icon></md-icon-button>
            </div>
            
            <table>
              <thead>
                <tr><th>ID</th><th>User</th><th>Role</th><th>Codec</th><th>Bitrate</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${map(this.sessions, s => html`
                  <tr>
                    <td style="font-family:monospace">${s.id}</td>
                    <td>${s.user}</td>
                    <td>${s.role}</td>
                    <td><md-assist-chip label="${s.codec}"></md-assist-chip></td>
                    <td>${s.bitrate}</td>
                    <td class="${s.status === 'Active' ? 'status-active' : ''}">${s.status}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>

          <!-- Config Panel -->
          <div style="display:flex; flex-direction:column; gap: 24px;">
            <!-- API Keys -->
            <div class="card">
              <h3 style="margin:0">API Configuration</h3>
              <md-outlined-text-field label="Public Key" value="pk_live_51M..." readonly style="width:100%">
                <md-icon-button slot="trailing-icon"><md-icon>content_copy</md-icon></md-icon-button>
              </md-outlined-text-field>
              <md-outlined-text-field label="Secret Key" type="password" value="sk_test_..." style="width:100%"></md-outlined-text-field>
            </div>

            <!-- Media Settings -->
            <div class="card">
              <h3 style="margin:0">Media Settings</h3>
              <md-tabs @change=${(e: Event) => this._tab = (e.target as any).activeTabIndex}>
                <md-primary-tab>Video</md-primary-tab>
                <md-primary-tab>Audio</md-primary-tab>
              </md-tabs>

              <div style="padding-top: 16px; display: flex; flex-direction: column; gap: 16px;">
                ${this._tab === 0 ? html`
                  <div class="row" style="justify-content: space-between">
                    <div>
                      <div style="font-weight:500">Simulcast</div>
                      <div class="text-sm">Auto-scale quality tiers</div>
                    </div>
                    <md-switch selected></md-switch>
                  </div>
                  <div>
                    <div style="font-weight:500; margin-bottom: 8px;">Max Ingest Bitrate</div>
                    <md-slider min="0" max="100" value="75" labeled></md-slider>
                  </div>
                ` : html`<div class="text-sm" style="text-align:center; padding: 20px;">Audio Settings...</div>`}
                
                <md-filled-button style="width:100%">Save Changes</md-filled-button>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;
  }

  renderStat(title: string, value: string, icon: string, subtitle: string, green = false) {
    return html`
      <div class="card">
        <div class="row" style="justify-content: space-between">
          <span style="font-weight: 500">${title}</span>
          <md-icon style="color: var(--md-sys-color-on-surface-variant)">${icon}</md-icon>
        </div>
        <div>
          <div class="text-xl" style="${green ? 'color: #16a34a' : ''}">${value}</div>
          <div class="text-sm">${subtitle}</div>
        </div>
      </div>
    `;
  }
}
