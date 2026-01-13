import { css } from 'lit';

// Font Imports
import '@fontsource/manrope/index.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';

export const pulseBeamStyles = css`
  :host {
    /* ========================================================================
       1. BRAND TOKENS
       ======================================================================== */
    --pb-blue:      #2563eb;
    --pb-ink:       #0f172a;
    --pb-paper:     #ffffff;
    --pb-canvas:    #f8fafc;
    
    --pb-border:    #e2e8f0;
    --pb-border-dk: #94a3b8;
    
    --pb-text:      #0f172a;
    --pb-text-sub:  #475569;
    --pb-text-dim:  #94a3b8;

    --pb-font-ui:   'Manrope', system-ui, sans-serif;
    --pb-font-mono: 'JetBrains Mono', monospace;
    
    --pb-radius:    2px; /* Strict Square */

    /* ========================================================================
       2. COMPONENT OVERRIDES
       ======================================================================== */
    
    /* Global Fonts */
    --md-ref-typeface-brand: var(--pb-font-ui);
    --md-ref-typeface-plain: var(--pb-font-ui);

    /* --- BUTTONS --- */
    --md-filled-button-container-shape: var(--pb-radius);
    --md-filled-button-container-height: 32px;
    --md-filled-button-label-text-size: 13px;
    --md-filled-button-label-text-weight: 600;
    
    --md-outlined-button-container-shape: var(--pb-radius);
    --md-outlined-button-container-height: 32px;
    --md-outlined-button-label-text-size: 13px;
    --md-outlined-button-label-text-weight: 600;
    --md-outlined-button-outline-color: var(--pb-border-dk);

    /* --- INPUTS --- */
    --md-outlined-text-field-container-shape: var(--pb-radius);
    --md-outlined-text-field-top-space: 8px;
    --md-outlined-text-field-bottom-space: 8px;
    --md-outlined-text-field-input-text-size: 13px;
    --md-outlined-text-field-input-text-font: var(--pb-font-mono);
    --md-outlined-text-field-outline-color: var(--pb-border);
    --md-outlined-text-field-focus-outline-color: var(--pb-blue);

    /* --- CHIPS --- */
    --md-assist-chip-container-shape: var(--pb-radius);
    --md-assist-chip-container-height: 24px;
    --md-assist-chip-label-text-weight: 600;
    --md-assist-chip-outline-color: var(--pb-border-dk);

    /* -----------------------------------------------------------------
       THE SWITCH FIX: Stable Mechanical Block
       ----------------------------------------------------------------- */
    --md-switch-track-shape: 2px;
    --md-switch-handle-shape: 2px;
    --md-switch-track-width: 32px;
    --md-switch-track-height: 16px;
    --md-switch-handle-width: 10px;
    --md-switch-handle-height: 10px;
    --md-switch-selected-handle-width: 10px;
    --md-switch-selected-handle-height: 10px;

    --md-switch-track-color: #ffffff;         
    --md-switch-track-outline-color: #64748b; 
    --md-switch-handle-color: #64748b;        
    
    --md-switch-selected-track-color: var(--pb-blue);
    --md-switch-selected-track-outline-color: var(--pb-blue);
    --md-switch-selected-handle-color: #ffffff; 

    --md-switch-icon-size: 0px;
    --md-switch-selected-icon-size: 0px;
    --md-switch-state-layer-color: transparent;
    --md-switch-selected-pressed-state-layer-color: transparent;

    /* Global Colors */
    --md-sys-color-primary: var(--pb-ink);
    --md-sys-color-on-primary: #ffffff;
    --md-sys-color-outline: var(--pb-border-dk);
    --md-sys-color-surface: var(--pb-paper);

    font-family: var(--pb-font-ui);
    color: var(--pb-text);
    font-size: 13px;
    line-height: 1.5;
  }

  /* Reset */
  * { box-sizing: border-box; }
  a { text-decoration: none; color: inherit; cursor: pointer; }
  button, input { font-family: inherit; }
`;

