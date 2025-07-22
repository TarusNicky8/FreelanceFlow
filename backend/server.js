const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // <<< THIS MUST BE UNCOMMENTED
const { createPublicClient, http, formatUnits } = require('viem');
require('dotenv').config();

const app = express();

// --- IMPORTANT: Log incoming requests for debugging ---
app.use((req, res, next) => {
  console.log(`Incoming Request: ${req.method} ${req.url}`);
  console.log(`Request Origin Header: ${req.headers.origin}`); // Log the origin header
  next();
});

// --- Middleware ---
// Define allowed origins for CORS
const allowedOrigins = [
  'https://freelanceflow.net',
  'https://www.freelanceflow.net',
  'http://localhost:3000', // For local frontend development
  'http://localhost:5000'  // If your backend serves itself or for testing
];

// Configure CORS using the 'cors' package with a dynamic origin check
app.use(cors({
  origin: function (origin, callback) {
    // If no origin is provided (e.g., direct API calls, curl, or same-origin in some cases), allow it.
    if (!origin) {
      console.log("CORS: No origin provided, allowing request.");
      return callback(null, true);
    }
    
    // Check if the origin is in our allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log(`CORS: Origin ${origin} is allowed.`);
      return callback(null, true);
    } else {
      // If the origin is not allowed, log it and reject the request
      console.error(`CORS: Origin ${origin} not allowed by CORS policy.`);
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}.`;
      return callback(new Error(msg), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], // Explicitly allow all necessary HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Explicitly allow headers your frontend might send
  credentials: true // Important if you plan to send cookies or authorization headers (e.g., for user sessions)
}));

app.use(express.json());

// --- Blockchain Configuration ---
const liskNetwork = {
  id: process.env.NODE_ENV === 'production' ? 1135 : 4202,
  name: process.env.NODE_ENV === 'production' ? 'Lisk Mainnet' : 'Lisk Sepolia Testnet',
  rpcUrls: {
    default: {
      // UPDATED RPC URLs based on your input
      http: [process.env.NODE_ENV === 'production' ? 'https://rpc.api.lisk.com' : 'https://rpc.sepolia-api.lisk.com'],
    },
  },
  blockExplorers: {
    default: { name: 'Lisk Blockscout', url: process.env.NODE_ENV === 'production' ? 'https://blockscout.lisk.com/' : 'https://sepolia-blockscout.lisk.com/' },
  },
  testnet: process.env.NODE_ENV !== 'production',
};

const USDC_CONTRACT_ADDRESS = process.env.NODE_ENV === 'production' 
  ? process.env.USDC_MAINNET_CONTRACT_ADDRESS 
  : process.env.USDC_SEPOLIA_CONTRACT_ADDRESS;

const ESCROW_CONTRACT_ADDRESS = process.env.NODE_ENV === 'production' 
  ? process.env.ESCROW_MAINNET_CONTRACT_ADDRESS 
  : process.env.ESCROW_SEPOLIA_CONTRACT_ADDRESS;

const publicClient = createPublicClient({
  chain: liskNetwork,
  transport: http(liskNetwork.rpcUrls.default.http[0]),
});

console.log(`Backend running in NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Using Lisk RPC URL: ${liskNetwork.rpcUrls.default.http[0]}`);
console.log(`Using ESCROW_CONTRACT_ADDRESS: ${ESCROW_CONTRACT_ADDRESS}`);
console.log(`Using USDC_CONTRACT_ADDRESS: ${USDC_CONTRACT_ADDRESS}`);


// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI) // Removed deprecated options
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Schemas (unchanged) ---
const userSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true, lowercase: true },
  role: { type: String, enum: ['freelancer', 'client', 'both'], default: 'freelancer' },
  skills: [String],
  portfolio: [String],
  rating: { type: Number, default: 0, min: 0, max: 5 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
userSchema.pre('save', function(next) { this.updatedAt = Date.now(); next(); });
userSchema.pre('findOneAndUpdate', function(next) { this.set({ updatedAt: Date.now() }); next(); });

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  client: { type: String, required: true, lowercase: true },
  freelancer: { type: String, default: null, lowercase: true },
  status: { type: String, enum: ['open', 'in-progress', 'completed', 'disputed', 'cancelled'], default: 'open' },
  depositTxHash: { type: String, default: null },
  completionTxHash: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
jobSchema.pre('save', function(next) { this.updatedAt = Date.now(); next(); });
jobSchema.pre('findOneAndUpdate', function(next) { this.set({ updatedAt: Date.now() }); next(); });

const disputeSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  reporterAddress: { type: String, required: true, lowercase: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['open', 'under-review', 'resolved', 'closed'], default: 'open' },
  reportedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null },
  resolutionDetails: { type: String, default: null },
});

const withdrawalSchema = new mongoose.Schema({
  requestorAddress: { type: String, required: true, lowercase: true },
  usdcAmount: { type: Number, required: true, min: 0 },
  fiatCurrency: { type: String, required: true },
  bankDetails: { type: String, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: null },
  txId: { type: String, default: null },
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
    const user = await User.findOne({ address: req.params.address.toLowerCase() });
    res.json(user || {});
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:address', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { address: req.params.address.toLowerCase() },
      req.body,
      { new: true, upsert: true, runValidators: true }
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
  }
  catch (error) {
    console.error('Error fetching job by ID:', error);
    res.status(400).json({ error: 'Invalid Job ID or server error' });
  }
});

app.put('/api/jobs/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };
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

app.get('/api/deposits/total/:account', async (req, res) => {
  try {
    const units = 6; 
    const addressToCheck = req.params.account;

    const escrowAbiForDeposits = [
      {
        inputs: [{ internalType: 'address', name: '', type: 'address' }],
        name: 'deposits',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ];

    console.log(`Attempting to read contract for address: ${addressToCheck} on Lisk RPC: ${liskNetwork.rpcUrls.default.http[0]}`);
    const depositBigInt = await publicClient.readContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: escrowAbiForDeposits,
      functionName: 'deposits',
      args: [addressToCheck],
    });
    console.log(`Successfully read contract. Raw deposit: ${depositBigInt}`);

    const totalDeposits = formatUnits(depositBigInt, units);
    res.json({ totalDeposits: totalDeposits });
  } catch (error) {
    console.error('Error fetching total deposits:', error);
    res.status(500).json({ 
      error: `Failed to fetch total deposits from Lisk Sepolia RPC (${liskNetwork.rpcUrls.default.http[0]}): ${error.message}. Please check your backend's network connectivity and RPC status.` 
    });
  }
});

app.post('/api/disputes', async (req, res) => {
  try {
    const disputeData = { ...req.body, reporterAddress: req.body.reporterAddress.toLowerCase() };
    const dispute = new Dispute(disputeData);
    await dispute.save();
    await Job.findByIdAndUpdate(dispute.jobId, { status: 'disputed' });
    res.status(201).json(dispute);
  } catch (error) {
    console.error('Error submitting dispute:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/withdrawals', async (req, res) => {
  try {
    const withdrawalData = { ...req.body, requestorAddress: req.body.requestorAddress.toLowerCase() };
    const withdrawal = new Withdrawal(withdrawalData);
    await withdrawal.save();
    res.status(201).json(withdrawal);
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(400).json({ error: error.message });
  }
});

// --- Vercel Export ---
module.exports = app;

// Local Development Server (only runs if not in production environment)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
