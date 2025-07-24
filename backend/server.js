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
    allowedHeaders: ['Content-Type', 'Authorization'],
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
// ADD THIS LINE FOR DEBUGGING:
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
    rating: { type: Number, default: 0, min: 0, max: 5 }, // Rating from 0-5
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
            escrowStatus: 'pending-deposit' // Initial state, client needs to fund escrow
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
        // Allow filtering by status and escrowStatus
        const queryFilter = {};
        if (req.query.status) {
            queryFilter.status = req.query.status;
        }
        if (req.query.escrowStatus) {
            queryFilter.escrowStatus = req.query.escrowStatus;
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
                    // Optionally, you might want to set main status to 'open' again
                    // if it was temporarily changed for deposit flow, or keep as is.
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


// NEW: Endpoint for freelancer to accept a job
app.put('/api/jobs/:id/accept', async (req, res) => {
    try {
        const { freelancerAddress } = req.body;
        const job = await Job.findById(req.params.id);

        if (!job) return res.status(404).json({ error: 'Job not found' });
        if (job.status !== 'open') return res.status(400).json({ error: 'Job is not open for acceptance.' });
        if (job.escrowStatus !== 'deposited') return res.status(400).json({ error: 'Job funds not yet deposited by client.' });

        const updatedJob = await Job.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    freelancer: freelancerAddress.toLowerCase(),
                    status: 'pending-client-approval' // Client needs to approve freelancer
                }
            },
            { new: true, runValidators: true }
        );
        res.json(updatedJob);
    } catch (error) {
        console.error('Error accepting job:', error);
        res.status(400).json({ error: error.message });
    }
});

// NEW: Endpoint for client to approve a freelancer
app.put('/api/jobs/:id/approve-freelancer', async (req, res) => {
    try {
        const { clientAddress } = req.body;
        const job = await Job.findById(req.params.id);

        if (!job) return res.status(404).json({ error: 'Job not found' });
        if (job.client.toLowerCase() !== clientAddress.toLowerCase()) {
            return res.status(403).json({ error: 'Unauthorized: Only the client can approve this freelancer.' });
        }
        if (job.status !== 'pending-client-approval') {
            return res.status(400).json({ error: 'Job is not in pending approval state.' });
        }

        const updatedJob = await Job.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    clientApprovedFreelancer: true,
                    status: 'in-progress' // Job now officially in progress
                }
            },
            { new: true, runValidators: true }
        );
        res.json(updatedJob);
    } catch (error) {
        console.error('Error approving freelancer:', error);
        res.status(400).json({ error: error.message });
    }
});

// NEW: Endpoint for client to reject a freelancer
app.put('/api/jobs/:id/reject-freelancer', async (req, res) => {
    try {
        const { clientAddress } = req.body;
        const job = await Job.findById(req.params.id);

        if (!job) return res.status(404).json({ error: 'Job not found' });
        if (job.client.toLowerCase() !== clientAddress.toLowerCase()) {
            return res.status(403).json({ error: 'Unauthorized: Only the client can reject this freelancer.' });
        }
        if (job.status !== 'pending-client-approval') {
            return res.status(400).json({ error: 'Job is not in pending approval state.' });
        }

        const updatedJob = await Job.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    freelancer: null, // Unassign freelancer
                    clientApprovedFreelancer: false,
                    status: 'open' // Revert to open for other freelancers
                }
            },
            { new: true, runValidators: true }
        );
        res.json(updatedJob);
    } catch (error) {
        console.error('Error rejecting freelancer:', error);
        res.status(400).json({ error: error.message });
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

// --- Server Start ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// --- EXPORT THE APP DIRECTLY for Vercel Serverless Function compatibility ---
// This is crucial for Vercel to pick up your Express app correctly when deployed from a subdirectory.
module.exports = app;
