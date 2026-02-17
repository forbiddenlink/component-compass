/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                parchment: '#F9F6F0',
                'warm-white': '#FFFAF3',
                ink: '#2C3E50',
                'deep-charcoal': '#1A1D23',
                muted: '#7A8B8C',
                compass: {
                    DEFAULT: '#C84B31',
                    dark: '#A63D2A',
                    light: '#D85740',
                },
                ocean: {
                    DEFAULT: '#1A535C',
                    dark: '#14424A',
                    light: '#E8F4F5',
                },
                terrain: {
                    DEFAULT: '#4E6E58',
                    dark: '#3D5246',
                    light: '#EDF3EF',
                },
                gold: {
                    DEFAULT: '#D4AF37',
                    muted: '#F9E5C7',
                    light: '#FDF8E8',
                },
            },
            fontFamily: {
                display: ["'Fraunces'", 'serif'],
                body: ["'Epilogue'", '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'sans-serif'],
                mono: ["'JetBrains Mono'", "'Fira Code'", 'monospace'],
            },
            fontSize: {
                'display': ['clamp(1.75rem, 4vw, 2.5rem)', { lineHeight: '1.1', fontWeight: '600' }],
                'h1': ['clamp(1.375rem, 3vw, 1.75rem)', { lineHeight: '1.2', fontWeight: '600' }],
                'h2': ['clamp(1.125rem, 2.5vw, 1.375rem)', { lineHeight: '1.25', fontWeight: '600' }],
                'h3': ['1rem', { lineHeight: '1.3', fontWeight: '600' }],
                'body': ['clamp(0.875rem, 2vw, 0.9375rem)', { lineHeight: '1.6', fontWeight: '400' }],
                'small': ['clamp(0.75rem, 1.5vw, 0.8125rem)', { lineHeight: '1.5', fontWeight: '500' }],
                'caption': ['0.6875rem', { lineHeight: '1.4', fontWeight: '600' }],
            },
            spacing: {
                '4.5': '1.125rem',
                '18': '4.5rem',
            },
            borderRadius: {
                'DEFAULT': '6px',
                'lg': '8px',
                'xl': '12px',
            },
            keyframes: {
                'compass-rotate': {
                    from: { transform: 'rotate(0deg)' },
                    to: { transform: 'rotate(360deg)' },
                },
                'bounce-typing': {
                    '0%, 80%, 100%': { transform: 'translateY(0)' },
                    '40%': { transform: 'translateY(-6px)' },
                },
                'slide-in': {
                    from: { opacity: '0', transform: 'translateY(8px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in': {
                    from: { opacity: '0' },
                    to: { opacity: '1' },
                },
                'slide-up': {
                    from: { opacity: '0', transform: 'translateY(16px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'slide-in-right': {
                    from: { opacity: '0', transform: 'translateX(12px)' },
                    to: { opacity: '1', transform: 'translateX(0)' },
                },
                'slide-in-top': {
                    from: { opacity: '0', transform: 'translateY(-6px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                'compass-spin': 'compass-rotate 20s linear infinite',
                'bounce-type': 'bounce-typing 1.4s infinite',
                'slide-in': 'slide-in 0.2s ease-out',
                'fade-in': 'fade-in 0.3s ease-out',
                'slide-up': 'slide-up 0.25s ease-out',
                'slide-in-right': 'slide-in-right 0.2s ease-out',
                'slide-in-top': 'slide-in-top 0.2s ease-out',
            },
            boxShadow: {
                'xs': '0 1px 2px rgba(44,62,80,0.04)',
                'sm': '0 1px 3px rgba(44,62,80,0.06), 0 1px 2px rgba(44,62,80,0.04)',
                'DEFAULT': '0 2px 8px rgba(44,62,80,0.08)',
                'md': '0 4px 12px rgba(44,62,80,0.08), 0 2px 4px rgba(44,62,80,0.04)',
                'lg': '0 8px 24px rgba(44,62,80,0.10), 0 4px 8px rgba(44,62,80,0.04)',
                'wax': 'inset 0 -2px 4px rgba(0,0,0,0.25), 0 2px 6px rgba(200,75,49,0.35)',
            },
            transitionDuration: {
                DEFAULT: '150ms',
            },
        },
    },
    plugins: [],
}
