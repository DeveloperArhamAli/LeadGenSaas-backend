const express = require('express');
const router = express.Router();
const scraperService = require('../services/scraperService');
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');

function qualifyLead(lead) {
  const availableChannels = [];

  if (lead.email)     availableChannels.push('email');
  if (lead.phone)     availableChannels.push('phone');
  if (lead.instagram) availableChannels.push('instagram');
  if (lead.facebook)  availableChannels.push('facebook');
  if (lead.twitter)   availableChannels.push('twitter');
  if (lead.linkedin)  availableChannels.push('linkedin');
  if (lead.tiktok)    availableChannels.push('tiktok');
  if (lead.whatsapp)  availableChannels.push('whatsapp');
  if (lead.snapchat)  availableChannels.push('snapchat');
  if (lead.youtube)   availableChannels.push('youtube');
  if (lead.website)   availableChannels.push('website');

  const contactScore = availableChannels.length; 

  if (contactScore === 0) {
    return {
      isQualified: false,
      reason: null,
      disqualifyReason: 'No contact method found - cannot reach this business',
      availableChannels,
      contactScore
    };
  }

  if (!lead.hasWebsite) {
    return {
      isQualified: true,
      reason: 'No website found. Can be contacted via: ' + availableChannels.join(', '),
      disqualifyReason: null,
      availableChannels,
      contactScore
    };
  }

  if (lead.websiteStatus === 'outdated' || lead.websiteStatus === 'broken') {
    return {
      isQualified: true,
      reason: 'Website is ' + lead.websiteStatus + '. Can be contacted via: ' + availableChannels.join(', '),
      disqualifyReason: null,
      availableChannels,
      contactScore
    };
  }

  if (lead.hasWebsite && lead.websiteStatus === 'unchecked') {
    return {
      isQualified: false,
      reason: null,
      disqualifyReason: 'Pending website analysis',
      availableChannels,
      contactScore
    };
  }

  return {
    isQualified: false,
    reason: null,
    disqualifyReason: 'Website appears functional - not an ideal lead right now',
    availableChannels,
    contactScore
  };
}

