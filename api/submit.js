const twilio = require('twilio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { firstName, lastName, phone, projectType, garageSize, coatingSystem, projectDetails, address } = req.body;

  if (!firstName || !lastName || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const smsBody = `New Platinum Installs Inquiry:\n${firstName} ${lastName}\nPhone: ${phone}\nProject: ${projectType}\nSize: ${garageSize}\nCoating: ${coatingSystem}\nAddress: ${address}\nDetails: ${projectDetails}`;

  try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: smsBody,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: process.env.PLATINUM_OWNER_PHONE,
      });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('SMS failed:', err.message);
    return res.status(500).json({ error: 'SMS failed' });
  }
};
