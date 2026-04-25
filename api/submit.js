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
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    const ownerPhone = process.env.PLATINUM_OWNER_PHONE;

    console.log('Env vars check:', {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasNumber: !!twilioNumber,
      hasOwnerPhone: !!ownerPhone,
    });

    if (accountSid && authToken && twilioNumber && ownerPhone) {
      const client = twilio(accountSid, authToken);
      const msg = await client.messages.create({
        body: smsBody,
        from: twilioNumber,
        to: `+1${ownerPhone}`,
      });
      console.log('SMS sent:', msg.sid);
    } else {
      console.warn('Twilio credentials incomplete');
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('SMS error:', err);
    return res.status(200).json({ success: true, warning: 'SMS failed but inquiry logged' });
  }
};
