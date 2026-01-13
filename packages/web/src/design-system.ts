import { css } from 'lit';

// Font Imports
import '@fontsource/manrope';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';

export const pulseBeamStyles = css`
  :host {
    /* --- 1. BRAND TOKENS --- */
    --pb-blue:      #2563eb;
    --pb-ink:       #09090b;
    --pb-paper:     #ffffff;
    --pb-canvas:    #f8fafc;
    
    --pb-border:    #e4e4e7;
    --pb-border-dk: #cbd5e1;
    
    --pb-text:      #0f172a;
    --pb-text-sub:  #64748b;
    --pb-text-dim:  #94a3b8;

    --pb-font-ui:   'Manrope', system-ui, sans-serif;
    --pb-font-mono: 'JetBrains Mono', monospace;
    
    --pb-radius:    3px; 
    --pb-ease:      cubic-bezier(0.2, 0, 0, 1);

    /* --- 2. MATERIAL WEB CONFIG --- */
    /* Force Font Inheritance */
    --md-ref-typeface-brand: var(--pb-font-ui);
    --md-ref-typeface-plain: var(--pb-font-ui);
    
    /* Button Typography (Fixes the Times New Roman issue) */
    --md-sys-typescale-label-large-font: var(--pb-font-ui);
    --md-sys-typescale-label-large-weight: 600;
    
    /* Shapes & Sizes */
    --md-sys-shape-corner-small: var(--pb-radius);
    --md-sys-shape-corner-medium: var(--pb-radius);
    --md-sys-shape-corner-large: var(--pb-radius);
    --md-sys-shape-corner-full: var(--pb-radius);
    
    --md-filled-button-container-height: 32px;
    --md-outlined-button-container-height: 32px;
    
    /* Colors */
    --md-sys-color-primary: var(--pb-ink);
    --md-sys-color-on-primary: #ffffff;
    --md-sys-color-outline: var(--pb-border);
    --md-sys-color-surface: var(--pb-paper);

    /* --- 3. GLOBAL LAYOUT --- */
    display: grid;
    grid-template-columns: 240px 1fr;
    height: 100vh;
    font-family: var(--pb-font-ui);
    color: var(--pb-text);
    background: var(--pb-canvas);
    font-size: 14px;
    line-height: 1.5;
  }

  /* Reset & Inheritance */
  * { box-sizing: border-box; }
  a { text-decoration: none; color: inherit; cursor: pointer; }
  button, input, select, textarea { font-family: inherit; } /* Crucial Fix */

  /* --- SIDEBAR --- */
  aside {
    background: #ffffff;
    border-right: 1px solid var(--pb-border);
    display: flex; flex-direction: column;
    padding: 20px 16px; gap: 32px;
  }

  .brand {
    display: flex; align-items: center; gap: 10px;
    font-weight: 800; font-size: 1.05rem; letter-spacing: -0.02em;
    color: var(--pb-ink); padding: 0 4px;
  }

  nav { display: flex; flex-direction: column; gap: 2px; }
  
  nav h6 {
    margin: 0 0 8px 8px;
    font-size: 0.7rem; font-weight: 700; color: var(--pb-text-dim);
    text-transform: uppercase; letter-spacing: 0.05em;
  }

  nav a {
    display: flex; align-items: center; gap: 10px; padding: 7px 10px;
    border-radius: var(--pb-radius);
    font-size: 0.8125rem; font-weight: 600; color: var(--pb-text-sub);
    transition: all 0.1s; border: 1px solid transparent;
  }
  
  nav a:hover { background: var(--pb-canvas); color: var(--pb-text); }
  nav a.active { background: #eff6ff; color: var(--pb-blue); border-color: #dbeafe; }

  /* --- MAIN --- */
  main {
    display: grid;
    grid-template-rows: 56px 1fr;
    /* Subtle Grid: 3% Opacity Black instead of Gray */
    background-image: linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    overflow: hidden;
  }

  header {
    background: rgba(255,255,255,0.8);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--pb-border);
    padding: 0 32px;
    display: flex; align-items: center; justify-content: space-between;
  }

  .crumbs { display: flex; align-items: center; gap: 8px; font-size: 0.8125rem; color: var(--pb-text-sub); font-weight: 500; }
  .tag { 
    font-family: var(--pb-font-mono); font-size: 0.75rem; 
    background: #fff; padding: 2px 6px; 
    border: 1px solid var(--pb-border-dk); border-radius: var(--pb-radius); 
  }

  /* Content Grid */
  .grid {
    padding: 32px;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    /* Auto rows + align-items: start prevents stretching */
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
    height: fit-content; /* Don't stretch */
  }

  section > header {
    height: 40px; padding: 0 20px;
    border-bottom: 1px solid var(--pb-border);
    background: #fafbfc;
    display: flex; align-items: center; justify-content: space-between;
  }
  
  section > header h3 { margin: 0; font-size: 0.75rem; font-weight: 700; color: var(--pb-text); text-transform: uppercase; letter-spacing: 0.05em; }
  
  section > div { padding: 20px; display: flex; flex-direction: column; gap: 16px; }

  /* --- TABLE --- */
  table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
  
  th { 
    text-align: left; padding: 12px 20px; 
    background: #fff; border-bottom: 1px solid var(--pb-border); 
    color: var(--pb-text-dim); font-weight: 700; font-size: 0.65rem; 
    text-transform: uppercase; letter-spacing: 0.05em; 
  }
  
  td { 
    padding: 12px 20px; 
    border-bottom: 1px solid var(--pb-border); 
    color: var(--pb-text); vertical-align: middle;
  }
  
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--pb-canvas); }

  /* --- UTILS --- */
  .stat-val { font-family: var(--pb-font-mono); font-size: 1.5rem; font-weight: 600; letter-spacing: -0.03em; margin-top: 8px; color: var(--pb-ink); }
  .stat-meta { font-size: 0.75rem; font-weight: 600; margin-top: 6px; display: flex; align-items: center; gap: 4px; }
  .trend-up { color: #16a34a; }

  .col-3 { grid-column: span 3; }
  .col-9 { grid-column: span 9; }
  @media (max-width: 1200px) { .col-3, .col-9 { grid-column: span 12; } }
`;
