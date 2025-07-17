import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = 'http://localhost:5000'; 

const Profile = ({ account }) => {
  const [profile, setProfile] = useState({ skills: [], portfolio: [], rating: 0 });
  const [skillsInput, setSkillsInput] = useState('');
  const [portfolioInput, setPortfolioInput] = useState('');
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
        setProfile(response.data);
        setSkillsInput(response.data.skills?.join(', ') || '');
        setPortfolioInput(response.data.portfolio?.join(', ') || '');
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
      });

      setProfile(prev => ({ ...prev, skills: updatedSkills, portfolio: updatedPortfolio }));
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
          <label htmlFor="skills" className="block text-lg font-medium text-text-dark mb-1">Skills (comma-separated)</label>
          <input
            type="text"
            id="skills"
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            placeholder="e.g., React, Node.js, Solidity, UI/UX Design"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isLoading}
          />
        </div>
        <div>
          <label htmlFor="portfolio" className="block text-lg font-medium text-text-dark mb-1">Portfolio Links (comma-separated)</label>
          <input
            type="text"
            id="portfolio"
            value={portfolioInput}
            onChange={(e) => setPortfolioInput(e.target.value)}
            placeholder="e.g., github.com/your-project, yourportfolio.com/design"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent transition duration-200"
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="block text-lg font-medium text-text-dark mb-1">Rating</label>
          <p className="text-xl font-semibold text-accent-green">
            {profile.rating !== undefined ? `${profile.rating}/5` : 'N/A'} 
            <span className="text-sm text-gray-500 ml-2">(based on completed jobs)</span>
          </p>
        </div>
        <button
          type="submit"
          className="w-full px-6 py-3 bg-secondary-purple text-white font-semibold rounded-md hover:bg-purple-700 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      <div className="mt-8 p-6 bg-gray-50 rounded-lg shadow-inner">
        <h3 className="text-xl font-semibold text-primary-blue mb-3 border-b pb-2">Current Profile Details</h3>
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

export default Profile;
