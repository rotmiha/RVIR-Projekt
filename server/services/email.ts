interface EmailParams {
  to: string;
  subject: string;
  htmlContent: string;
}

interface ConflictEmailParams {
  to: string;
  event1: {
    title: string;
    startTime: Date;
    endTime: Date;
    location?: string | null;
  };
  event2: {
    title: string;
    startTime: Date;
    endTime: Date;
    location?: string | null;
  };
}

interface UpcomingEventEmailParams {
  to: string;
  eventTitle: string;
  startTime: Date;
  endTime: Date;
  location?: string | null;
  minutesBefore: number;
}

export class EmailService {
  private apiKey: string;
  private senderEmail: string;
  private senderName: string;

  constructor() {
    this.apiKey = process.env.BREVO_API_KEY || '';
    this.senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@scheduleapp.com';
    this.senderName = process.env.BREVO_SENDER_NAME || 'Schedule Manager';
  }

  private async sendEmail({ to, subject, htmlContent }: EmailParams): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('Brevo API key not configured. Email not sent.');
      return false;
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: this.senderName,
            email: this.senderEmail,
          },
          to: [{ email: to }],
          subject,
          htmlContent,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Brevo API error:', errorText);
        return false;
      }

      console.log(`Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  async sendConflictNotification({ to, event1, event2 }: ConflictEmailParams): Promise<boolean> {
    const formatTime = (date: Date) => {
      return date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
            .event { background-color: white; border-left: 4px solid #3b82f6; padding: 15px; margin: 10px 0; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 0.9em; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Schedule Conflict Detected</h1>
            </div>
            <div class="content">
              <p>We've detected a scheduling conflict between the following events:</p>
              
              <div class="event">
                <h3>${event1.title}</h3>
                <p><strong>Time:</strong> ${formatTime(event1.startTime)} - ${formatTime(event1.endTime)}</p>
                ${event1.location ? `<p><strong>Location:</strong> ${event1.location}</p>` : ''}
              </div>

              <div class="event">
                <h3>${event2.title}</h3>
                <p><strong>Time:</strong> ${formatTime(event2.startTime)} - ${formatTime(event2.endTime)}</p>
                ${event2.location ? `<p><strong>Location:</strong> ${event2.location}</p>` : ''}
              </div>

              <p><strong>Note:</strong> If one of these is a study event, it will automatically take priority over personal activities.</p>
              <p>Please review your schedule and resolve this conflict.</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from Schedule Manager.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: '⚠️ Schedule Conflict Detected',
      htmlContent,
    });
  }

  async sendUpcomingEventNotification({ 
    to, 
    eventTitle, 
    startTime, 
    endTime, 
    location, 
    minutesBefore 
  }: UpcomingEventEmailParams): Promise<boolean> {
    const formatTime = (date: Date) => {
      return date.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const formatDate = (date: Date) => {
      return date.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
            .event-details { background-color: white; padding: 20px; margin: 15px 0; border-radius: 8px; }
            .time { font-size: 1.5em; font-weight: bold; color: #3b82f6; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 0.9em; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📅 Upcoming Event Reminder</h1>
            </div>
            <div class="content">
              <p>Your event starts in <strong>${minutesBefore} minutes</strong>!</p>
              
              <div class="event-details">
                <h2>${eventTitle}</h2>
                <p class="time">${formatTime(startTime)} - ${formatTime(endTime)}</p>
                <p>${formatDate(startTime)}</p>
                ${location ? `<p><strong>📍 Location:</strong> ${location}</p>` : ''}
              </div>

              <p>Make sure you're prepared and on your way!</p>
            </div>
            <div class="footer">
              <p>This is an automated reminder from Schedule Manager.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: `📅 Reminder: ${eventTitle} starts in ${minutesBefore} minutes`,
      htmlContent,
    });
  }

  async sendDailyDigest(to: string, events: Array<{ title: string; startTime: Date; endTime: Date; location?: string | null; type: string }>): Promise<boolean> {
    if (events.length === 0) {
      return true; // No events, no need to send
    }

    const formatTime = (date: Date) => {
      return date.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const eventsList = events
      .map((event) => {
        const typeColor = event.type === 'study' ? '#3b82f6' : '#8b5cf6';
        return `
          <div style="background-color: white; border-left: 4px solid ${typeColor}; padding: 15px; margin: 10px 0;">
            <h3 style="margin: 0 0 10px 0;">${event.title}</h3>
            <p style="margin: 5px 0;"><strong>⏰ Time:</strong> ${formatTime(event.startTime)} - ${formatTime(event.endTime)}</p>
            ${event.location ? `<p style="margin: 5px 0;"><strong>📍 Location:</strong> ${event.location}</p>` : ''}
            <p style="margin: 5px 0;"><strong>Type:</strong> ${event.type === 'study' ? '📚 Study' : '⭐ Personal'}</p>
          </div>
        `;
      })
      .join('');

    const today = new Date().toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 0.9em; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📅 Your Daily Schedule</h1>
              <p style="margin: 10px 0 0 0;">${today}</p>
            </div>
            <div class="content">
              <p>Good morning! Here's your schedule for today:</p>
              <p><strong>${events.length} ${events.length === 1 ? 'event' : 'events'} scheduled</strong></p>
              ${eventsList}
            </div>
            <div class="footer">
              <p>Have a productive day!</p>
              <p>This is an automated digest from Schedule Manager.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: `📅 Your Schedule for ${today}`,
      htmlContent,
    });
  }

  async sendTestEmail(to: string): Promise<boolean> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Email Configuration Test</h1>
            </div>
            <div class="content">
              <h2>Success!</h2>
              <p>Your email notifications are properly configured.</p>
              <p>You will now receive notifications for:</p>
              <ul style="text-align: left; display: inline-block;">
                <li>Scheduling conflicts</li>
                <li>Upcoming events</li>
                <li>Daily schedule digests</li>
              </ul>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: '✅ Schedule Manager - Test Email',
      htmlContent,
    });
  }
}

export const emailService = new EmailService();
