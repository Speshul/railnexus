import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Minimal Razorpay REST client (Orders, Payments, Refunds). Test mode only: this is a demo, so live keys
// are refused outright and no real money can ever move.

function keys() {
  const id = process.env.RAZORPAY_KEY_ID ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!id || !secret) throw new Error("Razorpay keys are missing. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local.");
  if (!id.startsWith("rzp_test_")) throw new Error("Only Razorpay TEST keys (rzp_test_...) are allowed in this demo.");
  return { id, secret };
}

export const razorpayConfigured = () => {
  try {
    keys();
    return true;
  } catch {
    return false;
  }
};

export const publicKeyId = () => keys().id;

async function api<T>(method: "GET" | "POST", path: string, body?: object): Promise<T> {
  const { id, secret } = keys();
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Razorpay ${res.status}: ${data?.error?.description ?? "request failed"}`);
  return data as T;
}

export type RzpOrder = { id: string; amount: number; currency: string; status: string; receipt: string };
export type RzpPayment = { id: string; order_id: string; amount: number; status: string; method: string; captured: boolean };
export type RzpRefund = { id: string; amount: number; status: string };

export const createOrder = (amountPaise: number, receipt: string, notes: Record<string, string>) =>
  api<RzpOrder>("POST", "/orders", { amount: amountPaise, currency: "INR", receipt, notes });

export const fetchPayment = (paymentId: string) => api<RzpPayment>("GET", `/payments/${encodeURIComponent(paymentId)}`);

export const capturePayment = (paymentId: string, amountPaise: number) =>
  api<RzpPayment>("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: "INR" });

export const refundPayment = (paymentId: string, amountPaise: number, notes: Record<string, string>) =>
  api<RzpRefund>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, { amount: amountPaise, notes });

/** Checkout returns signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifySignature(orderId: string, paymentId: string, signature: string) {
  const expected = createHmac("sha256", keys().secret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
