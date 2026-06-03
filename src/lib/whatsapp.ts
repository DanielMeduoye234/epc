// WhatsApp Cloud API integration utility
// Uses Meta's official WhatsApp Business Cloud API

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

interface SendMessageOptions {
  to: string; // phone number in international format (e.g., 2348012345678)
  message: string;
  imageUrl?: string;
}

interface SendBulkOptions {
  recipients: { phone_number: string; full_name: string }[];
  message: string;
  imageUrl?: string;
}

function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // Ensure it starts without leading zeros for international format
  return digits.startsWith('0') ? `234${digits.slice(1)}` : digits;
}

function personalizeMessage(template: string, name: string): string {
  return template.replace(/\{name\}/g, name).replace(/\{first_name\}/g, name.split(' ')[0]);
}

export async function sendWhatsAppMessage({ to, message, imageUrl }: SendMessageOptions) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp API credentials not configured');
  }

  const formattedPhone = formatPhoneNumber(to);

  // If there's an image, send image with caption
  if (imageUrl) {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'image',
          image: {
            link: imageUrl,
            caption: message,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  // Text-only message
  const response = await fetch(
    `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: {
          body: message,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function sendBulkWhatsApp({ recipients, message, imageUrl }: SendBulkOptions) {
  const results: { phone: string; success: boolean; error?: string }[] = [];

  // Send messages with a small delay to avoid rate limiting
  for (const recipient of recipients) {
    try {
      const personalizedMsg = personalizeMessage(message, recipient.full_name);
      await sendWhatsAppMessage({
        to: recipient.phone_number,
        message: personalizedMsg,
        imageUrl,
      });
      results.push({ phone: recipient.phone_number, success: true });
    } catch (error) {
      results.push({
        phone: recipient.phone_number,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Rate limiting: 80 messages per second max, we'll do 10/sec to be safe
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

export { formatPhoneNumber, personalizeMessage };
