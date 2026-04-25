const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { firstName, lastName, phone, projectType, garageSize, coatingSystem, projectDetails, address } = req.body;

  if (!firstName || !lastName || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Save to Supabase
    const supabaseUrl = 'https://lbqouvztogcvtbtmfnkw.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxicW91dnofdG9nY3ZidG1mbmtXIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDY4MDE5MzksImV4cCI6MTkzMjM3Nzk0NjF9.ImpXWgBp3P6RM4Z8F8dz4mKU5U0Q4RUCL4H5z0vF1bqI';

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
      .from('PlatinumInquiry')
      .insert([
        {
          firstName,
          lastName,
          phone,
          projectType,
          garageSize,
          coatingSystem: coatingSystem || null,
          projectDetails: projectDetails || null,
          address: address || null,
        }
      ])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
    } else {
      console.log('Inquiry saved:', data[0]?.id);
    }

    // Send SMS
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    const ownerPhone = process.env.PLATINUM_OWNER_PHONE;

    if (accountSid && authToken && twilioNumber && ownerPhone) {
      const smsBody = `New Platinum Installs Inquiry:\n${firstName} ${lastName}\nPhone: ${phone}\nProject: ${projectType}\nSize: ${garageSize}\nCoating: ${coatingSystem}\nAddress: ${address}\nDetails: ${projectDetails}`;

      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      const smsResponse = await fetch(url, {
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

      const smsData = await smsResponse.json();
      if (smsResponse.ok) {
        console.log('SMS sent:', smsData.sid);
      } else {
        console.error('Twilio API error:', smsData.message);
      }
    } else {
      console.warn('Twilio credentials incomplete');
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error:', err.message);
    return res.status(200).json({ success: true, warning: 'Error processing request' });
  }
};
