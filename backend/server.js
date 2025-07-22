const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Re-import the cors package
const { createPublicClient, http, formatUnits } = require('viem'); // Import formatUnits
require('dotenv').config(); // Load environment variables from .env file

const app = express();

// --- Middleware ---
// Define allowed origins for CORS
const allowedOrigins = [
  'https://freelanceflow.net',
  'https://www.freelanceflow.net',
  'http://localhost:3000', // For local frontend development
  'http://localhost:5000'  // If your frontend runs on 5000 locally
];

// Configure CORS using the 'cors' package with a dynamic origin check
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}.`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Explicitly allow all necessary HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Explicitly allow headers your frontend might send
  credentials: true // Important if you plan to send cookies or authorization headers (e.g., for user sessions)
}));

app.use(express.json()); // Parse JSON request bodies

// --- Blockchain Configuration ---
// Determine Lisk network based on environment
const liskNetwork = {
  id: process.env.NODE_ENV === 'production' ? 1135 : 4202, // 1135 for Mainnet, 4202 for Sepolia Testnet
  name: process.env.NODE_ENV === 'production' ? 'Lisk Mainnet' : 'Lisk Sepolia Testnet',
  rpcUrls: {
    default: {
      http: [process.env.NODE_ENV === 'production' ? 'https://rpc.lisk.com' : 'https://testnet-rpc.lisk.com'],
    },
  },
  blockExplorers: {
    default: { name: 'Lisk Blockscout', url: process.env.NODE_ENV === 'production' ? 'https://blockscout.lisk.com/' : 'https://sepolia-blockscout.lisk.com/' },
  },
  testnet: process.env.NODE_ENV !== 'production',
};

// Contract Addresses (from .env, specific to network)
const USDC_CONTRACT_ADDRESS = process.env.NODE_ENV === 'production' 
  ? process.env.USDC_MAINNET_CONTRACT_ADDRESS 
  : process.env.USDC_SEPOLIA_CONTRACT_ADDRESS;

const ESCROW_CONTRACT_ADDRESS = process.env.NODE_ENV === 'production' 
  ? process.env.ESCROW_MAINNET_CONTRACT_ADDRESS 
  : process.env.ESCROW_SEPOLIA_CONTRACT_ADDRESS;

// Public Client for blockchain reads
const publicClient = createPublicClient({
  chain: liskNetwork,
  transport: http(liskNetwork.rpcUrls.default.http[0]),
});

// Log environment and RPC URL for debugging on Vercel
console.log(`Backend running in NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Using Lisk RPC URL: ${liskNetwork.rpcUrls.default.http[0]}`);
console.log(`Using ESCROW_CONTRACT_ADDRESS: ${ESCROW_CONTRACT_ADDRESS}`);
console.log(`Using USDC_CONTRACT_ADDRESS: ${USDC_CONTRACT_ADDRESS}`);


// --- MongoDB Connection ---
// For Vercel serverless functions, it's crucial to handle database connections
// in a way that is efficient for a serverless environment (e.g., idempotent connection).
// Keeping it top-level like this is generally fine for Express apps on Vercel,
// but be aware of potential cold start impacts.
mongoose.connect(process.env.MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Schemas ---

// User Schema: Stores freelancer/client profiles
const userSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true, lowercase: true }, // Store addresses in lowercase for consistency
  role: { type: String, enum: ['freelancer', 'client', 'both'], default: 'freelancer' }, // Added 'both' role for flexibility
  skills: [String],
  portfolio: [String],
  rating: { type: Number, default: 0, min: 0, max: 5 }, // Rating from 0-5
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
userSchema.pre('save', function(next) { this.updatedAt = Date.now(); next(); });
userSchema.pre('findOneAndUpdate', function(next) { this.set({ updatedAt: Date.now() }); next(); });

// Job Schema: Stores job listings and their state
const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 }, // Amount in USDC (human-readable, e.g., 100)
  client: { type: String, required: true, lowercase: true }, // Client's wallet address
  freelancer: { type: String, default: null, lowercase: true }, // Freelancer's wallet address (null if unassigned)
  status: { type: String, enum: ['open', 'in-progress', 'completed', 'disputed', 'cancelled'], default: 'open' },
  depositTxHash: { type: String, default: null }, // Transaction hash for the initial escrow deposit
  completionTxHash: { type: String, default: null }, // Transaction hash for fund release
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
jobSchema.pre('save', function(next) { this.updatedAt = Date.now(); next(); });
jobSchema.pre('findOneAndUpdate', function(next) { this.set({ updatedAt: Date.now() }); next(); });

// Dispute Schema: Records disputes for jobs
const disputeSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true }, // Reference to the disputed job
  reporterAddress: { type: String, required: true, lowercase: true }, // Address of the user who reported the dispute
  reason: { type: String, required: true },
  status: { type: String, enum: ['open', 'under-review', 'resolved', 'closed'], default: 'open' },
  reportedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null },
  resolutionDetails: { type: String, default: null },
});

// Withdrawal Schema: Records withdrawal requests
const withdrawalSchema = new mongoose.Schema({
  requestorAddress: { type: String, required: true, lowercase: true },
  usdcAmount: { type: Number, required: true, min: 0 }, // Amount of USDC to withdraw
  fiatCurrency: { type: String, required: true }, // e.g., KES, NGN, USD
  bankDetails: { type: String, required: true }, // Mocked for now, in real app would be structured
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: null },
  txId: { type: String, default: null }, // Transaction ID from fiat on/off-ramp provider
});


const User = mongoose.model('User', userSchema);
const Job = mongoose.model('Job', jobSchema);
const Dispute = mongoose.model('Dispute', disputeSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

// --- API Routes ---

// User Routes
app.post('/api/users', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/users/:address', async (req, res) => {
  try {
    // Find user by address, case-insensitive
    const user = await User.findOne({ address: req.params.address.toLowerCase() });
    res.json(user || {}); // Return empty object if not found, consistent with frontend
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:address', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { address: req.params.address.toLowerCase() }, // Ensure case-insensitive update
      req.body,
      { new: true, upsert: true, runValidators: true } // upsert creates if not exists, runValidators ensures schema validation
    );
    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(400).json({ error: error.message });
  }
});

// Job Routes
app.post('/api/jobs', async (req, res) => {
  try {
    // Ensure client address is stored lowercase
    const jobData = { ...req.body, client: req.body.client.toLowerCase() };
    const job = new Job(jobData);
    await job.save();
    res.status(201).json(job);
  } catch (error) {
    console.error('Error posting job:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/jobs', async (req, res) => {
  try {
    // Retrieve only 'open' jobs for the browse page, or all if not specified
    const statusFilter = req.query.status ? { status: req.query.status } : {};
    const jobs = await Job.find(statusFilter);
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching all jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    console.error('Error fetching job by ID:', error);
    res.status(400).json({ error: 'Invalid Job ID or server error' });
  }
});

app.put('/api/jobs/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };
    // Ensure freelancer address is stored lowercase if provided
    if (updateData.freelancer) {
      updateData.freelancer = updateData.freelancer.toLowerCase();
    }
    const job = await Job.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(400).json({ error: error.message });
  }
});

// NEW: Get jobs for a specific user (as client or freelancer)
app.get('/api/jobs/forUser/:account', async (req, res) => {
  try {
    const userAddress = req.params.account.toLowerCase();
    const jobs = await Job.find({
      $or: [
        { client: userAddress },
        { freelancer: userAddress }
      ]
    });
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs for user:', error);
    res.status(500).json({ error: error.message });
  }
});


// Deposits (Blockchain Read)
app.get('/api/deposits/total/:account', async (req, res) => {
  try {
    // USDC uses 6 decimals
    const units = 6; 
    const addressToCheck = req.params.account;

    // ABI for the 'deposits' mapping in your Escrow contract
    const escrowAbiForDeposits = [
      {
        inputs: [{ internalType: 'address', name: '', type: 'address' }],
        name: 'deposits',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ];

    const depositBigInt = await publicClient.readContract({
      address: ESCROW_CONTRACT_ADDRESS, // Use the dynamically set contract address
      abi: escrowAbiForDeposits,
      functionName: 'deposits',
      args: [addressToCheck],
    });

    // Convert BigInt (smallest unit) to human-readable format (USDC has 6 decimals)
    const totalDeposits = formatUnits(depositBigInt, units);
    res.json({ totalDeposits: totalDeposits });
  } catch (error) {
    console.error('Error fetching total deposits:', error);
    // Provide a more informative error message to the frontend, including the RPC URL
    res.status(500).json({ 
      error: `Failed to fetch total deposits from Lisk Sepolia RPC (${liskNetwork.rpcUrls.default.http[0]}): ${error.message}. Please check your backend's network connectivity and RPC status.` 
    });
  }
});

