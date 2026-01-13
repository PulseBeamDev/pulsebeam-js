import { css } from 'lit';

// Font Imports
import '@fontsource/manrope/index.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';

export const pulseBeamStyles = css`
  :host {
    /* ========================================================================
       1. CENTRALIZED DESIGN TOKENS (Light Mode Default)
       ======================================================================== */
    --pb-blue:       #2563eb;
    --pb-ink:        #0f172a; /* Primary Action / Dark Text */
    --pb-paper:      #ffffff; /* Surface / Cards */
    --pb-canvas:     #f8fafc; /* App Background */
    
    --pb-border:     #e2e8f0;
    --pb-border-dk:  #cbd5e1;
    
    --pb-text:       #0f172a;
    --pb-text-sub:   #475569;
    --pb-text-dim:   #94a3b8;

    --pb-font-ui:    'Manrope', system-ui, sans-serif;
    --pb-font-mono:  'JetBrains Mono', monospace;
    
    --pb-radius:     4px;

    /* ========================================================================
       2. MATERIAL SYSTEM MAPPING (Light)
       ======================================================================== */
    --md-sys-color-primary: var(--pb-ink);
    --md-sys-color-on-primary: #ffffff;
    
    --md-sys-color-surface: var(--pb-paper);
    --md-sys-color-on-surface: var(--pb-text);
    
    --md-sys-color-outline: var(--pb-border-dk);
    --md-sys-color-surface-container-highest: var(--pb-border);
    
    /* Global Component Styles */
    font-family: var(--pb-font-ui);
    color: var(--pb-text);
    
    /* Component Override Tokens */
    --md-filled-button-container-shape: var(--pb-radius);
    --md-filled-button-container-height: 36px;
    --md-filled-button-label-text-size: 14px;
    --md-filled-button-label-text-weight: 600;

    --md-outlined-button-container-shape: var(--pb-radius);
    --md-outlined-button-container-height: 36px;
    --md-outlined-button-label-text-size: 14px;
    --md-outlined-button-label-text-weight: 600;
    --md-outlined-button-outline-color: var(--pb-border-dk);

    --md-outlined-text-field-container-shape: var(--pb-radius);
    --md-outlined-text-field-outline-color: var(--pb-border-dk);
    --md-outlined-text-field-focus-outline-color: var(--pb-blue);
    --md-outlined-text-field-label-text-color: var(--pb-text-sub);
    --md-outlined-text-field-input-text-color: var(--pb-text);

    --md-icon-button-state-layer-color: var(--pb-text);
    --md-icon-button-icon-color: var(--pb-text-sub);

    /* FONT MAPPING */
    --md-ref-typeface-plain: var(--pb-font-ui);
    --md-ref-typeface-brand: var(--pb-font-ui);
    --md-sys-typescale-body-large-font: var(--pb-font-ui);
    --md-sys-typescale-label-large-font: var(--pb-font-ui);

    /* SWITCH OVERRIDES (Rectangular Brand Style) */
    --md-switch-track-shape: var(--pb-radius);
    --md-switch-handle-shape: var(--pb-radius);
    --md-switch-track-width: 40px;
    --md-switch-track-height: 24px;
    /* Light Mode Switch Colors */
    --md-switch-selected-track-color: var(--pb-ink);
    --md-switch-selected-handle-color: #ffffff;
    --md-switch-unselected-track-color: var(--pb-border);
    --md-switch-unselected-handle-color: var(--pb-text-sub);
    --md-switch-selected-icon-color: var(--pb-ink);
    
    /* Strict Reset */
    box-sizing: border-box;
  }

  :host * {
    box-sizing: border-box;
  }

  /* ========================================================================
     3. DARK MODE OVERRIDES
     ======================================================================== */
  :host-context(html.dark) {
    --pb-blue:       #60a5fa;
    --pb-ink:        #f8fafc; /* Inverted for primary actions (Whiteish) */
    --pb-paper:      #1e293b; /* Dark Slate Cards */
    --pb-canvas:     #0f172a; /* Deep Navy Background */
    
    --pb-border:     #334155;
    --pb-border-dk:  #475569;
    
    --pb-text:       #f8fafc;
    --pb-text-sub:   #cbd5e1;
    --pb-text-dim:   #94a3b8;

    /* Material Mappings Update for Dark */
    --md-sys-color-primary: var(--pb-blue); /* Use BLUE for primary in dark mode */
    --md-sys-color-on-primary: #ffffff;     /* White text on blue button */

    --md-sys-color-surface: var(--pb-paper);
    --md-sys-color-on-surface: var(--pb-text);
    
    --md-sys-color-outline: var(--pb-border-dk);
    
    /* Dark Mode Switch Colors */
    --md-switch-selected-track-color: var(--pb-blue);
    --md-switch-unselected-track-color: var(--pb-border);
    --md-switch-unselected-handle-color: var(--pb-text-dim);
    --md-switch-selected-icon-color: #fff;

    
    /* Input adjustments */
    --md-outlined-text-field-input-text-color: var(--pb-text);
    --md-outlined-text-field-label-text-color: var(--pb-text-dim);
    --md-icon-button-icon-color: var(--pb-text-dim);
  }
`;
