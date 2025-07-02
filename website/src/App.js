import React from 'react';
import logo from './App icon.svg'; 
import { getDataSuffix, submitReferral } from '@divvi/referral-sdk'; 
import { createWalletClient, custom, parseUnits, encodeFunctionData, createPublicClient, http } from 'viem'; 

const liskSepolia = {
  id: 4202,
  name: 'Lisk Sepolia Testnet', 
  network: 'lisk-sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH', 
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.lisk.com'] },
    public: { http: ['https://testnet-rpc.lisk.com'] },
  },
  blockExplorers: {
    default: { name: 'Lisk Sepolia Blockscout', url: 'https://sepolia-blockscout.lisk.com/' },
  },
  testnet: true,
};

const usdcAbi = [
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const escrowAbi = [
  {
    "inputs": [
      { "internalType": "address", "name": "freelancer", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const usdcContractAddress = '0xFD2A349A744616C6077978A3D463C82Ac00A37c1'; 
const escrowContractAddress = '0x83C9919341aa0705b6b0d79420EfAAE27B53ADCf';
const defaultFreelancerAddress = '0x0000000000000000000000000000000000000001'; 

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
  const [walletClient, setWalletClient] = React.useState(null);
  const [publicClient, setPublicClient] = React.useState(null); 
  const [account, setAccount] = React.useState(null);
  const [status, setStatus] = React.useState('');
  const [amountToDeposit, setAmountToDeposit] = React.useState('100'); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const connectWallet = async () => {
    setStatus('Connecting wallet...');
    try {
      if (typeof window.ethereum === 'undefined') {
        setStatus('MetaMask or similar wallet not detected!');
        return;
      }
      const client = createWalletClient({
        chain: liskSepolia,
        transport: custom(window.ethereum),
      });
      const publicClient = createPublicClient({ 
        chain: liskSepolia,
        transport: http(liskSepolia.rpcUrls.default.http[0]),
      });
      
      const addresses = await client.getAddresses();
      setWalletClient(client);
      setPublicClient(publicClient);
      setAccount(addresses[0]);
      setStatus(`Wallet connected: ${addresses[0]}`);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setStatus(`Error connecting wallet: ${error.message}`);
    }
  };

  const handleDepositUSDC = async () => {
    if (!account || !walletClient || !publicClient) {
      setStatus('Please connect your wallet first.');
      return;
    }
    if (isNaN(parseFloat(amountToDeposit)) || parseFloat(amountToDeposit) <= 0) {
      setStatus('Please enter a valid amount to deposit.');
      return;
    }

    setStatus('Initiating USDC deposit with Divvi tracking...');
    try {
      const amountInSmallestUnit = parseUnits(amountToDeposit, 6); 

      const divviConsumerAddress = '0x58ccf714F804a10cd9FE22fCcc044d77Ea34e5b1';
      const divviProviderAddresses = ['0x0423189886d7966f0dd7e7d256898daeee625dca','0xc95876688026be9d6fa7a7c33328bd013effa2bb','0x7beb0e14f8d2e6f6678cc30d867787b384b19e20'];

      const approveCallData = encodeFunctionData({
        abi: usdcAbi,
        functionName: 'approve',
        args: [escrowContractAddress, amountInSmallestUnit],
      });

      setStatus('Approving USDC for Escrow contract...');
      const approveTxHash = await walletClient.sendTransaction({
        account,
        to: usdcContractAddress,
        data: approveCallData,
      });

      setStatus(`Approval transaction sent! Hash: ${approveTxHash}. Waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
      setStatus('USDC Approved. Now initiating deposit...');

      const depositCallData = encodeFunctionData({
        abi: escrowAbi,
        functionName: 'deposit',
        args: [defaultFreelancerAddress, amountInSmallestUnit],
      });

      const dataSuffix = getDataSuffix({
        consumer: divviConsumerAddress,
        providers: divviProviderAddresses,
      });

      const depositTxHash = await walletClient.sendTransaction({
        account,
        to: escrowContractAddress,
        data: depositCallData + dataSuffix, 
        value: 0n, 
      });

      setStatus(`Deposit transaction sent! Hash: ${depositTxHash}. Waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash: depositTxHash });
      setStatus('Deposit confirmed. Now reporting referral to Divvi...');

      const chainId = await walletClient.getChainId();
      await submitReferral({
        txHash: depositTxHash,
        chainId,
      });

      setStatus(`Deposit successful and referral submitted to Divvi! Tx Hash: ${depositTxHash}`);
      console.log('Divvi referral submitted successfully!');

    } catch (error) {
      console.error("Error during USDC deposit or Divvi integration:", error);
      setStatus(`Transaction failed or Divvi submission error: ${error.message}`);
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen font-sans text-gray-800">
      
      <header className="bg-primary-blue text-white p-4 shadow-lg sticky top-0 z-50 transition duration-300 ease-in-out">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            <img src={logo} alt="FreelanceFlow Logo" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white" />
            <span className="text-lg sm:text-2xl font-bold whitespace-nowrap">FreelanceFlow</span>
          </a>
          <nav className="hidden md:flex space-x-6 text-lg"> 
            <a href="#about" className="hover:text-blue-200 transition duration-300 ease-in-out">About</a>
            <a href="#vision" className="hover:text-blue-200 transition duration-300 ease-in-out">Vision</a> 
            <a href="#mission" className="hover:text-blue-200 transition duration-300 ease-in-out">Mission</a> 
            <a href="#features" className="hover:text-blue-200 transition duration-300 ease-in-out">Features</a>
            <a href="#team" className="hover:text-blue-200 transition duration-300 ease-in-out">Team</a>
            <a href="#roadmap" className="hover:text-blue-200 transition duration-300 ease-in-out">Roadmap</a>
            <a href="#whitepaper" className="hover:text-blue-200 transition duration-300 ease-in-out">Whitepaper</a> 
            <a href="#contact" className="hover:text-blue-200 transition duration-300 ease-in-out">Contact</a>
          </nav>
          <button 
            onClick={toggleMobileMenu}
            className="md:hidden text-white text-2xl focus:outline-none p-2 -mr-2"
            aria-label="Toggle navigation"
          >
            &#9776; 
          </button>
        </div>
        {isMobileMenuOpen && (
          <nav className="md:hidden bg-primary-blue pb-2 pt-1">
            <ul className="flex flex-col items-center space-y-2 text-lg">
              <li><a href="#about" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">About</a></li>
              <li><a href="#vision" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Vision</a></li> 
              <li><a href="#mission" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Mission</a></li> 
              <li><a href="#features" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Features</a></li>
              <li><a href="#team" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Team</a></li>
              <li><a href="#roadmap" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Roadmap</a></li>
              <li><a href="#whitepaper" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Whitepaper</a></li> 
              <li><a href="#contact" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Contact</a></li>
            </ul>
          </nav>
        )}
      </header>

      
      <section className="relative bg-gradient-to-r from-primary-blue to-secondary-purple text-white py-24 text-center overflow-hidden animate-gradient">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 h-full w-px bg-white/20 animate-line-flow"></div> 
          <div className="absolute top-0 left-3/4 h-full w-px bg-white/20 animate-line-flow-delay-2"></div> 
          <div className="absolute top-0 left-1/6 h-full w-px bg-white/20 animate-line-flow-delay-1"></div> 
          <div className="absolute top-0 left-5/6 h-full w-px bg-white/20 animate-line-flow-delay-2"></div> 
        </div>

        <div className="max-w-5xl mx-auto relative z-10 px-4">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 animate-fade-in-down tracking-tight animate-text-glow">
            FreelanceFlow
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl font-light mb-8 animate-fade-in-up">
            Your gateway to secure, low-cost USDC payments, empowering African freelancers to thrive globally.
          </p>
          <a
            href="https://discord.gg/7TVd2ZdP9h"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-10 py-4 bg-white text-secondary-purple font-bold rounded-full shadow-lg hover:bg-gray-100 hover:scale-105 transition duration-300 ease-in-out transform animate-pulse-slow animate-glowing-border"
          >
            Join Our Community
          </a>
          <div className="mt-12 p-6 bg-white/10 rounded-lg shadow-inner text-white">
            <h3 className="text-2xl font-bold mb-4">Divvi Integration: Deposit USDC</h3>
            <div className="mb-4">
              <label htmlFor="depositAmount" className="block text-lg font-medium mb-2">Amount to Deposit (USDC):</label>
              <input
                type="number"
                id="depositAmount"
                value={amountToDeposit}
                onChange={(e) => setAmountToDeposit(e.target.value)}
                placeholder="e.g., 100"
                className="w-full max-w-xs p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-primary-blue"
              />
            </div>
            <p className="mb-4 text-center">{status}</p>
            {!account ? (
              <button
                onClick={connectWallet}
                className="px-6 py-3 bg-accent-green text-white font-semibold rounded-full hover:bg-green-600 transition duration-300"
              >
                Connect Wallet
              </button>
            ) : (
              <button
                onClick={handleDepositUSDC} 
                className="px-6 py-3 bg-secondary-purple text-white font-semibold rounded-full hover:bg-purple-700 transition duration-300"
              >
                Deposit USDC to Escrow (with Divvi Tracking)
              </button>
            )}
          </div>


        </div>
      </section>

      <section id="vision" className="py-16 sm:py-20 bg-gray-100 text-center shadow-inner">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-blue mb-6">Our Vision</h2>
          <p className="text-lg sm:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            To create a world where every African freelancer has seamless access to global opportunities, empowered by secure, transparent, and equitable payment solutions that truly value their work.
          </p>
        </div>
      </section>

      <section id="mission" className="py-16 sm:py-20 bg-white text-center shadow-inner">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-blue mb-6">Our Mission</h2>
          <p className="text-lg sm:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            FreelanceFlow is dedicated to building and continuously refining a decentralized platform that provides African freelancers with the tools for secure, low-cost USDC payments, utilizing innovative blockchain technology to foster trust, efficiency, and financial growth.
          </p>
        </div>
      </section>

      
      <section id="about" className="py-16 sm:py-20 bg-gray-100 shadow-inner">
        <div className="max-w-5xl mx-auto text-center px-4 transition duration-300 ease-in-out">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-blue mb-6">About FreelanceFlow</h2>
          <p className="text-lg sm:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            FreelanceFlow is a pioneering blockchain-powered platform dedicated to revolutionizing how African freelancers engage with the global gig economy. We provide a robust ecosystem enabling secure, transparent, and significantly low-cost stablecoin USDC payments through advanced smart contract escrow. Our solution leverages cutting-edge blockchain technology to ensure fast, reliable, and equitable transactions, empowering gig workers across the continent to maximize their earnings and opportunities.
          </p>
        </div>
      </section>

      
      <section id="features" className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 transition duration-300 ease-in-out">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-blue text-center mb-8 sm:mb-12">Key Features Designed for You</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
            <div className="bg-gray-50 p-6 sm:p-8 rounded-lg shadow-xl text-center hover:scale-105 transition duration-300 ease-in-out transform animate-icon-float animate-glowing-border">
              <UsdcIcon />
              <h3 className="text-xl sm:text-2xl font-semibold text-secondary-purple mt-4 mb-2">Low-Cost USDC Payments</h3>
              <p className="text-base sm:text-lg text-gray-700 transition duration-300 ease-in-out">Receive and send USDC stablecoin with significantly reduced transaction fees, maximizing your earnings.</p>
            </div>
            
            <div className="bg-gray-50 p-6 sm:p-8 rounded-lg shadow-xl text-center hover:scale-105 transition duration-300 ease-in-out transform animate-icon-float animate-glowing-border"> 
              <SecurityIcon />
              <h3 className="text-xl sm:text-2xl font-semibold text-secondary-purple mt-4 mb-2">Built-in Escrow Security</h3>
              <p className="text-base sm:text-lg text-gray-700">Funds are held securely by smart contracts and released only when both parties confirm work completion, ensuring trust and fairness and mitigating disputes.</p> 
            </div>
            
            <div className="bg-gray-50 p-6 sm:p-8 rounded-lg shadow-xl text-center hover:scale-105 transition duration-300 ease-in-out transform animate-icon-float animate-glowing-border"> 
              <LiskIcon />
              <h3 className="text-xl sm:text-2xl font-semibold text-secondary-purple mt-4 mb-2">Robust Blockchain Infrastructure</h3>
              <p className="text-base sm:text-lg text-gray-700">Powered by a scalable and efficient Layer 2 blockchain, providing a reliable and future-proof foundation for decentralized payments worldwide.</p> 
            </div>
          </div>
        </div>
      </section>

      
      <section id="team" className="py-16 sm:py-20 bg-white shadow-inner">
        <div className="max-w-4xl mx-auto text-center px-4 transition duration-300 ease-in-out">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-blue mb-8">Meet Our Visionary Team</h2>
          <div className="flex flex-col items-center">
            <img 
              src={process.env.PUBLIC_URL + "/images/nicodemus-photo.jpg"} 
              alt="Nicodemus Kiptoo Profile" 
              className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover shadow-md mb-4 border-4 border-secondary-purple"
            />
            <h3 className="text-xl sm:text-2xl font-semibold text-secondary-purple">Nicodemus Kiptoo</h3>
            <p className="text-base sm:text-lg text-gray-700 mt-2 max-w-xl mx-auto">
             Founder. Nicodemus leads the effective use of innovative solutions that streamline work and transactions for the African gig economy.
            </p>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-xl mx-auto">
              <div className="p-4 rounded-lg bg-gray-50 shadow-md">
                <h4 className="font-bold text-lg text-primary-blue">CTO</h4>
                <p className="text-gray-700 text-sm">Technical architect behind FreelanceFlow's innovative platform</p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 shadow-md">
                <h4 className="font-bold text-lg text-primary-blue">CMO</h4>
                <p className="text-gray-700 text-sm">Guiding market entry and growth.</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
              <a href="https://github.com/TarusNicky8" target="_blank" rel="noopener noreferrer" className="text-primary-blue hover:text-blue-800 transition duration-300">GitHub</a>
              <a href="https://www.linkedin.com/in/freelanceflow-usdc-29a495371/" target="_blank" rel="noopener noreferrer" className="text-primary-blue hover:text-blue-800 transition duration-300">LinkedIn</a>
              <a href="https://x.com/freelanceflo" target="_blank" rel="noopener noreferrer" className="text-primary-blue hover:text-blue-800 transition duration-300">X (Twitter)</a>
            </div>
          </div>
        </div>
      </section>

      
      <section id="roadmap" className="py-16 sm:py-20 bg-gray-100">
        <div className="max-w-4xl mx-auto text-center px-4 transition duration-300 ease-in-out">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-blue mb-8">Our Product Roadmap</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left"> 
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl hover:scale-105 transition duration-300 ease-in-out transform">
              <div className="flex items-center mb-4">
                <span className="text-secondary-purple font-bold mr-3 text-xl sm:text-2xl">✔</span>
                <h3 className="text-lg sm:text-xl font-bold text-primary-blue">Phase 1: Initial Launch & Foundation</h3>
                <span className="ml-auto bg-green-200 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Completed</span>
              </div>
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                Core smart contracts deployed, secure payment infrastructure established, and initial community outreach.
              </p>
              <p className="text-sm text-gray-500 mt-2">(July 2025)</p>
            </div>
            
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl hover:scale-105 transition duration-300 ease-in-out transform">
              <div className="flex items-center mb-4">
                <span className="text-blue-600 font-bold mr-3 text-xl sm:text-2xl">⏳</span>
                <h3 className="text-lg sm:text-xl font-bold text-primary-blue">Phase 2: Minimum Viable Product Beta</h3>
                <span className="ml-auto bg-blue-200 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">In Progress</span>
              </div>
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                Launch of the core platform to a curated group of 50 beta users, enabling USDC payment processing and escrow, gathering crucial feedback for optimization.
              </p>
              <p className="text-sm text-gray-500 mt-2">(Target: Q3 2025)</p>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl hover:scale-105 transition duration-300 ease-in-out transform">
              <div className="flex items-center mb-4">
                <span className="text-green-600 font-bold mr-3 text-xl sm:text-2xl">🚀</span>
                <h3 className="text-lg sm:text-xl font-bold text-primary-blue">Phase 3: Growth & Ecosystem Expansion</h3>
                <span className="ml-auto bg-purple-200 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Upcoming</span>
              </div>
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                Scaling user base to 150 active users, achieving $40,000 USDC Total Value Locked (TVL), and enhancing platform with advanced features.
              </p>
              <p className="text-sm text-gray-500 mt-2">(Target: Q4 2025)</p>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl hover:scale-105 transition duration-300 ease-in-out transform">
              <div className="flex items-center mb-4">
                <span className="text-gray-500 font-bold mr-3 text-xl sm:text-2xl">💡</span>
                <h3 className="text-lg sm:text-xl font-bold text-primary-blue">Future Enhancements: Scaling & Accessibility</h3>
                <span className="ml-auto bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">Future</span>
              </div>
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                Plans include integrating seamless fiat on/off-ramps, implementing sophisticated dispute resolution mechanisms, and expanding global participation.
              </p>
              <p className="text-sm text-gray-500 mt-2">(Beyond Q4 2025)</p>
            </div>
          </div>
        </div>
      </section>

      <section id="whitepaper" className="py-12 sm:py-16 bg-white text-center shadow-inner">
        <div className="max-w-4xl mx-auto px-4 transition duration-300 ease-in-out">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-blue mb-4">Deep Dive: Our Whitepaper</h2>
          <p className="text-lg sm:text-xl mb-8">Explore the comprehensive technical architecture, economic model, and long-term vision of FreelanceFlow in our detailed Whitepaper.</p>
          <a
            href="/WHITEPAPER.md" 
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 bg-secondary-purple text-white font-semibold rounded-lg hover:bg-purple-700 shadow-lg transition duration-300"
          >
            Read the Whitepaper
          </a>
        </div>
      </section>
      
      <section id="contact" className="py-12 sm:py-16 bg-primary-blue text-white text-center">
        <div className="max-w-4xl mx-auto px-4 transition duration-300 ease-in-out">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Connect with FreelanceFlow</h2>
          <p className="text-lg sm:text-xl mb-8">Have questions, feedback, or want to partner? Reach out to us!</p>
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <a
              href="https://github.com/TarusNicky8/FreelanceFlow/blob/main/README.md" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-3 bg-secondary-purple text-white font-semibold rounded-lg hover:bg-purple-700 shadow-lg transition duration-300"
            >
              Explore Our GitHub
            </a>
            <a
              href="mailto:nicodemuskiptoo88@gmail.com" 
              className="inline-block px-8 py-3 bg-gray-200 text-primary-blue font-semibold rounded-lg hover:bg-gray-300 shadow-lg transition duration-300"
            >
              Email Us Directly
            </a>
          </div>
        </div>
      </section>

      
      <footer className="bg-gray-800 text-white py-6 sm:py-8 text-center text-sm">
        <div className="max-w-5xl mx-auto px-4 transition duration-300 ease-in-out">
          <p className="mb-3">&copy; {new Date().getFullYear()} FreelanceFlow. All rights reserved. Your gateway to global opportunities.</p> 
          <div className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-3 text-2xl">
            <a href="https://github.com/TarusNicky8" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition duration-300">
              <i className="fab fa-github"></i>
            </a>
            <a href="https://discord.gg/7TVd2ZdP9h" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition duration-300">
              <i className="fab fa-discord"></i>
            </a>
            <a href="https://x.com/freelanceflo" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition duration-300">
              <i className="fab fa-twitter"></i>
            </a>
            <a href="https://www.linkedin.com/in/freelanceflow-usdc-29a495371/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition duration-300">
              <i className="fab fa-linkedin"></i>
            </a>
          </div>
          <p className="mt-4 text-gray-400">Connecting African Talent to Global Opportunities.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
