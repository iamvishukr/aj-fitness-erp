import "server-only";
import { waNumber } from "./contact";

/**
 * WhatsApp Business Platform (Cloud API) sender for approved template messages.
 * Configure in Vercel env:
 *   WHATSAPP_TOKEN            permanent System User access token
 *   WHATSAPP_PHONE_NUMBER_ID  the business phone number ID from Meta (not the phone number itself)
 *   WHATSAPP_TEMPLATE_LANG    language code the templates were created with (default "en")
 *   WHATSAPP_API_VERSION      Graph API version (default "v23.0")
 */
export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

// Meta rejects template parameters containing newlines/tabs or 4+ consecutive spaces.
const clean = (v: string) => v.replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim() || "-";

export async function sendTemplate(phone: string, template: string, params: string[]): Promise<SendResult> {
  if (!whatsappConfigured()) return { ok: false, error: "WhatsApp is not connected" };
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const base = process.env.WHATSAPP_API_BASE || "https://graph.facebook.com"; // override only for testing
  const url = `${base}/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: waNumber(phone),
        type: "template",
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
          components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: clean(text) })) }],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number; error_data?: { details?: string } };
    };
    if (!res.ok || !json.messages?.[0]?.id) {
      const e = json.error;
      return { ok: false, error: e ? `${e.code ?? res.status}: ${e.error_data?.details || e.message}` : `HTTP ${res.status}` };
    }
    return { ok: true, id: json.messages[0].id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
