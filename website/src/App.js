import logo from './Logo.png';
import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <img src={logo} alt="FreelanceFlow Logo" className="w-32 mb-4" />
      <h1 className="text-4xl font-bold text-blue-600">FreelanceFlow</h1>
      <p className="text-lg text-gray-700 mt-2 text-center max-w-md">
        Empowering African freelancers with low-cost USDC payments on Lisk Testnet. Built with a LiskDAO Builder Grant.
      </p>
      <div className="mt-6 space-x-4">
        <a
          href="https://github.com/TarusNicky8/FreelanceFlow"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          GitHub
        </a>
        <a
          href="https://discord.gg/7TVd2ZdP9h"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Discord
        </a>
        <a
          href="https://x.com/nicodemuskipto0"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
        >
          X
        </a>
      </div>
    </div>
  );
}

export default App;