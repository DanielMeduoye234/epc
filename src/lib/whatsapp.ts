// WhatsApp Cloud API integration utility
// Uses Meta's official WhatsApp Business Cloud API

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

interface SendMessageOptions {
  to: string;
  message: string;
  imageUrl?: string;
  phoneNumberId?: string;
  accessToken?: string;
}

interface SendBulkOptions {
  recipients: { phone_number: string; full_name: string }[];
  message: string;
  imageUrl?: string;
  phoneNumberId?: string;
  accessToken?: string;
  templateName?: string;
  templateLanguage?: string;
}

export type WhatsAppTemplateListItem = {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  rejected_reason?: string;
};

export type WhatsAppCredentials = {
  phoneNumberId: string;
  accessToken: string;
};

import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeTemplateParam } from '@/lib/whatsapp-templates';

export async function getBranchWhatsAppCredentials(
  supabase: SupabaseClient,
  branchId: string
): Promise<WhatsAppCredentials> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const envNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  let branchNumberId: string | null = null;

  const { data } = await supabase
    .from('branch_settings')
    .select('whatsapp_phone_number_id')
    .eq('branch_id', branchId)
    .maybeSingle();

  branchNumberId = data?.whatsapp_phone_number_id || null;
  const phoneNumberId = branchNumberId || envNumberId;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp API credentials not configured');
  }

  return { phoneNumberId, accessToken };
}

export function getWhatsAppAccessToken(): string {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('WhatsApp API credentials not configured');
  }
  return accessToken;
}

export function getWhatsAppBusinessAccountId(): string {
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!wabaId) {
    throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID is not configured');
  }
  return wabaId;
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

export async function sendWhatsAppMessage({ to, message, imageUrl, phoneNumberId, accessToken }: SendMessageOptions) {
  const resolvedId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const resolvedToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!resolvedId || !resolvedToken) {
    throw new Error('WhatsApp API credentials not configured');
  }

  const formattedPhone = formatPhoneNumber(to);

  // If there's an image, send image with caption
  if (imageUrl) {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${resolvedId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resolvedToken}`,
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
    `${WHATSAPP_API_URL}/${resolvedId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resolvedToken}`,
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

export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode = 'en_US',
  bodyParams,
  phoneNumberId,
  accessToken,
}: {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams: string[];
  phoneNumberId?: string;
  accessToken?: string;
}) {
  const resolvedId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const resolvedToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!resolvedId || !resolvedToken) {
    throw new Error('WhatsApp API credentials not configured');
  }

  const formattedPhone = formatPhoneNumber(to);

  const response = await fetch(`${WHATSAPP_API_URL}/${resolvedId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resolvedToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: 'body',
            parameters: bodyParams.map((text) => ({
              type: 'text',
              text: sanitizeTemplateParam(text),
            })),
          },
        ],
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function sendBulkWhatsApp({
  recipients,
  message,
  imageUrl,
  phoneNumberId,
  accessToken,
  templateName,
  templateLanguage = 'en_US',
}: SendBulkOptions) {
  const results: { phone: string; success: boolean; error?: string }[] = [];

  for (const recipient of recipients) {
    if (!recipient.phone_number?.replace(/\D/g, '')) {
      results.push({ phone: recipient.phone_number || '', success: false, error: 'Missing phone number' });
      continue;
    }

    try {
      const firstName = recipient.full_name.split(' ')[0] || recipient.full_name;
      if (templateName) {
        await sendWhatsAppTemplate({
          to: recipient.phone_number,
          templateName,
          languageCode: templateLanguage,
          bodyParams: [firstName, personalizeMessage(message, recipient.full_name)],
          phoneNumberId,
          accessToken,
        });
      } else {
        await sendWhatsAppMessage({
          to: recipient.phone_number,
          message: personalizeMessage(message, recipient.full_name),
          imageUrl,
          phoneNumberId,
          accessToken,
        });
      }
      results.push({ phone: recipient.phone_number, success: true });
    } catch (error) {
      results.push({
        phone: recipient.phone_number,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

async function whatsappGraphError(response: Response): Promise<string> {
  try {
    const error = await response.json();
    return error?.error?.error_user_msg || error?.error?.message || JSON.stringify(error);
  } catch {
    return `WhatsApp API error (${response.status})`;
  }
}

export async function listWhatsAppTemplates(): Promise<WhatsAppTemplateListItem[]> {
  const token = getWhatsAppAccessToken();
  const wabaId = getWhatsAppBusinessAccountId();
  const templates: WhatsAppTemplateListItem[] = [];
  let nextUrl: string | null =
    `${WHATSAPP_API_URL}/${wabaId}/message_templates?limit=100&fields=id,name,status,language,category,rejected_reason`;

  while (nextUrl) {
    const requestUrl: string = nextUrl;
    const response: Response = await fetch(requestUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(await whatsappGraphError(response));
    }
    const json = (await response.json()) as {
      data?: Array<{
        id: string;
        name: string;
        status: string;
        language: string;
        category: string;
        rejected_reason?: string;
      }>;
      paging?: { next?: string };
    };
    for (const row of json.data || []) {
      templates.push({
        id: row.id,
        name: row.name,
        status: row.status,
        language: row.language,
        category: row.category,
        rejected_reason: row.rejected_reason,
      });
    }
    nextUrl = json.paging?.next ?? null;
  }

  return templates;
}

export async function createWhatsAppTemplate(template: {
  name: string;
  language: string;
  category: 'UTILITY' | 'MARKETING';
  body: string;
  example: [string, string];
}) {
  const token = getWhatsAppAccessToken();
  const wabaId = getWhatsAppBusinessAccountId();

  const response = await fetch(`${WHATSAPP_API_URL}/${wabaId}/message_templates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: template.name,
      language: template.language,
      category: template.category,
      components: [
        {
          type: 'BODY',
          text: template.body,
          example: {
            body_text: [template.example],
          },
        },
      ],
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.error_user_msg || json?.error?.message || JSON.stringify(json));
  }
  return json;
}

export { formatPhoneNumber, personalizeMessage };
