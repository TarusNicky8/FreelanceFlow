import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { createWalletClient, custom, parseUnits, encodeFunctionData, createPublicClient, http, formatUnits } from 'viem';
import { isAddress } from 'viem'; // Import isAddress for validation
import { getAddress } from 'viem'; // Import getAddress for checksumming
// Removed: import { useAccount, useNetwork } from 'wagmi'; // If you're using wagmi for wallet connection, this would be helpful. Assuming not for now.

// import { getDataSuffix, submitReferral } from '@divvi/referral-sdk'; // Uncomment if Divvi is fully integrated
import logo from './App icon.svg';

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
    default: { http: ['https://rpc.sepolia-api.lisk.com'] }, // Corrected Lisk Sepolia RPC URL
    public: { http: ['https://rpc.sepolia-api.lisk.com'] }, // Corrected Lisk Sepolia RPC URL
  },
  blockExplorers: {
    default: { name: 'Lisk Blockscout', url: 'https://sepolia-blockscout.lisk.com/' },
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
const usdcContractAddress = '0x0a216126b423E3bdf6eAcf8901e46a13915Fc153';
const escrowContractAddress = '0xB239CF4B51D8F9761176c7Cf4AA54D172a74B672';

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

// --- DivviIntegration Component (Now uses depositGeneral) ---
const DivviIntegration = ({ account, walletClient, publicClient, status, setStatus, amountToDeposit, setAmountToDeposit }) => {
  const handleDepositUSDCGeneral = async () => {
    if (!account || !walletClient || !publicClient) {
      setStatus('Please connect your wallet first.');
      return;
    }
    if (isNaN(parseFloat(amountToDeposit)) || parseFloat(amountToDeposit) <= 0) {
      setStatus('Please enter a valid amount to deposit.');
      return;
    }

    setStatus('Initiating general USDC deposit with Divvi tracking...');
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

      setStatus('Approving USDC for Escrow contract...');
      const approveTxHash = await walletClient.sendTransaction({
        account,
        to: usdcContractAddress,
        data: approveCallData,
      });

      setStatus(`Approval transaction sent! Hash: ${approveTxHash}. Waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
      setStatus('USDC Approved. Now initiating general deposit...');

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

      setStatus(`Deposit transaction sent! Hash: ${depositTxHash}. Waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash: depositTxHash });
      setStatus('General deposit confirmed. Now reporting referral to Divvi...');

      // --- Divvi SDK Integration (uncomment to enable) ---
      // const chainId = await walletClient.getChainId();
      // await submitReferral({
      //   txHash: depositTxHash,
      //   chainId,
      // });
      // ---------------------------------------------------

      setStatus(`General deposit successful and Divvi referral (mocked) completed! Tx Hash: ${depositTxHash}`);
      console.log('Divvi referral (mocked) completed!');

    } catch (error) {
      console.error("Error during general USDC deposit or Divvi integration:", error);
      setStatus(`Transaction failed or Divvi submission error: ${error.message}`);
    }
  };

  return (
    <section className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg my-8 text-center">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Divvi Integration Demo: General Deposit USDC</h2>
      <p className="text-lg text-gray-700 mb-6">
        This section demonstrates the secure USDC deposit process for general funds, enhanced with Divvi tracking for transparent on-chain activity.
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
      <p className={`mb-4 text-center text-lg ${status.includes('Error') || status.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>{status}</p>
      {account ? (
        <button
          onClick={handleDepositUSDCGeneral}
          className="px-8 py-4 bg-secondary-purple text-white font-semibold rounded-full shadow-lg hover:bg-purple-700 transition duration-300 transform hover:scale-105"
        >
          Deposit USDC to Escrow (General Funds)
        </button>
      ) : (
        <p className="text-lg text-gray-600">Connect your wallet in the header to deposit USDC.</p>
      )}
    </section>
  );
};

// --- Profile Component ---
const Profile = ({ account }) => {
  const [profile, setProfile] = useState({ skills: [], portfolio: [], rating: 0, role: 'freelancer' }); // Default role
  const [skillsInput, setSkillsInput] = useState('');
  const [portfolioInput, setPortfolioInput] = useState('');
  const [selectedRole, setSelectedRole] = useState('freelancer'); // State for role selection
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!account) {
        setStatusMessage('Please connect your wallet to view/edit profile.');
        setIsError(true);
        return;
      }
      setIsLoading(true);
      setStatusMessage('Loading profile...');
      setIsError(false);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/users/${account}`);
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
  }, [account]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!account) {
      setStatusMessage('Wallet not connected. Cannot save profile.');
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

  return (
    <div className="max-w-5xl mx-auto p-4 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Freelancer Profile</h2>

      <p className="text-lg text-gray-700 mb-4">
        Wallet: <span className="font-mono text-secondary-purple">{account || 'Not connected'}</span>
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
            <span className="text-sm text-gray-500 ml-2">(based on completed jobs)</span>
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

      <div className="mt-8 p-6 bg-gray-50 rounded-lg shadow-inner">
        <h3 className="text-xl font-semibold text-primary-blue mb-3 border-b pb-2">Current Profile Details</h3>
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
      </div>
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
            <div className="mt-4 p-4 bg-red-50 rounded-lg shadow-sm text-red-700">
              <p className="text-base">Profile not found. Please create your profile to get started!</p>
              <Link
                className="mt-4 px-6 py-2 bg-primary-blue text-white rounded-md hover:bg-blue-700 transition duration-300 inline-block"
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
                    <p className="text-sm text-gray-600">Freelancer: {job.freelancer ? job.freelancer.substring(0, 6) + '...' + job.freelancer.substring(job.freelancer.length - 4) : 'Unassigned'} | Status: {job.status} | Escrow: {job.escrowStatus}</p>
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
                    <p className="text-sm text-gray-600">Client: {job.client ? job.client.substring(0, 6) + '...' + job.client.substring(job.client.length - 4) : 'N/A'} | Status: {job.status} | Escrow: {job.escrowStatus}</p>
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
const JobDetails = ({ account, publicClient, walletClient }) => {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [clientUsdcBalance, setClientUsdcBalance] = useState(0); // For client to check balance before funding
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingTx, setIsProcessingTx] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const navigate = useNavigate();

  const fetchJobAndBalance = async () => {
    setIsLoading(true);
    setStatusMessage('');
    setIsError(false);
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
      setStatusMessage(`Error loading job details: ${error.message || 'Network error'}`);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobAndBalance();
  }, [id, account, publicClient]); // Re-fetch if ID, account, or publicClient changes

  // Helper to determine if current user is client or freelancer
  const isClient = account && job && job.client.toLowerCase() === account.toLowerCase();
  const isFreelancer = account && job && job.freelancer && job.freelancer.toLowerCase() === account.toLowerCase();


  // --- New: Handle Funding Escrow for a Job ---
  const handleFundEscrow = async () => {
    if (!account || !walletClient || !publicClient || !job) {
      setStatusMessage('Wallet not connected or job data missing.');
      setIsError(true);
      return;
    }
    if (!isClient) {
      setStatusMessage('Only the client can fund this job.');
      setIsError(true);
      return;
    }
    if (job.escrowStatus !== 'pending-deposit') {
      setStatusMessage('Job is not in a state to be funded.');
      setIsError(true);
      return;
    }
    if (clientUsdcBalance < job.amount) {
      setStatusMessage('Insufficient USDC balance to fund this job.');
      setIsError(true);
      return;
    }

    setIsProcessingTx(true);
    setStatusMessage('Initiating fund deposit for job escrow...');
    setIsError(false);

    try {
      const amountInSmallestUnit = parseUnits(job.amount.toString(), 6);

      // 1. Approve USDC for the Escrow contract
      const approveCallData = encodeFunctionData({
        abi: usdcAbi,
        functionName: 'approve',
        args: [escrowContractAddress, amountInSmallestUnit],
      });

      setStatusMessage('Approving USDC for Escrow contract...');
      const approveTxHash = await walletClient.sendTransaction({
        account,
        to: usdcContractAddress,
        data: approveCallData,
      });

      setStatusMessage(`Approval transaction sent! Hash: ${approveTxHash}. Waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
      setStatusMessage('USDC Approved. Now depositing funds to job escrow...');

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

      setStatusMessage(`Deposit transaction sent! Hash: ${depositTxHash}. Waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash: depositTxHash });
      setStatusMessage('Job funds deposited successfully on-chain!');

      // 3. Update backend with deposit confirmation
      await axios.put(`${API_BASE_URL}/api/jobs/${id}/deposit-confirmed`, {
        clientAddress: account,
        depositTxHash: depositTxHash,
      });

      // Update local job state
      setJob(prevJob => ({ ...prevJob, escrowStatus: 'deposited' }));
      setStatusMessage('Job funds confirmed and updated in backend!');
      setIsError(false);
      fetchJobAndBalance(); // Re-fetch to update balance and job state

    } catch (error) {
      console.error("Error funding job escrow:", error);
      setStatusMessage(`Transaction failed or error funding job: ${error.message || 'Please try again.'}`);
      setIsError(true);
    } finally {
      setIsProcessingTx(false);
    }
  };

  // --- Handle Freelancer Accepting Job ---
  const handleAccept = async () => {
    if (!account) {
      setStatusMessage('Please connect your wallet to accept jobs.');
      setIsError(true);
      return;
    }
    if (!job) {
      setStatusMessage('Job data not available.');
      setIsError(true);
      return;
    }
    if (job.status !== 'open' || job.escrowStatus !== 'deposited') {
      setStatusMessage('Job is not open or not funded for acceptance.');
      setIsError(true);
      return;
    }

    setIsProcessingTx(true);
    setStatusMessage('Accepting job...');
    setIsError(false);
    try {
      // Update backend: set freelancer and change status to pending-client-approval
      await axios.put(`${API_BASE_URL}/api/jobs/${id}/accept`, { freelancerAddress: account });

      // Update local job state
      setJob(prevJob => ({ ...prevJob, status: 'pending-client-approval', freelancer: account }));
      setStatusMessage('Job accepted! Waiting for client approval.');
      setIsError(false);

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Error accepting job:', error);
      setStatusMessage(`Error accepting job: ${error.message || 'Please try again.'}`);
      setIsError(true);
    } finally {
      setIsProcessingTx(false);
    }
  };

  // --- Handle Client Approving Freelancer ---
  const handleApproveFreelancer = async () => {
    if (!account || !job || !isClient) {
      setStatusMessage('Wallet not connected or you are not the client.');
      setIsError(true);
      return;
    }
    if (job.status !== 'pending-client-approval') {
      setStatusMessage('Job is not in pending approval state.');
      setIsError(true);
      return;
    }

    setIsProcessingTx(true);
    setStatusMessage('Approving freelancer...');
    setIsError(false);
    try {
      await axios.put(`${API_BASE_URL}/api/jobs/${id}/approve-freelancer`, { clientAddress: account });

      setJob(prevJob => ({ ...prevJob, status: 'in-progress', clientApprovedFreelancer: true }));
      setStatusMessage('Freelancer approved! Job is now in progress.');
      setIsError(false);

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Error approving freelancer:', error);
      setStatusMessage(`Error approving freelancer: ${error.message || 'Please try again.'}`);
      setIsError(true);
    } finally {
      setIsProcessingTx(false);
    }
  };

  // --- Handle Client Rejecting Freelancer ---
  const handleRejectFreelancer = async () => {
    if (!account || !job || !isClient) {
      setStatusMessage('Wallet not connected or you are not the client.');
      setIsError(true);
      return;
    }
    if (job.status !== 'pending-client-approval') {
      setStatusMessage('Job is not in pending approval state.');
      setIsError(true);
      return;
    }

    setIsProcessingTx(true);
    setStatusMessage('Rejecting freelancer...');
    setIsError(false);
    try {
      await axios.put(`${API_BASE_URL}/api/jobs/${id}/reject-freelancer`, { clientAddress: account });

      setJob(prevJob => ({ ...prevJob, status: 'open', freelancer: null, clientApprovedFreelancer: false }));
      setStatusMessage('Freelancer rejected. Job is now open again.');
      setIsError(false);

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Error rejecting freelancer:', error);
      setStatusMessage(`Error rejecting freelancer: ${error.message || 'Please try again.'}`);
      setIsError(true);
    } finally {
      setIsProcessingTx(false);
    }
  };

  // --- Handle Freelancer Marking Job as Completed ---
  const handleMarkCompleted = async () => {
    if (!account || !job || !isFreelancer) {
      setStatusMessage('Wallet not connected or you are not the assigned freelancer.');
      setIsError(true);
      return;
    }
    if (job.status !== 'in-progress') {
      setStatusMessage('Job is not in progress.');
      setIsError(true);
      return;
    }

    setIsProcessingTx(true);
    setStatusMessage('Marking job as completed...');
    setIsError(false);
    try {
      await axios.put(`${API_BASE_URL}/api/jobs/${id}/mark-completed`, { freelancerAddress: account });

      setJob(prevJob => ({ ...prevJob, status: 'completed' })); // Frontend status update
      setStatusMessage('Job marked as completed! Client can now release funds.');
      setIsError(false);

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Error marking job as completed:', error);
      setStatusMessage(`Error marking job as completed: ${error.message || 'Please try again.'}`);
      setIsError(true);
    } finally {
      setIsProcessingTx(false);
    }
  };


  // --- Handle Client Releasing Funds (On-chain) ---
  const handleReleaseFunds = async () => {
    if (!account || !publicClient || !walletClient || !job) {
      setStatusMessage('Wallet not connected or blockchain clients not ready.');
      setIsError(true);
      return;
    }
    if (!isClient) {
      setStatusMessage('Only the client can release funds.');
      setIsError(true);
      return;
    }
    if (job.status !== 'completed' || job.escrowStatus !== 'active') { // Job must be marked completed by freelancer, escrow active
      setStatusMessage('Job is not in a state for fund release (must be completed and escrow active).');
      setIsError(true);
      return;
    }

    setIsProcessingTx(true);
    setStatusMessage('Initiating fund release on-chain...');
    setIsError(false);
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

      setStatusMessage(`Transaction sent! Hash: ${txHash}. Waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      // Update backend after successful on-chain release
      await axios.put(`${API_BASE_URL}/api/jobs/${id}/release-confirmed`, {
        clientAddress: account,
        completionTxHash: txHash,
      });

      setJob(prevJob => ({ ...prevJob, escrowStatus: 'released' })); // Update local escrow status
      setStatusMessage('Funds released successfully, job marked as completed!');
      setIsError(false);

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Error releasing funds:', error);
      setStatusMessage(`Transaction failed or error releasing funds: ${error.message || 'Please try again.'}`);
      setIsError(true);
    } finally {
      setIsProcessingTx(false);
    }
  };

  // --- Handle Client Refunding Funds (On-chain) ---
  const handleRefundFunds = async () => {
    if (!account || !publicClient || !walletClient || !job) {
      setStatusMessage('Wallet not connected or blockchain clients not ready.');
      setIsError(true);
      return;
    }
    if (!isClient) {
      setStatusMessage('Only the client can refund funds.');
      setIsError(true);
      return;
    }
    if (job.escrowStatus !== 'active' && job.escrowStatus !== 'disputed') {
      setStatusMessage('Job is not in an active or disputed state for refund.');
      setIsError(true);
      return;
    }

    setIsProcessingTx(true);
    setStatusMessage('Initiating fund refund on-chain...');
    setIsError(false);
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

      setStatusMessage(`Transaction sent! Hash: ${txHash}. Waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      // Update backend after successful on-chain refund
      await axios.put(`${API_BASE_URL}/api/jobs/${id}/refund-confirmed`, {
        clientAddress: account,
      });

      setJob(prevJob => ({ ...prevJob, escrowStatus: 'refunded', status: 'cancelled' })); // Update local statuses
      setStatusMessage('Funds refunded successfully, job marked as cancelled!');
      setIsError(false);

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Error refunding funds:', error);
      setStatusMessage(`Transaction failed or error refunding funds: ${error.message || 'Please try again.'}`);
      setIsError(true);
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
        {statusMessage && (
          <div className="p-3 mt-4 rounded-md bg-red-100 text-red-700">
            {statusMessage}
          </div>
        )}
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
  const showAcceptJobButton = !isClient && !job.freelancer && job.status === 'open' && job.escrowStatus === 'deposited';
  const showApproveRejectButtons = isClient && job.status === 'pending-client-approval';
  const showMarkCompletedButton = isFreelancer && job.status === 'in-progress';
  const showReleaseFundsButton = isClient && job.status === 'completed' && job.escrowStatus === 'active'; // Client releases after freelancer marks completed
  const showRefundFundsButton = isClient && (job.escrowStatus === 'active' || job.escrowStatus === 'disputed'); // Client can refund if active or disputed


  return (
    <div className="max-w-5xl mx-auto p-4 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">{job.title}</h2>

      {statusMessage && (
        <div className={`p-3 mb-4 rounded-md ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {statusMessage}
        </div>
      )}

      <div className="space-y-3 text-gray-700 mb-6">
        <p className="text-lg">Description: {job.description}</p>
        <p className="text-lg">Amount: <span className="font-semibold text-accent-green">{job.amount} USDC</span></p>
        <p className="text-lg">Client: <span className="font-mono text-secondary-purple">{job.client ? job.client.substring(0, 6) + '...' + job.client.substring(job.client.length - 4) : 'N/A'}</span></p>
        <p className="text-lg">Freelancer: <span className="font-mono text-secondary-purple">{job.freelancer ? job.freelancer.substring(0, 6) + '...' + job.freelancer.substring(job.freelancer.length - 4) : 'Not assigned'}</span></p>
        <p className="text-lg">Current Status: <span className={`font-semibold ${job.status === 'open' ? 'text-blue-600' : job.status === 'pending-client-approval' ? 'text-orange-500' : job.status === 'in-progress' ? 'text-yellow-600' : job.status === 'completed' ? 'text-green-600' : job.status === 'disputed' ? 'text-red-600' : 'text-gray-600'}`}>{job.status}</span></p>
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

        {/* Freelancer: Accept Job Button */}
        {showAcceptJobButton && (
          <button
            className="px-6 py-3 bg-secondary-purple text-white font-semibold rounded-md hover:bg-purple-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAccept}
            disabled={isProcessingTx || !account}
          >
            {isProcessingTx ? 'Accepting...' : 'Accept Job'}
          </button>
        )}

        {/* Client: Approve/Reject Freelancer Buttons */}
        {showApproveRejectButtons && (
          <>
            <button
              className="px-6 py-3 bg-accent-green text-white font-semibold rounded-md hover:bg-green-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleApproveFreelancer}
              disabled={isProcessingTx || !account}
            >
              {isProcessingTx ? 'Approving...' : 'Approve Freelancer'}
            </button>
            <button
              className="px-6 py-3 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleRejectFreelancer}
              disabled={isProcessingTx || !account}
            >
              {isProcessingTx ? 'Rejecting...' : 'Reject Freelancer'}
            </button>
          </>
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
      </div>

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
const PostJob = ({ account }) => {
  const navigate = useNavigate();
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobAmount, setJobAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handlePostJob = async (e) => {
    e.preventDefault();
    if (!account) {
      setStatusMessage('Please connect your wallet to post a job.');
      setIsError(true);
      return;
    }
    if (!jobTitle || !jobDescription || !jobAmount || isNaN(parseFloat(jobAmount)) || parseFloat(jobAmount) <= 0) {
      setStatusMessage('Please fill all fields with valid data.');
      setIsError(true);
      return;
    }

    setIsLoading(true);
    setStatusMessage('Posting job...');
    setIsError(false);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/jobs`, {
        title: jobTitle,
        description: jobDescription,
        amount: parseFloat(jobAmount),
        client: account,
        status: 'open', // Initial status
        escrowStatus: 'pending-deposit' // Initial escrow status
      });

      setStatusMessage('Job posted successfully! Redirecting to job details to fund escrow.');
      setIsError(false);
      setJobTitle('');
      setJobDescription('');
      setJobAmount('');

      setTimeout(() => {
        navigate(`/job/${response.data._id}`); // Navigate to the newly posted job's details page
      }, 2000);

    } catch (error) {
      console.error('Error posting job:', error);
      setStatusMessage(`Error posting job: ${error.message || 'Please try again.'}`);
      setIsError(true);
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
        <button
          type="submit"
          className="w-full px-6 py-3 bg-secondary-purple text-white font-semibold rounded-md hover:bg-purple-700 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading || !account}
        >
          {isLoading ? 'Posting...' : 'Post Job'}
        </button>
      </form>
    </div>
  );
};

// --- BrowseJobs Component ---
const BrowseJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchJobs = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        // Fetch jobs that are 'open' and 'deposited'
        const response = await axios.get(`${API_BASE_URL}/api/jobs?status=open&escrowStatus=deposited`);
        setJobs(response.data);
      } catch (error) {
        console.error('Error fetching jobs:', error);
        setErrorMessage(`Error loading jobs: ${error.message || 'Network error'}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchJobs();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Browse Available Jobs</h2>

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
                    <p className="text-xs text-gray-500">Client: {job.client ? job.client.substring(0, 6) + '...' + job.client.substring(job.client.length - 4) : 'N/A'} | Status: {job.status} | Escrow: {job.escrowStatus}</p>
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
              <p className="text-base">No open jobs found at the moment. Check back later!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// --- CrossChainIntegration Component ---
const CrossChainIntegration = ({ account, walletClient, publicClient }) => {
  const [sourceChain, setSourceChain] = useState('Lisk Sepolia');
  const [destinationChain, setDestinationChain] = useState('Optimism/Base (Mock)');
  const [transferAmount, setTransferAmount] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleCrossChainTransfer = async () => {
    if (!account || !walletClient || !publicClient) {
      setStatusMessage('Please connect your wallet first.');
      setIsError(true);
      return;
    }
    if (isNaN(parseFloat(transferAmount)) || parseFloat(transferAmount) <= 0) {
      setStatusMessage('Please enter a valid amount to transfer.');
      setIsError(true);
      return;
    }

    setIsProcessing(true);
    setStatusMessage(`Initiating cross-chain transfer of ${transferAmount} USDC from ${sourceChain} to ${destinationChain}...`);
    setIsError(false);

    try {
      // --- Mocking LayerZero Integration ---
      // In a real LayerZero integration, you would:
      // 1. Get the OApp (Omnichain Application) contract instance for your specific bridge.
      // 2. Encode the function data for the cross-chain transfer (e.g., 'send' function on your OApp).
      //    This would involve specifying the destination chain ID, recipient address, amount, and LayerZero options.
      // 3. Send the transaction via walletClient.sendTransaction.
      // 4. Wait for transaction receipt.
      // 5. Potentially use LayerZero Scan API to track message status across chains.

      // For this demo, we'll simulate the process.
      await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate network delay

      setStatusMessage(`Simulated cross-chain transfer successful! ${transferAmount} USDC sent from ${sourceChain} to ${destinationChain}. (This is a mock transaction.)`);
      setIsError(false);
      setTransferAmount('');

    } catch (error) {
      console.error('Error during simulated cross-chain transfer:', error);
      setStatusMessage(`Simulated transfer failed: ${error.message || 'Please try again.'}`);
      setIsError(true);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Cross-Chain Payments (LayerZero Integration)</h2>
      <p className="text-lg text-gray-700 mb-6">
        Seamlessly transfer USDC between Lisk Sepolia and other Optimism-based networks (e.g., Optimism Mainnet, Base) using LayerZero.
      </p>

      <p className="text-lg text-gray-700 mb-4">
        Connected Wallet: <span className="font-mono text-secondary-purple">{account || 'Not connected'}</span>
      </p>

      {statusMessage && (
        <div className={`p-3 mb-4 rounded-md ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {statusMessage}
        </div>
      )}

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
            <option value="Optimism/Base (Mock)">Optimism/Base (Mock)</option>
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
          {isProcessing ? 'Transferring...' : 'Initiate Cross-Chain Transfer'}
        </button>
      </div>
    </div>
  );
};

