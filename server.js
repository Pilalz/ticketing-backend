require('dotenv').config();

const express = require('express');
const cors = require('cors');

const allowedOrigins = [
  'http://localhost:3000', // Frontend Guest
  'http://localhost:3001'  // Frontend Admin
];

const app = express();

// Middleware
app.use(cors({
  origin: allowedOrigins,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/tickets', require('./routes/tickets'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Ticketing API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      tickets: '/api/tickets'
    }
  });
});

// Error handling middleware (harus di paling bawah)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Something went wrong!',
    error: err.message 
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
