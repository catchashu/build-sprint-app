import { ConvexError, v } from "convex/values";
import { query, mutation, action, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { PRICE_PAISE, CURRENCY, equalSecret, confirmedPayment, validSignature } from "../shared/payments";
import type { ProviderPayment } from "../shared/payments";

const identity = { id: v.id("firstValueRuns"), token: v.string() };
function authorize(run: Doc<"firstValueRuns"> | null, token: string) {
  if (!run || run.token !== token) throw new ConvexError("This run could not be opened.");
  return run;
}
function reviewed(run: Doc<"firstValueRuns">) {
  if (run.reviewPending || !run.understandingJson || !run.reviewJson || !JSON.parse(run.reviewJson).accepted) throw new ConvexError("Confirm your cards before unlocking this run.");
  return run.understandingJson;
}
function keys() {
  const keyId = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  // Final website planning and real checkout validation are not complete: never take real money yet.
  if (!keyId?.startsWith("rzp_test_") || !secret) throw new ConvexError("Test payments aren’t set up yet. Your review is saved.");
  return { keyId, secret };
}
async function provider(path: string, method = "GET", body?: object) {
  const { keyId, secret } = keys();
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, { method, headers: { Authorization: `Basic ${btoa(`${keyId}:${secret}`)}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new ConvexError("Payment couldn’t be confirmed. Your first-value results are safe.");
  return response.json();
}
export const get = query({ args: identity, returns: v.any(), handler: async (ctx, { id, token }) => {
  const run = authorize(await ctx.db.get(id), token);
  const order = await ctx.db.query("paymentOrders").withIndex("by_run", q => q.eq("runId", id)).unique();
  return { accepted: !!run.understandingJson && !!run.reviewJson && JSON.parse(run.reviewJson).accepted && !run.reviewPending, unlocked: run.unlock ? { via: run.unlock.via } : null, paymentReady: !!process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") && !!process.env.RAZORPAY_KEY_SECRET, inviteReady: !!process.env.TOPIC_GIBBON_INVITE_CODE, orderPending: order?.state === "ready", testMode: true };
} });
export const invite = mutation({ args: { ...identity, code: v.string() }, returns: v.object({ ok: v.boolean(), message: v.string() }), handler: async (ctx, { id, token, code }) => {
  const run = authorize(await ctx.db.get(id), token);
  if (run.unlock) return { ok: true, message: "This run is already unlocked." };
  const understandingJson = reviewed(run), secret = process.env.TOPIC_GIBBON_INVITE_CODE;
  if (!secret) return { ok: false, message: "Invite codes aren’t available yet. Your review is saved." };
  const now = Date.now(), fresh = now - (run.inviteWindow ?? 0) >= 60000, attempts = fresh ? 0 : run.inviteAttempts ?? 0;
  if (attempts >= 5) return { ok: false, message: "Too many attempts. Wait a minute and try again." };
  await ctx.db.patch(id, { inviteWindow: fresh ? now : run.inviteWindow, inviteAttempts: attempts + 1 });
  if (code.length > 128 || !equalSecret(code.trim(), secret)) return { ok: false, message: "That invite code isn’t valid. Try again." };
  await ctx.db.patch(id, { unlock: { via: "comped", at: now, understandingJson, reviewJson: run.reviewJson } });
  return { ok: true, message: "Invite code applied. Your full run is unlocked." };
} });
export const read = internalQuery({ args: identity, returns: v.any(), handler: async (ctx, { id, token }) => {
  const run = authorize(await ctx.db.get(id), token);
  const order = await ctx.db.query("paymentOrders").withIndex("by_run", q => q.eq("runId", id)).unique();
  return { run, order };
} });
export const reserve = internalMutation({ args: { ...identity, attemptId: v.string(), keyId: v.string() }, returns: v.any(), handler: async (ctx, { id, token, attemptId, keyId }) => {
  const run = authorize(await ctx.db.get(id), token), understandingJson = reviewed(run);
  if (run.unlock) throw new ConvexError("This run is already unlocked.");
  const previous = await ctx.db.query("paymentOrders").withIndex("by_run", q => q.eq("runId", id)).unique();
  if (previous?.state === "ready") {
    if (previous.keyId !== keyId) throw new ConvexError("Payment settings changed. Contact support before trying again.");
    return { create: false, order: previous };
  }
  if (previous?.state === "creating" && Date.now() - previous.startedAt < 60000) throw new ConvexError("Preparing your payment. Try again in a moment.");
  const fields = { runId: id, state: "creating" as const, attemptId, startedAt: Date.now(), keyId, understandingJson, reviewJson: run.reviewJson! };
  if (previous) await ctx.db.patch(previous._id, fields); else await ctx.db.insert("paymentOrders", fields);
  return { create: true, order: null };
} });
export const saveOrder = internalMutation({ args: { id: v.id("firstValueRuns"), attemptId: v.string(), orderId: v.optional(v.string()) }, returns: v.null(), handler: async (ctx, { id, attemptId, orderId }) => {
  const order = await ctx.db.query("paymentOrders").withIndex("by_run", q => q.eq("runId", id)).unique();
  if (!order || order.attemptId !== attemptId) throw new ConvexError("Payment preparation changed. Please try again.");
  await ctx.db.patch(order._id, { state: orderId ? "ready" : "error", ...(orderId ? { orderId } : {}) }); return null;
} });
export const createOrder = action({ args: identity, returns: v.any(), handler: async (ctx, args): Promise<{ key: string; orderId: string; amount: number; currency: string }> => {
  const { keyId } = keys(), attemptId = crypto.randomUUID();
  const reserved = await ctx.runMutation(internal.payments.reserve, { ...args, attemptId, keyId });
  let orderId = reserved.order?.orderId;
  if (reserved.create) {
    try {
      const order = await provider("orders", "POST", { amount: PRICE_PAISE, currency: CURRENCY, receipt: attemptId, partial_payment: false });
      if (order.amount !== PRICE_PAISE || order.currency !== CURRENCY || !/^order_[A-Za-z0-9]+$/.test(order.id)) throw new Error("Invalid order");
      orderId = order.id;
      await ctx.runMutation(internal.payments.saveOrder, { id: args.id, attemptId, orderId });
    } catch { await ctx.runMutation(internal.payments.saveOrder, { id: args.id, attemptId }); throw new ConvexError("Payment couldn’t be prepared. Your review is saved. Try again."); }
  }
  if (!orderId) throw new ConvexError("Payment couldn’t be prepared. Try again.");
  return { key: keyId, orderId, amount: PRICE_PAISE, currency: CURRENCY };
} });
export const markPaid = internalMutation({ args: { orderId: v.string(), payment: v.any() }, returns: v.boolean(), handler: async (ctx, { orderId, payment }) => {
  const order = await ctx.db.query("paymentOrders").withIndex("by_order", q => q.eq("orderId", orderId)).unique();
  if (!order || !confirmedPayment(payment as ProviderPayment, orderId)) return false;
  const run = await ctx.db.get(order.runId); if (!run) return false;
  const useLatest = !!run.understandingJson && !!run.reviewJson && JSON.parse(run.reviewJson).accepted && !run.reviewPending;
  if (!run.unlock) await ctx.db.patch(run._id, { unlock: { via: order.keyId.startsWith("rzp_test_") ? "test" : "paid", at: Date.now(), paymentId: payment.id, understandingJson: useLatest ? run.understandingJson! : order.understandingJson, reviewJson: useLatest ? run.reviewJson! : order.reviewJson } });
  return true;
} });
export const verify = action({ args: { ...identity, paymentId: v.string(), orderId: v.string(), signature: v.string() }, returns: v.boolean(), handler: async (ctx, args): Promise<boolean> => {
  const { order } = await ctx.runQuery(internal.payments.read, { id: args.id, token: args.token });
  const { keyId, secret } = keys();
  if (!order?.orderId || order.orderId !== args.orderId || order.keyId !== keyId || !/^pay_[A-Za-z0-9]+$/.test(args.paymentId) || !await validSignature(`${order.orderId}|${args.paymentId}`, args.signature, secret)) throw new ConvexError("Payment couldn’t be confirmed. Your first-value results are safe.");
  const payment = await provider(`payments/${args.paymentId}`);
  return ctx.runMutation(internal.payments.markPaid, { orderId: order.orderId, payment });
} });
export const reconcile = action({ args: identity, returns: v.boolean(), handler: async (ctx, args): Promise<boolean> => {
  const { run, order } = await ctx.runQuery(internal.payments.read, args);
  if (run.unlock) return true;
  if (!order?.orderId || order.keyId !== keys().keyId) return false;
  const response = await provider(`orders/${order.orderId}/payments`);
  for (const payment of response.items ?? []) if (confirmedPayment(payment, order.orderId)) return ctx.runMutation(internal.payments.markPaid, { orderId: order.orderId, payment });
  return false;
} });
