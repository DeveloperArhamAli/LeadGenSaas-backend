const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  businessName: { type: String, required: true },
  industry:     String,
  location:     String,

  // Contact Info
  email:   String,
  phone:   String,
  website: String,

  // Social Media
  instagram: String,
  facebook:  String,
  twitter:   String,
  linkedin:  String,
  tiktok:    String,
  youtube:   String,
  whatsapp:  String,
  snapchat:  String,

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Website Analysis
  hasWebsite: { type: Boolean, default: false },
  websiteStatus: {
    type: String,
    enum: ['none', 'functional', 'outdated', 'broken', 'unchecked'],
    default: 'unchecked'
  },
  websiteScore:  Number,
  websiteIssues: [String],

  // Contact Score (calculated manually before save - no pre hook)
  contactScore:      { type: Number, default: 0 },
  availableChannels: [String],

  // Qualification
  isQualified:            { type: Boolean, default: false },
  qualificationReason:    String,
  disqualificationReason: String,

  // Outreach Status Per Channel
  outreach: {
    email: {
      sent:    { type: Boolean, default: false },
      sentAt:  Date,
      opened:  { type: Boolean, default: false },
      clicked: { type: Boolean, default: false },
      replied: { type: Boolean, default: false }
    },
    instagram: {
      sent:    { type: Boolean, default: false },
      sentAt:  Date,
      replied: { type: Boolean, default: false }
    },
    facebook: {
      sent:    { type: Boolean, default: false },
      sentAt:  Date,
      replied: { type: Boolean, default: false }
    },
    whatsapp: {
      sent:    { type: Boolean, default: false },
      sentAt:  Date,
      replied: { type: Boolean, default: false }
    },
    phone: {
      called:   { type: Boolean, default: false },
      calledAt: Date,
      answered: { type: Boolean, default: false }
    }
  },

  // Campaign Reference
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },

  // Metadata
  scrapedFrom:  String,
  mapsUrl:      String,
  rating:       Number,
  reviewsCount: Number,
  notes:        String,
  tags:         [String]

}, { timestamps: true });

// Indexes
leadSchema.index({ email:         1 });
leadSchema.index({ campaignId:    1 });
leadSchema.index({ isQualified:   1 });
leadSchema.index({ contactScore: -1 });
leadSchema.index({ websiteStatus: 1 });

module.exports = mongoose.model('Lead', leadSchema);