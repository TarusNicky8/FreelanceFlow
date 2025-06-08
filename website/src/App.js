import React from 'react';
import logo from './Logo.png'; 
const UsdcIcon = () => (
  <img src={process.env.PUBLIC_URL + '/icons/usdc.png'} alt="USDC Icon" className="h-14 w-14 text-blue-600 mb-4 mx-auto" />
);
const SecurityIcon = () => (
  <img src={process.env.PUBLIC_URL + '/icons/security.png'} alt="Security Icon" className="h-14 w-14 text-purple-600 mb-4 mx-auto" />
);
const LiskIcon = () => (
  <img src={process.env.PUBLIC_URL + '/icons/lisk.webp'} alt="Lisk Icon" className="h-14 w-14 text-lisk-blue mb-4 mx-auto" />
);

function App() {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen font-sans text-gray-800">
      
      <header className="bg-primary-blue text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            <img src={logo} alt="FreelanceFlow Logo" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white" />
            <span className="text-lg sm:text-2xl font-bold whitespace-nowrap">FreelanceFlow</span>
          </a>
          <nav className="hidden md:flex space-x-6 text-lg"> 
            <a href="#about" className="hover:text-blue-200 transition duration-300 ease-in-out">About</a>
            <a href="#features" className="hover:text-blue-200 transition duration-300 ease-in-out">Features</a>
            <a href="#team" className="hover:text-blue-200 transition duration-300 ease-in-out">Team</a>
            <a href="#roadmap" className="hover:text-blue-200 transition duration-300 ease-in-out">Roadmap</a>
            <a href="#docs" className="hover:text-blue-200 transition duration-300 ease-in-out">Docs</a>
          </nav>
          <button className="md:hidden text-white text-2xl focus:outline-none p-2 -mr-2">
            &#9776; 
          </button>
        </div>
      </header>

      
      <section className="relative bg-gradient-to-r from-primary-blue to-secondary-purple text-white py-24 text-center overflow-hidden">
        
        <div className="max-w-5xl mx-auto relative z-10 px-4">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 animate-fade-in-down">
            FreelanceFlow
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl font-light mb-8 animate-fade-in-up">
            Empowering African freelancers with secure, low-cost USDC payments on <span className="font-semibold">Lisk Testnet</span>.
          </p>
          <a
            href="https://discord.gg/7TVd2ZdP9h"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-10 py-4 bg-white text-secondary-purple font-bold rounded-full shadow-lg hover:bg-gray-100 hover:scale-105 transition duration-300 ease-in-out transform"
          >
            Join Our Discord Community
          </a>
        </div>
      </section>

      
      <section id="about" className="py-16 sm:py-20 bg-white shadow-inner">
        <div className="max-w-5xl mx-auto text-center px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-blue mb-6">About FreelanceFlow</h2>
          <p className="text-lg sm:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            FreelanceFlow is a pioneering blockchain-powered platform, proudly supported by a <span className="font-semibold">LiskDAO Builder Grant</span>. Our mission is to revolutionize how African freelancers receive payments, enabling them to accept stablecoin <span className="font-semibold">USDC payments with minimal fees</span>. By leveraging Lisk's cutting-edge Layer 2 Testnet, we ensure exceptionally fast, secure, and transparent transactions, empowering gig workers across the continent.
          </p>
        </div>
      </section>

      
      <section id="features" className="py-16 sm:py-20 bg-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-blue text-center mb-8 sm:mb-12">Key Features Designed for You</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
            
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl text-center hover:scale-105 transition duration-300 ease-in-out transform">
              <UsdcIcon />
              <h3 className="text-xl sm:text-2xl font-semibold text-secondary-purple mt-4 mb-2">Low-Cost USDC Payments</h3>
              <p className="text-base sm:text-lg text-gray-700">Receive and send USDC stablecoin with significantly reduced transaction fees, maximizing your earnings.</p>
            </div>
            
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl text-center hover:scale-105 transition duration-300 ease-in-out transform"> 
              <SecurityIcon />
              <h3 className="text-xl sm:text-2xl font-semibold text-secondary-purple mt-4 mb-2">Built-in Escrow Security</h3>
              <p className="text-base sm:text-lg text-gray-700">Funds are held securely by smart contracts and released only when both parties confirm work completion, ensuring trust and fairness and mitigating disputes.</p> 
            </div>
            
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl text-center hover:scale-105 transition duration-300 ease-in-out transform"> 
              <LiskIcon />
              <h3 className="text-xl sm:text-2xl font-semibold text-secondary-purple mt-4 mb-2">Robust Lisk Integration</h3>
              <p className="text-base sm:text-lg text-gray-700">Powered by the scalable and efficient Lisk Testnet, providing a reliable and future-proof blockchain foundation for decentralized applications.</p> 
            </div>
          </div>
        </div>
      </section>

      
      <section id="team" className="py-16 sm:py-20 bg-white shadow-inner">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-blue mb-8">Meet Our Visionary Team</h2>
          <div className="flex flex-col items-center">
            <img 
              src={process.env.PUBLIC_URL + "/images/nicodemus-photo.jpg"} 
              alt="Nicodemus Kiptoo Profile" 
              className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover shadow-md mb-4 border-4 border-secondary-purple"
            />
            <h3 className="text-xl sm:text-2xl font-semibold text-secondary-purple">Nicodemus Kiptoo</h3>
            <p className="text-base sm:text-lg text-gray-700 mt-2 max-w-xl mx-auto">
              A dedicated MERN stack developer and blockchain enthusiast, Nicodemus leads FreelanceFlow with a passion for creating impactful decentralized solutions for the African gig economy.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
              <a href="https://github.com/TarusNicky8" target="_blank" rel="noopener noreferrer" className="text-primary-blue hover:text-blue-800 transition duration-300">GitHub</a>
              <a href="https://www.linkedin.com/in/nicodemus-kiptoo-8116271a1" target="_blank" rel="noopener noreferrer" className="text-primary-blue hover:text-blue-800 transition duration-300">LinkedIn</a>
              <a href="https://x.com/nicodemuskipto0" target="_blank" rel="noopener noreferrer" className="text-primary-blue hover:text-blue-800 transition duration-300">X (Twitter)</a>
            </div>
          </div>
        </div>
      </section>

      
      <section id="roadmap" className="py-16 sm:py-20 bg-gray-100">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-blue mb-8">Our Visionary Roadmap</h2>
          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl text-left">
            <ul className="space-y-4 sm:space-y-6 text-base sm:text-lg text-gray-700">
              <li className="flex items-start">
                <span className="text-secondary-purple font-bold mr-3 text-xl sm:text-2xl">✔</span>
                <div>
                  <strong className="text-lg sm:text-xl text-primary-blue">Milestone 1 (July 2025): Initial Foundations & Community</strong><br />
                  Deployment of core smart contracts, establishment of the official website, and initial community building and outreach initiatives.
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 font-bold mr-3 text-xl sm:text-2xl">⏳</span>
                <div>
                  <strong className="text-lg sm:text-xl text-primary-blue">Milestone 2 (Q3 2025): Minimum Viable Product (MVP) Launch</strong><br />
                  Launch of the beta platform to 50 curated users, gathering crucial feedback for optimization and iterative refinement.
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 font-bold mr-3 text-xl sm:text-2xl">🚀</span>
                <div>
                  <strong className="text-lg sm:text-xl text-primary-blue">Milestone 3 (Q4 2025): Growth & Ecosystem Expansion</strong><br />
                  Scaling to 150 active users, achieving $40,000 LSK Total Value Locked (TVL) within the platform's secure escrow system.
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      
      <section id="docs" className="py-12 sm:py-16 bg-primary-blue text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Dive Deeper into FreelanceFlow</h2>
          <p className="text-lg sm:text-xl mb-8">Explore our comprehensive documentation to understand the technology, learn how to get started, or contribute to our open-source project.</p>
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <a
              href="https://github.com/TarusNicky8/FreelanceFlow/blob/main/README.md" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-3 bg-secondary-purple text-white font-semibold rounded-lg hover:bg-purple-700 shadow-lg transition duration-300"
            >
              Read the Docs
            </a>
            <a
              href="mailto:nicodemuskiptoo88@gmail.com" 
              className="inline-block px-8 py-3 bg-gray-200 text-primary-blue font-semibold rounded-lg hover:bg-gray-300 shadow-lg transition duration-300"
            >
              Contact Us
            </a>
          </div>
        </div>
      </section>

      
      <footer className="bg-gray-800 text-white py-6 sm:py-8 text-center text-sm">
        <div className="max-w-5xl mx-auto px-4">
          <p className="mb-3">&copy; {new Date().getFullYear()} FreelanceFlow. All rights reserved. Built with passion and a LiskDAO Builder Grant.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-3 text-2xl">
            <a href="https://github.com/TarusNicky8/FreelanceFlow" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition duration-300">
              <i className="fab fa-github"></i>
            </a>
            <a href="https://discord.gg/7TVd2ZdP9h" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition duration-300">
              <i className="fab fa-discord"></i>
            </a>
            <a href="https://x.com/nicodemuskipto0" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition duration-300">
              <i className="fab fa-twitter"></i>
            </a>
          </div>
          <p className="mt-4 text-gray-400">Connecting African Talent to Global Opportunities.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;