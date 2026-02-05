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
                'warm-white': '#FFF9F0',
                ink: '#2C3E50',
                'deep-charcoal': '#1A1D23',
                compass: {
                    DEFAULT: '#C84B31',
                    dark: '#A63D2A',
                    light: '#D85740',
                },
                ocean: {
                    DEFAULT: '#1A535C',
                    dark: '#14424A',
                },
                terrain: {
                    DEFAULT: '#4E6E58',
                    dark: '#3D5246',
                },
                gold: {
                    DEFAULT: '#D4AF37',
                    muted: '#F9E5C7',
                },
            },
            fontFamily: {
                display: ["'Fraunces'", 'serif'],
                body: ["'Epilogue'", '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'sans-serif'],
                mono: ["'JetBrains Mono'", "'Fira Code'", 'monospace'],
            },
            keyframes: {
                'compass-rotate': {
                    from: { transform: 'rotate(0deg)' },
                    to: { transform: 'rotate(360deg)' },
                },
                'bounce-typing': {
                    '0%, 80%, 100%': { transform: 'translateY(0)' },
                    '40%': { transform: 'translateY(-8px)' },
                },
                'slide-in': {
                    from: { opacity: '0', transform: 'translateY(10px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in': {
                    from: { opacity: '0' },
                    to: { opacity: '1' },
                },
                'slide-up': {
                    from: { opacity: '0', transform: 'translateY(20px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'slide-in-right': {
                    from: { opacity: '0', transform: 'translateX(16px)' },
                    to: { opacity: '1', transform: 'translateX(0)' },
                },
                'slide-in-top': {
                    from: { opacity: '0', transform: 'translateY(-8px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'gradient-bg': {
                    '0%, 100%': { transform: 'translateY(0%) scale(1)', opacity: '0.3' },
                    '50%': { transform: 'translateY(-20%) scale(1.1)', opacity: '0.5' },
                },
                'draw-path': {
                    from: { 'stroke-dashoffset': '50' },
                    to: { 'stroke-dashoffset': '0' },
                },
            },
            animation: {
                'compass-spin': 'compass-rotate 20s linear infinite',
                'bounce-type': 'bounce-typing 1.4s infinite',
                'slide-in': 'slide-in 0.3s ease-out',
                'fade-in': 'fade-in 0.5s ease-out',
                'slide-up': 'slide-up 0.3s ease-out',
                'slide-in-right': 'slide-in-right 0.3s ease-out',
                'slide-in-top': 'slide-in-top 0.3s ease-out',
                'gradient-bg': 'gradient-bg 15s ease-in-out infinite',
                'draw-path': 'draw-path 2s linear infinite',
            },
            boxShadow: {
                'paper': '0 2px 4px rgba(44,62,80,0.08), 0 4px 8px rgba(44,62,80,0.06), 0 8px 16px rgba(44,62,80,0.04), inset 0 1px 0 rgba(255,255,255,0.5)',
                'wax': 'inset 0 -2px 4px rgba(0,0,0,0.3), 0 2px 8px rgba(200,75,49,0.4)',
            },
        },
    },
    plugins: [],
}
