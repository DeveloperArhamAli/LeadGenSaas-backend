const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// ══════════════════════════════════════════════════════════
// LOCAL STRATEGY (Email/Password)
// ══════════════════════════════════════════════════════════

passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      console.log('🔍 Login attempt for:', email);
      
      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (!user) {
        console.log('❌ User not found:', email);
        return done(null, false, { message: 'Invalid email or password' });
      }
      
      console.log('✅ User found:', user.email);
      console.log('Auth provider:', user.authProvider);
      
      // Check if account is active
      if (!user.isActive) {
        console.log('❌ Account deactivated');
        return done(null, false, { message: 'Account has been deactivated' });
      }
      
      // Check if user registered with Google
      if (user.authProvider === 'google') {
        console.log('❌ User registered with Google');
        return done(null, false, { message: 'Please sign in with Google' });
      }
      
      // Verify password
      console.log('🔐 Verifying password...');
      const isMatch = await user.comparePassword(password);
      
      if (!isMatch) {
        console.log('❌ Password mismatch');
        return done(null, false, { message: 'Invalid email or password' });
      }
      
      console.log('✅ Password verified, login successful');
      
      return done(null, user);
      
    } catch (error) {
      console.error('❌ LocalStrategy error:', error);
      return done(error);
    }
  }
));

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });
      
      if (user) {
        console.log('✅ Existing Google user:', user.email);
        return done(null, user);
      }
      
      user = await User.findOne({ email: profile.emails[0].value.toLowerCase() });
      
      if (user) {
        user.googleId = profile.id;
        user.authProvider = 'google';
        user.avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
        user.isVerified = true;
        await user.save();
        console.log('✅ Linked Google account to existing user:', user.email);
        return done(null, user);
      }
      
      // Create new user
      user = new User({
        name: profile.displayName,
        email: profile.emails[0].value.toLowerCase(),
        googleId: profile.id,
        authProvider: 'google',
        avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        isVerified: true
      });
      
      await user.save();
      console.log('✅ New Google user created:', user.email);
      
      return done(null, user);
      
    } catch (error) {
      console.error('❌ Google OAuth error:', error);
      return done(error, null);
    }
  }
));

module.exports = passport;