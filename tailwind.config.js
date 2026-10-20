/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                notary: {
                    dark: '#09090b',       // Deepest background
                    card: '#18181b',       // Card container grey
                    border: '#27272a',     // Subtle border grey
                    muted: '#71717a',      // Subtitle / metadata grey
                    light: '#f4f4f5',      // Clean typography white/grey
                    yellow: '#facc15',     // Primary Notary Accent (Yellow 400)
                    gold: '#eab308',       // Deep Notary Seal Gold (Yellow 500)
                    hover: '#ca8a04',      // Action hover (Yellow 600)
                    badge: '#422006',      // Dark yellow badge background
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace']
            }
        },
    },
    plugins: [],
}