import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { createWalletClient, custom, parseUnits, encodeFunctionData, createPublicClient, http, formatUnits } from 'viem';
import { isAddress } from 'viem';
import { getAddress } from 'viem';

import logo from './App icon.svg';

// Function to truncate address for display
const truncateAddress = (address) => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

const liskSepolia = {
  id: 1135,
  name: 'Lisk',
  network: 'lisk',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['https://rpc.api.lisk.com'] },
    public: { http: ['https://rpc.api.lisk.com'] },
  },
  blockExplorers: {
    default: { name: 'Lisk Blockscout', url: 'https://blockscout.lisk.com/' },
  },
  testnet: true,
};

// --- ABIs for USDC and Escrow Contracts ---

// USDC ABI (only approve and balanceOf needed for this app)
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
  },
  {
    "inputs": [
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// Escrow Contract ABI (updated for job-specific functions)
const escrowAbi = [
  // General Deposit
  {
    "inputs": [
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "depositGeneral",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Job-specific Deposit
  {
    "inputs": [
      { "internalType": "string", "name": "_jobId", "type": "string" },
      { "internalType": "address", "name": "_client", "type": "address" },
      { "internalType": "address", "name": "_freelancer", "type": "address" },
      { "internalType": "uint256", "name": "_amount", "type": "uint256" }
    ],
    "name": "depositJob",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Job-specific Release
  {
    "inputs": [
      { "internalType": "string", "name": "_jobId", "type": "string" }
    ],
    "name": "releaseJob",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Job-specific Refund
  {
    "inputs": [
      { "internalType": "string", "name": "_jobId", "type": "string" }
    ],
    "name": "refundJob",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Get Job Escrow Details (view function)
  {
    "inputs": [
      { "internalType": "string", "name": "_jobId", "type": "string" }
    ],
    "name": "getJobEscrowDetails",
    "outputs": [
      { "internalType": "address", "name": "client", "type": "address" },
      { "internalType": "address", "name": "freelancer", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "uint8", "name": "status", "type": "uint8" } // EscrowStatus enum is uint8
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // General Deposits mapping (for Dashboard total)
  {
    "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "name": "generalDeposits",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function",
  }
];

// Contract Addresses (UPDATED AS PER YOUR DEPLOYMENT LOG)
const usdcContractAddress = '0xF242275d3a6527d877f2c927a82D9b057609cc71';
const escrowContractAddress = '0x44e58cA9A3597d3f050322F167f29396d7c84F0a';

// Backend API Base URL (from environment variable, or fallback to localhost for local dev)
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// --- Icon Components ---
const UsdcIcon = () => (
  <img src={process.env.PUBLIC_URL + '/icons/usdc.png'} alt="USDC Icon" className="h-14 w-14 text-blue-600 mb-4 mx-auto" />
);
const SecurityIcon = () => (
  <img src={process.env.PUBLIC_URL + '/icons/security.png'} alt="Security Icon" className="h-14 w-14 text-purple-600 mb-4 mx-auto" />
);
const LiskIcon = () => (
  <img src={process.env.PUBLIC_URL + '/icons/lisk.webp'} alt="Lisk Icon" className="h-14 w-14 text-lisk-blue mb-4 mx-auto" />
);

// --- Notification Component (Simple Toast) ---
const Notification = ({ message, type, onClose }) => {
  if (!message) return null;

  const bgColor = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';
  const textColor = 'text-white';

  return (
    <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${bgColor} ${textColor} z-50 flex items-center justify-between animate-fade-in-up-toast`}>
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 text-lg font-bold">
        &times;
      </button>
    </div>
  );
};

// --- Confirmation Modal Component ---
const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmButtonText, cancelButtonText, isProcessing, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
        <h3 className="text-2xl font-bold text-primary-blue mb-4">{title}</h3>
        <p className="text-lg text-gray-700 mb-6">{message}</p>
        {children} {/* Render children (e.g., additional form elements) here */}
        <div className="flex justify-center space-x-4 mt-6">
          <button
            onClick={onConfirm}
            className="px-6 py-3 bg-accent-green text-white font-semibold rounded-md hover:bg-green-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : confirmButtonText || 'Confirm'}
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-gray-400 text-white font-semibold rounded-md hover:bg-gray-500 transition duration-300"
            disabled={isProcessing}
          >
            {cancelButtonText || 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};


// --- DivviIntegration Component (Now uses depositGeneral) ---
const DivviIntegration = ({ account, walletClient, publicClient, setNotification }) => {
  const [userUsdcBalance, setUserUsdcBalance] = useState(0);
  const [amountToDeposit, setAmountToDeposit] = useState('100');
  const [isProcessingTx, setIsProcessingTx] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false); // For confirmation modal

  // Fetch user's USDC balance
  useEffect(() => {
    const fetchUsdcBalance = async () => {
      if (account && publicClient) {
        try {
          const balance = await publicClient.readContract({
            address: usdcContractAddress,
            abi: usdcAbi,
            functionName: 'balanceOf',
            args: [account],
          });
          setUserUsdcBalance(parseFloat(formatUnits(balance, 6)));
        } catch (error) {
          console.error("Error fetching user USDC balance:", error);
          setUserUsdcBalance(0);
          setNotification(`Error fetching USDC balance: ${error.message}`, 'error');
        }
      } else {
        setUserUsdcBalance(0);
      }
    };

    fetchUsdcBalance();
  }, [account, publicClient, usdcContractAddress, setNotification]); // Re-fetch when account or publicClient changes

  const handleDepositUSDCGeneral = async () => {
    if (!account || !walletClient || !publicClient) {
      setNotification('Please connect your wallet first.', 'error');
      return;
    }
    const depositAmountNum = parseFloat(amountToDeposit);
    if (isNaN(depositAmountNum) || depositAmountNum <= 0) {
      setNotification('Please enter a valid amount to deposit.', 'error');
      return;
    }
    if (depositAmountNum > userUsdcBalance) {
      setNotification('Insufficient USDC balance in your wallet for this deposit.', 'error');
      return;
    }

    // --- Chain Mismatch Check ---
    try {
      const currentChainId = await walletClient.getChainId();
      if (currentChainId !== liskSepolia.id) {
        setNotification(`Wallet is on the wrong network. Please switch to ${liskSepolia.name} (Chain ID: ${liskSepolia.id}). Attempting to switch...`, 'error');
        try {
          await walletClient.switchChain({ id: liskSepolia.id });
          setNotification(`Successfully prompted to switch to ${liskSepolia.name}. Please confirm in your wallet and try the deposit again.`, 'info');
          return; // Exit and let user retry after chain switch
        } catch (switchError) {
          console.error("Error switching chain:", switchError);
          setNotification(`Failed to switch to ${liskSepolia.name}. Please switch manually in your wallet. Error: ${switchError.message}`, 'error');
          return;
        }
      }
    } catch (chainCheckError) {
      console.error("Error checking current chain ID:", chainCheckError);
      setNotification(`Could not verify wallet chain. Please ensure your wallet is connected and on ${liskSepolia.name}. Error: ${chainCheckError.message}`, 'error');
      return;
    }
    // --- End Chain Mismatch Check ---

    setShowConfirmModal(true); // Show confirmation modal
  };

  const confirmDeposit = async () => {
    setShowConfirmModal(false); // Close modal
    setIsProcessingTx(true);
    setNotification('Initiating general USDC deposit with Divvi tracking...', 'info');
    try {
      const amountInSmallestUnit = parseUnits(amountToDeposit.toString(), 6); // USDC has 6 decimals

      // --- Divvi SDK Integration (uncomment and install @divvi/referral-sdk to enable) ---
      // const divviConsumerAddress = '0x58ccf714F804a10cd9FE22fCcc044d77Ea34e5b1';
      // const divviProviderAddresses = ['0x0423189886d7966f0dd7e7d256898daeee625dca','0xc95876688026be9d6fa7a7c33328bd013effa2bb','0x7beb0e14f8d2e6f6678cc30d867787b384b19e20'];
      // const dataSuffix = getDataSuffix({
      //   consumer: divviConsumerAddress,
      //   providers: divviProviderAddresses,
      // });
      // -----------------------------------------------------------------------------------

      // 1. Approve USDC for the Escrow contract
      const approveCallData = encodeFunctionData({
        abi: usdcAbi,
        functionName: 'approve',
        args: [escrowContractAddress, amountInSmallestUnit],
      });

      setNotification('Approving USDC for Escrow contract...', 'info');
      const approveTxHash = await walletClient.sendTransaction({
        account,
        to: usdcContractAddress,
        data: approveCallData,
      });

      setNotification(`Approval transaction sent! Hash: ${truncateAddress(approveTxHash)}. Waiting for confirmation...`, 'info');
      await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
      setNotification('USDC Approved. Now initiating general deposit...', 'info');

      // 2. Deposit USDC into the Escrow contract's general deposits
      const depositCallData = encodeFunctionData({
        abi: escrowAbi,
        functionName: 'depositGeneral', // Call the general deposit function
        args: [amountInSmallestUnit],
      });

      const depositTxHash = await walletClient.sendTransaction({
        account,
        to: escrowContractAddress,
        data: depositCallData, // + dataSuffix if Divvi is enabled
        value: 0n,
      });

      setNotification(`Deposit transaction sent! Hash: ${truncateAddress(depositTxHash)}. Waiting for confirmation...`, 'info');
      await publicClient.waitForTransactionReceipt({ hash: depositTxHash });
      setNotification('General deposit confirmed. Now reporting referral to Divvi...', 'info');

      // --- Divvi SDK Integration (uncomment to enable) ---
      // const chainId = await walletClient.getChainId();
      // await submitReferral({
      //   txHash: depositTxHash,
      //   chainId,
      // });
      // ---------------------------------------------------

      setNotification(`General deposit successful and Divvi referral (conceptual) completed! Tx Hash: ${truncateAddress(depositTxHash)}`, 'success');
      console.log('Divvi referral (conceptual) completed!');

    } catch (error) {
      console.error("Error during general USDC deposit or Divvi integration:", error);
      setNotification(`Transaction failed or Divvi submission error: ${error.message}`, 'error');
    } finally {
      setIsProcessingTx(false);
    }
  };

  const isDepositButtonDisabled = !account || !walletClient || !publicClient || parseFloat(amountToDeposit) <= 0 || parseFloat(amountToDeposit) > userUsdcBalance || isProcessingTx;

  return (
    <section className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg my-8 text-center">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Deposit Funds (General Escrow)</h2>
      <p className="text-lg text-gray-700 mb-6">
        Deposit USDC into the general escrow for future use. This process is enhanced with conceptual Divvi tracking for transparent on-chain activity.
      </p>
      <div className="mb-4">
        <label htmlFor="depositAmount" className="block text-lg font-medium text-gray-800 mb-2">Amount to Deposit (USDC):</label>
        <input
          type="number"
          id="depositAmount"
          value={amountToDeposit}
          onChange={(e) => setAmountToDeposit(e.target.value)}
          placeholder="e.g., 100"
          className="w-full max-w-xs p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200 text-gray-800"
        />
      </div>
      {account && (
        <p className="text-lg text-gray-700 mb-4">
          Your Wallet USDC Balance: <span className="font-semibold text-primary-blue">{userUsdcBalance} USDC</span>
        </p>
      )}
      {account && walletClient && publicClient ? ( // Check all three for full readiness
        <button
          onClick={handleDepositUSDCGeneral}
          className="px-8 py-4 bg-secondary-purple text-white font-semibold rounded-full shadow-lg hover:bg-purple-700 transition duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isDepositButtonDisabled}
        >
          {isProcessingTx ? 'Processing...' : 'Deposit USDC to Escrow (General Funds)'}
        </button>
      ) : (
        <p className="text-lg text-gray-600">Please connect your wallet in the header to deposit USDC.</p>
      )}

      <ConfirmationModal
        isOpen={showConfirmModal}
        title="Confirm General Deposit"
        message={`Are you sure you want to deposit ${amountToDeposit} USDC into the general escrow? You will be prompted to approve USDC and then confirm the deposit transaction in your wallet.`}
        onConfirm={confirmDeposit}
        onCancel={() => setShowConfirmModal(false)}
        confirmButtonText="Yes, Deposit"
        isProcessing={isProcessingTx}
      />
    </section>
  );
};

// --- Profile Component ---
const Profile = ({ account }) => {
  const { address: urlAddress } = useParams(); // Get address from URL if present
  const displayAddress = urlAddress || account; // Use URL address if available, else connected account

  const [profile, setProfile] = useState({ skills: [], portfolio: [], rating: 0, role: 'freelancer', totalRatingSum: 0, totalRatingsCount: 0 }); // Default role
  const [skillsInput, setSkillsInput] = useState('');
  const [portfolioInput, setPortfolioInput] = useState('');
  const [selectedRole, setSelectedRole] = useState('freelancer'); // State for role selection
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(''); // Kept for Profile component's internal messages
  const [isError, setIsError] = useState(false); // Kept for Profile component's internal error state

  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!displayAddress) {
        setStatusMessage('Please connect your wallet or provide an address to view profile.');
        setIsError(true);
        return;
      }
      setIsLoading(true);
      setStatusMessage('Loading profile...');
      setIsError(false);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/users/${displayAddress}`);
        const fetchedProfile = response.data;
        setProfile(fetchedProfile);
        setSkillsInput(fetchedProfile.skills?.join(', ') || '');
        setPortfolioInput(fetchedProfile.portfolio?.join(', ') || '');
        setSelectedRole(fetchedProfile.role || 'freelancer'); // Set selected role from fetched data
        setStatusMessage('Profile loaded successfully.');
      } catch (error) {
        console.error('Error fetching profile:', error);
        setStatusMessage(`Error loading profile: ${error.message || 'Network error'}`);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [displayAddress]); // Re-fetch when displayAddress changes

  const handleSave = async (e) => {
    e.preventDefault();
    if (!account) {
      setStatusMessage('Wallet not connected. Cannot save profile.');
      setIsError(true);
      return;
    }
    if (account.toLowerCase() !== displayAddress.toLowerCase()) {
        setStatusMessage('You can only edit your own profile.', 'error');
        setIsError(true);
        return;
    }

    setIsLoading(true);
    setStatusMessage('Saving profile...');
    setIsError(false);
    try {
      const updatedSkills = skillsInput.split(',').map(s => s.trim()).filter(s => s !== '');
      const updatedPortfolio = portfolioInput.split(',').map(p => p.trim()).filter(p => p !== '');

      await axios.put(`${API_BASE_URL}/api/users/${account}`, {
        skills: updatedSkills,
        portfolio: updatedPortfolio,
        role: selectedRole, // Include selected role
      });

      setProfile(prev => ({ ...prev, skills: updatedSkills, portfolio: updatedPortfolio, role: selectedRole }));
      setStatusMessage('Profile updated successfully!');
      setIsError(false);

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Error updating profile:', error);
      setStatusMessage(`Error updating profile: ${error.message || 'Please try again.'}`);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const isOwnProfile = account && displayAddress && account.toLowerCase() === displayAddress.toLowerCase();

  return (
    <div className="max-w-5xl mx-auto p-4 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">User Profile</h2>

      <p className="text-lg text-gray-700 mb-4">
        Wallet: <span className="font-mono text-secondary-purple">{displayAddress ? truncateAddress(displayAddress) : 'Not connected'}</span>
      </p>

      {statusMessage && (
        <div className={`p-3 mb-4 rounded-md ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {statusMessage}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center mb-4 text-primary-blue">
          <svg className="animate-spin h-5 w-5 mr-3 text-primary-blue" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </div>
      )}

      {isOwnProfile ? (
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label htmlFor="role" className="block text-lg font-medium text-gray-800 mb-1">Your Role</label>
            <select
              id="role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
              disabled={isLoading || !account}
            >
              <option value="freelancer">Freelancer</option>
              <option value="client">Client</option>
              <option value="both">Both (Freelancer & Client)</option>
            </select>
          </div>
          <div>
            <label htmlFor="skills" className="block text-lg font-medium text-gray-800 mb-1">Skills (comma-separated)</label>
            <input
              type="text"
              id="skills"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              placeholder="e.g., React, Node.js, Solidity, UI/UX Design"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
              disabled={isLoading || !account}
            />
          </div>
          <div>
            <label htmlFor="portfolio" className="block text-lg font-medium text-gray-800 mb-1">Portfolio Links (comma-separated)</label>
            <input
              type="text"
              id="portfolio"
              value={portfolioInput}
              onChange={(e) => setPortfolioInput(e.target.value)}
              placeholder="e.g., github.com/your-project, yourportfolio.com/design"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
              disabled={isLoading || !account}
            />
          </div>
          <div>
            <label className="block text-lg font-medium text-gray-800 mb-1">Rating</label>
            <p className="text-xl font-semibold text-accent-green">
              {profile.rating !== undefined ? `${profile.rating}/5` : 'N/A'}
              <span className="text-sm text-gray-500 ml-2">(based on {profile.totalRatingsCount || 0} ratings)</span>
            </p>
          </div>
          <button
            type="submit"
            className="w-full px-6 py-3 bg-secondary-purple text-white font-semibold rounded-md hover:bg-purple-700 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || !account}
          >
            {isLoading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="p-6 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-primary-blue mb-3 border-b pb-2">Profile Details</h3>
            <p className="text-base text-gray-700 mb-2">Role: {profile.role || 'N/A'}</p>
            <p className="text-base text-gray-700 mb-2">
              Skills: {profile.skills && profile.skills.length > 0 ? profile.skills.join(', ') : 'No skills added yet.'}
            </p>
            <p className="text-base text-gray-700">
              Portfolio: {profile.portfolio && profile.portfolio.length > 0 ? (
                profile.portfolio.map((p, index) => (
                  <React.Fragment key={index}>
                    <a
                      href={p.startsWith('http') ? p : `https://${p}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-blue hover:underline break-words"
                    >
                      {p}
                    </a>
                    {index < profile.portfolio.length - 1 && ', '}
                  </React.Fragment>
                ))
              ) : 'No portfolio links added yet.'}
            </p>
            <p className="text-xl font-semibold text-accent-green mt-4">
              Rating: {profile.rating !== undefined ? `${profile.rating}/5` : 'N/A'}
              <span className="text-sm text-gray-500 ml-2">(based on {profile.totalRatingsCount || 0} ratings)</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Dashboard Component ---
const Dashboard = ({ account }) => {
  const [totalEscrowDeposits, setTotalEscrowDeposits] = useState(0);
  const [clientJobs, setClientJobs] = useState([]);
  const [freelancerJobs, setFreelancerJobs] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!account) {
        setErrorMessage('Wallet not connected. Please connect to view your dashboard.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        // Fetch general escrow deposits
        const depositResponse = await axios.get(`${API_BASE_URL}/api/deposits/total/${account}`);
        setTotalEscrowDeposits(depositResponse.data.totalDeposits || 0);

        // Fetch all jobs associated with the user
        const jobsResponse = await axios.get(`${API_BASE_URL}/api/jobs/forUser/${account}`);
        const allUserJobs = Array.isArray(jobsResponse.data) ? jobsResponse.data : [];

        // Filter jobs by role
        const clientJobsFiltered = allUserJobs.filter(job => job.client.toLowerCase() === account.toLowerCase());
        const freelancerJobsFiltered = allUserJobs.filter(job => job.freelancer && job.freelancer.toLowerCase() === account.toLowerCase());

        setClientJobs(clientJobsFiltered);
        setFreelancerJobs(freelancerJobsFiltered);

        // Fetch user profile
        const profileResponse = await axios.get(`${API_BASE_URL}/api/users/${account}`);
        setUserProfile(profileResponse.data);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setErrorMessage(`Failed to load dashboard data: ${error.message || 'Network error'}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [account]);

  return (
    <div className="max-w-6xl mx-auto p-4 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Your Dashboard</h2>

      <p className="text-lg text-gray-700 mb-4">
        Connected Wallet: <span className="font-mono text-secondary-purple">{account || 'Not connected'}</span>
      </p>

      {errorMessage && (
        <div className="p-3 mb-4 rounded-md bg-red-100 text-red-700">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-primary-blue">
          <svg className="animate-spin h-6 w-6 mr-3 text-primary-blue" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading your dashboard...
        </div>
      ) : (
        <>
          <div className="mb-6 p-4 bg-blue-50 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold text-primary-blue mb-2">Total General Escrow Deposits</h3>
            <p className="text-3xl font-bold text-accent-green">{totalEscrowDeposits} USDC</p>
            <p className="text-sm text-gray-600 mt-1">Funds you have generally deposited into escrow (not tied to specific jobs).</p>
          </div>

          {userProfile && userProfile.address ? ( // Check if userProfile and its address exist
            <div className="mt-4 p-4 bg-purple-50 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-secondary-purple mb-2">Your Profile at a Glance</h3>
              <p className="text-base text-gray-700">Role: {userProfile.role || 'N/A'}</p>
              <p className="text-base text-gray-700">Skills: {userProfile.skills?.join(', ') || 'No skills added yet.'}</p>
              <p className="text-base text-gray-700">Rating: {userProfile.rating !== undefined ? `${userProfile.rating}/5` : 'N/A'}</p>
              <Link
                className="mt-4 px-6 py-2 bg-primary-blue text-white rounded-md hover:bg-blue-700 transition duration-300 inline-block"
                to="/profile"
              >
                Edit Profile
              </Link>
            </div>
          ) : (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg shadow-sm text-yellow-800 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-base">Profile not found. Please create your profile to get started!</p>
              <Link
                className="ml-auto px-6 py-2 bg-primary-blue text-white rounded-md hover:bg-blue-700 transition duration-300 inline-block"
                to="/profile"
              >
                Create Profile
              </Link>
            </div>
          )}

          <h3 className="text-xl font-semibold mt-8 text-primary-blue border-b pb-2">Jobs You Posted (Client)</h3>
          {clientJobs.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {clientJobs.map((job) => (
                <li key={job._id} className="bg-gray-50 p-4 rounded-lg shadow-md flex justify-between items-center">
                  <div>
                    <p className="text-lg font-semibold text-gray-800">{job.title} - <span className="text-accent-green">{job.amount} USDC</span></p>
                    <p className="text-sm text-gray-600">
                      Freelancer: {job.freelancer ? (
                        <Link to={`/profile/${job.freelancer}`} className="text-primary-blue hover:underline">
                          {truncateAddress(job.freelancer)}
                        </Link>
                      ) : 'Unassigned'} | Status: {job.status} | Escrow: {job.escrowStatus}
                    </p>
                  </div>
                  <Link
                    className="px-4 py-2 bg-secondary-purple text-white rounded-md hover:bg-purple-700 transition duration-300"
                    to={`/job/${job._id}`}
                  >
                    View Details
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg shadow-sm text-yellow-800">
              <p className="text-base">You haven't posted any jobs yet. Time to find some talent!</p>
            </div>
          )}

          <Link
            className="mt-8 w-full px-6 py-3 bg-primary-blue text-white font-semibold rounded-md hover:bg-blue-700 transition duration-300 text-center block"
            to="/post-job"
          >
            Post a New Job
          </Link>

          <h3 className="text-xl font-semibold mt-8 text-primary-blue border-b pb-2">Jobs You Are Working On (Freelancer)</h3>
          {freelancerJobs.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {freelancerJobs.map((job) => (
                <li key={job._id} className="bg-gray-50 p-4 rounded-lg shadow-md flex justify-between items-center">
                  <div>
                    <p className="text-lg font-semibold text-gray-800">{job.title} - <span className="text-accent-green">{job.amount} USDC</span></p>
                    <p className="text-sm text-gray-600">
                      Client: {job.client ? (
                        <Link to={`/profile/${job.client}`} className="text-primary-blue hover:underline">
                          {truncateAddress(job.client)}
                        </Link>
                      ) : 'N/A'} | Status: {job.status} | Escrow: {job.escrowStatus}
                    </p>
                  </div>
                  <Link
                    className="px-4 py-2 bg-secondary-purple text-white rounded-md hover:bg-purple-700 transition duration-300"
                    to={`/job/${job._id}`}
                  >
                    View Details
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg shadow-sm text-yellow-800">
              <p className="text-base">You haven't accepted any jobs yet. Browse available jobs!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// --- JobDetails Component ---
const JobDetails = ({ account, publicClient, walletClient, setNotification }) => {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [clientUsdcBalance, setClientUsdcBalance] = useState(0); // For client to check balance before funding
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingTx, setIsProcessingTx] = useState(false);
  const [newMessage, setNewMessage] = useState(''); // For in-app messaging
  const messagesEndRef = useRef(null); // For scrolling messages into view
  const [ratingInput, setRatingInput] = useState(0); // For freelancer rating
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false); // For general confirmations
  const [modalAction, setModalAction] = useState(null); // To store which action the modal is confirming


  const navigate = useNavigate();

  const fetchJobAndBalance = async () => {
    setIsLoading(true);
    try {
      const jobResponse = await axios.get(`${API_BASE_URL}/api/jobs/${id}`);
      setJob(jobResponse.data);

      if (account && publicClient && jobResponse.data.client.toLowerCase() === account.toLowerCase()) {
        // Fetch client's USDC balance if they are the client
        const balance = await publicClient.readContract({
          address: usdcContractAddress,
          abi: usdcAbi,
          functionName: 'balanceOf',
          args: [account],
        });
        setClientUsdcBalance(parseFloat(formatUnits(balance, 6)));
      }

    } catch (error) {
      console.error('Error fetching job or balance:', error);
      setNotification(`Error loading job details: ${error.message || 'Network error'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobAndBalance();
  }, [id, account, publicClient, setNotification]); // Re-fetch if ID, account, or publicClient changes

  // Scroll to bottom of messages when they update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [job?.messages]); // Scroll when job messages change

  // Helper to determine if current user is client or freelancer
  const isClient = account && job && job.client.toLowerCase() === account.toLowerCase();
  const isFreelancer = account && job && job.freelancer && job.freelancer.toLowerCase() === account.toLowerCase();
  const hasApplied = account && job?.applicants?.some(app => app.address.toLowerCase() === account.toLowerCase());


  // --- Handle Funding Escrow for a Job ---
  const handleFundEscrow = async () => {
    if (!account || !walletClient || !publicClient || !job) {
      setNotification('Wallet not connected or job data missing.', 'error');
      return;
    }
    if (!isClient) {
      setNotification('Only the client can fund this job.', 'error');
      return;
    }
    if (job.escrowStatus !== 'pending-deposit') {
      setNotification('Job is not in a state to be funded.', 'error');
      return;
    }
    if (clientUsdcBalance < job.amount) {
      setNotification('Insufficient USDC balance in your wallet for this job.', 'error'); // Enhanced message
      return;
    }

    // --- Chain Mismatch Check ---
    try {
      const currentChainId = await walletClient.getChainId();
      if (currentChainId !== liskSepolia.id) {
        setNotification(`Wallet is on the wrong network. Please switch to ${liskSepolia.name} (Chain ID: ${liskSepolia.id}). Attempting to switch...`, 'error');
        try {
          await walletClient.switchChain({ id: liskSepolia.id });
          setNotification(`Successfully prompted to switch to ${liskSepolia.name}. Please confirm in your wallet and try the deposit again.`, 'info');
          return; // Exit and let user retry after chain switch
        } catch (switchError) {
          console.error("Error switching chain:", switchError);
          setNotification(`Failed to switch to ${liskSepolia.name}. Please switch manually in your wallet. Error: ${switchError.message}`, 'error');
          return;
        }
      }
    } catch (chainCheckError) {
      console.error("Error checking current chain ID:", chainCheckError);
      setNotification(`Could not verify wallet chain. Please ensure your wallet is connected and on ${liskSepolia.name}. Error: ${chainCheckError.message}`, 'error');
      return;
    }
    // --- End Chain Mismatch Check ---

    setModalAction(() => async () => { // Set the action to be confirmed
      setShowConfirmModal(false); // Close modal
      setIsProcessingTx(true);
      setNotification('Initiating fund deposit for job escrow...', 'info');

      try {
        const amountInSmallestUnit = parseUnits(job.amount.toString(), 6);

        // 1. Approve USDC for the Escrow contract
        const approveCallData = encodeFunctionData({
          abi: usdcAbi,
          functionName: 'approve',
          args: [escrowContractAddress, amountInSmallestUnit],
        });

        setNotification('Approving USDC for Escrow contract...', 'info');
        const approveTxHash = await walletClient.sendTransaction({
          account,
          to: usdcContractAddress,
          data: approveCallData,
        });

        setNotification(`Approval transaction sent! Hash: ${truncateAddress(approveTxHash)}. Waiting for confirmation...`, 'info');
        await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
        setNotification('USDC Approved. Now depositing funds to job escrow...', 'info');

        // 2. Deposit USDC into the job-specific escrow
        const depositJobCallData = encodeFunctionData({
          abi: escrowAbi,
          functionName: 'depositJob',
          args: [job._id, getAddress(job.client), getAddress(job.freelancer || '0x0000000000000000000000000000000000000000'), amountInSmallestUnit], // Pass client, freelancer, and amount
        });

        const depositTxHash = await walletClient.sendTransaction({
          account,
          to: escrowContractAddress,
          data: depositJobCallData,
          value: 0n,
        });

        setNotification(`Deposit transaction sent! Hash: ${truncateAddress(depositTxHash)}. Waiting for confirmation...`, 'info');
        await publicClient.waitForTransactionReceipt({ hash: depositTxHash });
        setNotification('Job funds deposited successfully on-chain!', 'success');

        // 3. Update backend with deposit confirmation
        await axios.put(`${API_BASE_URL}/api/jobs/${id}/deposit-confirmed`, {
          clientAddress: account,
          depositTxHash: depositTxHash,
        });

        // Update local job state
        setJob(prevJob => ({ ...prevJob, escrowStatus: 'deposited' }));
        setNotification('Job funds confirmed and updated in backend!', 'success');
        fetchJobAndBalance(); // Re-fetch to update balance and job state

      } catch (error) {
        console.error("Error funding job escrow:", error);
        setNotification(`Transaction failed or error funding job: ${error.message || 'Please try again.'}`, 'error');
      } finally {
        setIsProcessingTx(false);
      }
    });
    setShowConfirmModal(true); // Show confirmation modal
  };

  // --- Handle Freelancer Applying for Job ---
  const handleApply = async () => {
    if (!account) {
      setNotification('Please connect your wallet to apply for jobs.', 'error');
      return;
    }
    if (!job) {
      setNotification('Job data not available.', 'error');
      return;
    }
    if (job.status !== 'open' || job.escrowStatus !== 'deposited') {
      setNotification('Job is not open or not funded for applications.', 'error');
      return;
    }
    if (hasApplied) {
      setNotification('You have already applied for this job.', 'info');
      return;
    }

    setModalAction(() => async () => {
      setShowConfirmModal(false);
      setIsProcessingTx(true);
      setNotification('Applying for job...', 'info');
      try {
        await axios.post(`${API_BASE_URL}/api/jobs/${id}/apply`, { applicantAddress: account });

        // Update local job state to reflect application
        setJob(prevJob => ({
          ...prevJob,
          applicants: [...(prevJob.applicants || []), { address: account, timestamp: new Date().toISOString() }]
        }));
        setNotification('Application submitted successfully! Client will review.', 'success');

      } catch (error) {
        console.error('Error applying for job:', error);
        setNotification(`Error applying for job: ${error.message || 'Please try again.'}`, 'error');
      } finally {
        setIsProcessingTx(false);
      }
    });
    setShowConfirmModal(true);
  };

  // --- Handle Client Approving an Applicant ---
  const handleApproveApplicant = async (applicantAddress) => {
    if (!account || !job || !isClient) {
      setNotification('Wallet not connected or you are not the client.', 'error');
      return;
    }
    if (job.status !== 'open' && job.status !== 'pending-client-approval') { // Allow approval if still open or if another freelancer was rejected
      setNotification('Job is not in a state to approve applicants.', 'error');
      return;
    }

    setModalAction(() => async () => {
      setShowConfirmModal(false);
      setIsProcessingTx(true);
      setNotification(`Approving applicant ${truncateAddress(applicantAddress)}...`, 'info');
      try {
        await axios.put(`${API_BASE_URL}/api/jobs/${id}/approve-applicant`, {
          clientAddress: account,
          freelancerAddress: applicantAddress
        });

        // Update local job state
        setJob(prevJob => ({
          ...prevJob,
          status: 'pending-client-approval',
          freelancer: applicantAddress,
          applicants: prevJob.applicants.filter(app => app.address.toLowerCase() !== applicantAddress.toLowerCase()) // Remove approved from applicants list
        }));
        setNotification(`Applicant ${truncateAddress(applicantAddress)} approved! Job is now pending freelancer acceptance.`, 'success');

      } catch (error) {
        console.error('Error approving applicant:', error);
        setNotification(`Error approving applicant: ${error.message || 'Please try again.'}`, 'error');
      } finally {
        setIsProcessingTx(false);
      }
    });
    setShowConfirmModal(true);
  };

  // --- Handle Client Rejecting an Applicant ---
  const handleRejectApplicant = async (applicantAddress) => {
    if (!account || !job || !isClient) {
      setNotification('Wallet not connected or you are not the client.', 'error');
      return;
    }
    if (job.status !== 'open' && job.status !== 'pending-client-approval') {
      setNotification('Job is not in a state to reject applicants.', 'error');
      return;
    }

    setModalAction(() => async () => {
      setShowConfirmModal(false);
      setIsProcessingTx(true);
      setNotification(`Rejecting applicant ${truncateAddress(applicantAddress)}...`, 'info');
      try {
        await axios.put(`${API_BASE_URL}/api/jobs/${id}/reject-applicant`, {
          clientAddress: account,
          freelancerAddress: applicantAddress // This is the applicant to remove
        });

        // Update local job state
        setJob(prevJob => ({
          ...prevJob,
          applicants: prevJob.applicants.filter(app => app.address.toLowerCase() !== applicantAddress.toLowerCase())
        }));
        setNotification(`Applicant ${truncateAddress(applicantAddress)} rejected.`, 'success');

      } catch (error) {
        console.error('Error rejecting applicant:', error);
        setNotification(`Error rejecting applicant: ${error.message || 'Please try again.'}`, 'error');
      } finally {
        setIsProcessingTx(false);
      }
    });
    setShowConfirmModal(true);
  };


  // --- Handle Freelancer Accepting Job (after client approval) ---
  const handleAcceptAssignedJob = async () => {
    if (!account || !job || !isFreelancer) {
      setNotification('Wallet not connected or you are not the assigned freelancer.', 'error');
      return;
    }
    if (job.status !== 'pending-client-approval' || job.freelancer.toLowerCase() !== account.toLowerCase()) {
      setNotification('Job is not pending your acceptance or you are not the assigned freelancer.', 'error');
      return;
    }

    // --- Chain Mismatch Check for Job Acceptance ---
    try {
      const currentChainId = await walletClient.getChainId();
      if (currentChainId !== liskSepolia.id) {
        setNotification(`Wallet is on the wrong network. Please switch to ${liskSepolia.name} (Chain ID: ${liskSepolia.id}). Attempting to switch...`, 'error');
        try {
          await walletClient.switchChain({ id: liskSepolia.id });
          setNotification(`Successfully prompted to switch to ${liskSepolia.name}. Please confirm in your wallet and try accepting the job again.`, 'info');
          return; // Exit and let user retry after chain switch
        } catch (switchError) {
          console.error("Error switching chain:", switchError);
          setNotification(`Failed to switch to ${liskSepolia.name}. Please switch manually in your wallet. Error: ${switchError.message}`, 'error');
          return;
        }
      }
    } catch (chainCheckError) {
      console.error("Error checking current chain ID:", chainCheckError);
      setNotification(`Could not verify wallet chain. Please ensure your wallet is connected and on ${liskSepolia.name}. Error: ${chainCheckError.message}`, 'error');
      return;
    }
    // --- End Chain Mismatch Check ---

    setModalAction(() => async () => {
      setShowConfirmModal(false);
      setIsProcessingTx(true);
      setNotification('Accepting assigned job...', 'info');
      try {
        await axios.put(`${API_BASE_URL}/api/jobs/${id}/accept-assigned`, { freelancerAddress: account });

        setJob(prevJob => ({ ...prevJob, status: 'in-progress' }));
        setNotification('Job accepted! It is now in progress.', 'success');

        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);

      } catch (error) {
        console.error('Error accepting assigned job:', error);
        setNotification(`Error accepting assigned job: ${error.message || 'Please try again.'}`, 'error');
      } finally {
        setIsProcessingTx(false);
      }
    });
    setShowConfirmModal(true);
  };


  // --- Handle Freelancer Marking Job as Completed ---
  const handleMarkCompleted = async () => {
    if (!account || !job || !isFreelancer) {
      setNotification('Wallet not connected or you are not the assigned freelancer.', 'error');
      return;
    }
    if (job.status !== 'in-progress') {
      setNotification('Job is not in progress.', 'error');
      return;
    }

    // --- Chain Mismatch Check for Marking Completed ---
    try {
      const currentChainId = await walletClient.getChainId();
      if (currentChainId !== liskSepolia.id) {
        setNotification(`Wallet is on the wrong network. Please switch to ${liskSepolia.name} (Chain ID: ${liskSepolia.id}). Attempting to switch...`, 'error');
        try {
          await walletClient.switchChain({ id: liskSepolia.id });
          setNotification(`Successfully prompted to switch to ${liskSepolia.name}. Please confirm in your wallet and try marking as completed again.`, 'info');
          return; // Exit and let user retry after chain switch
        } catch (switchError) {
          console.error("Error switching chain:", switchError);
          setNotification(`Failed to switch to ${liskSepolia.name}. Please switch manually in your wallet. Error: ${switchError.message}`, 'error');
          return;
        }
      }
    } catch (chainCheckError) {
      console.error("Error checking current chain ID:", chainCheckError);
      setNotification(`Could not verify wallet chain. Please ensure your wallet is connected and on ${liskSepolia.name}. Error: ${chainCheckError.message}`, 'error');
      return;
    }
    // --- End Chain Mismatch Check ---

    setModalAction(() => async () => {
      setShowConfirmModal(false);
      setIsProcessingTx(true);
      setNotification('Marking job as completed...', 'info');
      try {
        await axios.put(`${API_BASE_URL}/api/jobs/${id}/mark-completed`, { freelancerAddress: account });

        setJob(prevJob => ({ ...prevJob, status: 'completed' })); // Frontend status update
        setNotification('Job marked as completed! Client can now release funds.', 'success');

        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);

      } catch (error) {
        console.error('Error marking job as completed:', error);
        setNotification(`Error marking job as completed: ${error.message || 'Please try again.'}`, 'error');
      } finally {
        setIsProcessingTx(false);
      }
    });
    setShowConfirmModal(true);
  };


  // --- Handle Client Releasing Funds (On-chain) ---
  const handleReleaseFunds = async () => {
    if (!account || !publicClient || !walletClient || !job) {
      setNotification('Wallet not connected or blockchain clients not ready.', 'error');
      return;
    }
    if (!isClient) {
      setNotification('Only the client can release funds.', 'error');
      return;
    }
    if (job.status !== 'completed' || job.escrowStatus !== 'deposited') { // Job must be marked completed by freelancer, escrow active
      setNotification('Job is not in a state for fund release (must be completed and funds deposited).', 'error');
      return;
    }

    // --- Chain Mismatch Check for Release Funds ---
    try {
      const currentChainId = await walletClient.getChainId();
      if (currentChainId !== liskSepolia.id) {
        setNotification(`Wallet is on the wrong network. Please switch to ${liskSepolia.name} (Chain ID: ${liskSepolia.id}). Attempting to switch...`, 'error');
        try {
          await walletClient.switchChain({ id: liskSepolia.id });
          setNotification(`Successfully prompted to switch to ${liskSepolia.name}. Please confirm in your wallet and try releasing funds again.`, 'info');
          return; // Exit and let user retry after chain switch
        } catch (switchError) {
          console.error("Error switching chain:", switchError);
          setNotification(`Failed to switch to ${liskSepolia.name}. Please switch manually in your wallet. Error: ${switchError.message}`, 'error');
          return;
        }
      }
    } catch (chainCheckError) {
      console.error("Error checking current chain ID:", chainCheckError);
      setNotification(`Could not verify wallet chain. Please ensure your wallet is connected and on ${liskSepolia.name}. Error: ${chainCheckError.message}`, 'error');
      return;
    }
    // --- End Chain Mismatch Check ---

    setModalAction(() => async () => {
      setShowConfirmModal(false);
      setIsProcessingTx(true);
      setNotification('Initiating fund release on-chain...', 'info');
      try {
        const releaseCallData = encodeFunctionData({
          abi: escrowAbi,
          functionName: 'releaseJob', // Call job-specific release
          args: [job._id], // Pass job ID
        });

        const txHash = await walletClient.sendTransaction({
          account,
          to: escrowContractAddress,
          data: releaseCallData,
        });

        setNotification(`Transaction sent! Hash: ${truncateAddress(txHash)}. Waiting for confirmation...`, 'info');
        await publicClient.waitForTransactionReceipt({ hash: txHash });

        // Update backend after successful on-chain release
        await axios.put(`${API_BASE_URL}/api/jobs/${id}/release-confirmed`, {
          clientAddress: account,
          completionTxHash: txHash,
        });

        setJob(prevJob => ({ ...prevJob, escrowStatus: 'released' })); // Update local escrow status
        setNotification('Funds released successfully, job marked as completed!', 'success');

        // Show rating modal after successful release
        setShowRatingModal(true);

      } catch (error) {
        console.error('Error releasing funds:', error);
        setNotification(`Transaction failed or error releasing funds: ${error.message || 'Please try again.'}`, 'error');
      } finally {
        setIsProcessingTx(false);
      }
    });
    setShowConfirmModal(true);
  };

  // --- Handle Client Refunding Funds (On-chain) ---
  const handleRefundFunds = async () => {
    if (!account || !publicClient || !walletClient || !job) {
      setNotification('Wallet not connected or blockchain clients not ready.', 'error');
      return;
    }
    if (!isClient) {
      setNotification('Only the client can refund funds.', 'error');
      return;
    }
    if (job.escrowStatus !== 'deposited' && job.escrowStatus !== 'disputed') { // Can refund if deposited (not yet released) or disputed
      setNotification('Job is not in a state for refund (must be deposited or disputed).', 'error');
      return;
    }

    // --- Chain Mismatch Check for Refund Funds ---
    try {
      const currentChainId = await walletClient.getChainId();
      if (currentChainId !== liskSepolia.id) {
        setNotification(`Wallet is on the wrong network. Please switch to ${liskSepolia.name} (Chain ID: ${liskSepolia.id}). Attempting to switch...`, 'error');
        try {
          await walletClient.switchChain({ id: liskSepolia.id });
          setNotification(`Successfully prompted to switch to ${liskSepolia.name}. Please confirm in your wallet and try refunding funds again.`, 'info');
          return; // Exit and let user retry after chain switch
        } catch (switchError) {
          console.error("Error switching chain:", switchError);
          setNotification(`Failed to switch to ${liskSepolia.name}. Please switch manually in your wallet. Error: ${switchError.message}`, 'error');
          return;
        }
      }
    } catch (chainCheckError) {
      console.error("Error checking current chain ID:", chainCheckError);
      setNotification(`Could not verify wallet chain. Please ensure your wallet is connected and on ${liskSepolia.name}. Error: ${chainCheckError.message}`, 'error');
      return;
    }
    // --- End Chain Mismatch Check ---

    setModalAction(() => async () => {
      setShowConfirmModal(false);
      setIsProcessingTx(true);
      setNotification('Initiating fund refund on-chain...', 'info');
      try {
        const refundCallData = encodeFunctionData({
          abi: escrowAbi,
          functionName: 'refundJob', // Call job-specific refund
          args: [job._id], // Pass job ID
        });

        const txHash = await walletClient.sendTransaction({
          account,
          to: escrowContractAddress,
          data: refundCallData,
        });

        setNotification(`Transaction sent! Hash: ${truncateAddress(txHash)}. Waiting for confirmation...`, 'info');
        await publicClient.waitForTransactionReceipt({ hash: txHash });

        // Update backend after successful on-chain refund
        await axios.put(`${API_BASE_URL}/api/jobs/${id}/refund-confirmed`, {
          clientAddress: account,
        });

        setJob(prevJob => ({ ...prevJob, escrowStatus: 'refunded', status: 'cancelled' })); // Update local statuses
        setNotification('Funds refunded successfully, job marked as cancelled!', 'success');

        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);

      } catch (error) {
        console.error('Error refunding funds:', error);
        setNotification(`Transaction failed or error refunding funds: ${error.message || 'Please try again.'}`, 'error');
      } finally {
        setIsProcessingTx(false);
      }
    });
    setShowConfirmModal(true);
  };

  // --- Handle Sending a Message ---
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!account) {
      setNotification('Please connect your wallet to send messages.', 'error');
      return;
    }
    if (!newMessage.trim()) {
      setNotification('Message cannot be empty.', 'error');
      return;
    }
    if (!job) {
      setNotification('Job data not available for messaging.', 'error');
      return;
    }

    setNotification('Sending message...', 'info');
    try {
      const response = await axios.post(`${API_BASE_URL}/api/jobs/${id}/messages`, {
        sender: account,
        text: newMessage.trim(),
      });

      // Update local job state with the new message
      setJob(prevJob => ({
        ...prevJob,
        messages: [...(prevJob.messages || []), response.data] // Assuming backend returns the saved message
      }));
      setNewMessage(''); // Clear input field
      setNotification('Message sent!', 'success');

    } catch (error) {
      console.error('Error sending message:', error);
      setNotification(`Error sending message: ${error.message || 'Please try again.'}`, 'error');
    }
  };

  // --- Handle Rating Freelancer (from modal) ---
  const handleRateFreelancer = async () => {
    if (!account || !job || !isClient || !job.freelancer) {
      setNotification('Cannot rate: Wallet not connected, job data missing, or you are not the client.', 'error');
      return;
    }
    if (ratingInput < 1 || ratingInput > 5) {
      setNotification('Please provide a rating between 1 and 5.', 'error');
      return;
    }
    if (job.rated) {
      setNotification('Freelancer has already been rated for this job.', 'info');
      setShowRatingModal(false); // Close modal if already rated
      return;
    }

    setShowRatingModal(false); // Close rating modal
    setIsProcessingTx(true);
    setNotification('Submitting rating...', 'info');
    try {
      await axios.put(`${API_BASE_URL}/api/jobs/${id}/rate-freelancer`, {
        clientAddress: account,
        freelancerAddress: job.freelancer,
        rating: parseInt(ratingInput),
      });

      setJob(prevJob => ({ ...prevJob, rated: true })); // Mark job as rated
      setNotification('Freelancer rated successfully!', 'success');

    } catch (error) {
      console.error('Error rating freelancer:', error);
      setNotification(`Error rating freelancer: ${error.message || 'Please try again.'}`, 'error');
    } finally {
      setIsProcessingTx(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-primary-blue">
        <svg className="animate-spin h-6 w-6 mr-3 text-primary-blue" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading job details...
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-5xl mx-auto p-4 bg-white shadow-lg rounded-lg my-8 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Job Not Found</h2>
        <p className="text-lg text-gray-700">The job you are looking for does not exist or an error occurred.</p>
        <button
          className="mt-6 px-6 py-3 bg-primary-blue text-white rounded-md hover:bg-blue-700 transition duration-300"
          onClick={() => navigate('/dashboard')}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Determine button states based on job status and user role
  const showFundEscrowButton = isClient && job.escrowStatus === 'pending-deposit';
  const showApplyButton = !isClient && !job.freelancer && job.status === 'open' && job.escrowStatus === 'deposited' && !hasApplied;
  const showAcceptAssignedJobButton = isFreelancer && job.status === 'pending-client-approval' && job.freelancer.toLowerCase() === account.toLowerCase();
  const showClientApplicantActions = isClient && job.status === 'open' && job.escrowStatus === 'deposited' && job.applicants && job.applicants.length > 0 && !job.freelancer; // Only show if job is open, funded, has applicants, and no freelancer assigned
  const showMarkCompletedButton = isFreelancer && job.status === 'in-progress';
  const showReleaseFundsButton = isClient && job.status === 'completed' && job.escrowStatus === 'deposited'; // Client releases after freelancer marks completed
  const showRefundFundsButton = isClient && (job.escrowStatus === 'deposited' || job.escrowStatus === 'disputed'); // Client can refund if deposited or disputed
  const showRateFreelancerButton = isClient && job.escrowStatus === 'released' && job.freelancer && !job.rated;


  return (
    <div className="max-w-5xl mx-auto p-4 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">{job.title}</h2>

      <div className="space-y-3 text-gray-700 mb-6">
        <p className="text-lg">Description: {job.description}</p>
        <p className="text-lg">Amount: <span className="font-semibold text-accent-green">{job.amount} USDC</span></p>
        <p className="text-lg">Client: <span className="font-mono text-secondary-purple">
          {job.client ? (
            <Link to={`/profile/${job.client}`} className="text-primary-blue hover:underline">
              {truncateAddress(job.client)}
            </Link>
          ) : 'N/A'}
        </span></p>
        <p className="text-lg">Freelancer: <span className="font-mono text-secondary-purple">
          {job.freelancer ? (
            <Link to={`/profile/${job.freelancer}`} className="text-primary-blue hover:underline">
              {truncateAddress(job.freelancer)}
            </Link>
          ) : 'Not assigned'}
        </span></p>
        <p className="text-lg">
          Current Status: <span className={`font-semibold ${job.status === 'open' ? 'text-blue-600' : job.status === 'pending-client-approval' ? 'text-orange-500' : job.status === 'in-progress' ? 'text-yellow-600' : job.status === 'completed' ? 'text-green-600' : job.status === 'disputed' ? 'text-red-600' : 'text-gray-600'}`}>
            {job.status}
            {job.status === 'disputed' && <span className="ml-2 text-red-700">(Disputed!)</span>}
          </span>
        </p>
        <p className="text-lg">Escrow Status: <span className={`font-semibold ${job.escrowStatus === 'pending-deposit' ? 'text-red-500' : job.escrowStatus === 'deposited' || job.escrowStatus === 'active' ? 'text-green-500' : 'text-gray-600'}`}>{job.escrowStatus}</span></p>
        {isClient && <p className="text-lg">Your USDC Balance: <span className="font-semibold text-primary-blue">{clientUsdcBalance} USDC</span></p>}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Client: Fund Escrow Button */}
        {showFundEscrowButton && (
          <button
            className="px-6 py-3 bg-primary-blue text-white font-semibold rounded-md hover:bg-blue-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleFundEscrow}
            disabled={isProcessingTx || !account || clientUsdcBalance < job.amount}
          >
            {isProcessingTx ? 'Funding Escrow...' : 'Fund Job Escrow'}
          </button>
        )}

        {/* Freelancer: Apply for Job Button */}
        {showApplyButton && (
          <button
            className="px-6 py-3 bg-secondary-purple text-white font-semibold rounded-md hover:bg-purple-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleApply}
            disabled={isProcessingTx || !account}
          >
            {isProcessingTx ? 'Applying...' : 'Apply for Job'}
          </button>
        )}

        {/* Freelancer: Accept Assigned Job Button */}
        {showAcceptAssignedJobButton && (
          <button
            className="px-6 py-3 bg-accent-green text-white font-semibold rounded-md hover:bg-green-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAcceptAssignedJob}
            disabled={isProcessingTx || !account}
          >
            {isProcessingTx ? 'Accepting Job...' : 'Accept Assigned Job'}
          </button>
        )}

        {/* Freelancer: Mark as Completed Button */}
        {showMarkCompletedButton && (
          <button
            className="px-6 py-3 bg-yellow-600 text-white font-semibold rounded-md hover:bg-yellow-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleMarkCompleted}
            disabled={isProcessingTx || !account}
          >
            {isProcessingTx ? 'Marking...' : 'Mark as Completed'}
          </button>
        )}

        {/* Client: Release Funds Button */}
        {showReleaseFundsButton && (
          <button
            className="px-6 py-3 bg-accent-green text-white font-semibold rounded-md hover:bg-green-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleReleaseFunds}
            disabled={isProcessingTx || !account}
          >
            {isProcessingTx ? 'Releasing Funds...' : 'Release Funds'}
          </button>
        )}

        {/* Client: Refund Funds Button */}
        {showRefundFundsButton && (
          <button
            className="px-6 py-3 bg-red-500 text-white font-semibold rounded-md hover:bg-red-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleRefundFunds}
            disabled={isProcessingTx || !account}
          >
            {isProcessingTx ? 'Refunding...' : 'Refund Funds'}
          </button>
        )}

        {/* Client: Rate Freelancer Button */}
        {showRateFreelancerButton && (
          <button
            className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setShowRatingModal(true)}
            disabled={isProcessingTx || !account}
          >
            Rate Freelancer
          </button>
        )}
      </div>

      {/* Client: Applicant List and Actions */}
      {showClientApplicantActions && (
        <div className="mt-8 p-4 bg-blue-50 rounded-lg shadow-inner">
          <h3 className="text-xl font-semibold text-primary-blue mb-4">Job Applicants ({job.applicants.length})</h3>
          <ul className="space-y-3">
            {job.applicants.map((applicant, index) => (
              <li key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-md shadow-sm">
                <div className="mb-2 sm:mb-0">
                  <p className="font-mono text-secondary-purple text-base">
                    <Link to={`/profile/${applicant.address}`} className="text-primary-blue hover:underline">
                      {truncateAddress(applicant.address)}
                    </Link>
                  </p>
                  <p className="text-sm text-gray-600">Applied: {new Date(applicant.timestamp).toLocaleString()}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleApproveApplicant(applicant.address)}
                    className="px-4 py-2 bg-accent-green text-white rounded-md hover:bg-green-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    disabled={isProcessingTx}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleRejectApplicant(applicant.address)}
                    className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    disabled={isProcessingTx}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* In-App Messaging Section */}
      {(isClient || isFreelancer) && job.status !== 'open' && ( // Only show messaging if job is assigned/in progress/completed
        <div className="mt-8 p-4 bg-gray-50 rounded-lg shadow-inner">
          <h3 className="text-xl font-semibold text-primary-blue mb-4">Job Messages</h3>
          <div className="h-64 overflow-y-auto border border-gray-200 rounded-md p-3 mb-4 bg-white">
            {job.messages && job.messages.length > 0 ? (
              job.messages.map((message, index) => (
                <div
                  key={index}
                  className={`mb-2 p-2 rounded-lg max-w-[80%] ${
                    message.sender.toLowerCase() === account.toLowerCase()
                      ? 'bg-primary-blue text-white ml-auto'
                      : 'bg-gray-200 text-gray-800 mr-auto'
                  }`}
                >
                  <p className="font-semibold text-sm">{truncateAddress(message.sender)}</p>
                  <p className="text-base break-words">{message.text}</p>
                  <p className="text-xs text-right opacity-80 mt-1">{new Date(message.timestamp).toLocaleString()}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No messages yet. Start the conversation!</p>
            )}
            <div ref={messagesEndRef} /> {/* Scroll target */}
          </div>
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message here..."
              className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
              disabled={isProcessingTx || !account}
            />
            <button
              type="submit"
              className="px-6 py-3 bg-secondary-purple text-white font-semibold rounded-md hover:bg-purple-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isProcessingTx || !account || !newMessage.trim()}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
            <h3 className="text-2xl font-bold text-primary-blue mb-4">Rate Freelancer</h3>
            <p className="text-lg text-gray-700 mb-6">How would you rate {job.freelancer ? truncateAddress(job.freelancer) : 'the freelancer'} for this job?</p>
            <input
              type="number"
              min="1"
              max="5"
              value={ratingInput}
              onChange={(e) => setRatingInput(parseInt(e.target.value))}
              className="w-24 p-3 border border-gray-300 rounded-md text-center text-xl font-semibold mb-6"
            />
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleRateFreelancer}
                className="px-6 py-3 bg-accent-green text-white font-semibold rounded-md hover:bg-green-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isProcessingTx || ratingInput < 1 || ratingInput > 5}
              >
                Submit Rating
              </button>
              <button
                onClick={() => setShowRatingModal(false)}
                className="px-6 py-3 bg-gray-400 text-white font-semibold rounded-md hover:bg-gray-500 transition duration-300"
                disabled={isProcessingTx}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* General Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        title={
          modalAction === handleFundEscrow ? "Confirm Fund Job Escrow" :
          modalAction === handleApply ? "Confirm Job Application" :
          modalAction === handleApproveApplicant ? "Confirm Applicant Approval" :
          modalAction === handleRejectApplicant ? "Confirm Applicant Rejection" :
          modalAction === handleAcceptAssignedJob ? "Confirm Job Acceptance" :
          modalAction === handleMarkCompleted ? "Confirm Job Completion" :
          modalAction === handleReleaseFunds ? "Confirm Fund Release" :
          modalAction === handleRefundFunds ? "Confirm Fund Refund" :
          "Confirm Action"
        }
        message={
          modalAction === handleFundEscrow ? `Are you sure you want to fund this job with ${job?.amount} USDC? You will be prompted to approve USDC and then confirm the deposit transaction in your wallet.` :
          modalAction === handleApply ? `Are you sure you want to apply for the job "${job?.title}"?` :
          modalAction === handleApproveApplicant ? `Are you sure you want to approve this applicant? They will be assigned to the job.` :
          modalAction === handleRejectApplicant ? `Are you sure you want to reject this applicant? They will be removed from the applicant list.` :
          modalAction === handleAcceptAssignedJob ? `Are you sure you want to accept the assigned job "${job?.title}"? This will mark the job as 'in-progress'.` :
          modalAction === handleMarkCompleted ? `Are you sure you want to mark the job "${job?.title}" as completed? The client will then be able to release funds.` :
          modalAction === handleReleaseFunds ? `Are you sure you want to release ${job?.amount} USDC to ${truncateAddress(job?.freelancer)} for job "${job?.title}"? This action is irreversible on-chain.` :
          modalAction === handleRefundFunds ? `Are you sure you want to refund ${job?.amount} USDC to yourself for job "${job?.title}"? This will cancel the job.` :
          "Please confirm your action."
        }
        onConfirm={() => {
          if (modalAction) {
            modalAction();
          }
        }}
        onCancel={() => {
          setShowConfirmModal(false);
          setModalAction(null);
        }}
        confirmButtonText={
          modalAction === handleFundEscrow ? "Fund Escrow" :
          modalAction === handleApply ? "Apply" :
          modalAction === handleApproveApplicant ? "Approve" :
          modalAction === handleRejectApplicant ? "Reject" :
          modalAction === handleAcceptAssignedJob ? "Accept Job" :
          modalAction === handleMarkCompleted ? "Mark Completed" :
          modalAction === handleReleaseFunds ? "Release Funds" :
          modalAction === handleRefundFunds ? "Refund Funds" :
          "Confirm"
        }
        isProcessing={isProcessingTx}
      />

      <button
        className="mt-8 px-6 py-3 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 transition duration-300"
        onClick={() => navigate('/dashboard')}
      >
        Back to Dashboard
      </button>
    </div>
  );
};

// --- PostJob Component ---
const PostJob = ({ account, setNotification }) => {
  const navigate = useNavigate();
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobAmount, setJobAmount] = useState('');
  const [requiredSkillsInput, setRequiredSkillsInput] = useState(''); // New state for required skills
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false); // For confirmation modal

  const handlePostJob = async (e) => {
    e.preventDefault();
    if (!account) {
      setNotification('Please connect your wallet to post a job.', 'error');
      return;
    }
    if (!jobTitle || !jobDescription || !jobAmount || isNaN(parseFloat(jobAmount)) || parseFloat(jobAmount) <= 0) {
      setNotification('Please fill all fields with valid data.', 'error');
      return;
    }

    setShowConfirmModal(true); // Show confirmation modal
  };

  const confirmPostJob = async () => {
    setShowConfirmModal(false); // Close modal
    setIsLoading(true);
    setNotification('Posting job...', 'info');

    try {
      const skillsArray = requiredSkillsInput.split(',').map(s => s.trim()).filter(s => s !== '');

      const response = await axios.post(`${API_BASE_URL}/api/jobs`, {
        title: jobTitle,
        description: jobDescription,
        amount: parseFloat(jobAmount),
        client: account,
        status: 'open', // Initial status
        escrowStatus: 'pending-deposit', // Initial escrow status
        requiredSkills: skillsArray, // Include required skills
      });

      setNotification('Job posted successfully! Redirecting to job details to fund escrow.', 'success');
      setJobTitle('');
      setJobDescription('');
      setJobAmount('');
      setRequiredSkillsInput(''); // Clear skills input

      setTimeout(() => {
        navigate(`/job/${response.data._id}`); // Navigate to the newly posted job's details page
      }, 2000);

    } catch (error) {
      console.error('Error posting job:', error);
      setNotification(`Error posting job: ${error.message || 'Please try again.'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="max-w-3xl mx-auto p-4 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Post a New Job</h2>

      <p className="text-lg text-gray-700 mb-4">
        Connected Wallet: <span className="font-mono text-secondary-purple">{account || 'Not connected'}</span>
      </p>

      {isLoading && (
        <div className="flex items-center justify-center mb-4 text-primary-blue">
          <svg className="animate-spin h-5 w-5 mr-3 text-primary-blue" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Posting...
        </div>
      )}

      <form onSubmit={handlePostJob} className="space-y-6">
        <div>
          <label htmlFor="jobTitle" className="block text-lg font-medium text-gray-800 mb-1">Job Title</label>
          <input
            type="text"
            id="jobTitle"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g., Build a React Component"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isLoading || !account}
          />
        </div>
        <div>
          <label htmlFor="jobDescription" className="block text-lg font-medium text-gray-800 mb-1">Job Description</label>
          <textarea
            id="jobDescription"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Detailed description of the task..."
            rows="5"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isLoading || !account}
          ></textarea>
        </div>
        <div>
          <label htmlFor="jobAmount" className="block text-lg font-medium text-gray-800 mb-1">Amount (USDC)</label>
          <input
            type="number"
            id="jobAmount"
            value={jobAmount}
            onChange={(e) => setJobAmount(e.target.value)}
            placeholder="e.g., 500"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isLoading || !account}
          />
        </div>
        <div>
          <label htmlFor="requiredSkills" className="block text-lg font-medium text-gray-800 mb-1">Required Skills (comma-separated, optional)</label>
          <input
            type="text"
            id="requiredSkills"
            value={requiredSkillsInput}
            onChange={(e) => setRequiredSkillsInput(e.target.value)}
            placeholder="e.g., JavaScript, Solidity, UI/UX"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isLoading || !account}
          />
        </div>
        <button
          type="submit"
          className="w-full px-6 py-3 bg-secondary-purple text-white font-semibold rounded-md hover:bg-purple-700 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading || !account}
        >
          {isLoading ? 'Posting...' : 'Post Job'}
        </button>
      </form>

      <ConfirmationModal
        isOpen={showConfirmModal}
        title="Confirm Job Posting"
        message={`Are you sure you want to post the job "${jobTitle}" for ${jobAmount} USDC?`}
        onConfirm={confirmPostJob}
        onCancel={() => setShowConfirmModal(false)}
        confirmButtonText="Yes, Post Job"
        isProcessing={isLoading}
      />
    </div>
  );
};

// --- BrowseJobs Component ---
const BrowseJobs = ({ setNotification }) => {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [filterSkills, setFilterSkills] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortBy, setSortBy] = useState('dateDesc'); // 'dateDesc', 'dateAsc', 'amountDesc', 'amountAsc'
  const navigate = useNavigate();

  useEffect(() => {
    const fetchJobs = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        // Fetch jobs that are 'open' and 'deposited'
        const response = await axios.get(`${API_BASE_URL}/api/jobs?status=open&escrowStatus=deposited`);
        let fetchedJobs = response.data;

        // Frontend Filtering by Skills
        if (filterSkills) {
          const skillArray = filterSkills.toLowerCase().split(',').map(s => s.trim()).filter(s => s !== '');
          fetchedJobs = fetchedJobs.filter(job =>
            job.requiredSkills && skillArray.some(skill => job.requiredSkills.map(s => s.toLowerCase()).includes(skill))
          );
        }

        // Frontend Filtering by Amount Range
        const min = parseFloat(minAmount);
        const max = parseFloat(maxAmount);
        if (!isNaN(min)) {
          fetchedJobs = fetchedJobs.filter(job => job.amount >= min);
        }
        if (!isNaN(max)) {
          fetchedJobs = fetchedJobs.filter(job => job.amount <= max);
        }

        // Frontend Sorting
        fetchedJobs.sort((a, b) => {
          if (sortBy === 'dateDesc') {
            return new Date(b.createdAt) - new Date(a.createdAt);
          } else if (sortBy === 'dateAsc') {
            return new Date(a.createdAt) - new Date(b.createdAt);
          } else if (sortBy === 'amountDesc') {
            return b.amount - a.amount;
          } else if (sortBy === 'amountAsc') {
            return a.amount - b.amount;
          }
          return 0;
        });

        setJobs(fetchedJobs);
      } catch (error) {
        console.error('Error fetching jobs:', error);
        setErrorMessage(`Error loading jobs: ${error.message || 'Network error'}`);
        setNotification(`Error loading jobs: ${error.message || 'Network error'}`, 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchJobs();
  }, [filterSkills, minAmount, maxAmount, sortBy, setNotification]); // Re-fetch when filters/sort change

  return (
    <div className="max-w-6xl mx-auto p-4 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Browse Available Jobs</h2>

      {errorMessage && (
        <div className="p-3 mb-4 rounded-md bg-red-100 text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Filtering and Sorting Controls */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg shadow-inner grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label htmlFor="filterSkills" className="block text-sm font-medium text-gray-800 mb-1">Filter by Skills (comma-separated):</label>
          <input
            type="text"
            id="filterSkills"
            value={filterSkills}
            onChange={(e) => setFilterSkills(e.target.value)}
            placeholder="e.g., React, Node.js"
            className="w-full p-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label htmlFor="minAmount" className="block text-sm font-medium text-gray-800 mb-1">Min Amount (USDC):</label>
          <input
            type="number"
            id="minAmount"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            placeholder="e.g., 100"
            className="w-full p-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label htmlFor="maxAmount" className="block text-sm font-medium text-gray-800 mb-1">Max Amount (USDC):</label>
          <input
            type="number"
            id="maxAmount"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            placeholder="e.g., 1000"
            className="w-full p-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div className="md:col-span-2 lg:col-span-1">
          <label htmlFor="sortBy" className="block text-sm font-medium text-gray-800 mb-1">Sort By:</label>
          <select
            id="sortBy"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="dateDesc">Date Posted (Newest First)</option>
            <option value="dateAsc">Date Posted (Oldest First)</option>
            <option value="amountDesc">Amount (High to Low)</option>
            <option value="amountAsc">Amount (Low to High)</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-primary-blue">
          <svg className="animate-spin h-6 w-6 mr-3 text-primary-blue" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading jobs...
        </div>
      ) : (
        <>
          {jobs.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {jobs.map((job) => (
                <li key={job._id} className="bg-gray-50 p-4 rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <div className="mb-2 sm:mb-0">
                    <p className="text-lg font-semibold text-gray-800">{job.title} - <span className="text-accent-green">{job.amount} USDC</span></p>
                    <p className="text-sm text-gray-600 truncate max-w-sm">{job.description}</p>
                    <p className="text-xs text-gray-500">
                      Client: {job.client ? (
                        <Link to={`/profile/${job.client}`} className="text-primary-blue hover:underline">
                          {truncateAddress(job.client)}
                        </Link>
                      ) : 'N/A'} | Status: {job.status} | Escrow: {job.escrowStatus}
                    </p>
                    {job.requiredSkills && job.requiredSkills.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">Required Skills: {job.requiredSkills.join(', ')}</p>
                    )}
                  </div>
                  <Link
                    className="px-4 py-2 bg-primary-blue text-white rounded-md hover:bg-blue-700 transition duration-300 flex-shrink-0"
                    to={`/job/${job._id}`}
                  >
                    View Details
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg shadow-sm text-yellow-800 text-center">
              <p className="text-base">No open jobs found at the moment. Adjust your filters or check back later!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// --- CrossChainIntegration Component ---
const CrossChainIntegration = ({ account, walletClient, publicClient, setNotification }) => {
  const [sourceChain, setSourceChain] = useState('Lisk Sepolia');
  const [destinationChain, setDestinationChain] = useState('Optimism/Base');
  const [transferAmount, setTransferAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false); // For confirmation modal

  const handleCrossChainTransfer = async () => {
    if (!account || !walletClient || !publicClient) {
      setNotification('Please connect your wallet first.', 'error');
      return;
    }
    if (isNaN(parseFloat(transferAmount)) || parseFloat(transferAmount) <= 0) {
      setNotification('Please enter a valid amount to transfer.', 'error');
      return;
    }

    // --- Chain Mismatch Check for Cross-Chain Transfer ---
    try {
      const currentChainId = await walletClient.getChainId();
      if (currentChainId !== liskSepolia.id) {
        setNotification(`Wallet is on the wrong network. Please switch to ${liskSepolia.name} (Chain ID: ${liskSepolia.id}). Attempting to switch...`, 'error');
        try {
          await walletClient.switchChain({ id: liskSepolia.id });
          setNotification(`Successfully prompted to switch to ${liskSepolia.name}. Please confirm in your wallet and try the transfer again.`, 'info');
          return; // Exit and let user retry after chain switch
        } catch (switchError) {
          console.error("Error switching chain:", switchError);
          setNotification(`Failed to switch to ${liskSepolia.name}. Please switch manually in your wallet. Error: ${switchError.message}`, 'error');
          return;
        }
      }
    } catch (chainCheckError) {
      console.error("Error checking current chain ID:", chainCheckError);
      setNotification(`Could not verify wallet chain. Please ensure your wallet is connected and on ${liskSepolia.name}. Error: ${chainCheckError.message}`, 'error');
      return;
    }
    // --- End Chain Mismatch Check ---

    setShowConfirmModal(true); // Show confirmation modal
  };

  const confirmCrossChainTransfer = async () => {
    setShowConfirmModal(false); // Close modal
    setIsProcessing(true);
    setNotification(`Initiating cross-chain transfer of ${transferAmount} USDC from ${sourceChain} to ${destinationChain}...`, 'info');

    try {
      // This section represents a conceptual integration with LayerZero.
      // In a live environment, this would involve actual smart contract calls
      // to a LayerZero OApp (Omnichain Application) for cross-chain messaging.

      await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate network delay

      setNotification(`Conceptual cross-chain transfer initiated! ${transferAmount} USDC from ${sourceChain} to ${destinationChain}. This feature is coming soon.`, 'info');
      setTransferAmount('');

    } catch (error) {
      console.error('Error during conceptual cross-chain transfer:', error);
      setNotification(`Conceptual transfer failed: ${error.message || 'Please try again.'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Cross-Chain Payments (Future Feature)</h2>
      <p className="text-lg text-gray-700 mb-6">
        Seamlessly transfer USDC between Lisk Sepolia and other Optimism-based networks (e.g., Optimism Mainnet, Base) using LayerZero. This feature is currently under development and will be available soon.
      </p>

      <p className="text-lg text-gray-700 mb-4">
        Connected Wallet: <span className="font-mono text-secondary-purple">{account || 'Not connected'}</span>
      </p>

      <div className="space-y-6">
        <div>
          <label htmlFor="sourceChain" className="block text-lg font-medium text-gray-800 mb-1">Source Chain</label>
          <select
            id="sourceChain"
            value={sourceChain}
            onChange={(e) => setSourceChain(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isProcessing || !account}
          >
            <option value="Lisk Sepolia">Lisk Sepolia Testnet</option>
            {/* Add more options as actual LayerZero integrations are built */}
          </select>
        </div>
        <div>
          <label htmlFor="destinationChain" className="block text-lg font-medium text-gray-800 mb-1">Destination Chain</label>
          <select
            id="destinationChain"
            value={destinationChain}
            onChange={(e) => setDestinationChain(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isProcessing || !account}
          >
            <option value="Optimism/Base">Optimism/Base (Coming Soon)</option>
            {/* Add more options as actual LayerZero integrations are built */}
          </select>
        </div>
        <div>
          <label htmlFor="transferAmount" className="block text-lg font-medium text-gray-800 mb-1">Amount to Transfer (USDC)</label>
          <input
            type="number"
            id="transferAmount"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            placeholder="e.g., 50"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isProcessing || !account}
          />
        </div>
        <button
          onClick={handleCrossChainTransfer}
          className="w-full px-6 py-3 bg-secondary-purple text-white font-semibold rounded-md hover:bg-purple-700 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isProcessing || !account}
        >
          {isProcessing ? 'Transferring...' : 'Initiate Cross-Chain Transfer (Coming Soon)'}
        </button>
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        title="Confirm Cross-Chain Transfer"
        message={`Are you sure you want to initiate a conceptual transfer of ${transferAmount} USDC from ${sourceChain} to ${destinationChain}? This feature is coming soon.`}
        onConfirm={confirmCrossChainTransfer}
        onCancel={() => setShowConfirmModal(false)}
        confirmButtonText="Yes, Initiate Transfer"
        isProcessing={isProcessing}
      />
    </div>
  );
};

// --- DisputeResolution Component ---
const DisputeResolution = ({ account, setNotification }) => {
  const [jobId, setJobId] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false); // For confirmation modal

  const handleSubmitDispute = async (e) => {
    e.preventDefault();
    if (!account) {
      setNotification('Please connect your wallet to submit a dispute.', 'error');
      return;
    }
    if (!jobId || !disputeReason) {
      setNotification('Please fill in both Job ID and Dispute Reason.', 'error');
      return;
    }

    setShowConfirmModal(true); // Show confirmation modal
  };

  const confirmSubmitDispute = async () => {
    setShowConfirmModal(false); // Close modal
    setIsLoading(true);
    setNotification('Submitting dispute...', 'info');

    try {
      // Call backend to submit dispute
      await axios.post(`${API_BASE_URL}/api/disputes`, {
        jobId: jobId,
        reporterAddress: account,
        reason: disputeReason,
      });

      setNotification('Dispute submitted successfully! Our team will review it.', 'success');
      setJobId('');
      setDisputeReason('');

    } catch (error) {
      console.error('Error submitting dispute:', error);
      setNotification(`Error submitting dispute: ${error.message || 'Please try again.'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Dispute Resolution</h2>
      <p className="text-lg text-gray-700 mb-6">
        If there's an issue with a job, you can formally initiate a dispute here. This will mark the job as 'disputed' in the system.
      </p>

      <p className="text-lg text-gray-700 mb-4">
        Connected Wallet: <span className="font-mono text-secondary-purple">{account || 'Not connected'}</span>
      </p>

      {isLoading && (
        <div className="flex items-center justify-center mb-4 text-primary-blue">
          <svg className="animate-spin h-5 w-5 mr-3 text-primary-blue" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Submitting...
        </div>
      )}

      <form onSubmit={handleSubmitDispute} className="space-y-6">
        <div>
          <label htmlFor="jobId" className="block text-lg font-medium text-gray-800 mb-1">Job ID</label>
          <input
            type="text"
            id="jobId"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            placeholder="e.g., 60d5ec49f8c7e2a4b8f0e5b1 (MongoDB Job ID)"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isLoading || !account}
          />
        </div>
        <div>
          <label htmlFor="disputeReason" className="block text-lg font-medium text-gray-800 mb-1">Dispute Reason</label>
          <textarea
            id="disputeReason"
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Please describe the issue in detail..."
            rows="5"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isLoading || !account}
          ></textarea>
        </div>
        <button
          type="submit"
          className="w-full px-6 py-3 bg-secondary-purple text-white font-semibold rounded-md hover:bg-purple-700 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading || !account}
        >
          {isLoading ? 'Submitting...' : 'Submit Dispute'}
        </button>
      </form>

      <ConfirmationModal
        isOpen={showConfirmModal}
        title="Confirm Dispute Submission"
        message={`Are you sure you want to submit a dispute for Job ID: ${jobId}? This will mark the job as 'disputed'.`}
        onConfirm={confirmSubmitDispute}
        onCancel={() => setShowConfirmModal(false)}
        confirmButtonText="Yes, Submit Dispute"
        isProcessing={isLoading}
      />
    </div>
  );
};

// --- Withdrawal Component (Enhanced for Mobile Money) ---
const Withdrawal = ({ account, setNotification }) => {
  const [amount, setAmount] = useState('');
  const [country, setCountry] = useState('KE'); // Default to Kenya
  const [mobileMoneyNetwork, setMobileMoneyNetwork] = useState('M-Pesa');
  const [mobilePhoneNumber, setMobilePhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [totalGeneralDeposits, setTotalGeneralDeposits] = useState(0); // New state for user's general escrow balance

  // Fetch user's total general deposits
  useEffect(() => {
    const fetchTotalDeposits = async () => {
      if (account) {
        try {
          const response = await axios.get(`${API_BASE_URL}/api/deposits/total/${account}`);
          setTotalGeneralDeposits(parseFloat(response.data.totalDeposits));
        } catch (error) {
          console.error("Error fetching total general deposits:", error);
          setNotification(`Error fetching your general escrow balance: ${error.message}`, 'error');
          setTotalGeneralDeposits(0);
        }
      } else {
        setTotalGeneralDeposits(0);
      }
    };
    fetchTotalDeposits();
  }, [account, setNotification]);


  // Define mobile money networks based on selected country
  const getMobileMoneyNetworks = (selectedCountry) => {
    switch (selectedCountry) {
      case 'KE': return ['M-Pesa', 'Airtel Money', 'Telkom T-Kash'];
      case 'NG': return ['MTN Mobile Money', 'Airtel Money', 'Glo Money'];
      case 'ZA': return ['FNB eWallet', 'Standard Bank Instant Money'];
      case 'GH': return ['MTN Mobile Money', 'Vodafone Cash', 'AirtelTigo Money'];
      case 'UG': return ['MTN Mobile Money', 'Airtel Money'];
      case 'TZ': return ['M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Halopesa'];
      default: return ['Other'];
    }
  };

  const handleWithdrawal = async (e) => {
    e.preventDefault();
    if (!account) {
      setNotification('Please connect your wallet to initiate a withdrawal.', 'error');
      return;
    }
    const withdrawalAmountNum = parseFloat(amount);
    if (isNaN(withdrawalAmountNum) || withdrawalAmountNum <= 0 || !mobilePhoneNumber || !country || !mobileMoneyNetwork) {
      setNotification('Please fill all withdrawal details correctly.', 'error');
      return;
    }
    if (withdrawalAmountNum > totalGeneralDeposits) {
        setNotification(`Insufficient funds in your general escrow. You have ${totalGeneralDeposits} USDC available.`, 'error');
        return;
    }

    setShowConfirmModal(true);
  };

  const confirmWithdrawal = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);
    setNotification(`Initiating withdrawal request for ${amount} USDC to ${mobileMoneyNetwork} in ${country} for ${mobilePhoneNumber}...`, 'info');

    try {
      await axios.post(`${API_BASE_URL}/api/withdrawals`, {
        requestorAddress: account,
        usdcAmount: parseFloat(amount),
        country: country,
        mobileMoneyNetwork: mobileMoneyNetwork,
        mobilePhoneNumber: mobilePhoneNumber,
      });

      setNotification(`Withdrawal request submitted! Our team will process your ${amount} USDC to ${mobileMoneyNetwork}. This is an off-chain request.`, 'success');
      setAmount('');
      setMobilePhoneNumber('');
      // Optionally re-fetch totalGeneralDeposits after a successful request
      const response = await axios.get(`${API_BASE_URL}/api/deposits/total/${account}`);
      setTotalGeneralDeposits(parseFloat(response.data.totalDeposits));

    } catch (error) {
      console.error('Error during withdrawal:', error);
      setNotification(`Withdrawal request failed: ${error.message || 'Please try again.'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Withdraw Funds (Fiat On/Off-Ramp)</h2>
      <p className="text-lg text-gray-700 mb-6">
        Convert your USDC earnings to local fiat currency and withdraw directly to your mobile money account.
        <span className="font-semibold text-red-600 block mt-2">Note: This is an off-chain request, processed by our team.</span>
      </p>

      <p className="text-lg text-gray-700 mb-4">
        Connected Wallet: <span className="font-mono text-secondary-purple">{account || 'Not connected'}</span>
      </p>
      {account && (
        <p className="text-lg text-gray-700 mb-4">
          Your General Escrow Balance: <span className="font-semibold text-primary-blue">{totalGeneralDeposits} USDC</span>
        </p>
      )}

      {isLoading && (
        <div className="flex items-center justify-center mb-4 text-primary-blue">
          <svg className="animate-spin h-5 w-5 mr-3 text-primary-blue" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing Withdrawal...
        </div>
      )}

      <form onSubmit={handleWithdrawal} className="space-y-6">
        <div>
          <label htmlFor="amount" className="block text-lg font-medium text-gray-800 mb-1">Amount to Withdraw (USDC)</label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g., 100"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isLoading || !account}
          />
        </div>
        <div>
          <label htmlFor="country" className="block text-lg font-medium text-gray-800 mb-1">Country</label>
          <select
            id="country"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setMobileMoneyNetwork(getMobileMoneyNetworks(e.target.value)[0] || ''); // Reset network on country change
            }}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isLoading || !account}
          >
            <option value="KE">Kenya</option>
            <option value="NG">Nigeria</option>
            <option value="ZA">South Africa</option>
            <option value="GH">Ghana</option>
            <option value="UG">Uganda</option>
            <option value="TZ">Tanzania</option>
            {/* Add more African countries as needed */}
          </select>
        </div>
        <div>
          <label htmlFor="mobileMoneyNetwork" className="block text-lg font-medium text-gray-800 mb-1">Mobile Money Network</label>
          <select
            id="mobileMoneyNetwork"
            value={mobileMoneyNetwork}
            onChange={(e) => setMobileMoneyNetwork(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isLoading || !account}
          >
            {getMobileMoneyNetworks(country).map(network => (
              <option key={network} value={network}>{network}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="mobilePhoneNumber" className="block text-lg font-medium text-gray-800 mb-1">Mobile Phone Number</label>
          <input
            type="text"
            id="mobilePhoneNumber"
            value={mobilePhoneNumber}
            onChange={(e) => setMobilePhoneNumber(e.target.value)}
            placeholder="e.g., +2547XXXXXXXX"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isLoading || !account}
          />
        </div>
        <button
          type="submit"
          className="w-full px-6 py-3 bg-accent-green text-white font-semibold rounded-md hover:bg-green-600 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading || !account || parseFloat(amount) <= 0 || parseFloat(amount) > totalGeneralDeposits}
        >
          {isLoading ? 'Processing...' : 'Initiate Withdrawal Request'}
        </button>
      </form>

      <ConfirmationModal
        isOpen={showConfirmModal}
        title="Confirm Withdrawal Request"
        message={`Are you sure you want to request a withdrawal of ${amount} USDC to ${mobileMoneyNetwork} (${country}) at ${mobilePhoneNumber}? This is an off-chain request processed by our team.`}
        onConfirm={confirmWithdrawal}
        onCancel={() => setShowConfirmModal(false)}
        confirmButtonText="Yes, Request Withdrawal"
        isProcessing={isLoading}
      />
    </div>
  );
};


// --- AdminDashboard Component ---
const AdminDashboard = ({ setNotification }) => {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [disputes, setDisputes] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // New state for all users
  const [allWithdrawals, setAllWithdrawals] = useState([]); // New state for all withdrawals
  const [userCount, setUserCount] = useState(0); // New state for user count
  const [isLoading, setIsLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [newJobStatus, setNewJobStatus] = useState('');
  const [newEscrowStatus, setNewEscrowStatus] = useState('');
  const [showResolveDisputeModal, setShowResolveDisputeModal] = useState(false);
  const [currentDisputeToResolve, setCurrentDisputeToResolve] = useState(null);
  const [resolveDetails, setResolveDetails] = useState('');
  const [resolveJobStatus, setResolveJobStatus] = useState('');
  const [resolveEscrowStatus, setResolveEscrowStatus] = useState('');
  const [showProcessWithdrawalModal, setShowProcessWithdrawalModal] = useState(false);
  const [currentWithdrawalToProcess, setCurrentWithdrawalToProcess] = useState(null);


  const fetchAdminData = async () => {
    if (!adminKey) {
      setNotification('Please enter the Admin Secret Key.', 'error');
      setIsAuthenticated(false);
      return;
    }
    setIsLoading(true);
    setNotification('Fetching admin data...', 'info');
    try {
      // Fetch disputes
      const disputesResponse = await axios.get(`${API_BASE_URL}/api/admin/disputes`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      setDisputes(disputesResponse.data);

      // Fetch all jobs
      const jobsResponse = await axios.get(`${API_BASE_URL}/api/jobs`, { // Admin can see all jobs
        headers: { 'X-Admin-Key': adminKey }
      });
      setAllJobs(jobsResponse.data);

      // Fetch user count
      const userCountResponse = await axios.get(`${API_BASE_URL}/api/admin/users/count`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      setUserCount(userCountResponse.data.count);

      // Fetch all users
      const allUsersResponse = await axios.get(`${API_BASE_URL}/api/admin/users`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      setAllUsers(allUsersResponse.data);

      // Fetch all withdrawal requests
      const allWithdrawalsResponse = await axios.get(`${API_BASE_URL}/api/admin/withdrawals`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      setAllWithdrawals(allWithdrawalsResponse.data);


      setIsAuthenticated(true);
      setNotification('Admin data loaded successfully!', 'success');
    } catch (error) {
      console.error('Error fetching admin data:', error);
      setNotification(`Authentication failed or error fetching data: ${error.message || 'Please check your key.'}`, 'error');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveDispute = (dispute) => {
    setCurrentDisputeToResolve(dispute);
    setResolveDetails(''); // Clear previous details
    setResolveJobStatus(dispute.jobId.status); // Pre-fill with current job status
    setResolveEscrowStatus(dispute.jobId.escrowStatus); // Pre-fill with current escrow status
    setShowResolveDisputeModal(true);
  };

  const confirmResolveDispute = async () => {
    if (!currentDisputeToResolve) return;

    setIsLoading(true);
    setShowResolveDisputeModal(false);
    setNotification('Resolving dispute...', 'info');
    try {
      await axios.put(`${API_BASE_URL}/api/admin/disputes/${currentDisputeToResolve._id}/resolve`,
        {
          resolutionDetails: resolveDetails,
          jobStatus: resolveJobStatus,
          escrowStatus: resolveEscrowStatus,
        },
        { headers: { 'X-Admin-Key': adminKey } }
      );
      setNotification('Dispute resolved successfully and job status updated!', 'success');
      fetchAdminData(); // Re-fetch data to update lists
    } catch (error) {
      console.error('Error resolving dispute:', error);
      setNotification(`Error resolving dispute: ${error.message || 'Please try again.'}`, 'error');
    } finally {
      setIsLoading(false);
      setCurrentDisputeToResolve(null);
    }
  };

  const handleCloseDispute = async (disputeId) => {
    setIsLoading(true);
    setNotification('Closing dispute...', 'info');
    try {
      await axios.put(`${API_BASE_URL}/api/admin/disputes/${disputeId}/close`,
        { resolutionDetails: 'Closed by admin, no further action.' },
        { headers: { 'X-Admin-Key': adminKey } }
      );
      setNotification('Dispute closed successfully!', 'success');
      fetchAdminData();
    } catch (error) {
      console.error('Error closing dispute:', error);
      setNotification(`Error closing dispute: ${error.message || 'Please try again.'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateJobStatus = async () => {
    if (!selectedJobId || (!newJobStatus && !newEscrowStatus)) {
      setNotification('Please select a job and provide at least one new status.', 'error');
      return;
    }
    setIsLoading(true);
    setNotification('Updating job status...', 'info');
    try {
      await axios.put(`${API_BASE_URL}/api/admin/jobs/${selectedJobId}/update-status`,
        {
          status: newJobStatus || undefined, // Only send if not empty
          escrowStatus: newEscrowStatus || undefined, // Only send if not empty
        },
        { headers: { 'X-Admin-Key': adminKey } }
      );
      setNotification('Job status updated successfully!', 'success');
      setNewJobStatus('');
      setNewEscrowStatus('');
      fetchAdminData(); // Re-fetch data
    } catch (error) {
      console.error('Error updating job status:', error);
      setNotification(`Error updating job status: ${error.message || 'Please try again.'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessWithdrawal = (withdrawal) => {
    setCurrentWithdrawalToProcess(withdrawal);
    setShowProcessWithdrawalModal(true);
  };

  const confirmProcessWithdrawal = async () => {
    if (!currentWithdrawalToProcess) return;

    setIsLoading(true);
    setShowProcessWithdrawalModal(false);
    setNotification('Processing withdrawal request...', 'info');
    try {
      await axios.put(`${API_BASE_URL}/api/admin/withdrawals/${currentWithdrawalToProcess._id}/process`,
        {}, // No body needed for this conceptual process
        { headers: { 'X-Admin-Key': adminKey } }
      );
      setNotification('Withdrawal request marked as processed!', 'success');
      fetchAdminData(); // Re-fetch data to update lists
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      setNotification(`Error processing withdrawal: ${error.message || 'Please try again.'}`, 'error');
    } finally {
      setIsLoading(false);
      setCurrentWithdrawalToProcess(null);
    }
  };


  return (
    <div className="max-w-6xl mx-auto p-4 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Admin Dashboard</h2>

      {!isAuthenticated ? (
        <div className="text-center p-6 bg-gray-50 rounded-lg shadow-inner">
          <p className="text-lg text-gray-700 mb-4">Enter Admin Secret Key to access this dashboard:</p>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Admin Secret Key"
            className="w-full max-w-sm p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200 text-gray-800 mb-4"
          />
          <button
            onClick={fetchAdminData}
            className="px-8 py-3 bg-secondary-purple text-white font-semibold rounded-md hover:bg-purple-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? 'Authenticating...' : 'Authenticate'}
          </button>
        </div>
      ) : (
        <>
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-primary-blue">
              <svg className="animate-spin h-6 w-6 mr-3 text-primary-blue" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading admin data...
            </div>
          )}

          {/* User Count */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg shadow-sm text-center">
            <h3 className="text-xl font-semibold text-primary-blue mb-2">Total Registered Users</h3>
            <p className="text-4xl font-bold text-accent-green">{userCount}</p>
          </div>

          <h3 className="text-xl font-semibold mt-8 text-primary-blue border-b pb-2">All Users</h3>
          {allUsers.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {allUsers.map((user) => (
                <li key={user.address} className="bg-gray-50 p-4 rounded-lg shadow-md">
                  <p className="text-lg font-semibold text-gray-800">Address: <Link to={`/profile/${user.address}`} className="text-primary-blue hover:underline">{truncateAddress(user.address)}</Link></p>
                  <p className="text-md text-gray-700">Role: {user.role}</p>
                  <p className="text-md text-gray-700">Skills: {user.skills?.join(', ') || 'N/A'}</p>
                  <p className="text-md text-gray-700">Rating: {user.rating !== undefined ? `${user.rating}/5` : 'N/A'}</p>
                  <p className="text-sm text-gray-600">Registered: {new Date(user.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg shadow-sm text-yellow-800">
              <p className="text-base">No users registered yet.</p>
            </div>
          )}

          <h3 className="text-xl font-semibold mt-8 text-primary-blue border-b pb-2">All Withdrawal Requests</h3>
          {allWithdrawals.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {allWithdrawals.map((withdrawal) => (
                <li key={withdrawal._id} className="bg-gray-50 p-4 rounded-lg shadow-md">
                  <p className="text-lg font-semibold text-gray-800">Requestor: {truncateAddress(withdrawal.requestorAddress)}</p>
                  <p className="text-md text-gray-700">Amount: {withdrawal.usdcAmount} USDC</p>
                  <p className="text-md text-gray-700">Mobile Money: {withdrawal.mobileMoneyNetwork} ({withdrawal.country}) - {withdrawal.mobilePhoneNumber}</p>
                  <p className="text-md text-gray-700">Status: <span className={`font-semibold ${withdrawal.status === 'pending' ? 'text-orange-600' : withdrawal.status === 'completed' ? 'text-green-600' : 'text-red-600'}`}>{withdrawal.status}</span></p>
                  <p className="text-sm text-gray-600">Requested At: {new Date(withdrawal.requestedAt).toLocaleString()}</p>
                  {withdrawal.processedAt && <p className="text-sm text-gray-600">Processed At: {new Date(withdrawal.processedAt).toLocaleString()}</p>}
                  <div className="mt-3">
                    {withdrawal.status === 'pending' ? (
                      <button
                        onClick={() => handleProcessWithdrawal(withdrawal)}
                        className="px-4 py-2 bg-accent-green text-white rounded-md hover:bg-green-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        disabled={isLoading}
                      >
                        Mark as Processed
                      </button>
                    ) : (
                      <span className="text-gray-500 text-sm">Already processed.</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg shadow-sm text-yellow-800">
              <p className="text-base">No withdrawal requests found.</p>
            </div>
          )}

          <h3 className="text-xl font-semibold mt-8 text-primary-blue border-b pb-2">Disputes Overview</h3>
          {disputes.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {disputes.map((dispute) => (
                <li key={dispute._id} className="bg-gray-50 p-4 rounded-lg shadow-md">
                  <p className="text-lg font-semibold text-gray-800">Job ID: <Link to={`/job/${dispute.jobId._id}`} className="text-primary-blue hover:underline">{dispute.jobId._id}</Link></p>
                  <p className="text-md text-gray-700">Reported by: {truncateAddress(dispute.reporterAddress)}</p>
                  <p className="text-md text-gray-700">Reason: {dispute.reason}</p>
                  <p className="text-md text-gray-700">Status: <span className={`font-semibold ${dispute.status === 'open' ? 'text-red-600' : 'text-green-600'}`}>{dispute.status}</span></p>
                  <p className="text-sm text-gray-600">Reported At: {new Date(dispute.reportedAt).toLocaleString()}</p>
                  {dispute.resolutionDetails && <p className="text-sm text-gray-600">Resolution: {dispute.resolutionDetails}</p>}
                  <div className="mt-3 flex space-x-2">
                    {dispute.status === 'open' || dispute.status === 'under-review' ? (
                      <>
                        <button
                          onClick={() => handleResolveDispute(dispute)}
                          className="px-4 py-2 bg-accent-green text-white rounded-md hover:bg-green-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          disabled={isLoading}
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => handleCloseDispute(dispute._id)}
                          className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          disabled={isLoading}
                        >
                          Close
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-500 text-sm">Dispute already handled.</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg shadow-sm text-yellow-800">
              <p className="text-base">No disputes found.</p>
            </div>
          )}

          <h3 className="text-xl font-semibold mt-8 text-primary-blue border-b pb-2">Manually Update Job Status</h3>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg shadow-inner space-y-4">
            <div>
              <label htmlFor="selectJob" className="block text-lg font-medium text-gray-800 mb-1">Select Job:</label>
              <select
                id="selectJob"
                value={selectedJobId}
                onChange={(e) => {
                  setSelectedJobId(e.target.value);
                  const job = allJobs.find(j => j._id === e.target.value);
                  if (job) {
                    setNewJobStatus(job.status);
                    setNewEscrowStatus(job.escrowStatus);
                  } else {
                    setNewJobStatus('');
                    setNewEscrowStatus('');
                  }
                }}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
                disabled={isLoading}
              >
                <option value="">-- Select a Job --</option>
                {allJobs.map(job => (
                  <option key={job._id} value={job._id}>
                    {job.title} (ID: {truncateAddress(job._id)}) - Status: {job.status} | Escrow: {job.escrowStatus}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="newJobStatus" className="block text-lg font-medium text-gray-800 mb-1">New Job Status:</label>
              <select
                id="newJobStatus"
                value={newJobStatus}
                onChange={(e) => setNewJobStatus(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
                disabled={isLoading}
              >
                <option value="">-- Select Status --</option>
                <option value="open">open</option>
                <option value="pending-client-approval">pending-client-approval</option>
                <option value="in-progress">in-progress</option>
                <option value="completed">completed</option>
                <option value="disputed">disputed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
            <div>
              <label htmlFor="newEscrowStatus" className="block text-lg font-medium text-gray-800 mb-1">New Escrow Status:</label>
              <select
                id="newEscrowStatus"
                value={newEscrowStatus}
                onChange={(e) => setNewEscrowStatus(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
                disabled={isLoading}
              >
                <option value="">-- Select Escrow Status --</option>
                <option value="pending-deposit">pending-deposit</option>
                <option value="deposited">deposited</option>
                <option value="active">active</option>
                <option value="released">released</option>
                <option value="refunded">refunded</option>
                <option value="disputed">disputed</option>
              </select>
            </div>
            <button
              onClick={handleUpdateJobStatus}
              className="w-full px-6 py-3 bg-secondary-purple text-white font-semibold rounded-md hover:bg-purple-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !selectedJobId || (!newJobStatus && !newEscrowStatus)}
            >
              {isLoading ? 'Updating...' : 'Update Job Status'}
            </button>
          </div>

          <div className="mt-8 p-4 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-primary-blue mb-2">User Suspension/Activation</h3>
            <p className="text-lg text-gray-700 mb-4">
              Advanced user management features like suspension and activation are coming soon.
            </p>
            <button className="px-6 py-3 bg-gray-400 text-white rounded-md cursor-not-allowed">
              Coming Soon
            </button>
          </div>
        </>
      )}

      {/* Resolve Dispute Modal */}
      <ConfirmationModal
        isOpen={showResolveDisputeModal}
        title="Resolve Dispute"
        message={`Resolving dispute for Job ID: ${currentDisputeToResolve?.jobId?._id}. Please provide resolution details and set the final job statuses.`}
        onConfirm={confirmResolveDispute}
        onCancel={() => {
          setShowResolveDisputeModal(false);
          setCurrentDisputeToResolve(null);
        }}
        confirmButtonText="Confirm Resolution"
        isProcessing={isLoading}
      >
        <div className="text-left mt-4">
          <label htmlFor="resolveDetails" className="block text-lg font-medium text-gray-800 mb-1">Resolution Details:</label>
          <textarea
            id="resolveDetails"
            value={resolveDetails}
            onChange={(e) => setResolveDetails(e.target.value)}
            placeholder="Details of how the dispute was resolved..."
            rows="3"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200 mb-4"
            disabled={isLoading}
          ></textarea>

          <label htmlFor="resolveJobStatus" className="block text-lg font-medium text-gray-800 mb-1">Final Job Status:</label>
          <select
            id="resolveJobStatus"
            value={resolveJobStatus}
            onChange={(e) => setResolveJobStatus(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200 mb-4"
            disabled={isLoading}
          >
            <option value="">-- Select Status --</option>
            <option value="open">open</option>
            <option value="pending-client-approval">pending-client-approval</option>
            <option value="in-progress">in-progress</option>
            <option value="completed">completed</option>
            <option value="disputed">disputed</option>
            <option value="cancelled">cancelled</option>
          </select>

          <label htmlFor="resolveEscrowStatus" className="block text-lg font-medium text-gray-800 mb-1">Final Escrow Status:</label>
          <select
            id="resolveEscrowStatus"
            value={resolveEscrowStatus}
            onChange={(e) => setResolveEscrowStatus(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isLoading}
          >
            <option value="">-- Select Escrow Status --</option>
            <option value="pending-deposit">pending-deposit</option>
            <option value="deposited">deposited</option>
            <option value="active">active</option>
            <option value="released">released</option>
            <option value="refunded">refunded</option>
            <option value="disputed">disputed</option>
          </select>
        </div>
      </ConfirmationModal>

      {/* Process Withdrawal Modal */}
      <ConfirmationModal
        isOpen={showProcessWithdrawalModal}
        title="Process Withdrawal Request"
        message={`Are you sure you want to mark this withdrawal request for ${currentWithdrawalToProcess?.usdcAmount} USDC by ${truncateAddress(currentWithdrawalToProcess?.requestorAddress)} as processed? This action confirms the off-chain transfer has been handled.`}
        onConfirm={confirmProcessWithdrawal}
        onCancel={() => setShowProcessWithdrawalModal(false)}
        confirmButtonText="Yes, Process"
        isProcessing={isLoading}
      />
    </div>
  );
};

// --- CustomerSupport Component ---
const CustomerSupport = () => {
  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg my-8 text-center">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Customer Support</h2>
      <p className="text-lg text-gray-700 mb-6">
        We're here to help! If you have any questions, feedback, or need assistance, please reach out to us through the channels below.
      </p>

      <div className="space-y-6">
        <div className="p-4 bg-blue-50 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold text-primary-blue mb-2">Email Support</h3>
          <p className="text-lg text-gray-700">For general inquiries and support:</p>
          <a
            href="mailto:nicodemuskiptoo88@gmail.com"
            className="mt-2 inline-block px-6 py-2 bg-primary-blue text-white rounded-md hover:bg-blue-700 transition duration-300"
          >
            Email Us
          </a>
        </div>

        <div className="p-4 bg-purple-50 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold text-secondary-purple mb-2">Join Our Discord Community</h3>
          <p className="text-lg text-gray-700">Connect with other users and get community support:</p>
          <a
            href="https://discord.gg/7TVd2ZdP9h"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block px-6 py-2 bg-secondary-purple text-white rounded-md hover:bg-purple-700 transition duration-300"
          >
            Join Discord
          </a>
        </div>

        <div className="p-4 bg-green-50 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold text-accent-green mb-2">Check Our Documentation</h3>
          <p className="text-lg text-gray-700">Find answers to common questions in our whitepaper and GitHub:</p>
          <div className="flex justify-center space-x-4 mt-2">
            <a
              href="/WHITEPAPER.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2 bg-accent-green text-white rounded-md hover:bg-green-600 transition duration-300"
            >
              Whitepaper
            </a>
            <a
              href="https://github.com/TarusNicky8/FreelanceFlow/blob/main/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition duration-300"
            >
              GitHub Readme
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- NEW: SearchPage Component ---
const SearchPage = ({ setNotification }) => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('query') || '';
  const [jobs, setJobs] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const performSearch = async () => {
      if (!query) {
        setJobs([]);
        setUsers([]);
        setIsLoading(false);
        setErrorMessage('Please enter a search query.');
        return;
      }

      setIsLoading(true);
      setErrorMessage('');
      try {
        const [jobsResponse, usersResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/search/jobs?query=${encodeURIComponent(query)}`),
          axios.get(`${API_BASE_URL}/api/search/users?query=${encodeURIComponent(query)}`)
        ]);
        setJobs(jobsResponse.data);
        setUsers(usersResponse.data);
        setNotification(`Search results for "${query}" loaded.`, 'info');
      } catch (error) {
        console.error('Error during search:', error);
        setErrorMessage(`Error fetching search results: ${error.message || 'Network error'}`);
        setNotification(`Error fetching search results: ${error.message || 'Network error'}`, 'error');
      } finally {
        setIsLoading(false);
      }
    };
    performSearch();
  }, [query, setNotification]);

  return (
    <div className="max-w-6xl mx-auto p-4 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Search Results for "{query}"</h2>

      {errorMessage && (
        <div className="p-3 mb-4 rounded-md bg-red-100 text-red-700">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-primary-blue">
          <svg className="animate-spin h-6 w-6 mr-3 text-primary-blue" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Searching...
        </div>
      ) : (
        <>
          <h3 className="text-xl font-semibold mt-8 text-primary-blue border-b pb-2">Jobs Found ({jobs.length})</h3>
          {jobs.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {jobs.map((job) => (
                <li key={job._id} className="bg-gray-50 p-4 rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <div className="mb-2 sm:mb-0">
                    <p className="text-lg font-semibold text-gray-800">{job.title} - <span className="text-accent-green">{job.amount} USDC</span></p>
                    <p className="text-sm text-gray-600 truncate max-w-sm">{job.description}</p>
                    <p className="text-xs text-gray-500">
                      Client: {job.client ? (
                        <Link to={`/profile/${job.client}`} className="text-primary-blue hover:underline">
                          {truncateAddress(job.client)}
                        </Link>
                      ) : 'N/A'} | Status: {job.status} | Escrow: {job.escrowStatus}
                    </p>
                    {job.requiredSkills && job.requiredSkills.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">Required Skills: {job.requiredSkills.join(', ')}</p>
                    )}
                  </div>
                  <Link
                    className="px-4 py-2 bg-primary-blue text-white rounded-md hover:bg-blue-700 transition duration-300 flex-shrink-0"
                    to={`/job/${job._id}`}
                  >
                    View Details
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg shadow-sm text-yellow-800 text-center">
              <p className="text-base">No jobs found matching your query.</p>
            </div>
          )}

          <h3 className="text-xl font-semibold mt-8 text-primary-blue border-b pb-2">Users Found ({users.length})</h3>
          {users.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {users.map((user) => (
                <li key={user.address} className="bg-gray-50 p-4 rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <div className="mb-2 sm:mb-0">
                    <p className="text-lg font-semibold text-gray-800">
                      <Link to={`/profile/${user.address}`} className="text-primary-blue hover:underline">
                        {truncateAddress(user.address)}
                      </Link>
                    </p>
                    <p className="text-sm text-gray-600">Role: {user.role || 'N/A'}</p>
                    {user.skills && user.skills.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">Skills: {user.skills.join(', ')}</p>
                    )}
                  </div>
                  <Link
                    className="px-4 py-2 bg-secondary-purple text-white rounded-md hover:bg-purple-700 transition duration-300 flex-shrink-0"
                    to={`/profile/${user.address}`}
                  >
                    View Profile
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg shadow-sm text-yellow-800 text-center">
              <p className="text-base">No users found matching your query.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// --- NEW: SettingsPage Component ---
const SettingsPage = ({ account, setNotification }) => {
  const navigate = useNavigate();
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);

  const handleDeleteAccount = () => {
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteAccount = async () => {
    setShowDeleteConfirmModal(false);
    setIsProcessingDelete(true);
    setNotification('Attempting to delete account...', 'info');

    try {
      // IMPORTANT: Backend deletion logic is NOT implemented in server.js for this demo.
      // This is a placeholder for future functionality.
      // In a real application, you would make an API call here:
      // await axios.delete(`${API_BASE_URL}/api/users/${account}`);

      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call delay

      setNotification('Account deletion initiated (backend logic not yet implemented). Your data will not be removed from the database in this demo.', 'info');
      console.warn('Account deletion backend logic is NOT implemented for this demo.');

      // Optionally redirect after a delay, even if deletion is mocked
      setTimeout(() => {
        navigate('/'); // Redirect to home or login page
      }, 3000);

    } catch (error) {
      console.error('Error during conceptual account deletion:', error);
      setNotification(`Account deletion failed: ${error.message || 'Please try again.'}`, 'error');
    } finally {
      setIsProcessingDelete(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Settings</h2>

      <div className="space-y-6">
        <div className="p-4 bg-blue-50 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold text-primary-blue mb-2">Your Account</h3>
          <p className="text-lg text-gray-700">Connected Wallet: <span className="font-mono text-secondary-purple">{account ? truncateAddress(account) : 'Not connected'}</span></p>
          {account && (
            <Link
              to="/profile"
              className="mt-4 inline-block px-6 py-2 bg-primary-blue text-white rounded-md hover:bg-blue-700 transition duration-300"
            >
              View/Edit Profile
            </Link>
          )}
        </div>

        <div className="p-4 bg-gray-50 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold text-primary-blue mb-2">Notification Preferences</h3>
          <p className="text-lg text-gray-700">Manage how you receive alerts and updates.</p>
          <button className="mt-4 px-6 py-2 bg-gray-400 text-white rounded-md cursor-not-allowed">
            Coming Soon
          </button>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold text-primary-blue mb-2">Theme</h3>
          <p className="text-lg text-gray-700">Customize the look and feel of your FreelanceFlow experience.</p>
          <button className="mt-4 px-6 py-2 bg-gray-400 text-white rounded-md cursor-not-allowed">
            Coming Soon
          </button>
        </div>

        <div className="p-4 bg-red-50 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold text-red-700 mb-2">Danger Zone</h3>
          <p className="text-lg text-red-700 mb-4">Permanently delete your account and all associated data.</p>
          <button
            onClick={handleDeleteAccount}
            className="px-6 py-3 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!account || isProcessingDelete}
          >
            {isProcessingDelete ? 'Processing...' : 'Delete Account (Coming Soon)'}
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirmModal}
        title="Confirm Account Deletion"
        message="Are you absolutely sure you want to delete your account? This action is irreversible. Please note: Account deletion is a future feature and backend logic is not yet implemented in this demo."
        onConfirm={confirmDeleteAccount}
        onCancel={() => setShowDeleteConfirmModal(false)}
        confirmButtonText="Yes, Delete My Account"
        isProcessing={isProcessingDelete}
      />
    </div>
  );
};

// New wrapper component for the main application content
function MainAppContent() {
  const [walletClient, setWalletClient] = useState(null);
  const [publicClient, setPublicClient] = useState(null);
  const [account, setAccount] = useState(null);
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isInfoMenuOpen, setIsInfoMenuOpen] = useState(false);
  const infoMenuRef = useRef(null); // Ref for the More Info dropdown
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Function to set a notification
  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: '', type: '' }); // Clear after 5 seconds
    }, 5000);
  };

  const initializeWeb3Clients = async (connectedAddress) => {
    try {
      const client = createWalletClient({
        chain: liskSepolia,
        transport: custom(window.ethereum),
      });
      const publicClientInstance = createPublicClient({
        chain: liskSepolia,
        transport: http(liskSepolia.rpcUrls.default.http[0]),
      });
      setWalletClient(client);
      setPublicClient(publicClientInstance);
      setAccount(connectedAddress);
      showNotification(`Wallet connected: ${truncateAddress(connectedAddress)}`, 'success');
    } catch (error) {
      console.error("Error initializing Web3 clients:", error);
      showNotification(`Error initializing wallet: ${error.message}`, 'error');
      setAccount(null);
      setWalletClient(null);
      setPublicClient(null);
    }
  };

  const connectWallet = async () => {
    showNotification('Connecting wallet...', 'info');
    try {
      if (typeof window.ethereum === 'undefined') {
        showNotification('MetaMask or similar wallet not detected! Please install a Web3 wallet.', 'error');
        return;
      }

      // Request accounts directly from MetaMask
      const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      await initializeWeb3Clients(address); // Initialize clients after getting address
    } catch (error) {
      console.error("Error connecting wallet:", error);
      if (error.code === 4001) {
        showNotification('Wallet connection rejected by user.', 'error');
      } else {
        showNotification(`Error connecting wallet: ${error.message}`, 'error');
      }
      setAccount(null);
      setWalletClient(null);
      setPublicClient(null);
    }
  };

  // Listen for account changes (e.g., user changes account in MetaMask)
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = async (accounts) => {
        if (accounts.length > 0) {
          await initializeWeb3Clients(accounts[0]);
        } else {
          setAccount(null);
          setWalletClient(null);
          setPublicClient(null);
          showNotification('Wallet disconnected.', 'info');
        }
      };

      // Initial check for already connected account on component mount
      window.ethereum.request({ method: 'eth_accounts' })
        .then(async (accounts) => {
          if (accounts.length > 0) {
            await initializeWeb3Clients(accounts[0]);
          } else {
            showNotification('No wallet connected initially.', 'info');
          }
        })
        .catch(error => console.error("Error checking initial accounts:", error));

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', (chainId) => {
        // Re-initialize clients if chain changes to ensure they are bound to the new chain
        // This also implicitly updates the account if MetaMask changes it on chain switch
        window.ethereum.request({ method: 'eth_accounts' })
          .then(async (accounts) => {
            if (accounts.length > 0) {
              await initializeWeb3Clients(accounts[0]);
            } else {
              setAccount(null);
              setWalletClient(null);
              setPublicClient(null);
              showNotification('Wallet disconnected or chain changed to unknown network.', 'info');
            }
          })
          .catch(error => console.error("Error on chainChanged accounts check:", error));
      });


      // Cleanup listener on component unmount
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', () => {}); // Remove anonymous function listener
      };
    }
  }, []); // Empty dependency array means this runs once on mount

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    if (isInfoMenuOpen) setIsInfoMenuOpen(false); // Close info menu if mobile menu is opened
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (infoMenuRef.current && !infoMenuRef.current.contains(event.target)) {
        setIsInfoMenuOpen(false);
      }
    };

    if (isInfoMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isInfoMenuOpen]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?query=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery(''); // Clear search input after navigating
    } else {
      showNotification('Please enter a search query.', 'error');
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen font-sans text-gray-800">

      <header className="bg-primary-blue text-white p-4 shadow-lg sticky top-0 z-50 transition duration-300 ease-in-out">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            <img src={logo} alt="FreelanceFlow Logo" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white" />
            <span className="text-lg sm:text-2xl font-bold whitespace-nowrap">FreelanceFlow</span>
          </Link>
          <nav className="hidden md:flex flex-1 justify-between items-center ml-4 sm:ml-8"> {/* Adjusted ml */}
            <div className="flex items-center gap-x-4 lg:gap-x-6 text-lg"> {/* Adjusted gap-x */}
              <Link to="/" className="hover:text-blue-200 transition duration-300 ease-in-out">Home</Link>
              <Link to="/dashboard" className="hover:text-blue-200 transition duration-300 ease-in-out">Dashboard</Link>
              <Link to="/profile" className="hover:text-blue-200 transition duration-300 ease-in-out">Profile</Link>
              <Link to="/post-job" className="hover:text-blue-200 transition duration-300 ease-in-out">Post Job</Link>
              <Link to="/browse-jobs" className="hover:text-blue-200 transition duration-300 ease-in-out">Browse Jobs</Link>
            </div>
            <div className="flex items-center gap-x-3 sm:gap-x-4"> {/* Adjusted gap-x */}
              {/* Search Input in Header */}
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search jobs or users..."
                  className="pl-4 pr-10 py-2 rounded-full bg-blue-700 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white focus:bg-blue-600 transition duration-300 text-sm w-40 sm:w-48"
                />
                <button type="submit" className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-blue-200 hover:text-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </form>

              <div className="relative" ref={infoMenuRef}> {/* Added ref here */}
                <button
                  onClick={() => setIsInfoMenuOpen(!isInfoMenuOpen)}
                  className="px-3 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition duration-300 ease-in-out flex items-center text-sm sm:text-base"
                >
                  More Info
                  <svg className={`ml-1 sm:ml-2 h-4 w-4 transform transition-transform ${isInfoMenuOpen ? 'rotate-180' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isInfoMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                    <Link to="/deposit-funds" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Deposit Funds</Link>
                    <Link to="/cross-chain-transfer" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Cross-Chain Transfer</Link>
                    <Link to="/dispute-resolution" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Dispute Resolution</Link>
                    <Link to="/withdraw" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Withdraw Funds</Link>
                    <Link to="/settings" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Settings</Link>
                    <Link to="/support" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Customer Support</Link>
                    <a href="#about" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">About</a>
                    <a href="#vision" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Vision</a>
                    <a href="#mission" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Mission</a>
                    <a href="#features" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Features</a>
                    <a href="#team" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Team</a>
                    <a href="#roadmap" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Roadmap</a>
                    <a href="/WHITEPAPER.pdf" target="_blank" rel="noopener noreferrer" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Whitepaper</a>
                    <a href="#contact" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Contact</a>
                  </div>
                )}
              </div>
              {/* Wallet Connect Button in Header */}
              <button
                onClick={connectWallet}
                className="px-4 py-2 bg-accent-green text-white font-semibold rounded-md shadow-lg hover:bg-green-600 transition duration-300 transform hover:scale-105 ml-2 sm:ml-4" 
              >
                {account ? truncateAddress(account) : 'Connect Wallet'}
              </button>
            </div>
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
          <nav className="md:hidden bg-primary-blue pb-2 pt-1 overflow-y-auto max-h-screen">
            <ul className="flex flex-col items-center space-y-3 text-lg py-2">
              {/* Search Input for Mobile */}
              <li className="w-full px-4 mb-3">
                <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search jobs or users..."
                    className="pl-4 pr-10 py-2 rounded-full bg-blue-700 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white focus:bg-blue-600 transition duration-300 text-sm w-full"
                  />
                  <button type="submit" className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-blue-200 hover:text-white">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </form>
              </li>
              <li><Link to="/" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Home</Link></li>
              <li><Link to="/dashboard" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Dashboard</Link></li>
              <li><Link to="/profile" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Profile</Link></li>
              <li><Link to="/post-job" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Post Job</Link></li>
              <li><Link to="/browse-jobs" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Browse Jobs</Link></li>
              <li className="text-gray-300 text-sm mt-4 mb-2">--- Information & Demos ---</li>
              <li><Link to="/deposit-funds" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Deposit Funds</Link></li>
              <li><Link to="/cross-chain-transfer" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Cross-Chain Transfer</Link></li>
              <li><Link to="/dispute-resolution" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Dispute Resolution</Link></li>
              <li><Link to="/withdraw" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Withdraw Funds</Link></li>
              <li><Link to="/settings" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Settings</Link></li>
              <li><Link to="/support" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Customer Support</Link></li>
              <li><a href="#about" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">About</a></li>
              <li><a href="#vision" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Vision</a></li>
              <li><a href="#mission" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Mission</a></li>
              <li><a href="#features" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Features</a></li>
              <li><a href="#team" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Team</a></li>
              <li><a href="#roadmap" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Roadmap</a></li>
              <li><a href="/WHITEPAPER.pdf" target="_blank" rel="noopener noreferrer" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Whitepaper</a></li>
              <li><a href="#contact" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Contact</a></li>
              {/* Wallet Connect Button for Mobile Menu */}
              <li className="w-full px-4 pt-4">
                <button
                  onClick={connectWallet}
                  className="w-full px-6 py-3 bg-accent-green text-white font-semibold rounded-md shadow-lg hover:bg-green-600 transition duration-300 transform hover:scale-105"
                >
                  {account ? truncateAddress(account) : 'Connect Wallet'}
                </button>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <Routes>
        <Route path="/" element={
          <>
            <section className="relative bg-gradient-to-br from-primary-blue to-secondary-purple text-white py-24 text-center overflow-hidden animate-gradient">
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
              </div>
            </section>

            <section id="how-it-works" className="py-16 sm:py-20 bg-white text-center shadow-inner">
              <div className="max-w-6xl mx-auto px-4">
                <h2 className="text-3xl sm:text-4xl font-bold text-primary-blue mb-8">How FreelanceFlow Works</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
                  <div className="p-6 bg-gray-50 rounded-lg shadow-md text-center">
                    <div className="text-5xl text-accent-green mb-4">1</div>
                    <h3 className="text-xl font-semibold text-secondary-purple mb-2">Client Posts Job & Funds Escrow</h3>
                    <p className="text-base text-gray-700">A client posts a job with a clear description and a set USDC amount. They then deposit the full job amount into a secure smart contract escrow.</p>
                  </div>
                  <div className="p-6 bg-gray-50 rounded-lg shadow-md text-center">
                    <div className="text-5xl text-accent-green mb-4">2</div>
                    <h3 className="text-xl font-semibold text-secondary-purple mb-2">Freelancer Applies & Works</h3>
                    <p className="text-base text-gray-700">Interested freelancers apply. The client selects a freelancer, who then accepts the assignment and begins working on the task.</p>
                  </div>
                  <div className="p-6 bg-gray-50 rounded-lg shadow-md text-center">
                    <div className="text-5xl text-accent-green mb-4">3</div>
                    <h3 className="text-xl font-semibold text-secondary-purple mb-2">Funds Released or Disputed</h3>
                    <p className="text-base text-gray-700">Once the job is completed, the freelancer marks it as done. The client verifies the work and releases the USDC from escrow to the freelancer. In case of disagreement, a dispute can be initiated.</p>
                  </div>
                </div>
                <p className="text-lg text-gray-700 mt-8 max-w-3xl mx-auto">
                  This ensures fair and transparent transactions, protecting both clients and freelancers.
                </p>
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
                <div className="flex flex-col md:flex-row justify-center items-start md:space-x-8 space-y-12 md:space-y-0">

                  <div className="flex flex-col items-center flex-1">
                    <img
                      src={process.env.PUBLIC_URL + "/images/Nick copy.webp"}
                      alt="Nicodemus Kiptoo Profile"
                      className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover object-top shadow-md mb-4 border-4 border-secondary-purple"
                    />
                    <h3 className="text-xl sm:text-2xl font-semibold text-secondary-purple">Nicodemus</h3>
                    <p className="text-base sm:text-lg text-gray-700 mt-2 max-w-xs text-center">
                      Founder. Nicodemus leads the effective use of innovative solutions that streamline work and transactions for the African gig economy.
                    </p>

                    <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
                      <a href="https://www.linkedin.com/in/nicodemus-kiptoo-4276b9364/" target="_blank" rel="noopener noreferrer" className="hover:text-primary-blue transition duration-300">LinkedIn</a>
                      <a href="https://x.com/nicodemuskipto0" target="_blank" rel="noopener noreferrer" className="hover:text-primary-blue transition duration-300">X</a>
                    </div>
                  </div>

                  <div className="flex flex-col items-center flex-1">
                    <img
                      src={process.env.PUBLIC_URL + "/images/Ashley.webp"}
                      alt="Hacker Profile"
                      className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover object-top shadow-md mb-4 border-4 border-secondary-purple"
                    />
                    <h3 className="text-xl sm:text-2xl font-semibold text-secondary-purple">Ashley</h3>
                    <p className="text-base sm:text-lg text-gray-700 mt-2 max-w-xs text-center">
                      Growth hacker. Ashley focuses on strategies that help freelancers have access to more secure gigs and diverse talent across the continent.
                    </p>

                    <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
                      <a href="https://www.linkedin.com/in/ashley-jepchirchir-9222982a9/" target="_blank" rel="noopener noreferrer" className="hover:text-primary-blue transition duration-300">LinkedIn</a>
                      <a href="https://x.com/A_jepchirchir" target="_blank" rel="noopener noreferrer" className="hover:text-primary-blue transition duration-300">X</a>
                    </div>
                  </div>

                  <div className="flex flex-col items-center flex-1">
                    <img
                      src={process.env.PUBLIC_URL + "/images/Joan.jpg"}
                      alt="CMO Profile"
                      className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover object-top shadow-md mb-4 border-4 border-secondary-purple"
                    />
                    <h3 className="text-xl sm:text-2xl font-semibold text-secondary-purple">Joan</h3>
                    <p className="text-base sm:text-lg text-gray-700 mt-2 max-w-xs text-center">
                      Business developer. Joan focuses on guiding market entry and growth strategies to connect FreelanceFlow with a global audience.
                    </p>

                    <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
                      <a href="https://www.linkedin.com/in/eng-joan-jerop-810106133/" target="_blank" rel="noopener noreferrer" className="hover:text-primary-blue transition duration-300">LinkedIn</a>
                      <a href="https://x.com/jeropcrypto" target="_blank" rel="noopener noreferrer" className="hover:text-primary-blue transition duration-300">X</a>
                    </div>
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
                    href="/WHITEPAPER.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-8 py-3 bg-secondary-purple text-white font-semibold rounded-lg hover:bg-purple-700 shadow-lg transition duration-300"
                  >
                    Read the Whitepaper
                  </a>
                </div>
              </section>

              <section id="contact" className="py-12 sm:py-16 bg-primary-blue text-white text-center pb-20">
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
            </>
          } />
          <Route path="/dashboard" element={<Dashboard account={account} />} />
          <Route path="/profile/:address?" element={<Profile account={account} />} />
          <Route path="/job/:id" element={<JobDetails account={account} publicClient={publicClient} walletClient={walletClient} setNotification={showNotification} />} />
          <Route path="/deposit-funds" element={
            <DivviIntegration
              account={account}
              walletClient={walletClient}
              publicClient={publicClient}
              setNotification={showNotification}
            />
          } />
          <Route path="/post-job" element={<PostJob account={account} setNotification={showNotification} />} />
          <Route path="/browse-jobs" element={<BrowseJobs setNotification={showNotification} />} />
          <Route path="/cross-chain-transfer" element={<CrossChainIntegration account={account} publicClient={publicClient} walletClient={walletClient} setNotification={showNotification} />} />
          <Route path="/dispute-resolution" element={<DisputeResolution account={account} setNotification={showNotification} />} />
          <Route path="/withdraw" element={<Withdrawal account={account} setNotification={showNotification} />} />
          <Route path="/admin" element={<AdminDashboard setNotification={showNotification} />} />
          <Route path="/support" element={<CustomerSupport />} />
          <Route path="/search" element={<SearchPage setNotification={showNotification} />} />
          <Route path="/settings" element={<SettingsPage account={account} setNotification={showNotification} />} />
        </Routes>
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ message: '', type: '' })} />
      </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <MainAppContent />
    </BrowserRouter>
  );
}

export default App;