// --- DisputeResolution Component ---
const DisputeResolution = ({ account }) => {
  const [jobId, setJobId] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmitDispute = async (e) => {
    e.preventDefault();
    if (!account) {
      setStatusMessage('Please connect your wallet to submit a dispute.');
      setIsError(true);
      return;
    }
    if (!jobId || !disputeReason) {
      setStatusMessage('Please fill in both Job ID and Dispute Reason.');
      setIsError(true);
      return;
    }

    setIsLoading(true);
    setStatusMessage('Submitting dispute...');
    setIsError(false);

    try {
      // Call backend to submit dispute
      await axios.post(`${API_BASE_URL}/api/disputes`, {
        jobId: jobId,
        reporterAddress: account,
        reason: disputeReason,
      });

      setStatusMessage('Dispute submitted successfully! Our team will review it.');
      setIsError(false);
      setJobId('');
      setDisputeReason('');

    } catch (error) {
      console.error('Error submitting dispute:', error);
      setStatusMessage(`Error submitting dispute: ${error.message || 'Please try again.'}`);
      setIsError(true);
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
    </div>
  );
};

// --- Withdrawal Component (Mock Fiat On/Off-Ramp) ---
const Withdrawal = ({ account }) => {
  const [amount, setAmount] = useState('');
  const [fiatCurrency, setFiatCurrency] = useState('KES');
  const [bankDetails, setBankDetails] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleWithdrawal = async (e) => {
    e.preventDefault();
    if (!account) {
      setStatusMessage('Please connect your wallet to initiate a withdrawal.');
      setIsError(true);
      return;
    }
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0 || !bankDetails) {
      setStatusMessage('Please enter a valid amount and bank details.');
      setIsError(true);
      return;
    }

    setIsLoading(true);
    setStatusMessage(`Initiating withdrawal of ${amount} USDC to ${fiatCurrency} via bank transfer...`);
    setIsError(false);

    try {
      // Call backend to submit withdrawal request
      await axios.post(`${API_BASE_URL}/api/withdrawals`, {
        requestorAddress: account,
        usdcAmount: parseFloat(amount),
        fiatCurrency: fiatCurrency,
        bankDetails: bankDetails, // In a real app, this would be structured data
      });

      setStatusMessage(`Withdrawal request submitted! Our team will process your ${amount} USDC to ${fiatCurrency}.`);
      setIsError(false);
      setAmount('');
      setBankDetails('');

    } catch (error) {
      console.error('Error during withdrawal:', error);
      setStatusMessage(`Withdrawal failed: ${error.message || 'Please try again.'}`);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Withdraw Funds (Fiat On/Off-Ramp)</h2>
      <p className="text-lg text-gray-700 mb-6">
        Convert your USDC earnings to local fiat currency and withdraw directly to your bank account.
      </p>

      <p className="text-lg text-gray-700 mb-4">
        Connected Wallet: <span className="font-mono text-secondary-purple">{account || 'Not connected'}</span>
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
          <label htmlFor="fiatCurrency" className="block text-lg font-medium text-gray-800 mb-1">Fiat Currency</label>
          <select
            id="fiatCurrency"
            value={fiatCurrency}
            onChange={(e) => setFiatCurrency(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isLoading || !account}
          >
            <option value="KES">Kenyan Shilling (KES)</option>
            <option value="NGN">Nigerian Naira (NGN)</option>
            <option value="ZAR">South African Rand (ZAR)</option>
            <option value="USD">US Dollar (USD)</option>
            {/* Add more currencies as needed */}
          </select>
        </div>
        <div>
          <label htmlFor="bankDetails" className="block text-lg font-medium text-gray-800 mb-1">Bank Account Details (Mock)</label>
          <textarea
            id="bankDetails"
            value={bankDetails}
            onChange={(e) => setBankDetails(e.target.value)}
            placeholder="Bank Name, Account Number, SWIFT/BIC, etc."
            rows="3"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isLoading || !account}
          ></textarea>
        </div>
        <button
          type="submit"
          className="w-full px-6 py-3 bg-accent-green text-white font-semibold rounded-md hover:bg-green-600 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading || !account}
        >
          {isLoading ? 'Processing...' : 'Initiate Withdrawal'}
        </button>
      </form>
    </div>
  );
};


function App() {
  const [walletClient, setWalletClient] = useState(null);
  const [publicClient, setPublicClient] = useState(null);
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState('');
  const [amountToDeposit, setAmountToDeposit] = useState('100');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isInfoMenuOpen, setIsInfoMenuOpen] = useState(false);

  // Function to truncate address for display
  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const connectWallet = async () => {
    setStatus('Connecting wallet...');
    try {
      if (typeof window.ethereum === 'undefined') {
        setStatus('MetaMask or similar wallet not detected! Please install a Web3 wallet.');
        return;
      }

      // Request accounts directly from MetaMask
      const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });

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
      setAccount(address);
      setStatus(`Wallet connected: ${truncateAddress(address)}`);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      if (error.code === 4001) {
        setStatus('Wallet connection rejected by user.');
      } else {
        setStatus(`Error connecting wallet: ${error.message}`);
      }
    }
  };

  // Listen for account changes (e.g., user changes account in MetaMask)
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setStatus(`Wallet changed to: ${truncateAddress(accounts[0])}`);
        } else {
          setAccount(null);
          setWalletClient(null);
          setPublicClient(null);
          setStatus('Wallet disconnected.');
        }
      };

      // Initial check for already connected account
      window.ethereum.request({ method: 'eth_accounts' })
        .then(handleAccountsChanged)
        .catch(error => console.error("Error checking initial accounts:", error));

      window.ethereum.on('accountsChanged', handleAccountsChanged);

      // Cleanup listener on component unmount
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []); // Empty dependency array means this runs once on mount

  // handleDepositUSDC from DivviIntegration is moved into DivviIntegration component itself
  // to encapsulate its logic and use the new depositGeneral function.

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    if (isInfoMenuOpen) setIsInfoMenuOpen(false);
  };

  return (
    <BrowserRouter>
      <div className="bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen font-sans text-gray-800">

        <header className="bg-primary-blue text-white p-4 shadow-lg sticky top-0 z-50 transition duration-300 ease-in-out">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              <img src={logo} alt="FreelanceFlow Logo" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white" />
              <span className="text-lg sm:text-2xl font-bold whitespace-nowrap">FreelanceFlow</span>
            </Link>
            <nav className="hidden md:flex flex-1 justify-between items-center ml-8">
              <div className="flex items-center gap-x-6 text-lg">
                <Link to="/" className="hover:text-blue-200 transition duration-300 ease-in-out">Home</Link>
                <Link to="/dashboard" className="hover:text-blue-200 transition duration-300 ease-in-out">Dashboard</Link>
                <Link to="/profile" className="hover:text-blue-200 transition duration-300 ease-in-out">Profile</Link>
                <Link to="/post-job" className="hover:text-blue-200 transition duration-300 ease-in-out">Post Job</Link>
                <Link to="/browse-jobs" className="hover:text-blue-200 transition duration-300 ease-in-out">Browse Jobs</Link>
              </div>
              <div className="flex items-center gap-x-4">
                <div className="relative">
                  <button
                    onClick={() => setIsInfoMenuOpen(!isInfoMenuOpen)}
                    className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition duration-300 ease-in-out flex items-center"
                  >
                    More Info
                    <svg className={`ml-2 h-4 w-4 transform transition-transform ${isInfoMenuOpen ? 'rotate-180' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isInfoMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                      <Link to="/divvi-integration" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Divvi Demo</Link>
                      <Link to="/cross-chain-transfer" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Cross-Chain Transfer</Link>
                      <Link to="/dispute-resolution" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Dispute Resolution</Link>
                      <Link to="/withdraw" onClick={() => setIsInfoMenuOpen(false)} className="block px-4 py-2 text-gray-800 hover:bg-gray-100">Withdraw Funds</Link>
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
                  className="px-4 py-2 bg-accent-green text-white font-semibold rounded-md shadow-lg hover:bg-green-600 transition duration-300 transform hover:scale-105 ml-4"
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
                <li><Link to="/" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Home</Link></li>
                <li><Link to="/dashboard" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Dashboard</Link></li>
                <li><Link to="/profile" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Profile</Link></li>
                <li><Link to="/post-job" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Post Job</Link></li>
                <li><Link to="/browse-jobs" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Browse Jobs</Link></li>
                <li className="text-gray-300 text-sm mt-4 mb-2">--- Information & Demos ---</li>
                <li><Link to="/divvi-integration" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Divvi Demo</Link></li>
                <li><Link to="/cross-chain-transfer" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Cross-Chain Transfer</Link></li>
                <li><Link to="/dispute-resolution" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Dispute Resolution</Link></li>
                <li><Link to="/withdraw" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Withdraw Funds</Link></li>
                <li><a href="#about" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">About</a></li>
                <li><a href="#vision" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Vision</a></li>
                <li><a href="#mission" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Mission</a></li>
                <li><a href="#features" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Features</a></li>
                <li><a href="#team" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Team</a></li>
                <li><a href="#roadmap" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Roadmap</a></li>
                <li><a href="/WHITEPAPER.pdf" target="_blank" rel="noopener noreferrer" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Whitepaper</a></li>
                <li><a href="#contact" onClick={toggleMobileMenu} className="block w-full text-center py-2 hover:bg-blue-700">Contact</a></li>
                {/* Wallet Connect Button for Mobile Menu */}
                <li>
                  <button
                    onClick={connectWallet}
                    className="w-full px-6 py-3 bg-accent-green text-white font-semibold rounded-md shadow-lg hover:bg-green-600 transition duration-300 transform hover:scale-105 mt-4"
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
          <Route path="/profile" element={<Profile account={account} />} />
          <Route path="/job/:id" element={<JobDetails account={account} publicClient={publicClient} walletClient={walletClient} />} />
          <Route path="/divvi-integration" element={
            <DivviIntegration
              account={account}
              walletClient={walletClient}
              publicClient={publicClient}
              status={status}
              setStatus={setStatus}
              amountToDeposit={amountToDeposit}
              setAmountToDeposit={setAmountToDeposit}
            />
          } />
          <Route path="/post-job" element={<PostJob account={account} />} />
          <Route path="/browse-jobs" element={<BrowseJobs />} />
          <Route path="/cross-chain-transfer" element={<CrossChainIntegration account={account} publicClient={publicClient} walletClient={walletClient} />} />
          <Route path="/dispute-resolution" element={<DisputeResolution account={account} />} />
          <Route path="/withdraw" element={<Withdrawal account={account} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
