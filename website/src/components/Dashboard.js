import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Define your backend API base URL
// IMPORTANT: For production, use an environment variable (e.g., process.env.REACT_APP_API_BASE_URL)
// For local development, 'http://localhost:5000' is fine.
const API_BASE_URL = 'http://localhost:5000'; 

const Dashboard = ({ account }) => {
  // State for various dashboard data points
  const [totalEscrowDeposits, setTotalEscrowDeposits] = useState(0); // Renamed for clarity
  const [userJobs, setUserJobs] = useState([]); // Renamed for clarity
  const [userProfile, setUserProfile] = useState(null); // Renamed for clarity
  const [isLoading, setIsLoading] = useState(true); // Initial loading state
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate();

  // useEffect hook to fetch all necessary data for the dashboard
  useEffect(() => {
    const fetchData = async () => {
      if (!account) {
        setErrorMessage('Wallet not connected. Please connect to view your dashboard.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(''); // Clear previous errors
      
      try {
        // Fetch total deposits for the connected account
        // Assuming your backend endpoint provides total deposits for the user
        const depositResponse = await axios.get(`${API_BASE_URL}/api/deposits/total/${account}`);
        setTotalEscrowDeposits(depositResponse.data.totalDeposits || 0); // Ensure a default of 0

        // Fetch jobs relevant to the connected account (either as client or freelancer)
        // IMPORTANT: You need to implement this endpoint on your backend to filter jobs by user.
        // E.g., backend might return jobs where user is client OR freelancer.
        const jobsResponse = await axios.get(`${API_BASE_URL}/api/jobs/forUser/${account}`);
        setUserJobs(jobsResponse.data || []); // Ensure an empty array if no jobs

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
  }, [account]); // Dependency array: re-run when 'account' changes

  return (
    <div className="max-w-6xl mx-auto p-4 bg-white shadow-lg rounded-lg my-8">
      <h2 className="text-3xl font-bold text-primary-blue mb-6 border-b pb-2">Your Dashboard</h2>
      
      {/* Wallet Connection Status */}
      <p className="text-lg text-gray-700 mb-4">
        **Connected Wallet:** <span className="font-mono text-secondary-purple">{account || 'Not connected'}</span>
      </p>

      {/* Error Message Display */}
      {errorMessage && (
        <div className="p-3 mb-4 rounded-md bg-red-100 text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Loading Indicator */}
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
          {/* Escrow Deposits Summary */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold text-primary-blue mb-2">Total Escrow Deposits</h3>
            <p className="text-3xl font-bold text-accent-green">{totalEscrowDeposits} USDC</p>
            <p className="text-sm text-gray-600 mt-1">Funds currently held in escrow for your active jobs as a client or freelancer.</p>
          </div>

          {/* User Profile Summary */}
          {userProfile ? (
            <div className="mt-4 p-4 bg-purple-50 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-secondary-purple mb-2">Your Profile at a Glance</h3>
              <p className="text-base text-gray-700">**Role:** {userProfile.role || 'N/A'}</p>
              <p className="text-base text-gray-700">**Skills:** {userProfile.skills?.join(', ') || 'No skills added yet.'}</p>
              <p className="text-base text-gray-700">**Rating:** {userProfile.rating !== undefined ? `${userProfile.rating}/5` : 'N/A'}</p>
              <button
                className="mt-4 px-6 py-2 bg-primary-blue text-white rounded-md hover:bg-blue-700 transition duration-300"
                onClick={() => navigate('/profile')}
              >
                Edit Profile
              </button>
            </div>
          ) : (
            <div className="mt-4 p-4 bg-red-50 rounded-lg shadow-sm text-red-700">
              <p className="text-base">Profile not found. Please create your profile to get started!</p>
              <button
                className="mt-4 px-6 py-2 bg-primary-blue text-white rounded-md hover:bg-blue-700 transition duration-300"
                onClick={() => navigate('/profile')}
              >
                Create Profile
              </button>
            </div>
          )}

          {/* Your Jobs Section */}
          <h3 className="text-xl font-semibold mt-8 text-primary-blue border-b pb-2">Your Jobs</h3>
          {userJobs.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {userJobs.map((job) => (
                <li key={job._id} className="bg-gray-50 p-4 rounded-lg shadow-md flex justify-between items-center">
                  <div>
                    <p className="text-lg font-semibold text-text-dark">{job.title} - <span className="text-accent-green">{job.amount} USDC</span></p>
                    <p className="text-sm text-gray-600">Client: {job.client || 'N/A'} | Status: {job.status || 'Pending'}</p>
                  </div>
                  <button
                    className="px-4 py-2 bg-secondary-purple text-white rounded-md hover:bg-purple-700 transition duration-300"
                    onClick={() => navigate(`/job/${job._id}`)}
                  >
                    View Details
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg shadow-sm text-yellow-800">
              <p className="text-base">You don't have any active jobs yet. Time to find some or post one!</p>
            </div>
          )}

          {/* Post a Job Button */}
          <button
            className="mt-8 w-full px-6 py-3 bg-primary-blue text-white font-semibold rounded-md hover:bg-blue-700 transition duration-300"
            onClick={() => navigate('/post-job')}
          >
            Post a New Job
          </button>
        </>
      )}
    </div>
  );
};

export default Dashboard;