export const legacyLayoutStyles = css`
  :host {
    /* ========================================================================
       3. GLOBAL LAYOUT (LEGACY)
       ======================================================================== */
    display: grid;
    grid-template-columns: 240px 1fr;
    height: 100vh;
    background: var(--pb-canvas);
  }

  /* --- SIDEBAR --- */
  aside {
    background: #ffffff;
    border-right: 1px solid var(--pb-border);
    display: flex; flex-direction: column;
    padding: 20px 16px; gap: 32px;
  }

  .brand {
    display: flex; align-items: center; gap: 10px;
    font-weight: 800; font-size: 1.1rem; letter-spacing: -0.02em;
    color: var(--pb-ink); padding-left: 8px;
  }

  nav { display: flex; flex-direction: column; gap: 4px; }
  
  nav h6 {
    margin: 0 0 8px 12px;
    font-size: 0.75rem; font-weight: 700; color: var(--pb-text-dim);
    text-transform: uppercase; letter-spacing: 0.05em;
  }

  nav a {
    display: flex; align-items: center; gap: 10px; padding: 8px 12px;
    border-radius: var(--pb-radius);
    font-size: 0.875rem; font-weight: 600; color: var(--pb-text-sec);
    transition: all 0.1s; border: 1px solid transparent;
  }
  
  nav a:hover { background: var(--pb-canvas); color: var(--pb-text); }
  nav a.active { background: #eff6ff; color: var(--pb-blue); border-color: #dbeafe; }

  /* --- MAIN --- */
  main {
    display: grid;
    grid-template-rows: 60px 1fr;
    background-image: radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px);
    background-size: 24px 24px;
    overflow: hidden;
  }

  header {
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--pb-border);
    padding: 0 32px;
    display: flex; align-items: center; justify-content: space-between;
  }

  .crumbs { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; color: var(--pb-text-sec); font-weight: 500; }
  .tag { 
    font-family: var(--pb-font-mono); font-size: 0.75rem; 
    background: #fff; padding: 3px 8px; 
    border: 1px solid var(--pb-border-dk); border-radius: var(--pb-radius); 
  }

  .grid {
    padding: 32px;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    grid-auto-rows: min-content;
    align-items: start; 
    gap: 24px;
  }

  /* --- PANELS --- */
  section {
    background: var(--pb-paper);
    border: 1px solid var(--pb-border);
    border-radius: var(--pb-radius);
    display: flex; flex-direction: column;
    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    overflow: hidden;
    height: fit-content;
  }

  section > header {
    height: 44px; padding: 0 20px;
    border-bottom: 1px solid var(--pb-border);
    background: #fafbfc;
    display: flex; align-items: center; justify-content: space-between;
  }
  
  section > header h3 { margin: 0; font-size: 0.8125rem; font-weight: 700; color: var(--pb-text); text-transform: uppercase; letter-spacing: 0.05em; }
  
  section > div { padding: 20px; display: flex; flex-direction: column; gap: 16px; }

  /* --- TABLE --- */
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  
  th { 
    text-align: left; padding: 12px 20px; 
    background: #fff; border-bottom: 1px solid var(--pb-border); 
    color: var(--pb-text-sec); font-weight: 700; font-size: 0.75rem; 
    text-transform: uppercase; letter-spacing: 0.05em; 
  }
  
  td { 
    padding: 12px 20px; 
    border-bottom: 1px solid var(--pb-border); 
    color: var(--pb-text); vertical-align: middle;
  }
  
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f8fafc; }

  /* --- STATS --- */
  .stat-val { font-family: var(--pb-font-mono); font-size: 1.75rem; font-weight: 600; letter-spacing: -0.04em; margin-top: 12px; color: var(--pb-ink); line-height: 1; }
  .stat-meta { font-size: 0.8125rem; font-weight: 600; margin-top: 8px; display: flex; align-items: center; gap: 4px; }
  .trend-up { color: #16a34a; }

  .col-3 { grid-column: span 3; }
  .col-9 { grid-column: span 9; }
  @media (max-width: 1200px) { .col-3, .col-9 { grid-column: span 12; } }
`;
