# FreelanceFlow
**Problem:** African freelancers often face significant hurdles with high international payment fees, slow transfers, and a lack of trust in cross-border transactions.

**Solution:** FreelanceFlow is a pioneering blockchain platform empowering African freelancers with **secure, transparent, and low-cost USDC payments** on the **Lisk blockchain**. We're building a reliable solution to maximize earnings and foster global opportunities.

**Supported by:** Proudly funded by a LiskDAO Builder Grant.

Progress & Achievements (Milestone 1)
As part of Milestone 1, FreelanceFlow successfully developed and deployed its core smart contracts and established foundational community and web presence.

**Key Achievements:**

* **Core Smart Contracts Deployed:** Our secure Escrow and Mock USDC contracts are live and functional on the Lisk Sepolia Testnet, enabling transparent and affordable payments.

* **USDC Contract Address:** 0xFD2A349A744616C6077978A3D463C82Ac00A37c1
https://sepolia-blockscout.lisk.com/address/0xFD2A349A744616C6077978A3D463C82Ac00A37c1

* **Escrow Contract Address:** 0x83C9919341aa0705b6b0d79420EfAAE27B53ADCf
https://sepolia-blockscout.lisk.com/address/0x83C9919341aa0705b6b0d79420EfAAE27B53ADCf

* **Source Code:** /contracts/USDC.sol, /contracts/Escrow.sol

* **Tests:** /test/Escrow.js

* **Official Project Website:** Our introductory website is launched at https://freelanceflow-lisk.vercel.app.

* **Community Building:** We've established an engaged Discord community (currently 31 members and growing!) for discussions, feedback, and support.

* **Join us here:** https://discord.gg/7TVd2ZdP9h

* **Project Documentation & Outreach:** Initial blog posts and comprehensive documentation are available.

* **Medium Blog:** https://medium.com/@nicodemuskiptoo8/freelanceflow-empowering-african-freelancers-b85936f28f25

Getting Started (Local Development)
To get FreelanceFlow running on your local machine for development and testing, follow these steps:

**Smart Contracts**

**Clone the repository and navigate to the contracts directory:**

git clone https://github.com/TarusNicky8/FreelanceFlow.git
cd FreelanceFlow/contracts

**Install project dependencies:**

npm install

**Configure your environment:** Create a .env file in the contracts directory and add your PRIVATE_KEY. Refer to .env.example for the required format.

**Compile the smart contracts:**

npx hardhat compile

**Run contract tests:**

npx hardhat test

**Deploy contracts to Lisk Testnet:**

npx hardhat run scripts/deploy.js --network liskTestnet

**Website (Frontend)**

**Navigate to the website directory:**

**If you are currently in the 'contracts' directory:**
cd ../website
**If you are in the root 'FreelanceFlow' directory:**
cd website

**Install website dependencies:**

npm install

**Run the local development server:**

npm start

Your website should now be running at http://localhost:3000.

**Deploy to Vercel (for production/staging):**

vercel --prod

Technical Details
* **USDC (Mock ERC20 Token):** This is a simulated ERC20 token designed for use on the Testnet. It functions as the primary currency for payments within FreelanceFlow's test environment, with an initial supply of 1,000,000 tokens minted.

* **Escrow Contract:** Our robust escrow smart contract securely holds funds between freelancers and clients. It features deposit, release, and refund functions, ensuring that payments are only released upon mutual agreement or successful dispute resolution, thereby enhancing trust and mitigating risks.

* **Lisk Integration:** FreelanceFlow is built entirely on the **Lisk Sepolia Testnet**. We leverage Lisk's Layer 2 scalability and efficiency for fast, low-cost, and reliable decentralized transactions.

* **Chain ID:** 4202

* **RPC URL:** https://testnet-rpc.lisk.com

**Integrating Divvi: Driving On-Chain Rewards**
To further incentivize user activity and growth, FreelanceFlow has integrated **Divvi's Referral SDK**. Divvi is a protocol that allows dApps to earn rewards permissionlessly by driving on-chain activity and user growth for other protocols (called "providers").

**How it Works within FreelanceFlow:**

When a user performs a key "value-generating" transaction on our platform (e.g., their first deposit into an Escrow contract), our dApp appends special referral metadata to that transaction's calldata. This metadata includes our unique Divvi identifier (consumer) and the addresses of the reward campaigns (providers) we've signed up for.

After the transaction is confirmed on the blockchain, FreelanceFlow's frontend reports the transaction hash and chain ID to Divvi. Divvi then decodes the referral metadata from the transaction and registers the user as our referral *permanently*. All their future on-chain activity with the associated reward campaigns will then be tracked by Divvi, earning rewards for FreelanceFlow.

This integration ensures transparent and automated tracking, allowing us to focus on building great user experiences while maximizing potential benefits for the project.

* **Example Divvi Consumer Address (from dApp code):** 0x58ccf714F804a10cd9FE22fCcc044d77Ea34e5b1

* **Example Divvi Provider Addresses (from dApp code):** ['0x0423189886d7966f0dd7e7d256898daeee625dca','0xc95876688026be9d6fa7a7c33328bd013effa2bb','0x7beb0e14f8d2e6f6678cc30d867787b384b19e20']

Roadmap & Future Development
We're committed to continuously enhancing FreelanceFlow to better serve African freelancers and grow our ecosystem. Our upcoming milestones include:

* **Q3 2025: Minimum Viable Product (MVP) Beta Launch:** We will roll out the platform to a curated group of 50 users to gather crucial real-world feedback for optimization and iterative refinement.

* **Q4 2025: Growth & Ecosystem Expansion:** Our goal is to scale to 150 active users and achieve $40,000 LSK Total Value Locked (TVL) within the platform's secure escrow system.

* **Future Enhancements:** Plans include integrating with fiat on/off-ramps, implementing advanced dispute resolution mechanisms, and expanding participation within the wider Lisk ecosystem.

Contributing
We welcome contributions from the community!

* **Fork and Contribute:** Feel free to fork the repository and submit pull requests with your improvements.

* **Code Style:** Please adhere to our coding style, using Prettier for JavaScript and the Solidity Plugin for smart contracts.

* **Report Issues:** If you encounter any bugs or have feature suggestions, please report them on our GitHub Issues page: https://github.com/TarusNicky8/FreelanceFlow/issues

License
This project is licensed under the Apache 2.0 License. See the LICENSE file for more details.

Contact
* **Email:** nicodemuskiptoo88@gmail.com

* **X (Twitter):** https://x.com/nicodemuskipto0

* **Discord:** https://discord.gg/7TVd2ZdP9h