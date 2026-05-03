module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { firstName, lastName, phone, projectType, garageSize, coatingSystem, projectDetails, address, source, eventID } = req.body;

  if (!firstName || !lastName || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Save to Supabase using REST API
    const supabaseUrl = 'https://lbqouvztogcvtbtmfnkw.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxicW91dnp0b2djdnRidG1mbmt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MjY3NzcsImV4cCI6MjA5MjMwMjc3N30.m_l-HpeUbZGCYdGQ7k_ZEhN2AAykgclgwAKP9ShZ6dE';

    const dbResponse = await fetch(
      `${supabaseUrl}/rest/v1/PlatinumInquiry`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          projectType,
          garageSize,
          coatingSystem: coatingSystem || null,
          projectDetails: projectDetails || null,
          address: address || null,
        }),
      }
    );

    if (dbResponse.ok) {
      console.log('Inquiry saved to Supabase');
    } else {
      console.error('Supabase error:', await dbResponse.text());
    }

    // Send SMS via Twilio
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
        console.error('Twilio error:', smsData.message);
      }
    }

    // Meta Conversions API — server-side Lead event
    const capiToken = process.env.META_CAPI_TOKEN;
    if (capiToken) {
      const crypto = require('crypto');
      const hash = (val) => val
        ? crypto.createHash('sha256').update(val.toLowerCase().trim()).digest('hex')
        : undefined;

      const eventPayload = {
        data: [{
          event_name: 'Lead',
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventID || undefined,
          event_source_url: 'https://platinuminstallstx.com/landing',
          action_source: 'website',
          user_data: {
            fn: hash(firstName),
            ln: hash(lastName),
            ph: hash(phone?.replace(/\D/g, '')),
            ct: hash(address),
            country: hash('us'),
          },
        }],
      };

      await fetch(
        `https://graph.facebook.com/v19.0/808036985388949/events?access_token=${capiToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventPayload),
        }
      ).catch(() => {}); // fire-and-forget, don't block response
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error:', err.message);
    return res.status(200).json({ success: true });
  }
};
