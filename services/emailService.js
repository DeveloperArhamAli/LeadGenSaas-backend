const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }
  
  async sendEmail({ to, subject, body, leadId }) {
    try {
      const trackingPixel = `<img src="${process.env.BACKEND_URL}/api/track/open/${leadId}" width="1" height="1" />`;
      
      const mailOptions = {
        from: `"${process.env.FROM_NAME || 'Your Name'}" <${process.env.GMAIL_USER}>`,
        to: to,
        subject: subject,
        html: `${body.replace(/\n/g, '<br>')}\n\n${trackingPixel}`,
        text: body
      }; 
      
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`Email sent to ${to}: ${info.messageId}`);
      
      return {
        success: true,
        messageId: info.messageId
      };
      
    } catch (error) {
      console.error(`Email sending failed to ${to}:`, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('Email service is ready');
      return true;
    } catch (error) {
      console.error('Email service verification failed:', error.message);
      return false;
    }
  }
}

module.exports = new EmailService();