// NEW: Dispute Routes
app.post('/api/disputes', async (req, res) => {
  try {
    const disputeData = { ...req.body, reporterAddress: req.body.reporterAddress.toLowerCase() };
    const dispute = new Dispute(disputeData);
    await dispute.save();
    // Optionally, update the job status to 'disputed' here
    await Job.findByIdAndUpdate(dispute.jobId, { status: 'disputed' });
    res.status(201).json(dispute);
  } catch (error) {
    console.error('Error submitting dispute:', error);
    res.status(400).json({ error: error.message });
  }
});

// NEW: Withdrawal Routes
app.post('/api/withdrawals', async (req, res) => {
  try {
    const withdrawalData = { ...req.body, requestorAddress: req.body.requestorAddress.toLowerCase() };
    const withdrawal = new Withdrawal(withdrawalData);
    await withdrawal.save();
    // In a real application, you would now integrate with a fiat on/off-ramp provider
    // and handle the actual crypto-to-fiat conversion and bank transfer.
    // For now, this just records the request.
    res.status(201).json(withdrawal);
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(400).json({ error: error.message });
  }
});


// --- Vercel Export ---
// Instead of app.listen, export the app for Vercel's serverless function environment
module.exports = app;

// If you still want to run locally with app.listen, you can do this:
// if (process.env.NODE_ENV !== 'production') {
//   const PORT = process.env.PORT || 5000;
//   app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// }
