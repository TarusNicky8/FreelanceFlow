// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

// This contract manages USDC escrows for freelance jobs and general deposits.
// It is now upgradable and includes logic for platform fees.
contract Escrow is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    IERC20Upgradeable public usdc; // The USDC token contract instance

    // Address of the ProfitFlow contract where platform fees will be sent
    address public profitFlowAddress;

    // Platform fee percentage (e.g., 100 = 1%, 50 = 0.5%). Max 10,000 for 100%.
    // Stored as basis points (bps) to avoid floating point issues.
    uint256 public platformFeePercentage; // Max 10,000 (for 100%)

    // --- General Deposits ---
    mapping(address => uint256) public generalDeposits;

    // --- Job-Specific Escrow ---
    enum EscrowStatus {
        Pending,    // Job created on-chain, waiting for client to deposit funds
        Active,     // Funds deposited, job is in progress
        Released,   // Funds released to freelancer
        Refunded,   // Funds refunded to client
        Disputed    // Job is under dispute (requires off-chain resolution, then refund/release)
    }

    struct JobEscrow {
        address client;
        address freelancer; // Can be address(0) initially
        uint256 amount;
        EscrowStatus status;
    }

    mapping(string => JobEscrow) public jobEscrows;

    // --- Events ---
    event GeneralDepositMade(address indexed depositor, uint256 amount);
    event GeneralFundsReleased(address indexed recipient, uint256 amount);
    event GeneralFundsRefunded(address indexed recipient, uint256 amount);

    // Updated event for when a job listing is created on-chain (no freelancer yet)
    event JobListingCreated(string indexed jobId, address indexed client, uint256 amount);
    event JobDepositMade(string indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
    event JobFundsReleased(string indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
    event JobFundsRefunded(string indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
    event JobEscrowStatusUpdated(string indexed jobId, EscrowStatus newStatus);
    event PlatformFeeUpdated(uint256 newPercentage);
    event FeeCollected(string indexed jobId, uint256 feeAmount, uint256 originalAmount);
    // New event for when a freelancer is assigned to an existing job on-chain
    event FreelancerAssigned(string indexed jobId, address indexed freelancer);


    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Constructor is empty for upgradable contracts using Initializable.
        // Initialization logic goes into the initialize function.
    }

    // The initialize function acts as the constructor for upgradable contracts.
    // It's called only once, immediately after deployment.
    function initialize(address _usdc, address _profitFlowAddress, uint256 _initialFeePercentage) public initializer {
        __Ownable_init(); // Initialize the Ownable part of the contract
        __UUPSUpgradeable_init(); // Initializing UUPS
        require(_usdc != address(0), "Escrow: USDC address cannot be zero");
        require(_profitFlowAddress != address(0), "Escrow: ProfitFlow address cannot be zero");
        require(_initialFeePercentage <= 10000, "Escrow: Fee percentage cannot exceed 100%"); // 10000 basis points = 100%

        usdc = IERC20Upgradeable(_usdc);
        profitFlowAddress = _profitFlowAddress;
        platformFeePercentage = _initialFeePercentage; // Set initial fee (e.g., 100 for 1%)
    }

    // This function must be implemented for UUPSUpgradeable.
    // It is called during the upgrade process to authorize the upgrade.
    // Only the contract owner can authorize an upgrade.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // --- Admin Functions for Fee Management ---

    // Allows the owner to update the platform fee percentage.
    // This provides flexibility for future business model adjustments.
    function updatePlatformFeePercentage(uint256 newPercentage) external onlyOwner {
        require(newPercentage <= 10000, "Escrow: Fee percentage cannot exceed 100%");
        platformFeePercentage = newPercentage;
        emit PlatformFeeUpdated(newPercentage);
    }

    // --- General Deposit/Release/Refund Functions ---
    // (No changes here, as they are not tied to job-specific fees)
    function depositGeneral(uint256 amount) external {
        require(amount > 0, "Escrow: Amount must be greater than 0");
        usdc.transferFrom(msg.sender, address(this), amount);
        generalDeposits[msg.sender] += amount;
        emit GeneralDepositMade(msg.sender, amount);
    }

    function releaseGeneral(address recipient, uint256 amount) external onlyOwner {
        require(generalDeposits[recipient] >= amount, "Escrow: Insufficient general funds for recipient");
        generalDeposits[recipient] -= amount;
        usdc.transfer(recipient, amount);
        emit GeneralFundsReleased(recipient, amount);
    }

    function refundGeneral(address recipient, uint256 amount) external onlyOwner {
        require(generalDeposits[recipient] >= amount, "Escrow: Insufficient general funds for recipient");
        generalDeposits[recipient] -= amount;
        usdc.transfer(recipient, amount);
        emit GeneralFundsRefunded(recipient, amount);
    }

    // --- Job-Specific Escrow Functions ---

    // NEW: Step 1 of job creation. Client creates a job listing on-chain without an assigned freelancer yet.
    // This allows jobs to be "known" on-chain and fundable before a freelancer is chosen.
    function createJobListingOnChain(string calldata _jobId, address _client, uint256 _amount) external {
        // Ensure no job with this ID already exists on-chain.
        require(jobEscrows[_jobId].client == address(0), "Escrow: Job with this ID already exists on-chain");
        // Ensure only the designated client can create the job listing.
        require(msg.sender == _client, "Escrow: Only the designated client can create this job listing");
        require(_amount > 0, "Escrow: Amount must be greater than 0");

        jobEscrows[_jobId] = JobEscrow({
            client: _client,
            freelancer: address(0), // No freelancer assigned yet
            amount: _amount,
            status: EscrowStatus.Pending // The job is pending a deposit.
        });

        emit JobListingCreated(_jobId, _client, _amount);
        emit JobEscrowStatusUpdated(_jobId, EscrowStatus.Pending);
    }

    // NEW: Allows the client to assign a freelancer on-chain to an existing job.
    // This should be called after a freelancer is approved in your application logic.
    function assignFreelancerOnChain(string calldata _jobId, address _freelancer) external { // Corrected 'calcalata' to 'calldata'
        JobEscrow storage job = jobEscrows[_jobId];
        require(job.client != address(0), "Escrow: Job not found");
        require(job.client == msg.sender, "Escrow: Only the job client can assign a freelancer");
        require(job.freelancer == address(0), "Escrow: Freelancer already assigned"); // Prevent re-assignment
        require(_freelancer != address(0), "Escrow: Freelancer address cannot be zero");

        job.freelancer = _freelancer;
        emit FreelancerAssigned(_jobId, _freelancer);
        // The status remains whatever it was (e.g., Pending or Active if already funded)
        emit JobEscrowStatusUpdated(_jobId, job.status);
    }


    // Client deposits funds for an existing, pending job.
    // This is Step 2 (or later) of the on-chain process.
    function fundJob(string calldata _jobId) external {
        JobEscrow storage job = jobEscrows[_jobId];

        // Ensure the job exists and is in a pending state.
        require(job.client != address(0), "Escrow: Job not found");
        require(job.status == EscrowStatus.Pending, "Escrow: Job not in pending state for funding");
        // Ensure only the designated client can fund the job.
        require(msg.sender == job.client, "Escrow: Only the designated client can fund this job");

        // The job amount is already stored from the `createJobListingOnChain` call.
        uint256 amountToDeposit = job.amount;
        require(amountToDeposit > 0, "Escrow: Amount must be greater than 0");

        // Transfer the funds from the client to the contract.
        usdc.transferFrom(msg.sender, address(this), amountToDeposit);

        // Update the job status to active.
        job.status = EscrowStatus.Active;

        // Note: job.freelancer might still be address(0) if assigned after funding.
        emit JobDepositMade(_jobId, job.client, job.freelancer, amountToDeposit);
        emit JobEscrowStatusUpdated(_jobId, EscrowStatus.Active);
    }

    // Client releases funds to the freelancer for a specific job, deducting platform fee.
    function releaseJob(string calldata _jobId) external {
        require(jobEscrows[_jobId].client == msg.sender, "Escrow: Only client can release funds for this job");
        require(jobEscrows[_jobId].status == EscrowStatus.Active, "Escrow: Job not in active state for release");
        require(jobEscrows[_jobId].freelancer != address(0), "Escrow: No freelancer assigned to release funds to"); // Ensure freelancer is assigned before release

        JobEscrow storage job = jobEscrows[_jobId];
        job.status = EscrowStatus.Released;

        uint256 totalAmount = job.amount;
        uint256 feeAmount = (totalAmount * platformFeePercentage) / 10000; // Calculate fee in basis points
        uint256 amountToFreelancer = totalAmount - feeAmount;

        // Transfer fee to ProfitFlow contract
        if (feeAmount > 0) {
            // Ensure this Escrow contract has enough balance to cover the fee
            require(usdc.balanceOf(address(this)) >= feeAmount, "Escrow: Insufficient balance for fee transfer");
            IERC20Upgradeable(profitFlowAddress).transfer(profitFlowAddress, feeAmount);
            emit FeeCollected(_jobId, feeAmount, totalAmount);
        }

        // Transfer remaining amount to the freelancer
        usdc.transfer(job.freelancer, amountToFreelancer);

        emit JobFundsReleased(_jobId, job.client, job.freelancer, amountToFreelancer); // Emit actual amount sent to freelancer
        emit JobEscrowStatusUpdated(_jobId, EscrowStatus.Released);
    }

    // Client refunds funds to themselves for a specific job.
    // No fee is taken on refund.
    function refundJob(string calldata _jobId) external {
        require(jobEscrows[_jobId].client == msg.sender, "Escrow: Only client can refund funds for this job");
        require(jobEscrows[_jobId].status == EscrowStatus.Active || jobEscrows[_jobId].status == EscrowStatus.Disputed, "Escrow: Job not in active or disputed state for refund");

        JobEscrow storage job = jobEscrows[_jobId];
        job.status = EscrowStatus.Refunded;
        usdc.transfer(job.client, job.amount); // Transfer full amount back to the client
        emit JobFundsRefunded(_jobId, job.client, job.freelancer, job.amount);
        emit JobEscrowStatusUpdated(_jobId, EscrowStatus.Refunded);
    }

    // Allows the owner (or a dispute resolver) to set a job's escrow status to disputed.
    function setJobEscrowDisputed(string calldata _jobId) external onlyOwner {
        require(jobEscrows[_jobId].status == EscrowStatus.Active, "Escrow: Job not in active state to be disputed");
        jobEscrows[_jobId].status = EscrowStatus.Disputed;
        emit JobEscrowStatusUpdated(_jobId, EscrowStatus.Disputed);
    }

    // View function to get details of a specific job escrow by its ID.
    function getJobEscrowDetails(string calldata _jobId)
        external
        view
        returns (address client, address freelancer, uint256 amount, EscrowStatus status)
    {
        JobEscrow storage job = jobEscrows[_jobId];
        return (job.client, job.freelancer, job.amount, job.status);
    }
}
