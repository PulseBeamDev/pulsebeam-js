import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { pulseBeamStyles } from './theme';

import './components/layout';
import './components/sidebar';
import './components/header';
import './components/icon';
import './components/button';
import './components/card';
import './components/tag';

@customElement('pb-video-app')
export class VideoApp extends LitElement {
  static styles = [
    pulseBeamStyles,
    css`
      :host {
        display: block;
        height: 100vh;
        background: var(--pb-canvas); /* Light theme */
        color: var(--pb-text);
      }

      .video-grid {
        display: grid;
        grid-template-columns: 1fr 320px; /* Switch columns: Main stage left, sidebar right */
        grid-template-rows: 1fr 80px;
        height: 100%;
        gap: 24px;
        padding: 24px;
        box-sizing: border-box;
      }

      .stage {
        grid-column: 1;
        grid-row: 1;
        background: #000; /* Video stage remains dark for contrast */
        border-radius: var(--pb-radius);
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      }

      .participants {
        grid-column: 2;
        grid-row: 1;
        display: flex;
        flex-direction: column;
        gap: 16px;
        overflow-y: auto;
      }

      .controls {
        grid-column: 1 / -1;
        grid-row: 2;
        background: var(--pb-paper);
        border: 1px solid var(--pb-border);
        border-radius: var(--pb-radius);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05); /* Subtle shadow for floating bar effect */
      }

      .participant-card {
        background: var(--pb-paper);
        border: 1px solid var(--pb-border);
        aspect-ratio: 16/9;
        border-radius: var(--pb-radius);
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .avatar-placeholder {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--pb-canvas);
        color: var(--pb-text-dim);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
      }
      
      .name-tag {
        position: absolute;
        bottom: 8px;
        left: 8px;
        background: rgba(0,0,0,0.6);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      
      .stage .name-tag {
        background: rgba(0,0,0,0.6);
        font-size: 13px;
        padding: 6px 12px;
      }
    `
  ];

  render() {
    return html`
      <div class="video-grid">
        <div class="stage">
           <!-- Placeholder for active speaker -->
           <div style="color:white; opacity:0.5; font-weight:500;">Active Speaker Video</div>
           <div class="name-tag">Lukas (You)</div>
           <pb-icon icon="mic_off" style="position:absolute; top:16px; right:16px; background:#dc2626; color:white; padding:6px; border-radius:50%; font-size:18px;"></pb-icon>
        </div>

        <div class="participants">
           <pb-card header="Participants (3)" style="height:100%; display:flex; flex-direction:column;">
             <div style="display:flex; flex-direction:column; gap:12px; height:100%; overflow-y:auto; padding-right:4px;">
               ${[1, 2, 3].map(i => html`
                 <div class="participant-card">
                   <div class="avatar-placeholder">P${i}</div>
                   <div class="name-tag">Participant ${i}</div>
                 </div>
               `)}
             </div>
           </pb-card>
        </div>

        <div class="controls">
           <pb-button variant="icon" icon="mic"></pb-button>
           <pb-button variant="icon" icon="videocam"></pb-button>
           <pb-button variant="filled" style="--md-sys-color-primary: #dc2626; padding: 0 24px;">End Call</pb-button>
           <pb-button variant="icon" icon="present_to_all"></pb-button>
           <pb-button variant="icon" icon="chat"></pb-button>
        </div>
      </div>
    `;
  }
}
