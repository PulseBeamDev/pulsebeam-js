import type { SvelteHTMLElements } from 'svelte/elements';
import type { Button } from './components/button';
import type { Card } from './components/card';
import type { Checkbox } from './components/checkbox';
import type { Header } from './components/header';
import type { Icon } from './components/icon';
import type { Layout } from './components/layout';
import type { Radio } from './components/radio';
import type { Select, Option } from './components/select';
import type { Sidebar, SidebarGroup, SidebarItem } from './components/sidebar';
import type { StatCard } from './components/stat-card';
import type { Switch } from './components/switch';
import type { Table } from './components/table';
import type { Tag } from './components/tag';
import type { TextField } from './components/text-field';
import type { Textarea } from './components/textarea';

declare module 'svelte/elements' {
    interface IntrinsicElements {
        'pb-button': any;
        'pb-card': any;
        'pb-checkbox': any;
        'pb-header': any;
        'pb-icon': any;
        'pb-layout': any;
        'pb-radio': any;
        'pb-select': any;
        'pb-option': any;
        'pb-sidebar': any;
        'pb-sidebar-group': any;
        'pb-sidebar-item': any;
        'pb-stat-card': any;
        'pb-switch': any;
        'pb-table': any;
        'pb-tag': any;
        'pb-text-field': any;
        'pb-textarea': any;
    }
}

// Also for JSX/React if needed
declare global {
    namespace JSX {
        interface IntrinsicElements {
            [tagName: string]: any;
        }
    }
}
