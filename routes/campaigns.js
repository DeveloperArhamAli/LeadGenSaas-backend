const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');
const Lead = require('../models/Lead');

// ══════════════════════════════════════════════════════════
// GET /api/campaigns - Get all campaigns for logged-in user
// ══════════════════════════════════════════════════════════

router.get('/', async (req, res) => {
  try {
    const campaigns = await Campaign.find({ userId: req.user.id })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      campaigns
    });
  } catch (error) {
    console.error('❌ Get campaigns error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/campaigns/:id - Get single campaign with leads
// ══════════════════════════════════════════════════════════

router.get('/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.user.id
    });
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }
    
    // Get leads for this campaign
    const leads = await Lead.find({ 
      campaignId: req.params.id,
      userId: req.user.id
    });
    
    res.json({
      success: true,
      campaign,
      leads
    });
  } catch (error) {
    console.error('❌ Get campaign error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/campaigns - Create new campaign
// ══════════════════════════════════════════════════════════

router.post('/', async (req, res) => {
  try {
    const {
      name,
      niche,
      location,
      keywords,
      maxResults,
      emailSubject,
      emailTemplate,
      dailyLimit
    } = req.body;
    
    // DETAILED LOGGING
    console.log('📝 Creating campaign...');
    console.log('   User ID:', req.user?.id);
    console.log('   Campaign name:', name);
    console.log('   Request body:', JSON.stringify(req.body, null, 2));
    
    // Check authentication
    if (!req.user || !req.user.id) {
      console.error('❌ No user in request - authentication failed');
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }
    
    // Validate name
    if (!name) {
      console.error('❌ Campaign name is missing');
      return res.status(400).json({
        success: false,
        error: 'Campaign name is required'
      });
    }
    
    // Create campaign with userId
    const campaign = new Campaign({
      userId: req.user.id,  // From JWT token
      name,
      niche,
      location,
      keywords,
      maxResults: maxResults || 100,
      emailSubject,
      emailTemplate,
      dailyLimit: dailyLimit || 50,
      status: 'draft',
      stats: {
        totalLeads: 0,
        qualifiedLeads: 0,
        emailsSent: 0,
        emailsOpened: 0,
        emailsClicked: 0,
        replies: 0
      }
    });
    
    console.log('💾 Attempting to save campaign...');
    await campaign.save();
    
    console.log('✅ Campaign created successfully:', campaign._id);
    
    res.status(201).json({
      success: true,
      campaign
    });
  } catch (error) {
    console.error('❌ CREATE CAMPAIGN ERROR:');
    console.error('   Message:', error.message);
    console.error('   Name:', error.name);
    console.error('   Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message,
      errorName: error.name
    });
  }
});

// ══════════════════════════════════════════════════════════
// PUT /api/campaigns/:id - Update campaign
// ══════════════════════════════════════════════════════════

router.put('/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { 
        _id: req.params.id,
        userId: req.user.id  // Ensure user owns this campaign
      },
      req.body,
      { new: true }
    );
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }
    
    res.json({
      success: true,
      campaign
    });
  } catch (error) {
    console.error('❌ Update campaign error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ══════════════════════════════════════════════════════════
// DELETE /api/campaigns/:id - Delete campaign and its leads
// ══════════════════════════════════════════════════════════

router.delete('/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id  // Ensure user owns this campaign
    });
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }
    
    await Lead.deleteMany({ 
      campaignId: req.params.id,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Campaign and associated leads deleted'
    });
  } catch (error) {
    console.error('❌ Delete campaign error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/campaigns/:id/send - Send emails for campaign
// ══════════════════════════════════════════════════════════

router.post('/:id/send', async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.user.id
    });
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }
    
    // Get qualified leads with email that haven't been sent yet
    const leads = await Lead.find({
      campaignId: req.params.id,
      userId: req.user.id,
      isQualified: true,
      email: { $exists: true, $ne: null },
      'outreach.email.sent': false
    }).limit(campaign.dailyLimit || 50);
    
    if (leads.length === 0) {
      return res.json({
        success: true,
        message: 'No leads to send emails to',
        emailsSent: 0
      });
    }

    console.log(`📧 Sending emails to ${leads.length} leads...`);
    
    // Import email service
    const emailService = require('../services/emailService');
    const aiService = require('../services/aiService');
    
    let emailsSent = 0;
    
    for (const lead of leads) {
      try {
        // Generate personalized email
        const emailBody = await aiService.generatePersonalizedEmail(lead, campaign);
        const subject = await aiService.generateSubject(lead, campaign);
        
        // Send email
        await emailService.sendEmail(
          lead.email,
          subject,
          emailBody,
          lead._id
        );
        
        // Mark as sent
        lead.outreach.email.sent = true;
        lead.outreach.email.sentAt = new Date();
        await lead.save();
        
        emailsSent++;
        
        console.log(`  ✅ Sent to ${lead.businessName}`);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`  ❌ Failed to send to ${lead.businessName}:`, error.message);
      }
    }
    
    // Update campaign stats
    campaign.stats.emailsSent += emailsSent;
    await campaign.save();
    
    console.log(`✅ Sent ${emailsSent} emails`);
    
    res.json({
      success: true,
      message: `Sent ${emailsSent} emails`,
      emailsSent,
    });
    
  } catch (error) {
    console.error('❌ Send emails error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;