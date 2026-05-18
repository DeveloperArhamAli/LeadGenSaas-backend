const axios = require('axios');

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:5001';

class ScraperService {
  
  constructor() {
    this.pythonApiUrl = PYTHON_API_URL;
  }

  // Check if Python service is healthy
  async checkHealth() {
    try {
      const response = await axios.get(`${this.pythonApiUrl}/health`, {
        timeout: 5000
      });
      return response.data.status === 'ok';
    } catch (error) {
      console.error('❌ Python scraper service is not available');
      return false;
    }
  }

  // Scrape Google Maps via Python service
  async scrapeGoogleMaps(keyword, location, maxResults = 100) {
    console.log(`🔍 Calling Python scraper: ${keyword} in ${location}`);
    
    try {
      const response = await axios.post(
        `${this.pythonApiUrl}/scrape`,
        {
          keyword,
          location,
          max_results: maxResults
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        console.log(`✅ Python scraper returned ${response.data.count} leads`);
        return response.data.leads;
      } else {
        throw new Error(response.data.error || 'Scraping failed');
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Python scraper service is not running. Start it with: cd python-scraper && python app.py');
      }
      
      console.error('❌ Python scraper error:', error.message);
      throw new Error(`Scraping failed: ${error.message}`);
    }
  }

  // Analyze single website via Python service
  async analyzeWebsite(url) {
    if (!url) {
      return {
        hasWebsite: false,
        status: 'none',
        score: 0,
        issues: ['No website URL provided']
      };
    }

    try {
      const response = await axios.post(
        `${this.pythonApiUrl}/analyze-website`,
        { url },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        return response.data.analysis;
      } else {
        throw new Error(response.data.error || 'Analysis failed');
      }
      
    } catch (error) {
      console.error(`❌ Website analysis error for ${url}:`, error.message);
      return {
        hasWebsite: true,
        status: 'broken',
        score: 0,
        issues: [`Analysis failed: ${error.message}`]
      };
    }
  }

  // Batch analyze websites
  async batchAnalyzeWebsites(urls) {
    try {
      const response = await axios.post(
        `${this.pythonApiUrl}/batch-analyze`,
        { urls },
        {
          timeout: 120000, // 2 minutes for batch
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        return response.data.results;
      } else {
        throw new Error(response.data.error || 'Batch analysis failed');
      }
      
    } catch (error) {
      console.error('❌ Batch analysis error:', error.message);
      throw error;
    }
  }

  // Find email on website
  async findEmail(url) {
    if (!url) return null;

    try {
      const response = await axios.post(
        `${this.pythonApiUrl}/find-email`,
        { url },
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        return response.data.email;
      }
      
      return null;
      
    } catch (error) {
      console.error(`❌ Email finding error for ${url}:`, error.message);
      return null;
    }
  }
}

module.exports = new ScraperService();