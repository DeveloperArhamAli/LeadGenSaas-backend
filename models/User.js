const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  
  password: {
    type: String,
    required: function() {
      return this.authProvider === 'local';
    }
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  googleId: {
    type: String,
    sparse: true  // Allows null values but ensures uniqueness when set
  },
  
  avatar: String,
  
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free'
  },
  
  stats: {
    totalCampaigns: { type: Number, default: 0 },
    totalLeads: { type: Number, default: 0 },
    emailsSent: { type: Number, default: 0 }
  },
  
  lastLogin: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  
}, { timestamps: true });

userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    if (!this.password) {
      console.log('No password set for user');
      return false;
    }
    
    console.log('Comparing passwords...');
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    console.log('Password match:', isMatch);
    return isMatch;
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

userSchema.statics.hashPassword = async function(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  delete user.googleId;
  return user;
};

userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });

module.exports = mongoose.model('User', userSchema);