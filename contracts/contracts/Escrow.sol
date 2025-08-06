// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol"; // <--- NEW IMPORT

// This contract manages USDC escrows for freelance jobs and general deposits.
// It is now upgradable and includes logic for platform fees.
contract Escrow is Initializable, OwnableUpgradeable, UUPSUpgradeable { // <--- NEW INHERITANCE
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
        Pending,   // Job created, waiting for client to deposit funds
        Active,    // Funds deposited, job is in progress
        Released,  // Funds released to freelancer
        Refunded,  // Funds refunded to client
        Disputed   // Job is under dispute (requires off-chain resolution, then refund/release)
    }

    struct JobEscrow {
        address client;
        address freelancer;
        uint256 amount;
        EscrowStatus status;
    }

    mapping(string => JobEscrow) public jobEscrows;

    // --- Events ---
    event GeneralDepositMade(address indexed depositor, uint256 amount);
    event GeneralFundsReleased(address indexed recipient, uint256 amount);
    event GeneralFundsRefunded(address indexed recipient, uint256 amount);

    event JobDepositMade(string indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
    event JobFundsReleased(string indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
    event JobFundsRefunded(string indexed jobId, address indexed client, address indexed freelancer, uint256 amount);
    event JobEscrowStatusUpdated(string indexed jobId, EscrowStatus newStatus);
    event PlatformFeeUpdated(uint256 newPercentage);
    event FeeCollected(string indexed jobId, uint256 feeAmount, uint256 originalAmount);


    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Constructor is empty for upgradable contracts using Initializable.
        // Initialization logic goes into the initialize function.
    }

    // The initialize function acts as the constructor for upgradable contracts.
    // It's called only once, immediately after deployment.
    function initialize(address _usdc, address _profitFlowAddress, uint256 _initialFeePercentage) public initializer {
        __Ownable_init(); // Initialize the Ownable part of the contract
        __UUPSUpgradeable_init(); // <--- NEW INITIALIZATION for UUPS
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
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {} // <--- NEW REQUIRED FUNCTION

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

    // Client deposits funds for a specific job into escrow.
    function depositJob(string calldata _jobId, address _client, address _freelancer, uint256 _amount) external {
        require(jobEscrows[_jobId].client == address(0) || jobEscrows[_jobId].status == EscrowStatus.Pending, "Escrow: Job already funded or invalid state for deposit");
        require(_amount > 0, "Escrow: Amount must be greater than 0");
        require(_freelancer != address(0), "Escrow: Freelancer address cannot be zero");
        require(_client != address(0), "Escrow: Client address cannot be zero");
        require(msg.sender == _client, "Escrow: Only the designated client can deposit for this job");

        usdc.transferFrom(msg.sender, address(this), _amount);

        jobEscrows[_jobId] = JobEscrow({
            client: _client,
            freelancer: _freelancer,
            amount: _amount,
            status: EscrowStatus.Active
        });
        emit JobDepositMade(_jobId, _client, _freelancer, _amount);
        emit JobEscrowStatusUpdated(_jobId, EscrowStatus.Active);
    }

    // Client releases funds to the freelancer for a specific job, deducting platform fee.
    function releaseJob(string calldata _jobId) external {
        require(jobEscrows[_jobId].client == msg.sender, "Escrow: Only client can release funds for this job");
        require(jobEscrows[_jobId].status == EscrowStatus.Active, "Escrow: Job not in active state for release");

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
