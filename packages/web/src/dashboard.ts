import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { pulseBeamStyles } from './design-system';

// Import all PB components
import './components/pb-layout';
import './components/pb-sidebar';
import './components/pb-header';
import './components/pb-icon';
import './components/pb-button';
import './components/pb-stat-card';
import './components/pb-card';
import './components/pb-text-field';
import './components/pb-switch';
import './components/pb-tag';
import './components/pb-table';
import type { PbTableColumn } from './components/pb-table';

// For icons
import 'material-symbols/outlined.css';

import { ThemeManager, type Theme } from './utils/theme-manager';

// Initialize theme on load (could be done in main.ts, but dashboard is entry for now)
ThemeManager.init();

@customElement('pb-dashboard')
export class Dashboard extends LitElement {

  @state() theme: Theme = ThemeManager.getTheme();

  static styles = [pulseBeamStyles, css`
    :host {
      display: block; /* Ensure it doesn't default to grid or inline */
      height: 100vh;
      width: 100%;
    }
    
    .crumbs { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; color: var(--pb-text-sec); font-weight: 500; }
    
    /* Utility for flex spacing */
    .flex-row { display: flex; gap: 8px; align-items: center; }
    .w-full { width: 100%; }
    
    .dashboard-grid {
       display: grid;
       grid-template-columns: repeat(12, 1fr);
       gap: 24px;
       align-items: start;
    }
    
    .col-3 { grid-column: span 3; }
    .col-9 { grid-column: span 9; }
    @media (max-width: 1200px) { .col-3, .col-9 { grid-column: span 12; } }
  `];

  @property({ type: Array }) sessions = [
    { id: "s_8829", user: "Alice_Dev", transport: "UDP", rate: "2.4 Mbps", status: "Active" },
    { id: "s_1102", user: "Bob_Ops", transport: "TCP", rate: "1.1 Mbps", status: "Active" },
    { id: "s_5521", user: "Charlie_QA", transport: "UDP", rate: "800 Kbps", status: "Warn" },
    { id: "s_3391", user: "Load_Test", transport: "UDP", rate: "4.2 Mbps", status: "Active" },
  ];

  columns: PbTableColumn[] = [
    { header: 'Session ID', accessor: 'id', width: '120px', render: (r) => html`<span style="font-family:var(--pb-font-mono); font-size:12px">${r.id}</span>` },
    { header: 'User', accessor: 'user', render: (r) => html`<span style="font-weight:600">${r.user}</span>` },
    { header: 'Transport', accessor: 'transport', render: (r) => html`<pb-tag label="${r.transport}"></pb-tag>` },
    { header: 'Bitrate', accessor: 'rate', render: (r) => html`<span style="font-family:var(--pb-font-mono)">${r.rate}</span>` },
    {
      header: 'Status', accessor: 'status', render: (r) => html`
      <span style="font-size:12px; font-weight:600; color:${r.status === 'Active' ? '#16a34a' : '#b45309'}">
        ● ${r.status}
      </span>
    ` }
  ];

  toggleTheme() {
    this.theme = ThemeManager.toggle();
  }

  render() {
    return html`
      <pb-layout>
        <pb-sidebar slot="sidebar">
           <div slot="brand" style="display:flex;align-items:center;gap:10px;">
            <img src="https://pulsebeam.dev/favicon.svg" width=24 heigh=24 />
             PulseBeam
           </div>

           <pb-sidebar-group title="Platform">
             <pb-sidebar-item icon="grid_view" active>Overview</pb-sidebar-item>
             <pb-sidebar-item icon="dns">Nodes</pb-sidebar-item>
             <pb-sidebar-item icon="hub">Topologies</pb-sidebar-item>
           </pb-sidebar-group>

           <pb-sidebar-group title="Observability">
             <pb-sidebar-item icon="bar_chart">Metrics</pb-sidebar-item>
             <pb-sidebar-item icon="terminal">Logs</pb-sidebar-item>
           </pb-sidebar-group>
        </pb-sidebar>

        <pb-header slot="header">
          <div slot="start" class="crumbs">
            <pb-icon icon="home" style="font-size:18px; color:var(--pb-text-dim)"></pb-icon> / us-east-1 / 
            <pb-tag label="prod-sfu-04"/>
          </div>
          <div slot="end" style="display:flex; gap:8px;">
            <pb-button variant="icon" icon="${ThemeManager.getIcon(this.theme)}" @click=${this.toggleTheme}></pb-button>
            <pb-button icon="add">Deploy</pb-button>
          </div>
        </pb-header>

        <!-- Main Content -->
        <div class="dashboard-grid">
          <pb-stat-card class="col-3" label="Active Connections" value="4,812" trend="+12%" trendDirection="up"></pb-stat-card>
          <pb-stat-card class="col-3" label="Egress Bandwidth" value="8.2 GB/s" trend="Stable"></pb-stat-card>
          <pb-stat-card class="col-3" label="Cluster Health" value="99.9%" trend="Optimal" trendDirection="up"></pb-stat-card>
          <pb-stat-card class="col-3" label="Latency P95" value="24ms" trend="Global" trendDirection="up"></pb-stat-card>

          <pb-card class="col-9" header="Live Sessions">
             <div slot="header-actions" class="flex-row">
                <pb-button variant="outlined">Filter</pb-button>
                <pb-button variant="icon" icon="refresh"></pb-button> 
             </div>
             
             <pb-table .columns=${this.columns} .data=${this.sessions}></pb-table>
          </pb-card>

          <pb-card class="col-3" header="Node Config">
             <div style="font-size:12px; font-weight:600; color:var(--pb-text-sec); margin-bottom:8px;">Public Key</div>
             <pb-text-field value="pk_live_..." readonly trailingIcon="content_copy"></pb-text-field>
             
             <div style="height:1px; background:var(--pb-border); margin:16px 0;"></div>

             <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:14px; font-weight:500">Maintenance</span>
                <pb-switch></pb-switch>
             </div>
             <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:14px; font-weight:500">Simulcast</span>
                <pb-switch selected></pb-switch>
             </div>
             
             <div style="margin-top:16px">
                <pb-button variant="outlined" style="width:100%; display:flex;">View Raw Config</pb-button>
             </div>
          </pb-card>
        </div>
      </pb-layout>
    `;
  }
}
