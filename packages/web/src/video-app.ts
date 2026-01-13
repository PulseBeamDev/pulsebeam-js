import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { pulseBeamStyles } from './design-system';

import './components/pb-layout';
import './components/pb-sidebar';
import './components/pb-header';
import './components/pb-icon';
import './components/pb-button';
import './components/pb-card';
import './components/pb-tag';

@customElement('pb-video-app')
export class PbVideoApp extends LitElement {
    static styles = [
        pulseBeamStyles,
        css`
      :host {
        display: block;
        height: 100vh;
        background: var(--pb-ink); /* Dark theme for video app */
        color: white;
      }

      .video-grid {
        display: grid;
        grid-template-columns: 3fr 1fr;
        grid-template-rows: 1fr 80px;
        height: 100%;
        gap: 16px;
        padding: 16px;
        box-sizing: border-box;
      }

      .stage {
        grid-column: 1;
        grid-row: 1;
        background: #1e293b;
        border-radius: var(--pb-radius);
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .participants {
        grid-column: 2;
        grid-row: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow-y: auto;
      }

      .controls {
        grid-column: 1 / -1;
        grid-row: 2;
        background: #1e293b;
        border-radius: var(--pb-radius);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
      }

      .participant-card {
        background: #334155;
        aspect-ratio: 16/9;
        border-radius: var(--pb-radius);
        position: relative;
      }
      
      .name-tag {
        position: absolute;
        bottom: 8px;
        left: 8px;
        background: rgba(0,0,0,0.6);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      }
      
      .stage img { width: 100%; height: 100%; object-fit: cover; }
    `
    ];

    render() {
        return html`
      <div class="video-grid">
        <div class="stage">
           <!-- Placeholder for active speaker -->
           <div class="name-tag">Lukas (You)</div>
           <pb-icon icon="mic_off" style="position:absolute; top:16px; right:16px; background:red; padding:4px; border-radius:50%;"></pb-icon>
        </div>

        <div class="participants">
           ${[1, 2, 3].map(i => html`
             <div class="participant-card">
               <div class="name-tag">Participant ${i}</div>
             </div>
           `)}
        </div>

        <div class="controls">
           <pb-button variant="icon" icon="mic"></pb-button>
           <pb-button variant="icon" icon="videocam"></pb-button>
           <pb-button variant="filled" style="--md-sys-color-primary: #dc2626;">End Call</pb-button>
           <pb-button variant="icon" icon="present_to_all"></pb-button>
           <pb-button variant="icon" icon="chat"></pb-button>
        </div>
      </div>
    `;
    }
}
