// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// This contract manages USDC escrows for freelance jobs and general deposits.
contract Escrow is Ownable {
    IERC20 public usdc; // The USDC token contract instance

    // --- General Deposits ---
    // Mapping to track general USDC deposits by user address (not tied to a specific job)
    // This can be used for platform-wide funds, or as a holding area before assigning to jobs,
    // or for the Divvi integration demo.
    mapping(address => uint256) public generalDeposits;

    // --- Job-Specific Escrow ---
    // Enum to define the status of a job's escrow on-chain
    enum EscrowStatus {
        Pending,   // Job created, waiting for client to deposit funds
        Active,    // Funds deposited, job is in progress
        Released,  // Funds released to freelancer
        Refunded,  // Funds refunded to client
        Disputed   // Job is under dispute (requires off-chain resolution, then refund/release)
    }

    // Struct to hold detailed information for each job's escrow
    struct JobEscrow {
        address client;     // The client's address who initiated the escrow
        address freelancer; // The freelancer's address assigned to the job
        uint256 amount;     // The amount of USDC escrowed for this job (in smallest units, e.g., wei for ETH, or 6 decimals for USDC)
        EscrowStatus status; // Current status of this specific job's escrow
        // uint256 createdAt; // Optional: timestamp of escrow creation
        // uint256 updatedAt; // Optional: timestamp of last status update
    }

    // Mapping from MongoDB jobId (string) to JobEscrow details
    // Using string for jobId directly maps to MongoDB's ObjectId string
    mapping(string => JobEscrow) public jobEscrows;

    // --- Events ---
    // Events for general deposits/releases/refunds
    event GeneralDepositMade(address indexed depositor, uint256 amount);
    event GeneralFundsReleased(address indexed recipient, uint256 amount);
    event GeneralFundsRefunded(address indexed recipient, uint256 amount);

    // Events for job-specific escrow actions
    event JobDepositMade(string indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
    event JobFundsReleased(string indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
    event JobFundsRefunded(string indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
    event JobEscrowStatusUpdated(string indexed jobId, EscrowStatus newStatus);


    // Constructor: Initializes the contract with the USDC token address and sets the owner.
    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "Escrow: USDC address cannot be zero");
        usdc = IERC20(_usdc);
    }

    // --- General Deposit/Release/Refund Functions ---
    // Allows any user to deposit USDC into their general balance within the escrow contract.
    // This is useful for holding funds not yet assigned to a specific job, or for platform-wide uses.
    function depositGeneral(uint256 amount) external {
        require(amount > 0, "Escrow: Amount must be greater than 0");
        // Transfer USDC from the sender's wallet to this escrow contract
        usdc.transferFrom(msg.sender, address(this), amount);
        generalDeposits[msg.sender] += amount; // Track the deposit for the sender
        emit GeneralDepositMade(msg.sender, amount);
    }

    // Allows the contract owner to release general funds to a specified recipient.
    // This could be used for platform payouts, or other administrative transfers.
    function releaseGeneral(address recipient, uint256 amount) external onlyOwner {
        require(generalDeposits[recipient] >= amount, "Escrow: Insufficient general funds for recipient");
        generalDeposits[recipient] -= amount;
        usdc.transfer(recipient, amount);
        emit GeneralFundsReleased(recipient, amount);
    }

    // Allows the contract owner to refund general funds to a specified recipient.
    function refundGeneral(address recipient, uint256 amount) external onlyOwner {
        require(generalDeposits[recipient] >= amount, "Escrow: Insufficient general funds for recipient");
        generalDeposits[recipient] -= amount;
        usdc.transfer(recipient, amount);
        emit GeneralFundsRefunded(recipient, amount);
    }

    // --- Job-Specific Escrow Functions ---

    // Client deposits funds for a specific job into escrow.
    // The _jobId is expected to be the MongoDB ObjectId string.
    function depositJob(string calldata _jobId, address _client, address _freelancer, uint256 _amount) external {
        // Ensure the job ID is not already active in escrow or has a client set (prevents re-deposits)
        require(jobEscrows[_jobId].client == address(0) || jobEscrows[_jobId].status == EscrowStatus.Pending, "Escrow: Job already funded or invalid state for deposit");
        require(_amount > 0, "Escrow: Amount must be greater than 0");
        require(_freelancer != address(0), "Escrow: Freelancer address cannot be zero");
        require(_client != address(0), "Escrow: Client address cannot be zero");
        require(msg.sender == _client, "Escrow: Only the designated client can deposit for this job");

        // Transfer USDC from the client's wallet to this escrow contract
        usdc.transferFrom(msg.sender, address(this), _amount);

        // Store the job escrow details
        jobEscrows[_jobId] = JobEscrow({
            client: _client,
            freelancer: _freelancer,
            amount: _amount,
            status: EscrowStatus.Active
            // createdAt: block.timestamp,
            // updatedAt: block.timestamp
        });
        emit JobDepositMade(_jobId, _client, _freelancer, _amount);
        emit JobEscrowStatusUpdated(_jobId, EscrowStatus.Active);
    }

    // Client releases funds to the freelancer for a specific job.
    function releaseJob(string calldata _jobId) external {
        require(jobEscrows[_jobId].client == msg.sender, "Escrow: Only client can release funds for this job");
        require(jobEscrows[_jobId].status == EscrowStatus.Active, "Escrow: Job not in active state for release");

        JobEscrow storage job = jobEscrows[_jobId]; // Use storage to modify the struct directly
        job.status = EscrowStatus.Released;
        usdc.transfer(job.freelancer, job.amount); // Transfer funds to the freelancer
        emit JobFundsReleased(_jobId, job.client, job.freelancer, job.amount);
        emit JobEscrowStatusUpdated(_jobId, EscrowStatus.Released);
    }

    // Client refunds funds to themselves for a specific job.
    // Can be called if job is Active (uncompleted) or Disputed.
    function refundJob(string calldata _jobId) external {
        require(jobEscrows[_jobId].client == msg.sender, "Escrow: Only client can refund funds for this job");
        require(jobEscrows[_jobId].status == EscrowStatus.Active || jobEscrows[_jobId].status == EscrowStatus.Disputed, "Escrow: Job not in active or disputed state for refund");

        JobEscrow storage job = jobEscrows[_jobId]; // Use storage to modify the struct directly
        job.status = EscrowStatus.Refunded;
        usdc.transfer(job.client, job.amount); // Transfer funds back to the client
        emit JobFundsRefunded(_jobId, job.client, job.freelancer, job.amount);
        emit JobEscrowStatusUpdated(_jobId, EscrowStatus.Refunded);
    }

    // Allows the owner (or a dispute resolver) to set a job's escrow status to disputed.
    // This function is typically called by an admin or an arbitration system.
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
