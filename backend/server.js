const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { createPublicClient, http, formatUnits } = require('viem');
require('dotenv').config();

const app = express();

// --- Log incoming requests for debugging ---
app.use((req, res, next) => {
    console.log(`Incoming Request: ${req.method} ${req.url}`);
    console.log(`Request Origin Header: ${req.headers.origin}`);
    next();
});

// --- CORS Configuration ---
const allowedOrigins = [
    'https://freelanceflow.net',
    'https://www.freelanceflow.net',
    'https://freelanceflow-lisk.vercel.app', // Add your Vercel frontend domain
    'https://freelanceflow-backend-api.vercel.app', // Add your Vercel backend domain (if different)
    'http://localhost:3000',
    'http://localhost:5000'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            console.log(`CORS: Origin ${origin} is allowed.`);
            return callback(null, true);
        }
        const msg = `CORS: Origin ${origin} not allowed by the application.`;
        console.error(msg);
        return callback(new Error(msg), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], // Ensure PATCH is included if used
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'], // Added X-Admin-Key
    credentials: true // Allow cookies/auth headers to be sent
}));

app.use(express.json()); // Middleware to parse JSON request bodies

// --- Blockchain Configuration ---
// Determine Lisk network based on environment
const liskNetwork = {
    id: process.env.NODE_ENV === 'production' ? 1135 : 4202, // 1135 for Mainnet, 4202 for Sepolia Testnet
    name: process.env.NODE_ENV === 'production' ? 'Lisk Mainnet' : 'Lisk Sepolia Testnet',
    rpcUrls: {
        default: {
            // Corrected Lisk Sepolia RPC URL for consistency with frontend
            http: [process.env.NODE_ENV === 'production' ? 'https://rpc.lisk.com' : 'https://rpc.sepolia-api.lisk.com'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Lisk Blockscout',
            url: process.env.NODE_ENV === 'production' ? 'https://blockscout.lisk.com/' : 'https://sepolia-blockscout.lisk.com/',
        },
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

// Initialize Viem public client for blockchain reads
const publicClient = createPublicClient({
    chain: liskNetwork,
    transport: http(liskNetwork.rpcUrls.default.http[0]),
});

console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Using Lisk RPC: ${liskNetwork.rpcUrls.default.http[0]}`);
console.log(`ESCROW_CONTRACT_ADDRESS: ${ESCROW_CONTRACT_ADDRESS}`);
console.log(`USDC_CONTRACT_ADDRESS: ${USDC_CONTRACT_ADDRESS}`);

// --- MongoDB Connection ---
console.log('Attempting to connect to MongoDB with URI:', process.env.MONGO_URI ? 'URI_SET' : 'URI_NOT_SET');
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true, // Deprecated in Mongoose 6+, but harmless
    useUnifiedTopology: true, // Deprecated in Mongoose 6+, but harmless
})
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB initial connection error:', err);
        // Exit process if MongoDB connection fails on startup
        process.exit(1);
    });

// --- Mongoose Schemas ---

// User Schema: Stores freelancer/client profiles
const userSchema = new mongoose.Schema({
    address: { type: String, required: true, unique: true, lowercase: true },
    role: { type: String, enum: ['freelancer', 'client', 'both'], default: 'freelancer' },
    skills: [String],
    portfolio: [String],
    rating: { type: Number, default: 0, min: 0, max: 5 }, // Average rating from 0-5
    totalRatingSum: { type: Number, default: 0 }, // Sum of all ratings received
    totalRatingsCount: { type: Number, default: 0 }, // Number of ratings received
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
// Update 'updatedAt' timestamp on save and update operations
userSchema.pre('save', function (next) { this.updatedAt = Date.now(); next(); });
userSchema.pre('findOneAndUpdate', function (next) { this.set({ updatedAt: Date.now() }); next(); });

// Job Schema: Stores job listings and their state
const jobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 }, // Amount in USDC (human-readable, e.g., 100)
    client: { type: String, required: true, lowercase: true }, // Client's wallet address
    freelancer: { type: String, default: null, lowercase: true }, // Freelancer's wallet address (null if unassigned)
    
    // Main status for the job workflow
    status: {
        type: String,
        enum: ['open', 'pending-client-approval', 'in-progress', 'completed', 'disputed', 'cancelled'],
        default: 'open'
    },
    // On-chain escrow status (reflects smart contract state)
    escrowStatus: {
        type: String,
        enum: ['pending-deposit', 'deposited', 'active', 'released', 'refunded', 'disputed'],
        default: 'pending-deposit' // Initial state: job posted, waiting for client to deposit funds
    },
    clientApprovedFreelancer: { type: Boolean, default: false }, // Client explicitly approved freelancer after acceptance

    depositTxHash: { type: String, default: null }, // Transaction hash for the initial escrow deposit
    completionTxHash: { type: String, default: null }, // Transaction hash for fund release
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    // --- NEW FIELDS FOR JOB APPLICATION AND MESSAGING ---
    applicants: [ // Array of objects for job applicants
      {
        address: { type: String, required: true, lowercase: true }, // Wallet address of the applicant
        timestamp: { type: Date, default: Date.now },
      }
    ],
    messages: [ // Array of objects for in-app messages
      {
        sender: { type: String, required: true, lowercase: true }, // Wallet address of the sender
        text: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      }
    ],
    requiredSkills: [{ type: String }], // Array of strings for skills required for the job
    // New field to track if the freelancer has been rated for this job
    rated: { type: Boolean, default: false }
});
// Update 'updatedAt' timestamp on save and update operations
jobSchema.pre('save', function (next) { this.updatedAt = Date.now(); next(); });
jobSchema.pre('findOneAndUpdate', function (next) { this.set({ updatedAt: Date.now() }); next(); });

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

// --- Admin Authentication Middleware (Placeholder) ---
// IMPORTANT: Replace this with a robust authentication and authorization mechanism for production.
// This is a simple check for an X-Admin-Key header.
const authenticateAdmin = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'];
    // In a real app, you would compare this to a securely stored environment variable
    // or validate a JWT token, or check against a whitelist of admin addresses.
    if (adminKey === process.env.ADMIN_SECRET_KEY) { // Replace with your actual admin key in .env
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }
};

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
        const jobData = {
            ...req.body,
            client: req.body.client.toLowerCase(),
            status: 'open', // Job is open for freelancers to accept
            escrowStatus: 'pending-deposit', // Initial state, client needs to fund escrow
            // Ensure requiredSkills is passed if present in req.body
            requiredSkills: req.body.requiredSkills || [], // Initialize as empty array if not provided
        };
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
        // Allow filtering by status, escrowStatus, and skills
        const queryFilter = {};
        if (req.query.status) {
            queryFilter.status = req.query.status;
        }
        if (req.query.escrowStatus) {
            queryFilter.escrowStatus = req.query.escrowStatus;
        }
        if (req.query.skills) {
            const skillArray = req.query.skills.split(',').map(s => s.trim()).filter(s => s !== '');
            if (skillArray.length > 0) {
                // Use $in to find jobs that require ANY of the specified skills
                // Using $all for jobs that require ALL specified skills: queryFilter.requiredSkills = { $all: skillArray };
                // Using $in for jobs that require ANY specified skills:
                queryFilter.requiredSkills = { $in: skillArray };
            }
        }

        const jobs = await Job.find(queryFilter);
        res.json(jobs);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/jobs/:id', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        res.json(job);
    } catch (error) {
        console.error('Error fetching job by ID:', error);
        res.status(400).json({ error: 'Invalid Job ID or server error' });
    }
});

// NEW: Endpoint to get jobs for a specific user (client or freelancer)
app.get('/api/jobs/forUser/:address', async (req, res) => {
    try {
        const userAddress = req.params.address.toLowerCase();
        const jobs = await Job.find({
            $or: [
                { client: userAddress },
                { freelancer: userAddress },
                { "applicants.address": userAddress } // Also include jobs where user is an applicant
            ]
        });
        res.json(jobs);
    } catch (error) {
        console.error('Error fetching jobs for user:', error);
        res.status(500).json({ error: error.message });
    }
});


// Generic PUT for updating job details. Specific actions below.
app.put('/api/jobs/:id', async (req, res) => {
    try {
        const updateData = { ...req.body };
        if (updateData.freelancer) {
            updateData.freelancer = updateData.freelancer.toLowerCase();
        }
        const job = await Job.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
        if (!job) return res.status(404).json({ error: 'Job not found' });
        res.json(job);
    } catch (error) {
        console.error('Error updating job:', error);
        res.status(400).json({ error: error.message });
    }
});

// NEW: Endpoint to confirm on-chain deposit for a job
app.put('/api/jobs/:id/deposit-confirmed', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        // Ensure only the client can confirm deposit
        if (job.client.toLowerCase() !== req.body.clientAddress.toLowerCase()) {
            return res.status(403).json({ error: 'Unauthorized: Only the client can confirm deposit.' });
        }

        // Update job status and escrow status
        const updatedJob = await Job.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    escrowStatus: 'deposited',
                    // For now, it stays 'open' until accepted by freelancer.
                    depositTxHash: req.body.depositTxHash // Store the transaction hash
                }
            },
            { new: true, runValidators: true }
        );
        res.json(updatedJob);
    } catch (error) {
        console.error('Error confirming job deposit:', error);
        res.status(400).json({ error: error.message });
    }
});


// NEW: POST /api/jobs/:id/apply - Freelancer applies for a job
app.post('/api/jobs/:id/apply', async (req, res) => {
  try {
    const { id } = req.params;
    const { applicantAddress } = req.body;

    if (!applicantAddress || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid job ID or applicant address.' });
    }

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }
    if (job.status !== 'open' || job.escrowStatus !== 'deposited') {
      return res.status(400).json({ message: 'Job is not open for applications or not funded.' });
    }
    if (job.applicants.some(app => app.address.toLowerCase() === applicantAddress.toLowerCase())) {
      return res.status(409).json({ message: 'You have already applied for this job.' });
    }

    job.applicants.push({ address: applicantAddress.toLowerCase() }); // Store address in lowercase
    await job.save();
    res.status(200).json({ message: 'Application submitted successfully.', job });
  } catch (error) {
    console.error('Error applying for job:', error);
    res.status(500).json({ message: error.message });
  }
});

// NEW: PUT /api/jobs/:id/approve-applicant - Client approves an applicant
app.put('/api/jobs/:id/approve-applicant', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientAddress, freelancerAddress } = req.body;

    if (!clientAddress || !freelancerAddress || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid job ID, client address, or freelancer address.' });
    }

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }
    if (job.client.toLowerCase() !== clientAddress.toLowerCase()) {
      return res.status(403).json({ message: 'Unauthorized: Only the client can approve applicants for this job.' });
    }
    // Job must be open and funded for client to approve an applicant
    if (job.status !== 'open' || job.escrowStatus !== 'deposited') {
        return res.status(400).json({ message: 'Job is not open for applicant approval or not funded.' });
    }
    if (!job.applicants.some(app => app.address.toLowerCase() === freelancerAddress.toLowerCase())) {
      return res.status(404).json({ message: 'Applicant not found for this job.' });
    }
    if (job.freelancer) { // If a freelancer is already assigned, prevent approving another
        return res.status(400).json({ message: 'A freelancer is already assigned to this job. Reject them first if you wish to approve another.' });
    }


    job.freelancer = freelancerAddress.toLowerCase(); // Assign freelancer
    job.status = 'pending-client-approval'; // Freelancer needs to accept this assignment
    // Remove approved freelancer from applicants list
    job.applicants = job.applicants.filter(app => app.address.toLowerCase() !== freelancerAddress.toLowerCase());
    await job.save();
    res.status(200).json({ message: 'Applicant approved successfully.', job });
  } catch (error) {
    console.error('Error approving applicant:', error);
    res.status(500).json({ message: error.message });
  }
});

// NEW: PUT /api/jobs/:id/reject-applicant - Client rejects an applicant
app.put('/api/jobs/:id/reject-applicant', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientAddress, freelancerAddress } = req.body; // freelancerAddress here is the applicant to reject

    if (!clientAddress || !freelancerAddress || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid job ID, client address, or applicant address.' });
    }

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }
    if (job.client.toLowerCase() !== clientAddress.toLowerCase()) {
      return res.status(403).json({ message: 'Unauthorized: Only the client can reject applicants for this job.' });
    }
    // Job must be open and funded for client to reject an applicant
    if (job.status !== 'open' || job.escrowStatus !== 'deposited') {
        return res.status(400).json({ message: 'Job is not open for applicant rejection or not funded.' });
    }
    if (!job.applicants.some(app => app.address.toLowerCase() === freelancerAddress.toLowerCase())) {
      return res.status(404).json({ message: 'Applicant not found for this job.' });
    }

    job.applicants = job.applicants.filter(app => app.address.toLowerCase() !== freelancerAddress.toLowerCase());
    await job.save();
    res.status(200).json({ message: 'Applicant rejected successfully.', job });
  } catch (error) {
    console.error('Error rejecting applicant:', error);
    res.status(500).json({ message: error.message });
  }
});

// NEW: PUT /api/jobs/:id/accept-assigned - Freelancer accepts the job after client approval
app.put('/api/jobs/:id/accept-assigned', async (req, res) => {
  try {
    const { id } = req.params;
    const { freelancerAddress } = req.body;

    if (!freelancerAddress || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid job ID or freelancer address.' });
    }

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }
    if (!job.freelancer || job.freelancer.toLowerCase() !== freelancerAddress.toLowerCase()) { // Ensure they are the assigned freelancer
      return res.status(403).json({ message: 'You are not the assigned freelancer for this job.' });
    }
    if (job.status !== 'pending-client-approval') {
      return res.status(400).json({ message: 'Job is not in pending client approval state.' });
    }

    job.status = 'in-progress';
    await job.save();
    res.status(200).json({ message: 'Job successfully accepted by assigned freelancer.', job });
  } catch (error) {
    console.error('Error accepting assigned job:', error);
    res.status(500).json({ message: error.message });
  }
});


// NEW: Endpoint for freelancer to mark job as completed
app.put('/api/jobs/:id/mark-completed', async (req, res) => {
    try {
        const { freelancerAddress } = req.body;
        const job = await Job.findById(req.params.id);

        if (!job) return res.status(404).json({ error: 'Job not found' });
        if (job.freelancer.toLowerCase() !== freelancerAddress.toLowerCase()) {
            return res.status(403).json({ error: 'Unauthorized: Only the assigned freelancer can mark this job as completed.' });
        }
        if (job.status !== 'in-progress') {
            return res.status(400).json({ error: 'Job is not in progress.' });
        }

        const updatedJob = await Job.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    status: 'completed' // Mark as completed (client still needs to release funds)
                }
            },
            { new: true, runValidators: true }
        );
        res.json(updatedJob);
    } catch (error) {
        console.error('Error marking job as completed:', error);
        res.status(400).json({ error: error.message });
    }
});


// NEW: Endpoint to confirm on-chain fund release for a job
app.put('/api/jobs/:id/release-confirmed', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        // Ensure only the client can confirm release (or an admin)
        if (job.client.toLowerCase() !== req.body.clientAddress.toLowerCase()) {
            return res.status(403).json({ error: 'Unauthorized: Only the client can confirm fund release.' });
        }

        const updatedJob = await Job.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    escrowStatus: 'released', // On-chain escrow status
                    completionTxHash: req.body.completionTxHash // Store the transaction hash
                }
            },
            { new: true, runValidators: true }
        );
        res.json(updatedJob);
    } catch (error) {
        console.error('Error confirming job release:', error);
        res.status(400).json({ error: error.message });
    }
});

// NEW: Endpoint to confirm on-chain refund for a job
app.put('/api/jobs/:id/refund-confirmed', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        // Ensure only the client can confirm refund (or an admin)
        if (job.client.toLowerCase() !== req.body.clientAddress.toLowerCase()) {
            return res.status(403).json({ error: 'Unauthorized: Only the client can confirm refund.' });
        }

        const updatedJob = await Job.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    escrowStatus: 'refunded', // On-chain escrow status
                    status: 'cancelled' // Job is cancelled after refund
                }
            },
            { new: true, runValidators: true }
        );
        res.json(updatedJob);
    } catch (error) {
        console.error('Error confirming job refund:', error);
        res.status(400).json({ error: error.message });
    }
});


// Get total general deposits for an account (from smart contract)
app.get('/api/deposits/total/:account', async (req, res) => {
    try {
        const addressToCheck = req.params.account;
        const escrowAbiForGeneralDeposits = [
            {
                inputs: [{ internalType: 'address', name: '', type: 'address' }],
                name: 'generalDeposits', // Changed to generalDeposits
                outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
                stateMutability: 'view',
                type: 'function',
            },
        ];

        const depositBigInt = await publicClient.readContract({
            address: ESCROW_CONTRACT_ADDRESS,
            abi: escrowAbiForGeneralDeposits,
            functionName: 'generalDeposits',
            args: [addressToCheck],
        });

        const totalDeposits = formatUnits(depositBigInt, 6); // USDC uses 6 decimals
        res.json({ totalDeposits });
    } catch (error) {
        console.error('Error fetching total general deposits:', error);
        res.status(500).json({ error: error.message });
    }
});

// Disputes
app.post('/api/disputes', async (req, res) => {
    try {
        const disputeData = { ...req.body, reporterAddress: req.body.reporterAddress.toLowerCase() };
        const dispute = new Dispute(disputeData);
        await dispute.save();
        // Update job status to 'disputed' in MongoDB
        await Job.findByIdAndUpdate(dispute.jobId, { status: 'disputed', escrowStatus: 'disputed' });
        res.status(201).json(dispute);
    } catch (error) {
        console.error('Error creating dispute:', error);
        res.status(400).json({ error: error.message });
    }
});

// Withdrawals
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

// NEW: POST /api/jobs/:id/messages - Send a message for a job
app.post('/api/jobs/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { sender, text } = req.body;

    if (!sender || !text || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid job ID, sender, or message text.' });
    }

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    // Ensure only client or assigned freelancer can send messages
    const isAuthorized = job.client.toLowerCase() === sender.toLowerCase() ||
                         (job.freelancer && job.freelancer.toLowerCase() === sender.toLowerCase());

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Only the client or assigned freelancer can send messages for this job.' });
    }

    const newMessage = { sender: sender.toLowerCase(), text }; // Store sender in lowercase
    job.messages.push(newMessage);
    await job.save();
    res.status(201).json(newMessage); // Return the newly added message
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: error.message });
  }
});

// NEW: GET /api/jobs/:id/messages - Get all messages for a job
app.get('/api/jobs/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid job ID.' });
    }

    const job = await Job.findById(id).select('messages'); // Only fetch messages
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }
    res.status(200).json(job.messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: error.message });
  }
});

// NEW: PUT /api/jobs/:id/rate-freelancer - Client rates the freelancer for a job
app.put('/api/jobs/:id/rate-freelancer', async (req, res) => {
    try {
        const { id } = req.params;
        const { clientAddress, freelancerAddress, rating } = req.body;

        if (!clientAddress || !freelancerAddress || rating === undefined || rating < 1 || rating > 5 || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid request: missing client/freelancer address, or invalid rating (1-5).' });
        }

        const job = await Job.findById(id);
        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }
        if (job.client.toLowerCase() !== clientAddress.toLowerCase()) {
            return res.status(403).json({ message: 'Unauthorized: Only the client can rate for this job.' });
        }
        if (!job.freelancer || job.freelancer.toLowerCase() !== freelancerAddress.toLowerCase()) {
            return res.status(400).json({ message: 'Freelancer not assigned or mismatch for this job.' });
        }
        if (job.escrowStatus !== 'released') {
            return res.status(400).json({ message: 'Funds must be released for this job before rating.' });
        }
        if (job.rated) {
            return res.status(400).json({ message: 'Freelancer has already been rated for this job.' });
        }

        // Update the job to mark it as rated
        job.rated = true;
        await job.save();

        // Find the freelancer's user profile
        const freelancerUser = await User.findOne({ address: freelancerAddress.toLowerCase() });
        if (!freelancerUser) {
            console.warn(`Freelancer user profile not found for address: ${freelancerAddress}. Cannot update rating.`);
            return res.status(404).json({ message: 'Freelancer profile not found to update rating.' });
        }

        // Update totalRatingSum and totalRatingsCount
        freelancerUser.totalRatingSum += rating;
        freelancerUser.totalRatingsCount += 1;
        freelancerUser.rating = (freelancerUser.totalRatingSum / freelancerUser.totalRatingsCount).toFixed(1); // Calculate new average

        await freelancerUser.save();

        res.status(200).json({ message: 'Rating submitted successfully.', job, freelancerUser });
    } catch (error) {
        console.error('Error rating freelancer:', error);
        res.status(500).json({ message: error.message });
    }
});

// --- ADMIN ROUTES ---
// All admin routes should be protected by the authenticateAdmin middleware
// You will need to set process.env.ADMIN_SECRET_KEY in your .env file for this to work.
// Example: ADMIN_SECRET_KEY=your_super_secret_admin_key_here

// Get all disputes (for admin review)
app.get('/api/admin/disputes', authenticateAdmin, async (req, res) => {
    try {
        const disputes = await Dispute.find({}).populate('jobId'); // Populate job details
        res.json(disputes);
    } catch (error) {
        console.error('Error fetching disputes for admin:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin resolves a dispute
app.put('/api/admin/disputes/:id/resolve', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { resolutionDetails, jobStatus, escrowStatus } = req.body; // Admin can specify outcome

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid dispute ID.' });
        }

        const dispute = await Dispute.findById(id);
        if (!dispute) {
            return res.status(404).json({ message: 'Dispute not found.' });
        }

        if (dispute.status !== 'open' && dispute.status !== 'under-review') {
            return res.status(400).json({ message: `Dispute is already ${dispute.status}.` });
        }

        const updatedDispute = await Dispute.findByIdAndUpdate(
            id,
            {
                status: 'resolved',
                resolvedAt: Date.now(),
                resolutionDetails: resolutionDetails || 'Resolved by admin.',
            },
            { new: true, runValidators: true }
        );

        // Optionally update the associated job's status and escrow status based on resolution
        if (jobStatus || escrowStatus) {
            const jobUpdate = {};
            if (jobStatus) jobUpdate.status = jobStatus;
            if (escrowStatus) jobUpdate.escrowStatus = escrowStatus;
            await Job.findByIdAndUpdate(dispute.jobId, jobUpdate);
        }

        res.json(updatedDispute);
    } catch (error) {
        console.error('Error resolving dispute:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin closes a dispute (e.g., no action needed, or invalid)
app.put('/api/admin/disputes/:id/close', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { resolutionDetails } = req.body; // Optional details for closing

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid dispute ID.' });
        }

        const dispute = await Dispute.findById(id);
        if (!dispute) {
            return res.status(404).json({ message: 'Dispute not found.' });
        }

        if (dispute.status !== 'open' && dispute.status !== 'under-review') {
            return res.status(400).json({ message: `Dispute is already ${dispute.status}.` });
        }

        const updatedDispute = await Dispute.findByIdAndUpdate(
            id,
            {
                status: 'closed',
                resolvedAt: Date.now(),
                resolutionDetails: resolutionDetails || 'Dispute closed by admin.',
            },
            { new: true, runValidators: true }
        );

        res.json(updatedDispute);
    } catch (error) {
        console.error('Error closing dispute:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin can manually update a job's status and escrow status (for dispute outcomes, etc.)
app.put('/api/admin/jobs/:id/update-status', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, escrowStatus } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid job ID.' });
        }
        if (!status && !escrowStatus) {
            return res.status(400).json({ message: 'Please provide at least one status to update (status or escrowStatus).' });
        }

        const job = await Job.findById(id);
        if (!job) {
            return res.status(404).json({ message: 'Job not found.' });
        }

        const updateFields = {};
        if (status) {
            if (!Job.schema.path('status').enumValues.includes(status)) {
                return res.status(400).json({ message: `Invalid job status: ${status}.` });
            }
            updateFields.status = status;
        }
        if (escrowStatus) {
            if (!Job.schema.path('escrowStatus').enumValues.includes(escrowStatus)) {
                return res.status(400).json({ message: `Invalid escrow status: ${escrowStatus}.` });
            }
            updateFields.escrowStatus = escrowStatus;
        }

        const updatedJob = await Job.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        res.json(updatedJob);
    } catch (error) {
        console.error('Error updating job status by admin:', error);
        res.status(500).json({ error: error.message });
    }
});


// --- Server Start ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// --- EXPORT THE APP DIRECTLY for Vercel Serverless Function compatibility ---
// This is crucial for Vercel to pick up your Express app correctly when deployed from a subdirectory.
module.exports = app;
