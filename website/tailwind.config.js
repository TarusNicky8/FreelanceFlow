/** @type {import('tailwindcss').Config} */
module.exports = {
  // Crucially, include public/index.html if you use Tailwind classes there
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        'primary-blue': '#2563eb', // A strong blue, similar to your current `blue-700`
        'secondary-purple': '#9333ea', // A strong purple, similar to your current `purple-700`
        'accent-green': '#10b981', // A pop of green for calls to action, if desired
        'lisk-gray': '#4b5563', // For text or subtle elements
      },
      // Define custom keyframes for animations
      keyframes: {
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Optionally, for hover effects if you want a subtle pulse
        pulseOnce: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        }
      },
      // Apply animations
      animation: {
        'fade-in-down': 'fadeInDown 1s ease-out forwards',
        'fade-in-up': 'fadeInUp 1s ease-out forwards',
        'pulse-once': 'pulseOnce 0.5s ease-in-out', // For a quick hover effect
      },
    },
  },
  plugins: [],
};