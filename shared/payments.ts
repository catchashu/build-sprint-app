export const PRICE_PAISE = 39900;
export const CURRENCY = "INR";
export type ProviderPayment = { id: string; order_id: string; amount: number; currency: string; status: string; captured: boolean; method: string; amount_refunded?: number };
export function confirmedPayment(payment: ProviderPayment, orderId: string) {
  return payment.order_id === orderId && payment.amount === PRICE_PAISE && payment.currency === CURRENCY && payment.status === "captured" && payment.captured === true && payment.method === "upi" && (payment.amount_refunded ?? 0) === 0;
}
export function equalSecret(left: string, right: string) {
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  return difference === 0;
}
export async function validSignature(message: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = new Uint8Array(signature.match(/../g)!.map(hex => parseInt(hex, 16)));
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(message));
}
