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

/**
  * Send Meta WhatsApp Cloud API message directly in the background.
  * Does NOT redirect user to wa.me or WhatsApp Web.
  */
export async function sendWhatsAppMessage(recipientPhone: string, messageText: string, templateName?: string) {
  const apiToken = process.env.WHATSAPP_API_TOKEN;
  const numId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!apiToken || !numId) {
    return {
      success: false,
      configured: false,
      error: 'WhatsApp API credentials (WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID) not configured in environment',
    };
  }

  // Clean phone number to digits only (e.g. +91 98765-43210 -> 919876543210)
  const cleanPhone = recipientPhone.replace(/\D/g, '');

  let payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
  };

  if (templateName) {
    payload.type = 'template';
    payload.template = {
      name: templateName,
      language: { code: 'en_US' },
    };
  } else {
    payload.type = 'text';
    payload.text = {
      preview_url: false,
      body: messageText,
    };
  }

  try {
    const res = await fetch(`${WHATSAPP_API_URL}/${numId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Meta WhatsApp API error response:', data);
      return {
        success: false,
        configured: true,
        error: data.error?.message || `API Error HTTP ${res.status}`,
        details: data,
      };
    }

    return {
      success: true,
      configured: true,
      messageId: data.messages?.[0]?.id,
      details: data,
    };
  } catch (error: any) {
    console.error('Failed to send Meta WhatsApp message:', error);
    return { success: false, configured: true, error: error.message };
  }
}

// Server-side only: check if API token and Phone Number ID are set
export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}
