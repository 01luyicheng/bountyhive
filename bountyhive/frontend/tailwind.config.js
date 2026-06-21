/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: {
          DEFAULT: '#0a0a14',
          deep: '#06060d',
          surface: '#131326',
          raised: '#1a1a30',
          border: '#2a2a4a',
        },
        neon: {
          cyan: '#00f0ff',
          magenta: '#ff00aa',
          green: '#00ff88',
          red: '#ff3366',
          amber: '#ffaa00',
          violet: '#a855f7',
        },
        ink: {
          DEFAULT: '#e0e6f0',
          muted: '#8a90b0',
          dim: '#5a6080',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'heartbeat': 'heartbeat 1.4s ease-in-out infinite',
        'fade-in': 'fade-in 0.6s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.7s ease-out forwards',
        'glow-pulse': 'glow-pulse 2.5s ease-in-out infinite',
        'star-twinkle': 'twinkle 3s ease-in-out infinite',
        'star-ignite': 'ignite 1.2s ease-out forwards',
        'scan': 'scan 6s linear infinite',
        'blink': 'blink 1s step-start infinite',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.4)', opacity: '0.7' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 12px rgba(0, 240, 255, 0.4), 0 0 24px rgba(0, 240, 255, 0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 240, 255, 0.7), 0 0 40px rgba(0, 240, 255, 0.35)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.9' },
        },
        ignite: {
          '0%': { transform: 'scale(1)', filter: 'brightness(1)' },
          '40%': { transform: 'scale(2.2)', filter: 'brightness(2)' },
          '100%': { transform: 'scale(1.4)', filter: 'brightness(1.4)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        blink: {
          '0%, 50%': { opacity: '1' },
          '50.01%, 100%': { opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      boxShadow: {
        'neon-cyan': '0 0 12px rgba(0, 240, 255, 0.5), 0 0 24px rgba(0, 240, 255, 0.25)',
        'neon-magenta': '0 0 12px rgba(255, 0, 170, 0.5), 0 0 24px rgba(255, 0, 170, 0.25)',
        'neon-green': '0 0 12px rgba(0, 255, 136, 0.5), 0 0 24px rgba(0, 255, 136, 0.25)',
        'neon-red': '0 0 12px rgba(255, 51, 102, 0.5), 0 0 24px rgba(255, 51, 102, 0.25)',
      },
    },
  },
  plugins: [],
}
