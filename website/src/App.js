import React from 'react';
import logo from './Logo.png'; 
import { getDataSuffix, submitReferral } from '@divvi/referral-sdk'; 
import { createWalletClient, custom, parseUnits, encodeFunctionData, createPublicClient, http } from 'viem'; 

// Define your Lisk Sepolia chain configuration for Viem
const liskSepolia = {
  id: 4202,
  name: 'Lisk Sepolia Testnet',
  network: 'lisk-sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH', // Lisk Testnet uses ETH as native currency for gas
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

// Simplified ABI for USDC (only 'approve' function needed for this example)
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

// Simplified ABI for Escrow (only 'deposit' function needed for this example)
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

// Your deployed contract addresses (replace with actual deployed addresses on Lisk Sepolia)
// For demonstration, these are pulled from your README.md
const usdcContractAddress = '0xFD2A349A744616C6077978A3D463C82Ac00A37c1'; 
const escrowContractAddress = '0x83C9919341aa0705b6b0d79420EfAAE27B53ADCf';

// Placeholder for freelancer address (in a real dApp, this would come from user input or project data)
const defaultFreelancerAddress = '0x0000000000000000000000000000000000000001'; // Example: A known test freelancer address

// Icons (LiskIcon removed from here to de-emphasize its direct display in features)
const UsdcIcon = () => (
  <img src={process.env.PUBLIC_URL + '/icons/usdc.png'} alt="USDC Icon" className="h-14 w-14 text-blue-600 mb-4 mx-auto" />
);
const SecurityIcon = () => (
  <img src={process.env.PUBLIC_URL + '/icons/security.png'} alt="Security Icon" className="h-14 w-14 text-purple-600 mb-4 mx-auto" />
);
// LiskIcon component is no longer used directly in the features section
// const LiskIcon = () => (
//   <img src={process.env.PUBLIC_URL + '/icons/lisk.webp'} alt="Lisk Icon" className="h-14 w-14 text-lisk-blue mb-4 mx-auto" />
// );


function App() {
  const [walletClient, setWalletClient] = React.useState(null);
  const [publicClient, setPublicClient] = React.useState(null); 
  const [account, setAccount] = React.useState(null);
  const [status, setStatus] = React.useState('');
  const [amountToDeposit, setAmountToDeposit] = React.useState('100'); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false); // State for mobile menu

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

  // Function to toggle mobile menu
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
            <a href="#features" className="hover:text-blue-200 transition duration-300 ease-in-out">Features</a>
            <a href="#team" className="hover:text-blue-200 transition duration-300 ease-in-out">Team</a>
            <a href="#roadmap" className="hover:text-blue-200 transition duration-300 ease-in-out">Roadmap</a>
            <a href="#docs" className="hover:text-blue-200 transition duration-300 ease-in-out">Docs</a>
          </nav>
          {/* Mobile menu button */}
          <button 
            onClick={toggleMobileMenu}
            className="md:hidden text-white text-2xl focus:outline-none p-2 -mr-2"
            aria-label="Toggle navigation"
          >
            &#9776; 
          </button>
        </div>
        {/* Mobile Navigation (simple conditional rendering) */}
        {isMobileMenuOpen && (
          <nav className="md:hidden bg-primary-blue pb-2 pt-1">
            <ul className="flex flex-col items-center space-y-2 text-lg">
              <li><a href="#about" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">About</a></li>
              <li><a href="#features" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Features</a></li>
              <li><a href="#team" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Team</a></li>
              <li><a href="#roadmap" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Roadmap</a></li>
              <li><a href="#docs" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Docs</a></li>
            </ul>
          </nav>
        )}
      </header>

      
      <section className="relative bg-gradient-to-r from-primary-blue to-secondary-purple text-white py-24 text-center overflow-hidden animate-gradient">
        {/* Dynamic Background Lines */}
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
          {/* Updated tagline to focus on user value, remove specific Lisk Testnet mention */}
          <p className="text-xl md:text-2xl lg:text-3xl font-light mb-8 animate-fade-in-up">
            Empowering African freelancers with secure, low-cost USDC payments to maximize their earnings and global opportunities.
          </p>
          <a
            href="https://discord.gg/7TVd2ZdP9h"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-10 py-4 bg-white text-secondary-purple font-bold rounded-full shadow-lg hover:bg-gray-100 hover:scale-105 transition duration-300 ease-in-out transform animate-pulse-slow animate-glowing-border"
          >
            Join Our Discord Community
          </a>

          {/* Divvi Integration Demonstration Area */}
          <div className="mt-12 p-6 bg-white/10 rounded-lg shadow-inner text-white">
            <h3 className="text-2xl font-bold mb-4">Divvi Integration Demo: Deposit USDC</h3>
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
          {/* End Divvi Integration Demo Area */}


        </div>
      </section>

      
      <section id="about" className="py-16 sm:py-20 bg-white shadow-inner">
        <div className="max-w-5xl mx-auto text-center px-4 transition duration-300 ease-in-out">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-blue mb-6">About FreelanceFlow</h2>
          <p className="text-lg sm:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            FreelanceFlow is a pioneering blockchain-powered platform, proudly supported by a <span className="font-semibold">LiskDAO Builder Grant</span>. Our mission is to revolutionize how African freelancers receive payments, enabling them to accept stablecoin <span className="font-semibold">USDC payments with minimal fees</span>. By leveraging Lisk's cutting-edge Layer 2 Testnet, we ensure exceptionally fast, secure, and transparent transactions, empowering gig workers across the continent.
          </p>
        </div>
      </section>

      
      <section id="features" className="py-16 sm:py-20 bg-gray-100">
        <div className="max-w-6xl mx-auto px-4 transition duration-300 ease-in-out">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-blue text-center mb-8 sm:mb-12">Key Features Designed for You</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
            {/* Feature 1: Low-Cost USDC Payments */}
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl text-center hover:scale-105 transition duration-300 ease-in-out transform animate-icon-float animate-glowing-border">
              <UsdcIcon />
              <h3 className="text-xl sm:text-2xl font-semibold text-secondary-purple mt-4 mb-2">Low-Cost USDC Payments</h3>
              <p className="text-base sm:text-lg text-gray-700 transition duration-300 ease-in-out">Receive and send USDC stablecoin with significantly reduced transaction fees, maximizing your earnings.</p>
            </div>
            
            {/* Feature 2: Built-in Escrow Security */}
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl text-center hover:scale-105 transition duration-300 ease-in-out transform animate-icon-float animate-glowing-border"> 
              <SecurityIcon />
              <h3 className="text-xl sm:text-2xl font-semibold text-secondary-purple mt-4 mb-2">Built-in Escrow Security</h3>
              <p className="text-base sm:text-lg text-gray-700">Funds are held securely by smart contracts and released only when both parties confirm work completion, ensuring trust and fairness and mitigating disputes.</p> 
            </div>
            
            {/* Feature 3: Reframed/Generic Benefit (Removed LiskIcon for de-emphasis) */}
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl text-center hover:scale-105 transition duration-300 ease-in-out transform animate-icon-float animate-glowing-border"> 
              {/* No specific tech icon here to align with "focus on product, not Lisk" */}
              {/* Placeholder for a more generic icon or just rely on heading/text for a feature like "Seamless Global Reach" or "Decentralized Foundation" */}
              <img src={process.env.PUBLIC_URL + '/icons/global.png'} alt="Global Reach Icon" className="h-14 w-14 text-blue-600 mb-4 mx-auto" />
              <h3 className="text-xl sm:text-2xl font-semibold text-secondary-purple mt-4 mb-2">Global & Secure Infrastructure</h3>
              <p className="text-base sm:text-lg text-gray-700">Built on a scalable and efficient blockchain, providing a reliable and future-proof foundation for decentralized payments worldwide.</p> 
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
              A dedicated MERN stack developer and blockchain enthusiast, Nicodemus leads FreelanceFlow with a passion for creating impactful decentralized solutions for the African gig economy.
            </p>
            {/* External Task Reminder: Update this section with professional portraits and concise bios. 
                Consider expanding to showcase key advisors or future core team members.*/}
            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
              <a href="https://github.com/TarusNicky8" target="_blank" rel="noopener noreferrer" className="text-primary-blue hover:text-blue-800 transition duration-300">GitHub</a>
              {/* Updated LinkedIn to project's account */}
              <a href="https://www.linkedin.com/in/freelanceflow-usdc-29a495371/" target="_blank" rel="noopener noreferrer" className="text-primary-blue hover:text-blue-800 transition duration-300">LinkedIn</a>
              {/* Updated X (Twitter) to project's account */}
              <a href="https://x.com/freelanceflo" target="_blank" rel="noopener noreferrer" className="text-primary-blue hover:text-blue-800 transition duration-300">X (Twitter)</a>
            </div>
          </div>
        </div>
      </section>

      
      <section id="roadmap" className="py-16 sm:py-20 bg-gray-100">
        <div className="max-w-4xl mx-auto text-center px-4 transition duration-300 ease-in-out">
          {/* Roadmap title remains focused on "Our Visionary Roadmap" */}
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-blue mb-8">Our Visionary Roadmap</h2>
          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl text-left">
            <ul className="space-y-4 sm:space-y-6 text-base sm:text-lg text-gray-700">
              <li className="flex items-start">
                <span className="text-secondary-purple font-bold mr-3 text-xl sm:text-2xl">✔</span>
                <div>
                  {/* Descriptions are already product-centric */}
                  <strong className="text-lg sm:text-xl text-primary-blue">Milestone 1 (July 2025): Initial Foundations & Community</strong><br />
                  Deployment of core smart contracts, establishment of the official website, and initial community building and outreach initiatives.
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 font-bold mr-3 text-xl sm:text-2xl">⏳</span>
                <div>
                  <strong className="text-lg sm:text-xl text-primary-blue">Milestone 2 (Q3 2025): Minimum Viable Product (MVP) Beta Launch</strong><br />
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
          {/* External Task Reminder: Consider creating a separate Whitepaper document linked here for detailed technical and business plans. */}
        </div>
      </section>

      
      <section id="docs" className="py-12 sm:py-16 bg-primary-blue text-white text-center">
        <div className="max-w-4xl mx-auto px-4 transition duration-300 ease-in-out">
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
        <div className="max-w-5xl mx-auto px-4 transition duration-300 ease-in-out">
          <p className="mb-3">&copy; {new Date().getFullYear()} FreelanceFlow. All rights reserved. Built with passion and a LiskDAO Builder Grant.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-3 text-2xl">
            <a href="https://github.com/TarusNicky8" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition duration-300">
              <i className="fab fa-github"></i>
            </a>
            <a href="https://discord.gg/7TVd2ZdP9h" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition duration-300">
              <i className="fab fa-discord"></i>
            </a>
            {/* Updated X (Twitter) to project's account */}
            <a href="https://x.com/freelanceflo" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition duration-300">
              <i className="fab fa-twitter"></i>
            </a>
            {/* External Task Reminder: Consider adding other social links (e.g., TikTok) if relevant */}
          </div>
          <p className="mt-4 text-gray-400">Connecting African Talent to Global Opportunities.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
