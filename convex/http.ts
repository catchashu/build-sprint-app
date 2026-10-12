import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { validSignature } from "../shared/payments";

const http = httpRouter();
// The app is mounted at /api; static hosting retains the / mount.
http.route({ path: "/razorpay/webhook", method: "POST", handler: httpAction(async (ctx, request) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return new Response("Not configured", { status: 503 });
  const body = await request.text();
  if (body.length > 100000 || !await validSignature(body, request.headers.get("x-razorpay-signature") ?? "", secret)) return new Response("Invalid signature", { status: 400 });
  let event;
  try { event = JSON.parse(body); } catch { return new Response("Invalid body", { status: 400 }); }
  if (event.event === "payment.captured" || event.event === "order.paid") {
    const payment = event.payload?.payment?.entity;
    if (typeof payment?.order_id === "string") await ctx.runMutation(internal.payments.markPaid, { orderId: payment.order_id, payment });
  }
  return new Response("OK", { status: 200 });
}) });
export default http;
