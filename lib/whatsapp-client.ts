const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

export async function fetchWhatsAppMessages(phoneNumberId?: string, token?: string) {
  const apiToken = token || process.env.WHATSAPP_API_TOKEN;
  const numId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!apiToken || !numId) {
    return { connected: false, messages: [], error: 'WhatsApp API credentials not configured' };
  }

  try {
    const res = await fetch(`${WHATSAPP_API_URL}/${numId}/messages`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (!res.ok) {
      return { connected: false, messages: [], error: `API error: ${res.status}` };
    }

    const data = await res.json();
    return { connected: true, messages: data.messages || [], error: null };
  } catch (error: any) {
    return { connected: false, messages: [], error: error.message };
  }
}

export async function getWhatsAppBusinessProfile(token?: string) {
  const apiToken = token || process.env.WHATSAPP_API_TOKEN;
  const numId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!apiToken || !numId) {
    return { connected: false, profile: null };
  }

  try {
    const res = await fetch(`${WHATSAPP_API_URL}/${numId}/whatsapp_business_profile`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const data = await res.json();
    return { connected: true, profile: data };
  } catch {
    return { connected: false, profile: null };
  }
}

// Server-side only: never expose the token
export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}
