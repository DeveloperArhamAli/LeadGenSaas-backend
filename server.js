const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lead-gen-saas')
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

app.use(session({ 
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/lead-gen-saas',
    touchAfter: 24 * 3600
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

require('./config/passport');

console.log('Google OAuth:', process.env.GOOGLE_CLIENT_ID ? 'ENABLED' : 'DISABLED (set GOOGLE_CLIENT_ID)');

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    googleOAuth: !!process.env.GOOGLE_CLIENT_ID
  });
});

const { authenticateToken } = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const leadRoutes = require('./routes/leads');
const scraperRoutes = require('./routes/scraper');

app.use('/api/campaigns', authenticateToken, campaignRoutes);
app.use('/api/leads', authenticateToken, leadRoutes);
app.use('/api/scraper', authenticateToken, scraperRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}\n`);
});
