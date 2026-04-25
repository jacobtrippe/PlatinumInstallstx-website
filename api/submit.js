module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { firstName, lastName, phone, projectType, garageSize, coatingSystem, projectDetails, address } = req.body;

  if (!firstName || !lastName || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
  const ownerPhone = process.env.PLATINUM_OWNER_PHONE;

  if (!accountSid || !authToken || !twilioNumber || !ownerPhone) {
    console.warn('Twilio credentials incomplete');
    return res.status(200).json({ success: true });
  }

  const smsBody = `New Platinum Installs Inquiry:\n${firstName} ${lastName}\nPhone: ${phone}\nProject: ${projectType}\nSize: ${garageSize}\nCoating: ${coatingSystem}\nAddress: ${address}\nDetails: ${projectDetails}`;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: twilioNumber,
        To: `+1${ownerPhone}`,
        Body: smsBody,
      }).toString(),
    });

    const data = await response.json();
    if (response.ok) {
      console.log('SMS sent:', data.sid);
    } else {
      console.error('Twilio API error:', data.message);
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('SMS fetch error:', err.message);
    return res.status(200).json({ success: true, warning: 'SMS failed' });
  }
};
