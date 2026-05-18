const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  niche: String,
  location: String,
  status: { 
    type: String, 
    enum: ['draft', 'scraping', 'analyzing', 'sending', 'completed', 'paused'],
    default: 'draft'
  },
  
  // Scraping config
  scrapingConfig: {
    keywords: [String],
    location: String,
    maxResults: { type: Number, default: 100 },
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Email config
  emailConfig: {
    subject: String,
    template: String,
    fromName: String,
    replyTo: String,
    dailyLimit: { type: Number, default: 50 },
  },
  
  // Statistics
  stats: {
    totalLeads: { type: Number, default: 0 },
    qualifiedLeads: { type: Number, default: 0 }, 
    emailsSent: { type: Number, default: 0 },
    emailsOpened: { type: Number, default: 0 },
    emailsClicked: { type: Number, default: 0 },
    replies: { type: Number, default: 0 },
  },
  
}, { timestamps: true });

module.exports = mongoose.model('Campaign', campaignSchema);