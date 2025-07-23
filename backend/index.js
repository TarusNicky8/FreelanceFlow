// index.js
const app = require('./server'); // Import your Express app from server.js

// Vercel sets the PORT environment variable.
// Use 5000 as a fallback for local development.
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open your browser at http://localhost:${PORT} (for local development)`);
});