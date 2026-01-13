export type Theme = 'light' | 'dark' | 'auto';

export class ThemeManager {
    private static STORAGE_KEY = 'pulsebeam-theme';

    static init() {
        const savedTheme = localStorage.getItem(this.STORAGE_KEY) as Theme | null;
        this.setTheme(savedTheme || 'auto');
    }

    static setTheme(theme: Theme) {
        const root = document.documentElement;
        localStorage.setItem(this.STORAGE_KEY, theme);

        if (theme === 'auto') {
            root.classList.remove('light', 'dark');
        } else {
            root.classList.remove('light', 'dark');
            root.classList.add(theme);
        }
    }

    static getTheme(): Theme {
        return (localStorage.getItem(this.STORAGE_KEY) as Theme) || 'auto';
    }

    static toggle() {
        const current = this.getTheme();
        if (current === 'light') this.setTheme('dark');
        else if (current === 'dark') this.setTheme('auto');
        else this.setTheme('light');

        return this.getTheme();
    }

    static getIcon(theme: Theme): string {
        if (theme === 'light') return 'light_mode';
        if (theme === 'dark') return 'dark_mode';
        return 'brightness_auto';
    }
}
