import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient("https://ardent-fly-778.convex.cloud");
function admin(name: string, args: object) {
  const result = spawnSync(process.execPath, ["node_modules/convex/bin/main.js", "run", name, JSON.stringify(args), "--prod"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Verification setup failed.");
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}
// A separate run with saved real evidence. No new searches and no real payments.
const source = admin("firstValue:read", { id: "jd74aezpsqhj5acp02bacpn3b98g2k8x" });
const token = crypto.randomUUID();
const id = await client.mutation(api.firstValue.create, { offering: source.offering, context: source.context, token });
admin("firstValue:save", { id, state: "complete", cards: source.cards });
const identity = { id, token };
const code = readFileSync("artifacts/invite-code.txt", "utf8").trim();
await assert.rejects(() => client.mutation(api.payments.invite, { ...identity, code }));
console.log("PASS: invite cannot unlock an unconfirmed review.");
let review = (await client.query(api.cardReview.get, identity))!;
for (const card of review.cards) {
  await client.mutation(api.cardReview.decision, { ...identity, revision: review.revision, cardId: card.groupId, decision: "correct" });
  review = (await client.query(api.cardReview.get, identity))!;
}
await client.mutation(api.cardReview.accept, { ...identity, revision: review.revision });
const before = await client.query(api.payments.get, identity);
assert.equal(before.accepted, true); assert.equal(before.paymentReady, false); assert.equal(before.inviteReady, true);
assert.equal(JSON.stringify(before).includes(code), false);
assert.equal((await client.mutation(api.payments.invite, { ...identity, code: "incorrect-test-code" })).ok, false);
assert.equal((await client.mutation(api.payments.invite, { ...identity, code })).ok, true);
assert.equal((await client.query(api.payments.get, identity)).unlocked?.via, "comped");
console.log("PASS: wrong code stays locked; private valid code unlocks the same run and survives a fresh read.");
await assert.rejects(() => client.mutation(api.cardReview.decision, { ...identity, revision: review.revision, cardId: review.cards[0].groupId, decision: "excluded" }));
const saved = admin("firstValue:read", { id });
assert.equal(saved.cards, source.cards); assert.equal(saved.searchCount, 0);
assert.deepEqual(JSON.parse(saved.unlock.understandingJson), JSON.parse(saved.understandingJson));
assert.equal((await client.query(api.cardReview.get, identity))!.unlocked, true);
console.log("PASS: confirmed understanding and evidence preserved; zero new searches; no payment taken.");
await assert.rejects(() => client.action(api.payments.createOrder, identity));
console.log("PASS: checkout stays unavailable without Razorpay test credentials.");
const response = await fetch("https://ardent-fly-778.convex.site/"); assert.equal(response.status, 200);
const html = await response.text();
const asset = html.match(/src="([^"]+\.js)"/)?.[1]; assert.ok(asset);
const script = await (await fetch(new URL(asset, response.url))).text(); assert.ok(script.includes("Unlock the full Topic Gibbon plan")); assert.ok(!script.includes(code));
console.log("PASS: deployed unlock screen is served; private invite code is absent from its script.");
writeFileSync("artifacts/m4-live-receipt.json", JSON.stringify(identity));
console.log("NOT RUN: real Razorpay checkout, QR or UPI app handoff (account not set up); phone/desktop clicks (browser unavailable).");
