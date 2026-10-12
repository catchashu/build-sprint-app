import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { convexTest } from "convex-test";
import schema from "../convex/schema.ts";
import { api, internal } from "../convex/_generated/api.js";
import { confirmedPayment, validSignature } from "../shared/payments.ts";

const modules = { "../convex/_generated/server.js": () => import("../convex/_generated/server.js"), "../convex/payments.ts": () => import("../convex/payments.ts"), "../convex/cardReview.ts": () => import("../convex/cardReview.ts"), "../convex/http.ts": () => import("../convex/http.ts") };
const payment = { id: "pay_test", order_id: "order_test", amount: 39900, currency: "INR", status: "captured", captured: true, method: "upi", amount_refunded: 0 };
async function setup(accepted = true) {
  const t = convexTest(schema, modules), token = "test-token-more-than-thirty-two-characters";
  const cards = [{ groupId: "a", label: "Beds", need: "Hospital beds", queries: [] }];
  const reviewJson = JSON.stringify({ revision: 1, cards, decisions: { a: "correct" }, accepted, notes: [] });
  const understandingJson = JSON.stringify({ offering: "Hospital equipment", cards, corrections: [] });
  const id = await t.run(ctx => ctx.db.insert("firstValueRuns", { token, offering: "Hospital equipment", context: "", state: "complete", searchCount: 4, searches: [], responses: [], batches: [], cards: JSON.stringify(cards), reviewJson, ...(accepted ? { understandingJson } : {}) }));
  return { t, id, token, understandingJson };
}
test("only fully captured INR 399 UPI payments for the saved order unlock", () => {
  assert.equal(confirmedPayment(payment, "order_test"), true);
  for (const change of [{ amount: 399 }, { currency: "USD" }, { status: "authorized" }, { captured: false }, { method: "card" }, { order_id: "order_other" }, { amount_refunded: 1 }]) assert.equal(confirmedPayment({ ...payment, ...change }, "order_test"), false);
});
test("checkout and webhook signatures reject changed contents or forged signatures", async () => {
  const secret = "test-secret", body = "order_test|pay_test", signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(await validSignature(body, signature, secret), true);
  assert.equal(await validSignature(body + "changed", signature, secret), false);
  assert.equal(await validSignature(body, "fake", secret), false);
  assert.equal(await validSignature(body, signature, "wrong"), false);
});
test("invite code requires a saved review, stays server-only, limits guesses and persists the same run", async () => {
  process.env.TOPIC_GIBBON_INVITE_CODE = "test-only-invite";
  try {
    const { t, id, token, understandingJson } = await setup();
    await assert.rejects(() => t.mutation(api.payments.invite, { id, token: "wrong", code: "test-only-invite" }));
    const before = await t.query(api.payments.get, { id, token }); assert.equal(JSON.stringify(before).includes("test-only-invite"), false);
    assert.equal((await t.mutation(api.payments.invite, { id, token, code: "bad" })).ok, false);
    assert.equal((await t.mutation(api.payments.invite, { id, token, code: "test-only-invite" })).ok, true);
    const saved = await t.run(ctx => ctx.db.get(id)); assert.equal(saved?.unlock?.via, "comped"); assert.equal(saved?.unlock?.understandingJson, understandingJson); assert.equal(saved?.searchCount, 4);
    assert.equal((await t.query(api.payments.get, { id, token })).unlocked?.via, "comped");
    await assert.rejects(() => t.mutation(api.cardReview.decision, { id, token, revision: 1, cardId: "a", decision: "excluded" }));
    assert.equal((await t.mutation(api.payments.invite, { id, token, code: "bad" })).ok, true);
    const unreviewed = await setup(false); await assert.rejects(() => unreviewed.t.mutation(api.payments.invite, { id: unreviewed.id, token: unreviewed.token, code: "test-only-invite" }));
    const guesses = await setup();
    for (let i = 0; i < 5; i++) assert.equal((await guesses.t.mutation(api.payments.invite, { id: guesses.id, token: guesses.token, code: "bad" })).ok, false);
    assert.match((await guesses.t.mutation(api.payments.invite, { id: guesses.id, token: guesses.token, code: "test-only-invite" })).message, /Wait a minute/);
  } finally { delete process.env.TOPIC_GIBBON_INVITE_CODE; }
});
test("order reservation prevents double creation, reuses an order, and duplicate confirmation cannot overwrite unlock", async () => {
  const { t, id, token } = await setup();
  const request = { id, token, attemptId: "attempt-one", keyId: "rzp_test_example" };
  assert.equal((await t.mutation(internal.payments.reserve, request)).create, true);
  await assert.rejects(() => t.mutation(internal.payments.reserve, { ...request, attemptId: "attempt-two" }));
  await t.mutation(internal.payments.saveOrder, { id, attemptId: "attempt-one", orderId: "order_test" });
  assert.equal((await t.mutation(internal.payments.reserve, { ...request, attemptId: "attempt-three" })).order?.orderId, "order_test");
  assert.equal(await t.mutation(internal.payments.markPaid, { orderId: "order_test", payment: { ...payment, status: "authorized" } }), false);
  assert.equal((await t.query(api.payments.get, { id, token })).unlocked, null);
  assert.equal(await t.mutation(internal.payments.markPaid, { orderId: "order_test", payment }), true);
  const saved = await t.run(ctx => ctx.db.get(id)); assert.equal(saved?.unlock?.via, "test");
  await t.mutation(internal.payments.markPaid, { orderId: "order_test", payment });
  assert.deepEqual((await t.run(ctx => ctx.db.get(id)))?.unlock, saved?.unlock);
});
test("without test credentials or with live credentials, createOrder cannot take payment", async () => {
  const { t, id, token } = await setup();
  delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET;
  await assert.rejects(() => t.action(api.payments.createOrder, { id, token }), /Test payments/);
  process.env.RAZORPAY_KEY_ID = "rzp_live_test_rejected"; process.env.RAZORPAY_KEY_SECRET = "test-secret";
  try { await assert.rejects(() => t.action(api.payments.createOrder, { id, token }), /Test payments/); }
  finally { delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET; }
});
test("webhook rejects an unsigned or altered event and handles a valid duplicate safely", async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
  try {
    const { t, id, token } = await setup();
    await t.mutation(internal.payments.reserve, { id, token, attemptId: "attempt", keyId: "rzp_test_example" });
    await t.mutation(internal.payments.saveOrder, { id, attemptId: "attempt", orderId: "order_test" });
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: payment } } });
    assert.equal((await t.fetch("/razorpay/webhook", { method: "POST", body })).status, 400);
    const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
    assert.equal((await t.fetch("/razorpay/webhook", { method: "POST", body: body + " ", headers: { "x-razorpay-signature": signature } })).status, 400);
    for (let i = 0; i < 2; i++) assert.equal((await t.fetch("/razorpay/webhook", { method: "POST", body, headers: { "x-razorpay-signature": signature } })).status, 200);
    assert.equal((await t.query(api.payments.get, { id, token })).unlocked?.via, "test");
  } finally { delete process.env.RAZORPAY_WEBHOOK_SECRET; }
});
