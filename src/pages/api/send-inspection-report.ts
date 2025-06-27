
import type { NextApiRequest, NextApiResponse } from 'next';
import Mailjet from 'node-mailjet';
import { getHome } from '@/lib/firestore'; // Import getHome instead of getUserEmail

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { homeId, homeName, inspectedBy, pdfBase64, inspectionDate, overallStatus } = req.body; // Expect homeId and overallStatus

  if (!homeId || !homeName || !inspectedBy || !pdfBase64 || !inspectionDate || !overallStatus) {
    return res.status(400).json({ message: 'Missing required fields for sending report.' });
  }

  const mailjetApiKey = process.env.MAILJET_API_KEY;
  const mailjetApiSecret = process.env.MAILJET_API_SECRET;
  const senderEmail = process.env.MAILJET_SENDER_EMAIL;

  if (!mailjetApiKey || !mailjetApiSecret || !senderEmail) {
    console.error('Mailjet API Key, Secret, or Sender Email not configured in environment variables.');
    return res.status(500).json({ message: 'Email service configuration error.' });
  }

  try {
    const homeData = await getHome(homeId); // Fetch home document
    if (!homeData || !homeData.ownerEmail) {
      console.error(`Could not find home data or owner email for home ID: ${homeId}`);
      return res.status(404).json({ message: 'Home data or owner email not found.' });
    }
    const ownerEmail = homeData.ownerEmail;
    const ownerDisplayName = homeData.ownerDisplayName || 'Home Owner';

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host; // Prioritize x-forwarded-host
    const dashboardLink = `${protocol}://${host}/dashboard`;

    const mailjet = new Mailjet({
      apiKey: mailjetApiKey,
      apiSecret: mailjetApiSecret,
    });

    const formattedDate = new Date(inspectionDate).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    const statusMessageHtml = overallStatus === 'Completed - All Clear'
      ? '<p style="color: #2e7d32; font-weight: bold;">Good news! The AI analysis found no discrepancies during this inspection. All items were accounted for.</p>'
      : '';

    const statusMessageText = overallStatus === 'Completed - All Clear'
      ? "Good news! The AI analysis found no discrepancies during this inspection. All items were accounted for.\\n\\n"
      : '';

    const emailData = {
      Messages: [
        {
          From: {
            Email: senderEmail,
            Name: 'HomieStan Inspections',
          },
          To: [
            {
              Email: ownerEmail,
              Name: ownerDisplayName,
            },
          ],
          Subject: `Inspection Report for ${homeName} - ${formattedDate}`,
          TextPart: `Dear ${ownerDisplayName},\n\nPlease find attached the inspection report for your property "${homeName}", conducted by ${inspectedBy} on ${formattedDate}.\n\n${statusMessageText}You can manage your homes directly from your dashboard: ${dashboardLink}\n\nThank you,\nHomieStan Team`,
          HTMLPart: `<h3>Dear ${ownerDisplayName},</h3>
                       <p>Please find attached the inspection report for your property "<strong>${homeName}</strong>", conducted by <strong>${inspectedBy}</strong> on <strong>${formattedDate}</strong>.</p>
                       ${statusMessageHtml}
                       <p>You can manage your homes directly from your dashboard:</p>
                       <p><a href="${dashboardLink}" target="_blank">Go to Your Dashboard</a></p>
                       <p>Thank you,<br/>HomieStan Team</p>`,
          Attachments: [
            {
              ContentType: 'application/pdf',
              Filename: `Inspection_Report_${homeName.replace(/\s+/g, '_')}_${new Date(inspectionDate).toISOString().split('T')[0]}.pdf`,
              Base64Content: pdfBase64,
            },
          ],
        },
      ],
    };

    const result = await mailjet.post('send', { version: 'v3.1' }).request(emailData);
    console.log('Mailjet send result:', result.body);
    return res.status(200).json({ message: 'Report sent successfully!' });

  } catch (error: any) {
    console.error('Error sending email via Mailjet:', error.statusCode, error.ErrorMessage, error.response?.data);
    let errorMessage = 'Failed to send inspection report.';
    if (error.isMailjetError) {
        errorMessage = error.ErrorMessage || 'Mailjet API error.';
    } else if (error.response && error.response.data && error.response.data.Messages) {
        errorMessage = error.response.data.Messages[0]?.Errors?.[0]?.ErrorMessage || errorMessage;
    } else if (error.message) {
        errorMessage = error.message;
    }
    return res.status(500).json({ message: errorMessage });
  }
}

    
