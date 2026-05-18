const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }
    
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }
    
    const hashedPassword = await User.hashPassword(password);
    
    const user = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      authProvider: 'local'
    });
    
    await user.save();
    
    const token = generateToken(user);
    
    console.log(`✅ New user registered: ${user.email}`);
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: user.toJSON()
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    console.log('🔍 Login attempt for:', email);
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    console.log('✅ User found:', user.email);
    
    if (!user.isActive) {
      console.log('❌ Account deactivated');
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }
    
    if (user.authProvider === 'google') {
      console.log('❌ User registered with Google');
      return res.status(401).json({
        success: false,
        message: 'Please sign in with Google'
      });
    }
    
    console.log('🔐 Verifying password...');
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      console.log('❌ Password mismatch');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    console.log('✅ Password verified');
    
    const token = generateToken(user);
    
    console.log(`✅ User logged in: ${user.email}`);
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: user.toJSON()
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email']
  })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=google_auth_failed`
  }),
  (req, res) => {
    const token = generateToken(req.user);
    
    console.log(`✅ User logged in via Google: ${req.user.email}`);
    
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?token=${token}`);
  }
);

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user: user.toJSON()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
});

router.post('/logout', authenticateToken, (req, res) => {
  console.log(`✅ User logged out: ${req.user.email}`);
  
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    req.user = user;
    next();
  });
}

router.authenticateToken = authenticateToken;

module.exports = router;