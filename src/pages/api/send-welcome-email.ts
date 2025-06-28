
import type { NextApiRequest, NextApiResponse } from 'next';
import Mailjet from 'node-mailjet';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { email, displayName } = req.body;

  if (!email || !displayName) {
    return res.status(400).json({ message: 'Missing required fields: email and displayName.' });
  }

  const mailjetApiKey = process.env.MAILJET_API_KEY;
  const mailjetApiSecret = process.env.MAILJET_API_SECRET;
  const senderEmail = process.env.MAILJET_SENDER_EMAIL;

  if (!mailjetApiKey || !mailjetApiSecret || !senderEmail) {
    console.error('Mailjet API Key, Secret, or Sender Email not configured in environment variables for welcome email.');
    // Avoid exposing detailed config errors to client in production for this type of optional feature
    return res.status(500).json({ message: 'Welcome email service configuration error on server.' });
  }

  try {
    const mailjet = new Mailjet({
      apiKey: mailjetApiKey,
      apiSecret: mailjetApiSecret,
    });
    
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    const dashboardLink = `${protocol}://${host}/dashboard`;


    const emailData = {
      Messages: [
        {
          From: {
            Email: senderEmail,
            Name: 'HomieStan', // Sender name for welcome emails
          },
          To: [
            {
              Email: email,
              Name: displayName,
            },
          ],
          Subject: `Welcome to HomieStan, ${displayName}!`,
          TextPart: `Dear ${displayName},\n\nWelcome to HomieStan! We're thrilled to have you join our community. Get ready to explore, manage, and analyze your properties like never before.\n\nYou can start by visiting your dashboard to create your first home: ${dashboardLink}\n\nIf you have any questions or need assistance, please feel free to reach out.\n\nBest and regards,\nTeam ARC Stay`,
          HTMLPart: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Welcome to HomieStan</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; background-color: #1a1a2e;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1a1a2e;">
                <tr>
                  <td align="center">
                    <table width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 20px auto; background-color: #2a2a3e; border-radius: 8px; color: #e0e0e0; overflow: hidden;">
                      <!-- Header -->
                      <tr>
                        <td align="center" style="padding: 40px 20px 20px 20px;">
                          <h1 style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 28px; font-weight: bold; color: #ffffff; margin: 0;">HomieStan</h1>
                        </td>
                      </tr>
                      <!-- Body -->
                      <tr>
                        <td style="padding: 20px 40px;">
                          <h1 style="font-size: 24px; font-weight: 600; color: #ffffff; margin: 0 0 20px 0;">Welcome, ${displayName}!</h1>
                          <p style="font-size: 16px; line-height: 1.5; margin: 0 0 16px 0;">We're thrilled to have you join our community. Get ready to explore, manage, and analyze your properties like never before with HomieStan.</p>
                          <p style="font-size: 16px; line-height: 1.5; margin: 0 0 30px 0;">You can start by visiting your dashboard to create your first home.</p>
                          <!-- Button -->
                          <table border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                            <tr>
                              <td align="center" bgcolor="#C33764" style="border-radius: 6px;">
                                <a href="${dashboardLink}" target="_blank" style="font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; display: inline-block;">Go to Dashboard</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <!-- Footer -->
                      <tr>
                        <td style="padding: 40px 20px 20px 20px; text-align: center; font-size: 12px; color: #88889a;">
                          <p>If you have any questions, please feel free to reach out.</p>
                          <p>&copy; 2025 HomieStan by ARC Stay. All rights reserved.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        },
      ],
    };

    await mailjet.post('send', { version: 'v3.1' }).request(emailData);
    return res.status(200).json({ message: 'Welcome email sent successfully!' });

  } catch (error: any) {
    console.error('Error sending welcome email via Mailjet:', error.statusCode, error.ErrorMessage, error.response?.data);
    let errorMessage = 'Failed to send welcome email.';
    if (error.isMailjetError) {
        errorMessage = error.ErrorMessage || 'Mailjet API error during welcome email.';
    } else if (error.response && error.response.data && error.response.data.Messages) {
        errorMessage = error.response.data.Messages[0]?.Errors?.[0]?.ErrorMessage || errorMessage;
    } else if (error.message) {
        errorMessage = error.message;
    }
    // Don't make the signup process fail if welcome email sending fails. Log it.
    return res.status(500).json({ message: errorMessage });
  }
}
