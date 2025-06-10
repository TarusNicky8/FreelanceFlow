/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html", 
  ],
  theme: {
    extend: {
      colors: {
        'primary-blue': '#2563eb',
        'secondary-purple': '#9333ea',
        'accent-green': '#10b981',
        'lisk-gray': '#4b5563',
      },
      keyframes: {
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        gradientAnimation: { 
            '0%': { backgroundPosition: '0% 50%;' },
            '50%': { backgroundPosition: '100% 50%;' },
            '100%': { backgroundPosition: '0% 50%;' },
        },
        pulseSlow: { 
            '0%, 100%': { opacity: '1', transform: 'scale(1)' },
            '50%': { opacity: '0.8', transform: 'scale(1.05)' }, // Less aggressive opacity change and smaller scale
        },
        lineFlow: { // New keyframe for background lines
            '0%': { transform: 'translateY(-100%)' },
            '100%': { transform: 'translateY(100%)' },
        },
        iconFloat: { // New keyframe for floating icons
            '0%, 100%': { transform: 'translateY(0)' },
            '50%': { transform: 'translateY(-8px)' }, // Less noticeable float
        },
        textGlow: { // New keyframe for text glowing
            '0%, 100%': { textShadow: '0 0 5px rgba(255,255,255,0.7), 0 0 10px rgba(255,255,255,0.4)' }, // Less bright glow
            '50%': { textShadow: '0 0 10px rgba(255,255,255,0.9), 0 0 20px rgba(255,255,255,0.6)' }, // Less bright glow
        },
        glowingBorder: { // New keyframe for glowing border
            '0%, 100%': { borderColor: '#f472b6', boxShadow: '0 0 0 0 rgba(244, 114, 182, 0.5)' }, // Fuchsia-ish, lower opacity shadow start
            '50%': { borderColor: '#a3e635', boxShadow: '0 0 0 5px rgba(163, 230, 53, 0.3)' }, // Lime-ish, smaller, subtler shadow
        },
      },
      animation: {
        'fade-in-down': 'fadeInDown 1s ease-out forwards',
        'fade-in-up': 'fadeInUp 1s ease-out forwards',
        'gradient': 'gradientAnimation 6s infinite linear', // Slower gradient animation
        'pulse-slow': 'pulseSlow 3s infinite ease-in-out', // Slower pulse animation
        'line-flow': 'lineFlow 15s infinite linear', // Slower lines
        'line-flow-delay-1': 'lineFlow 15s infinite linear 2s', 
        'line-flow-delay-2': 'lineFlow 15s infinite linear 4s',
        'icon-float': 'iconFloat 4s infinite ease-in-out', // Slower icon float
        'text-glow': 'textGlow 2s infinite ease-in-out alternate', // Slower text glow
        'glowing-border': 'glowingBorder 3s infinite ease-in-out', // Slower glowing border
      },
    },
  },
  plugins: [],
};
