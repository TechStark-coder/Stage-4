
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
          TextPart: `Dear ${displayName},\n\nWelcome to HomieStan! We're thrilled to have you join our community. Get ready to explore, manage, and analyze your properties like never before.\n\nYou can start by visiting your dashboard to create your first home.\n\nIf you have any questions or need assistance, please feel free to reach out.\n\nBest and regards,\nTeam ARC Stay`,
          HTMLPart: `<h3>Dear ${displayName},</h3>
                       <p>Welcome to HomieStan! We're thrilled to have you join our community. Get ready to explore, manage, and analyze your properties like never before.</p>
                       <p>You can start by visiting your dashboard to create your first home.</p>
                       <p>If you have any questions or need assistance, please feel free to reach out.</p>
                       <p>Best and regards,<br/>Team ARC Stay</p>`,
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