router.get('/health', async (req, res) => {
  try {
    const isHealthy = await scraperService.checkHealth();
    if (isHealthy) {
      res.json({
        success: true,
        message: 'Python scraper service is running',
        pythonApiUrl: process.env.PYTHON_API_URL || 'http://localhost:5001'
      });
    } else {
      res.status(503).json({
        success: false,
        message: 'Python scraper service is not available. Run: cd python-scraper && python app.py',
        pythonApiUrl: process.env.PYTHON_API_URL || 'http://localhost:5001'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/start', async (req, res) => {
  try {
    const { keyword, location, maxResults, campaignId } = req.body;

    if (!keyword || !location) {
      return res.status(400).json({
        success: false,
        error: 'keyword and location are required'
      });
    }

    const isHealthy = await scraperService.checkHealth();
    if (!isHealthy) {
      return res.status(503).json({
        success: false,
        error: 'Python scraper service is not running. Start it with: cd python-scraper && python app.py'
      });
    }

    if (campaignId) {
      await Campaign.findByIdAndUpdate(campaignId, {
        status: 'scraping',
        'stats.totalLeads': 0,
        'stats.qualifiedLeads': 0
      });
    }

    console.log('\n============================');
    console.log('   STARTING SCRAPE');
    console.log('   Keyword  : ' + keyword);
    console.log('   Location : ' + location);
    console.log('   Max      : ' + (maxResults || 100));
    console.log('============================\n');

    const businesses = await scraperService.scrapeGoogleMaps(
      keyword,
      location,
      maxResults || 100
    );

    console.log('Received ' + businesses.length + ' businesses from Python scraper\n');

    const savedLeads = [];
    let duplicateCount = 0;

    for (const business of businesses) {
      try {
        const existing = await Lead.findOne({
          businessName: business.businessName,
          location: business.location
        });

        if (existing) {
          duplicateCount++;
          console.log('   Duplicate skipped: ' + business.businessName);
          continue;
        }

        const leadData = {
          businessName : business.businessName,
          location     : business.location     || null,
          website      : business.website      || null,
          phone        : business.phone        || null,
          email        : business.email        || null,
          instagram    : business.instagram    || null,
          facebook     : business.facebook     || null,
          twitter      : business.twitter      || null,
          linkedin     : business.linkedin     || null,
          tiktok       : business.tiktok       || null,
          youtube      : business.youtube      || null,
          whatsapp     : business.whatsapp     || null,
          snapchat     : business.snapchat     || null,
          rating       : business.rating       || null,
          reviewsCount : business.reviewsCount || null,
          mapsUrl      : business.mapsUrl      || null,
          campaignId   : campaignId            || null,
          userId       : req.user.id,
          scrapedFrom  : 'google_maps',
          hasWebsite   : !!business.website,
          websiteStatus: business.website ? 'unchecked' : 'none'
        };

        const qualification = qualifyLead(leadData);
        leadData.isQualified            = qualification.isQualified;
        leadData.qualificationReason    = qualification.reason;
        leadData.disqualificationReason = qualification.disqualifyReason;
        leadData.availableChannels      = qualification.availableChannels;
        leadData.contactScore           = qualification.contactScore;

        const lead = new Lead(leadData);
        await lead.save();

        savedLeads.push(lead);

        if (qualification.isQualified) {
          console.log('   QUALIFIED  : ' + business.businessName);
          console.log('   Channels   : ' + qualification.availableChannels.join(', '));
        } else {
          console.log('   NOT QUAL.  : ' + business.businessName);
          console.log('   Reason     : ' + qualification.disqualifyReason);
        }

      } catch (error) {
        console.error('   Error saving ' + business.businessName + ': ' + error.message);
      }
    }

    const qualifiedCount = savedLeads.filter(function(l) { return l.isQualified; }).length;
    const withEmail      = savedLeads.filter(function(l) { return l.email; }).length;
    const withPhone      = savedLeads.filter(function(l) { return l.phone; }).length;
    const withInstagram  = savedLeads.filter(function(l) { return l.instagram; }).length;
    const withFacebook   = savedLeads.filter(function(l) { return l.facebook; }).length;
    const withWebsite    = savedLeads.filter(function(l) { return l.hasWebsite; }).length;
    const noContact      = savedLeads.filter(function(l) { return (l.contactScore || 0) === 0; }).length;

    console.log('\n============================');
    console.log('   SCRAPING COMPLETE');
    console.log('   Total found  : ' + businesses.length);
    console.log('   Saved        : ' + savedLeads.length);
    console.log('   Duplicates   : ' + duplicateCount);
    console.log('   Qualified    : ' + qualifiedCount);
    console.log('   Have Email   : ' + withEmail);
    console.log('   Have Phone   : ' + withPhone);
    console.log('   Have Insta   : ' + withInstagram);
    console.log('   Have FB      : ' + withFacebook);
    console.log('   Have Website : ' + withWebsite);
    console.log('   No Contact   : ' + noContact);
    console.log('============================\n');

    if (campaignId) {
      const nextStatus = withWebsite > 0 ? 'analyzing' : 'sending';
      await Campaign.findByIdAndUpdate(campaignId, {
        status: nextStatus,
        'stats.totalLeads'    : savedLeads.length,
        'stats.qualifiedLeads': qualifiedCount
      });
      console.log('Campaign status set to: ' + nextStatus);
    }

    res.json({
      success    : true,
      leadsFound : businesses.length,
      leadsAdded : savedLeads.length,
      duplicates : duplicateCount,
      qualified  : qualifiedCount,
      channelBreakdown: {
        email    : withEmail,
        phone    : withPhone,
        instagram: withInstagram,
        facebook : withFacebook,
        website  : withWebsite,
        noContact: noContact
      },
      leads: savedLeads
    });

  } catch (error) {
    console.error('Scraping route error: ' + error.message);

    if (req.body.campaignId) {
      await Campaign.findByIdAndUpdate(req.body.campaignId, { status: 'paused' });
    }

    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/analyze/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    console.log('\n============================');
    console.log('   STARTING WEBSITE ANALYSIS');
    console.log('   Campaign: ' + campaignId);
    console.log('============================\n');

    const leadsWithWebsites = await Lead.find({
      campaignId,
      hasWebsite   : true,
      websiteStatus: 'unchecked',
      website      : { $exists: true, $ne: null }
    });

    const leadsWithoutWebsites = await Lead.find({
      campaignId,
      $or: [
        { websiteStatus: 'none' },
        { hasWebsite   : false  },
        { website      : { $exists: false } },
        { website      : null }
      ]
    });

    console.log('   Leads with websites    : ' + leadsWithWebsites.length);
    console.log('   Leads without websites : ' + leadsWithoutWebsites.length + '\n');

    let analyzedCount  = 0;
    let qualifiedCount = 0;

    if (leadsWithWebsites.length > 0) {
      console.log('Analyzing ' + leadsWithWebsites.length + ' websites...\n');

      for (const lead of leadsWithWebsites) {
        try {
          console.log('   Checking: ' + lead.website);

          const analysis = await scraperService.analyzeWebsite(lead.website);

          lead.websiteStatus = analysis.status;
          lead.websiteScore  = analysis.score;
          lead.websiteIssues = analysis.issues;

          const qualification = qualifyLead(lead);
          lead.isQualified            = qualification.isQualified;
          lead.qualificationReason    = qualification.reason    || lead.qualificationReason;
          lead.disqualificationReason = qualification.disqualifyReason;
          lead.availableChannels      = qualification.availableChannels;
          lead.contactScore           = qualification.contactScore;

          if (qualification.isQualified) {
            qualifiedCount++;
            console.log('   Qualified : ' + lead.businessName + ' (' + analysis.status + ', score: ' + analysis.score + ')');
          } else {
            console.log('   Not Qual. : ' + lead.businessName + ' (' + analysis.status + ', score: ' + analysis.score + ')');
          }

          await lead.save();
          analyzedCount++;

          await new Promise(function(resolve) { setTimeout(resolve, 500); });

        } catch (error) {
          console.error('   Error analyzing ' + lead.website + ': ' + error.message);

          lead.websiteStatus          = 'broken';
          lead.websiteScore           = 0;
          lead.websiteIssues          = ['Analysis failed'];
          lead.isQualified            = true;
          lead.qualificationReason    = 'Website analysis failed - likely broken';
          lead.disqualificationReason = null;

          await lead.save();
          qualifiedCount++;
          analyzedCount++;
        }
      }
    } else {
      console.log('No websites to analyze\n');
    }

    if (leadsWithoutWebsites.length > 0) {
      console.log('\nProcessing ' + leadsWithoutWebsites.length + ' leads without websites...\n');

      for (const lead of leadsWithoutWebsites) {
        try {
          const qualification = qualifyLead(lead);

          lead.isQualified            = qualification.isQualified;
          lead.qualificationReason    = qualification.reason    || lead.qualificationReason;
          lead.disqualificationReason = qualification.disqualifyReason || lead.disqualificationReason;
          lead.availableChannels      = qualification.availableChannels;
          lead.contactScore           = qualification.contactScore;
          lead.websiteStatus          = 'none';
          lead.hasWebsite             = false;

          await lead.save();

          if (qualification.isQualified) {
            qualifiedCount++;
            console.log('   Qualified    : ' + lead.businessName);
            console.log('   Channels     : ' + qualification.availableChannels.join(', '));
          } else {
            console.log('   Disqualified : ' + lead.businessName);
            console.log('   Reason       : ' + qualification.disqualifyReason);
          }

        } catch (error) {
          console.error('   Error qualifying ' + lead.businessName + ': ' + error.message);
        }
      }
    }

    const totalQualified    = await Lead.countDocuments({ campaignId, isQualified: true });
    const totalDisqualified = await Lead.countDocuments({ campaignId, isQualified: false });
    const withEmail         = await Lead.countDocuments({ campaignId, isQualified: true, email:     { $exists: true, $ne: null } });
    const withPhone         = await Lead.countDocuments({ campaignId, isQualified: true, phone:     { $exists: true, $ne: null } });
    const withInstagram     = await Lead.countDocuments({ campaignId, isQualified: true, instagram: { $exists: true, $ne: null } });
    const withFacebook      = await Lead.countDocuments({ campaignId, isQualified: true, facebook:  { $exists: true, $ne: null } });
    const noContact         = await Lead.countDocuments({ campaignId, contactScore: 0 });

    console.log('\n============================');
    console.log('   ANALYSIS COMPLETE');
    console.log('   Websites analyzed  : ' + analyzedCount);
    console.log('   Total qualified    : ' + totalQualified);
    console.log('   Total disqualified : ' + totalDisqualified);
    console.log('   With Email         : ' + withEmail);
    console.log('   With Phone         : ' + withPhone);
    console.log('   With Instagram     : ' + withInstagram);
    console.log('   With Facebook      : ' + withFacebook);
    console.log('   No contact at all  : ' + noContact);
    console.log('============================\n');

    const nextStatus = totalQualified > 0 ? 'sending' : 'completed';
    await Campaign.findByIdAndUpdate(campaignId, {
      status               : nextStatus,
      'stats.qualifiedLeads': totalQualified
    });

    console.log('Campaign status set to: ' + nextStatus);

    res.json({
      success          : true,
      analyzed         : analyzedCount,
      qualified        : qualifiedCount,
      totalQualified,
      totalDisqualified,
      channelBreakdown : {
        email    : withEmail,
        phone    : withPhone,
        instagram: withInstagram,
        facebook : withFacebook,
        noContact
      },
      message: totalQualified > 0
        ? totalQualified + ' leads are ready for outreach'
        : 'No qualified leads found'
    });

  } catch (error) {
    console.error('Analysis route error: ' + error.message);

    try {
      await Campaign.findByIdAndUpdate(req.params.campaignId, { status: 'paused' });
    } catch (e) {
      console.error('Failed to update campaign status: ' + e.message);
    }

    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/re-qualify/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    const allLeads = await Lead.find({ campaignId });
    console.log('Re-qualifying ' + allLeads.length + ' leads...');

    let qualifiedCount    = 0;
    let disqualifiedCount = 0;

    for (const lead of allLeads) {
      const qualification = qualifyLead(lead);

      lead.isQualified            = qualification.isQualified;
      lead.qualificationReason    = qualification.reason    || lead.qualificationReason;
      lead.disqualificationReason = qualification.disqualifyReason || lead.disqualificationReason;
      lead.availableChannels      = qualification.availableChannels;
      lead.contactScore           = qualification.contactScore;

      await lead.save();

      if (qualification.isQualified) qualifiedCount++;
      else disqualifiedCount++;
    }

    await Campaign.findByIdAndUpdate(campaignId, {
      'stats.qualifiedLeads': qualifiedCount
    });

    console.log('Re-qualification done: ' + qualifiedCount + ' qualified, ' + disqualifiedCount + ' disqualified');

    res.json({
      success     : true,
      total       : allLeads.length,
      qualified   : qualifiedCount,
      disqualified: disqualifiedCount
    });

  } catch (error) {
    console.error('Re-qualification error: ' + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    const results = await Promise.all([
      Lead.countDocuments({ campaignId }),
      Lead.countDocuments({ campaignId, isQualified: true }),
      Lead.countDocuments({ campaignId, email:     { $exists: true, $ne: null } }),
      Lead.countDocuments({ campaignId, phone:     { $exists: true, $ne: null } }),
      Lead.countDocuments({ campaignId, instagram: { $exists: true, $ne: null } }),
      Lead.countDocuments({ campaignId, facebook:  { $exists: true, $ne: null } }),
      Lead.countDocuments({ campaignId, twitter:   { $exists: true, $ne: null } }),
      Lead.countDocuments({ campaignId, linkedin:  { $exists: true, $ne: null } }),
      Lead.countDocuments({ campaignId, tiktok:    { $exists: true, $ne: null } }),
      Lead.countDocuments({ campaignId, whatsapp:  { $exists: true, $ne: null } }),
      Lead.countDocuments({ campaignId, website:   { $exists: true, $ne: null } }),
      Lead.countDocuments({ campaignId, contactScore: 0 })
    ]);

    res.json({
      success: true,
      stats: {
        total    : results[0],
        qualified: results[1],
        channels : {
          email    : results[2],
          phone    : results[3],
          instagram: results[4],
          facebook : results[5],
          twitter  : results[6],
          linkedin : results[7],
          tiktok   : results[8],
          whatsapp : results[9],
          website  : results[10],
          noContact: results[11]
        }
      }
    });

  } catch (error) {
    console.error('Stats error: ' + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;