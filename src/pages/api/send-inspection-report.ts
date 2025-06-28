
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
      ? `<div style="background-color: #1e3a30; border-left: 4px solid #34d399; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
           <p style="margin: 0; font-size: 15px; color: #d1fae5; font-weight: 500;">All Clear!</p>
           <p style="margin: 8px 0 0 0; font-size: 14px; color: #a7f3d0;">Good news! The AI analysis found no discrepancies during this inspection.</p>
         </div>`
      : overallStatus.includes('discrepancies')
      ? `<div style="background-color: #451a24; border-left: 4px solid #f87171; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
           <p style="margin: 0; font-size: 15px; color: #fee2e2; font-weight: 500;">Discrepancies Found</p>
           <p style="margin: 8px 0 0 0; font-size: 14px; color: #fecaca;">Some items seem to be missing. Please check the PDF file attached to this mail for details.</p>
         </div>`
      : '';
      
    const statusMessageText = overallStatus === 'Completed - All Clear'
      ? "Good news! The AI analysis found no discrepancies during this inspection. All items were accounted for.\n\n"
      : overallStatus.includes('discrepancies')
      ? "Some items seem to be missing. Please check the PDF file attached to this mail.\n\n"
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
          HTMLPart: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Inspection Report for ${homeName}</title>
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
                          <h1 style="font-size: 24px; font-weight: 600; color: #ffffff; margin: 0 0 20px 0;">Inspection Report Ready</h1>
                          <p style="font-size: 16px; line-height: 1.5; margin: 0 0 16px 0;">Dear ${ownerDisplayName},</p>
                          <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">Please find attached the inspection report for your property "<strong>${homeName}</strong>", conducted by <strong>${inspectedBy}</strong> on <strong>${formattedDate}</strong>.</p>
                          
                          <!-- Status Message -->
                          ${statusMessageHtml}
                          
                          <!-- Button -->
                          <table border="0" cellspacing="0" cellpadding="0" style="margin: 30px auto 0 auto;">
                            <tr>
                              <td align="center" bgcolor="#C33764" style="border-radius: 6px;">
                                <a href="${dashboardLink}" target="_blank" style="font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; display: inline-block;">View on Dashboard</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <!-- Footer -->
                      <tr>
                        <td style="padding: 40px 20px 20px 20px; text-align: center; font-size: 12px; color: #88889a;">
                          <p>Thank you,<br/>The HomieStan Team</p>
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
    