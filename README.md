FreelanceFlow
Problem: African freelancers often face significant hurdles with high international payment fees, slow transfers, and a lack of trust in cross-border transactions.

Solution: FreelanceFlow is a pioneering blockchain platform empowering African freelancers with secure, transparent, and low-cost USDC payments on the Lisk blockchain. We're building a reliable solution to maximize earnings and foster global opportunities.

Supported by: Proudly funded by a LiskDAO Builder Grant.

Progress & Achievements (Milestone 1)
As part of Milestone 1, FreelanceFlow successfully developed and deployed its core smart contracts and established foundational community and web presence.

Key Achievements:
Core Smart Contracts Deployed: Our secure Escrow and Mock USDC contracts are live and functional on the Lisk Sepolia Testnet, enabling transparent and affordable payments.

USDC Contract Address: 0xFD2A349A744616C6077978A3D463C82Ac00A37c1

Escrow Contract Address: 0x83C9919341aa0705b6b0d79420EfAAE27B53ADCf

Source Code: /contracts/USDC.sol, /contracts/Escrow.sol

Tests: /test/Escrow.js

Official Project Website: Our introductory website is launched at freelanceflow.net.

Community Building: We've established an engaged Discord community (currently 31 members and growing!) for discussions, feedback, and support.

Join us here: FreelanceFlow Discord

Project Documentation & Outreach: Initial blog posts and comprehensive documentation are available.

Medium Blog: Read our latest updates

Getting Started (Local Development)
To get FreelanceFlow running on your local machine for development and testing, follow these steps:

Smart Contracts
Clone the repository and navigate to the contracts directory:

git clone https://github.com/TarusNicky8/FreelanceFlow.git
cd FreelanceFlow/contracts


Install project dependencies:

npm install


Configure your environment: Create a .env file in the contracts directory and add your PRIVATE_KEY. Refer to .env.example for the required format.

Compile the smart contracts:

npx hardhat compile


Run contract tests:

npx hardhat test


Deploy contracts to Lisk Testnet:

npx hardhat run scripts/deploy.js --network liskTestnet


Website (Frontend)
Navigate to the website directory:

# If you are currently in the 'contracts' directory:
cd ../website
# If you are in the root 'FreelanceFlow' directory:
# cd website


Install website dependencies:

npm install


Run the local development server:

npm start


Your website should now be running at http://localhost:3000.

Deploy to Vercel (for production/staging):

vercel --prod


Technical Details
USDC (Mock ERC20 Token): This is a simulated ERC20 token designed for use on the Testnet. It functions as the primary currency for payments within FreelanceFlow's test environment, with an initial supply of 1,000,000 tokens minted.

Escrow Contract: Our robust escrow smart contract securely holds funds between freelancers and clients. It features deposit, release, and refund functions, ensuring that payments are only released upon mutual agreement or successful dispute resolution, thereby enhancing trust and mitigating risks.

Lisk Integration: FreelanceFlow is built entirely on the Lisk Sepolia Testnet. We leverage Lisk's Layer 2 scalability and efficiency for fast, low-cost, and reliable decentralized transactions.

Chain ID: 4202

RPC URL: https://testnet-rpc.lisk.com

Roadmap & Future Development
We're committed to continuously enhancing FreelanceFlow to better serve African freelancers and grow our ecosystem. Our upcoming milestones include:

Q3 2025: Minimum Viable Product (MVP) Beta Launch: We will roll out the platform to a curated group of 50 users to gather crucial real-world feedback for optimization and iterative refinement.

Q4 2025: Growth & Ecosystem Expansion: Our goal is to scale to 150 active users and achieve $40,000 LSK Total Value Locked (TVL) within the platform's secure escrow system.

Future Enhancements: Plans include integrating with fiat on/off-ramps, implementing advanced dispute resolution mechanisms, and expanding participation within the wider Lisk ecosystem.

Contributing
We welcome contributions from the community!

Fork and Contribute: Feel free to fork the repository and submit pull requests with your improvements.

Code Style: Please adhere to our coding style, using Prettier for JavaScript and the Solidity Plugin for smart contracts.

Report Issues: If you encounter any bugs or have feature suggestions, please report them on our GitHub Issues page.

License
This project is licensed under the Apache 2.0 License. See the LICENSE file for more details.

Contact
Email: nicodemuskiptoo88@gmail.com

X (Twitter): @nicodemuskipto0

Discord: FreelanceFlow Discord Server