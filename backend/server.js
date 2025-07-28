const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { createPublicClient, http, formatUnits } = require('viem');
require('dotenv').config();

const app = express();

app.use((req, res, next) => {
    console.log(`Incoming Request: ${req.method} ${req.url}`);
    console.log(`Request Origin Header: ${req.headers.origin}`);
    next();
});

const allowedOrigins = [
    'https://freelanceflow.net',
    'https://www.freelanceflow.net',
    'https://freelanceflow-lisk.vercel.app',
    'https://freelanceflow-backend-api.vercel.app',
    'http://localhost:3000',
    'http://localhost:5000'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            console.log(`CORS: Origin ${origin} is allowed.`);
            return callback(null, true);
        }
        const msg = `CORS: Origin ${origin} not allowed by the application.`;
        console.error(msg);
        return callback(new Error(msg), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
    credentials: true
}));

app.use(express.json());

const liskNetwork = {
    id: process.env.NODE_ENV === 'production' ? 1135 : 4202,
    name: process.env.NODE_ENV === 'production' ? 'Lisk' : 'Lisk Sepolia Testnet',
    rpcUrls: {
        default: {
            http: [process.env.NODE_ENV === 'production' ? 'https://rpc.api.lisk.com' : 'https://rpc.sepolia-api.lisk.com'],
        },
    },
    blockExplorers: {
        default: {
            name: process.env.NODE_ENV === 'production' ? 'Lisk Blockscout' : 'Lisk Blockscout',
            url: process.env.NODE_ENV === 'production' ? 'https://blockscout.lisk.com/' : 'https://sepolia-blockscout.lisk.com/',
        },
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

console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Using Lisk RPC: ${liskNetwork.rpcUrls.default.http[0]}`);
console.log(`ESCROW_CONTRACT_ADDRESS: ${ESCROW_CONTRACT_ADDRESS}`);
console.log(`USDC_CONTRACT_ADDRESS: ${USDC_CONTRACT_ADDRESS}`);

console.log('Attempting to connect to MongoDB with URI:', process.env.MONGO_URI ? 'URI_SET' : 'URI_NOT_SET');
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB initial connection error:', err);
        process.exit(1);
    });

const userSchema = new mongoose.Schema({
    address: { type: String, required: true, unique: true, lowercase: true },
    role: { type: String, enum: ['freelancer', 'client', 'both'], default: 'freelancer' },
    skills: [String],
    portfolio: [String],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatingSum: { type: Number, default: 0 },
    totalRatingsCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
userSchema.pre('save', function (next) { this.updatedAt = Date.now(); next(); });
userSchema.pre('findOneAndUpdate', function (next) { this.set({ updatedAt: Date.now() }); next(); });

const jobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    client: { type: String, required: true, lowercase: true },
    freelancer: { type: String, default: null, lowercase: true },
    status: {
        type: String,
        enum: ['open', 'pending-client-approval', 'in-progress', 'completed', 'disputed', 'cancelled'],
        default: 'open'
    },
    escrowStatus: {
        type: String,
        enum: ['pending-deposit', 'deposited', 'active', 'released', 'refunded', 'disputed'],
        default: 'pending-deposit'
    },
    clientApprovedFreelancer: { type: Boolean, default: false },
    depositTxHash: { type: String, default: null },
    completionTxHash: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    applicants: [
      {
        address: { type: String, required: true, lowercase: true },
        timestamp: { type: Date, default: Date.now },
      }
    ],
    messages: [
      {
        sender: { type: String, required: true, lowercase: true },
        text: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      }
    ],
    requiredSkills: [{ type: String }],
    rated: { type: Boolean, default: false }
});
jobSchema.pre('save', function (next) { this.updatedAt = Date.now(); next(); });
jobSchema.pre('findOneAndUpdate', function (next) { this.set({ updatedAt: Date.now() }); next(); });

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
    country: { type: String, required: true },
    mobileMoneyNetwork: { type: String, required: true },
    mobilePhoneNumber: { type: String, required: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date, default: null },
    txId: { type: String, default: null },
});

const User = mongoose.model('User', userSchema);
const Job = mongoose.model('Job', jobSchema);
const Dispute = mongoose.model('Dispute', disputeSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

const authenticateAdmin = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey === process.env.ADMIN_SECRET_KEY) {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }
};

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

app.post('/api/jobs', async (req, res) => {
    try {
        const jobData = {
            ...req.body,
            client: req.body.client.toLowerCase(),
            status: 'open',
            escrowStatus: 'pending-deposit',
            requiredSkills: req.body.requiredSkills || [],
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

app.get('/api/jobs/forUser/:address', async (req, res) => {
    try {
        const userAddress = req.params.address.toLowerCase();
        const jobs = await Job.find({
            $or: [
                { client: userAddress },
                { freelancer: userAddress },
                { "applicants.address": userAddress }
            ]
        });
        res.json(jobs);
    } catch (error) {
        console.error('Error fetching jobs for user:', error);
        res.status(500).json({ error: error.message });
    }
});

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

app.put('/api/jobs/:id/deposit-confirmed', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        if (job.client.toLowerCase() !== req.body.clientAddress.toLowerCase()) {
            return res.status(403).json({ error: 'Unauthorized: Only the client can confirm deposit.' });
        }

        const updatedJob = await Job.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    escrowStatus: 'deposited',
                    depositTxHash: req.body.depositTxHash
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

    job.applicants.push({ address: applicantAddress.toLowerCase() });
    await job.save();
    res.status(200).json({ message: 'Application submitted successfully.', job });
  } catch (error) {
    console.error('Error applying for job:', error);
    res.status(500).json({ message: error.message });
  }
});

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
    if (job.status !== 'open' || job.escrowStatus !== 'deposited') {
        return res.status(400).json({ message: 'Job is not open for applicant approval or not funded.' });
    }
    if (!job.applicants.some(app => app.address.toLowerCase() === freelancerAddress.toLowerCase())) {
      return res.status(404).json({ message: 'Applicant not found for this job.' });
    }
    if (job.freelancer) {
        return res.status(400).json({ message: 'A freelancer is already assigned to this job. Reject them first if you wish to approve another.' });
    }

    job.freelancer = freelancerAddress.toLowerCase();
    job.status = 'pending-client-approval';
    job.applicants = job.applicants.filter(app => app.address.toLowerCase() !== freelancerAddress.toLowerCase());
    await job.save();
    res.status(200).json({ message: 'Applicant approved successfully.', job });
  } catch (error) {
    console.error('Error approving applicant:', error);
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/jobs/:id/reject-applicant', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientAddress, freelancerAddress } = req.body;

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
    if (!job.freelancer || job.freelancer.toLowerCase() !== freelancerAddress.toLowerCase()) {
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
                    status: 'completed'
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

app.put('/api/jobs/:id/release-confirmed', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        if (job.client.toLowerCase() !== req.body.clientAddress.toLowerCase()) {
            return res.status(403).json({ error: 'Unauthorized: Only the client can confirm fund release.' });
        }

        const updatedJob = await Job.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    escrowStatus: 'released',
                    completionTxHash: req.body.completionTxHash
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

app.put('/api/jobs/:id/refund-confirmed', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        if (job.client.toLowerCase() !== req.body.clientAddress.toLowerCase()) {
            return res.status(403).json({ error: 'Unauthorized: Only the client can confirm refund.' });
        }

        const updatedJob = await Job.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    escrowStatus: 'refunded',
                    status: 'cancelled'
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

app.get('/api/deposits/total/:account', async (req, res) => {
    try {
        const addressToCheck = req.params.account;
        const escrowAbiForGeneralDeposits = [
            {
                inputs: [{ internalType: 'address', name: '', type: 'address' }],
                name: 'generalDeposits',
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

        const totalDeposits = formatUnits(depositBigInt, 6);
        res.json({ totalDeposits });
    } catch (error) {
        console.error('Error fetching total general deposits:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/disputes', async (req, res) => {
    try {
        const disputeData = { ...req.body, reporterAddress: req.body.reporterAddress.toLowerCase() };
        const dispute = new Dispute(disputeData);
        await dispute.save();
        await Job.findByIdAndUpdate(dispute.jobId, { status: 'disputed', escrowStatus: 'disputed' });
        res.status(201).json(dispute);
    } catch (error) {
        console.error('Error creating dispute:', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/withdrawals', async (req, res) => {
    try {
        const withdrawalData = {
            requestorAddress: req.body.requestorAddress.toLowerCase(),
            usdcAmount: req.body.usdcAmount,
            country: req.body.country,
            mobileMoneyNetwork: req.body.mobileMoneyNetwork,
            mobilePhoneNumber: req.body.mobilePhoneNumber,
            status: 'pending',
        };
        const withdrawal = new Withdrawal(withdrawalData);
        await withdrawal.save();
        res.status(201).json(withdrawal);
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        res.status(400).json({ error: error.message });
    }
});

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

    const isAuthorized = job.client.toLowerCase() === sender.toLowerCase() ||
                         (job.freelancer && job.freelancer.toLowerCase() === sender.toLowerCase());

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Only the client or assigned freelancer can send messages for this job.' });
    }

    const newMessage = { sender: sender.toLowerCase(), text };
    job.messages.push(newMessage);
    await job.save();
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/jobs/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid job ID.' });
    }

    const job = await Job.findById(id).select('messages');
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }
    res.status(200).json(job.messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: error.message });
  }
});

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

        job.rated = true;
        await job.save();

        const freelancerUser = await User.findOne({ address: freelancerAddress.toLowerCase() });
        if (!freelancerUser) {
            console.warn(`Freelancer user profile not found for address: ${freelancerAddress}. Cannot update rating.`);
            return res.status(404).json({ message: 'Freelancer profile not found to update rating.' });
        }

        freelancerUser.totalRatingSum += rating;
        freelancerUser.totalRatingsCount += 1;
        freelancerUser.rating = (freelancerUser.totalRatingSum / freelancerUser.totalRatingsCount).toFixed(1);

        await freelancerUser.save();

        res.status(200).json({ message: 'Rating submitted successfully.', job, freelancerUser });
    } catch (error) {
        console.error('Error rating freelancer:', error);
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/search/jobs', async (req, res) => {
    try {
        const searchTerm = req.query.query;
        if (!searchTerm) {
            return res.status(400).json({ error: 'Search query is required.' });
        }
        const regex = new RegExp(searchTerm, 'i');

        const jobs = await Job.find({
            $or: [
                { title: { $regex: regex } },
                { description: { $regex: regex } }
            ]
        });
        res.json(jobs);
    } catch (error) {
        console.error('Error searching jobs:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/search/users', async (req, res) => {
    try {
        const searchTerm = req.query.query;
        if (!searchTerm) {
            return res.status(400).json({ error: 'Search query is required.' });
        }
        const regex = new RegExp(searchTerm, 'i');

        const users = await User.find({
            $or: [
                { address: { $regex: regex } },
                { skills: { $regex: regex } },
                { portfolio: { $regex: regex } }
            ]
        });
        res.json(users);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/disputes', authenticateAdmin, async (req, res) => {
    try {
        const disputes = await Dispute.find({}).populate('jobId');
        res.json(disputes);
    } catch (error) {
        console.error('Error fetching disputes for admin:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/disputes/:id/resolve', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { resolutionDetails, jobStatus, escrowStatus } = req.body;

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

app.put('/api/admin/disputes/:id/close', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { resolutionDetails } = req.body;

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

app.get('/api/admin/users/count', authenticateAdmin, async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        res.json({ count: userCount });
    } catch (error) {
        console.error('Error fetching user count for admin:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (error) {
        console.error('Error fetching all users for admin:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/withdrawals', authenticateAdmin, async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({});
        res.json(withdrawals);
    } catch (error) {
        console.error('Error fetching all withdrawals for admin:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/withdrawals/:id/process', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid withdrawal ID.' });
        }

        const withdrawal = await Withdrawal.findById(id);
        if (!withdrawal) {
            return res.status(404).json({ message: 'Withdrawal request not found.' });
        }
        if (withdrawal.status === 'completed' || withdrawal.status === 'failed') {
            return res.status(400).json({ message: `Withdrawal request is already ${withdrawal.status}.` });
        }

        const updatedWithdrawal = await Withdrawal.findByIdAndUpdate(
            id,
            {
                $set: {
                    status: 'completed',
                    processedAt: Date.now(),
                }
            },
            { new: true, runValidators: true }
        );

        res.json(updatedWithdrawal);
    } catch (error) {
        console.error('Error processing withdrawal request by admin:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
