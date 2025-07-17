import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { encodeFunctionData, parseUnits } from 'viem'; 


const API_BASE_URL = 'http://localhost:5000'; 

const escrowAbiForRelease = [
  {
    "inputs": [
      { "internalType": "address", "name": "freelancer", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
    ],
    "name": "release",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function",
  },
];

const escrowContractAddress = '0x83C9919341aa0705b6b0d79420EfAAE27B53ADCf';

const JobDetails = ({ account, publicClient, walletClient }) => {
  const { id } = useParams(); 
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingTx, setIsProcessingTx] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchJob = async () => {
      setIsLoading(true);
      setStatusMessage('');
      setIsError(false);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/jobs/${id}`);
        setJob(response.data);
      } catch (error) {
        console.error('Error fetching job:', error);
        setStatusMessage(`Error loading job details: ${error.message || 'Network error'}`);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchJob();
  }, [id]); 

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

    setIsProcessingTx(true);
    setStatusMessage('Accepting job...');
    setIsError(false);
    try {
      await axios.put(`${API_BASE_URL}/api/jobs/${id}`, { status: 'in-progress', freelancer: account });
      
      setJob(prevJob => ({ ...prevJob, status: 'in-progress', freelancer: account }));
      setStatusMessage('Job accepted successfully!');
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

  const handleComplete = async () => {
    if (!account || !publicClient || !walletClient) {
      setStatusMessage('Wallet not connected or blockchain clients not ready.');
      setIsError(true);
      return;
    }
    if (!job || !job.freelancer || job.amount === undefined) {
      setStatusMessage('Job data incomplete. Cannot release funds.');
      setIsError(true);
      return;
    }

    setIsProcessingTx(true);
    setStatusMessage('Initiating fund release...');
    setIsError(false);
    try {
      const callData = encodeFunctionData({
        abi: escrowAbiForRelease, 
        functionName: 'release',
        args: [job.freelancer, parseUnits(job.amount.toString(), 6)],
      });

      const txHash = await walletClient.sendTransaction({
        account, 
        to: escrowContractAddress, 
        data: callData,
      });

      setStatusMessage(`Transaction sent! Hash: ${txHash}. Waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      await axios.put(`${API_BASE_URL}/api/jobs/${id}`, { status: 'completed' });
      
      setJob(prevJob => ({ ...prevJob, status: 'completed' }));
      setStatusMessage('Funds released successfully, job marked as completed!');
      setIsError(false);

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Error completing job or releasing funds:', error);
      setStatusMessage(`Transaction failed or error completing job: ${error.message || 'Please try again.'}`);
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

  return (
    <div className="max-w-5xl mx-auto p-4 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">{job.title}</h2>
      
      {statusMessage && (
        <div className={`p-3 mb-4 rounded-md ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {statusMessage}
        </div>
      )}

      <div className="space-y-3 text-gray-700 mb-6">
        <p className="text-lg">**Description:** {job.description}</p>
        <p className="text-lg">**Amount:** <span className="font-semibold text-accent-green">{job.amount} USDC</span></p>
        <p className="text-lg">**Client:** <span className="font-mono text-secondary-purple">{job.client || 'N/A'}</span></p>
        <p className="text-lg">**Freelancer:** <span className="font-mono text-secondary-purple">{job.freelancer || 'Not assigned'}</span></p>
        <p className="text-lg">**Current Status:** <span className={`font-semibold ${job.status === 'open' ? 'text-blue-600' : job.status === 'in-progress' ? 'text-yellow-600' : job.status === 'completed' ? 'text-green-600' : 'text-gray-600'}`}>{job.status}</span></p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {job.status === 'open' && account && account.toLowerCase() !== job.client.toLowerCase() && (
          <button
            className="px-6 py-3 bg-secondary-purple text-white font-semibold rounded-md hover:bg-purple-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAccept}
            disabled={isProcessingTx}
          >
            {isProcessingTx ? 'Accepting...' : 'Accept Job'}
          </button>
        )}

        {job.status === 'in-progress' && account && account.toLowerCase() === job.client.toLowerCase() && (
          <button
            className="px-6 py-3 bg-accent-green text-white font-semibold rounded-md hover:bg-green-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleComplete}
            disabled={isProcessingTx}
          >
            {isProcessingTx ? 'Releasing Funds...' : 'Release Funds'}
          </button>
        )}

        {/* Example: Cancel Job Button (Client action, if job is 'open' or 'in-progress') */}
        {/* You would need to implement the handleCancel function and backend endpoint */}
        {/* {job.status !== 'completed' && account && account.toLowerCase() === job.client.toLowerCase() && (
          <button
            className="px-6 py-3 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleCancel}
            disabled={isProcessingTx}
          >
            {isProcessingTx ? 'Cancelling...' : 'Cancel Job'}
          </button>
        )} */}
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

export default JobDetails;
