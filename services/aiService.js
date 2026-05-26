const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const MODELS = {
  LLAMA_3_3_70B: 'llama-3.3-70b-versatile',
  LLAMA_3_1_8B: 'llama-3.1-8b-instant',
  MIXTRAL: 'mixtral-8x7b-32768',
  LLAMA_3_1_70B: 'llama-3.1-70b-versatile'
};

const DEFAULT_MODEL = MODELS.LLAMA_3_3_70B;

class AIService {
  
  async generatePersonalizedEmail(lead, campaign) {
    try {
      const businessName = lead.businessName;
      const industry = lead.industry || campaign.niche || 'business';
      const hasWebsite = lead.hasWebsite;
      const websiteStatus = lead.websiteStatus;
      const websiteScore = lead.websiteScore;
      
      // Build context about the lead
      let context = `Business: ${businessName}\nIndustry: ${industry}\n`;
      
      if (hasWebsite) {
        context += `Website: ${lead.website}\n`;
        context += `Website Status: ${websiteStatus}\n`;
        if (websiteScore !== undefined) {
          context += `Website Quality Score: ${websiteScore}/100\n`;
        }
      } else {
        context += `Website: No website found\n`;
      }
      
      // Build the prompt
      const prompt = `You are a professional web developer and digital marketer writing a personalized cold email.

LEAD INFORMATION:
${context}

YOUR GOAL:
Write a SHORT, personalized email (3-4 sentences max) offering web development services.

REQUIREMENTS:
1. Start with a specific observation about their business or website
2. Briefly explain the value you can provide
3. End with a soft call-to-action
4. Keep it under 100 words
5. Sound human and friendly, not salesy
6. Don't use phrases like "I hope this email finds you well"
7. Don't be overly formal

${hasWebsite ? 
  `Since they have a website with status "${websiteStatus}" and score ${websiteScore}/100, mention specific improvements you noticed.` :
  `Since they don't have a website, emphasize the opportunity cost of not having an online presence.`
}

Write ONLY the email body, no subject line:`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        model: DEFAULT_MODEL,
        temperature: 0.7,
        max_tokens: 300,
        top_p: 1
      });

      const emailBody = completion.choices[0]?.message?.content?.trim();
      
      if (!emailBody) {
        throw new Error('Empty response from AI');
      }

      console.log(`✅ Generated personalized email for ${businessName}`);
      
      return emailBody;

    } catch (error) {
      console.error('❌ AI email generation error:', error);
      
      // Fallback template
      return this.getFallbackEmail(lead);
    }
  }

  async generateSubject(lead, campaign) {
    try {
      const businessName = lead.businessName;
      
      const prompt = `Generate a SHORT email subject line (5-8 words max) for a cold email to ${businessName}.

The email is about offering web development services.

Requirements:
- Personalized and relevant to ${businessName}
- Not salesy or spammy
- Creates curiosity
- Professional but friendly
- NO emojis
- NO "RE:" or "FWD:"

Examples of good subjects:
- "Quick question about ${businessName}"
- "${businessName}'s online presence"
- "Noticed your website, ${businessName}"

Write ONLY the subject line, nothing else:`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        model: DEFAULT_MODEL,
        temperature: 0.8,
        max_tokens: 50,
        top_p: 1
      });

      const subject = completion.choices[0]?.message?.content?.trim();
      
      // Remove quotes if AI added them
      const cleanSubject = subject.replace(/^["']|["']$/g, '');
      
      console.log(`✅ Generated subject: ${cleanSubject}`);
      
      return cleanSubject;

    } catch (error) {
      console.error('❌ AI subject generation error:', error);
      
      return `Quick question about ${lead.businessName}`;
    }
  }

  getFallbackEmail(lead) {
    const businessName = lead.businessName;
    
    if (lead.hasWebsite) {
      return `Hi there,

I came across ${businessName} and noticed your website could use some modernization. I specialize in building fast, mobile-friendly sites that convert visitors into customers.

Would you be open to a quick chat about updating your online presence?

Best regards`;
    } else {
      return `Hi there,

I noticed ${businessName} doesn't have a website yet. In today's digital age, most customers search online before making a purchase.

I'd love to help you establish a professional web presence. Would you be interested in discussing this?

Best regards`;
    }
  }

  isConfigured() {
    return !!process.env.GROQ_API_KEY;
  }

  getModelInfo() {
    return {
      model: DEFAULT_MODEL,
      provider: 'Groq',
      cost: 'Free',
      rateLimit: '30 requests/minute'
    };
  }
}

module.exports = new AIService();
