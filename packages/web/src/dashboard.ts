import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';

import { pulseBeamStyles } from './design-system.ts';

import 'material-symbols/outlined.css';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/switch/switch.js';
import '@material/web/chips/assist-chip.js';
import '@material/web/divider/divider.js';

@customElement('pb-dashboard')
export class Dashboard extends LitElement {

  static styles = [pulseBeamStyles];

  @property({ type: Array }) sessions = [
    { id: "s_8829", user: "Alice_Dev", transport: "UDP", rate: "2.4 Mbps", status: "Active" },
    { id: "s_1102", user: "Bob_Ops", transport: "TCP", rate: "1.1 Mbps", status: "Active" },
    { id: "s_5521", user: "Charlie_QA", transport: "UDP", rate: "800 Kbps", status: "Warn" },
    { id: "s_3391", user: "Load_Test", transport: "UDP", rate: "4.2 Mbps", status: "Active" },
  ];

  render() {
    return html`
      <aside>
        <div class="brand">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
             <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="var(--pb-blue)"/>
             <path d="M2 17L12 22L22 17" stroke="var(--pb-blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>
           PulseBeam
        </div>

        <nav>
          <h6>Platform</h6>
          <a class="active"><md-icon>grid_view</md-icon> Overview</a>
          <a><md-icon>dns</md-icon> Nodes</a>
          <a><md-icon>hub</md-icon> Topologies</a>
        </nav>

        <nav>
          <h6>Observability</h6>
          <a><md-icon>bar_chart</md-icon> Metrics</a>
          <a><md-icon>terminal</md-icon> Logs</a>
        </nav>
      </aside>

      <main>
        <header>
          <div class="crumbs">
            <md-icon style="font-size:18px; color:var(--pb-text-dim)">home</md-icon> / us-east-1 / 
            <span class="tag">prod-sfu-04</span>
          </div>
          <md-filled-button>
            <md-icon slot="icon">add</md-icon> Deploy
          </md-filled-button>
        </header>

        <div class="grid">
          
          <!-- Stats -->
          ${this.renderStat("Active Connections", "4,812", "+12%", true)}
          ${this.renderStat("Egress Bandwidth", "8.2 GB/s", "Stable", false)}
          ${this.renderStat("Cluster Health", "99.9%", "Optimal", true)}
          ${this.renderStat("Latency P95", "24ms", "Global", true)}

          <!-- Table -->
          <section class="col-9">
            <header>
               <h3>Live Sessions</h3>
               <div style="display:flex; gap:8px">
                  <md-outlined-button>Filter</md-outlined-button>
                  <md-icon-button style="width:24px; height:24px; padding:4px;"><md-icon>refresh</md-icon></md-icon-button>
               </div>
            </header>
            
            <table>
              <thead>
                <tr><th>Session ID</th><th>User</th><th>Transport</th><th>Bitrate</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${map(this.sessions, s => html`
                  <tr>
                    <td class="mono" style="font-size:12px;">${s.id}</td>
                    <td style="font-weight:600">${s.user}</td>
                    <td>
                      <!-- Compact Chip -->
                      <md-assist-chip label="${s.transport}" style="--md-assist-chip-container-height:22px; --md-assist-chip-label-text-weight:600;"></md-assist-chip>
                    </td>
                    <td class="mono">${s.rate}</td>
                    <td>
                      <span style="font-size:11px; font-weight:600; color:${s.status === 'Active' ? '#16a34a' : '#b45309'}">
                         ● ${s.status}
                      </span>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </section>

          <!-- Config -->
          <section class="col-3">
             <header><h3>Node Config</h3></header>
             <div>
                <div>
                   <div style="font-size:11px; font-weight:600; color:var(--pb-text-dim); margin-bottom:6px;">Public Key</div>
                   <md-outlined-text-field value="pk_live_..." readonly style="width:100%">
                      <md-icon-button slot="trailing-icon"><md-icon>content_copy</md-icon></md-icon-button>
                   </md-outlined-text-field>
                </div>
                
                <md-divider></md-divider>

                <div style="display:flex; justify-content:space-between; align-items:center;">
                   <span style="font-size:13px; font-weight:500">Maintenance</span>
                   <md-switch></md-switch>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                   <span style="font-size:13px; font-weight:500">Simulcast</span>
                   <md-switch selected></md-switch>
                </div>
                
                <div style="margin-top:16px">
                   <md-outlined-button style="width:100%">View Raw Config</md-outlined-button>
                </div>
             </div>
          </section>

        </div>
      </main>
    `;
  }

  renderStat(label: string, value: string, sub: string, good: boolean) {
    return html`
      <section class="col-3">
         <div style="padding: 20px;">
            <div style="font-size:0.75rem; font-weight:600; color:var(--pb-text-dim); text-transform:uppercase; letter-spacing:0.05em">${label}</div>
            <div class="stat-val">${value}</div>
            <div class="stat-meta ${good ? 'trend-up' : ''}">
               <md-icon style="font-size:14px">${good ? 'trending_up' : 'remove'}</md-icon> ${sub}
            </div>
         </div>
      </section>
    `;
  }
}
