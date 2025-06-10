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
            '50%': { opacity: '0.8', transform: 'scale(1.05)' }, 
        },
        lineFlow: { 
            '0%': { transform: 'translateY(-100%)' },
            '100%': { transform: 'translateY(100%)' },
        },
        iconFloat: { 
            '0%, 100%': { transform: 'translateY(0)' },
            '50%': { transform: 'translateY(-8px)' }, 
        },
        textGlow: { 
            '0%, 100%': { textShadow: '0 0 1px rgba(255,255,255,0.2), 0 0 2px rgba(255,255,255,0.1)' },
            '50%': { textShadow: '0 0 3px rgba(255,255,255,0.5), 0 0 6px rgba(255,255,255,0.3)' },
        },
        glowingBorder: { 
            '0%, 100%': { borderColor: '#f472b6', boxShadow: '0 0 0 0 rgba(244, 114, 182, 0.5)' }, 
            '50%': { borderColor: '#a3e635', boxShadow: '0 0 0 5px rgba(163, 230, 53, 0.3)' }, 
        },
      },
      animation: {
        'fade-in-down': 'fadeInDown 1s ease-out forwards',
        'fade-in-up': 'fadeInUp 1s ease-out forwards',
        'gradient': 'gradientAnimation 6s infinite linear', 
        'pulse-slow': 'pulseSlow 3s infinite ease-in-out', 
        'line-flow': 'lineFlow 15s infinite linear', 
        'line-flow-delay-1': 'lineFlow 15s infinite linear 2s', 
        'line-flow-delay-2': 'lineFlow 15s infinite linear 4s',
        'icon-float': 'iconFloat 4s infinite ease-in-out', 
        'text-glow': 'textGlow 2s infinite ease-in-out alternate', 
        'glowing-border': 'glowingBorder 3s infinite ease-in-out', 
      },
    },
  },
  plugins: [],
};
