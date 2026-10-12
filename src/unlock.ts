import type { ConvexClient } from "convex/browser";
import type { Id } from "../convex/_generated/dataModel";
import { api } from "../convex/_generated/api";

type Checkout = { open(): void; close(): void; on(event: string, handler: () => void): void };
type RazorpayConstructor = new (options: Record<string, unknown>) => Checkout;
declare global { interface Window { Razorpay?: RazorpayConstructor } }
let checkoutScript: Promise<void> | undefined;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutScript) checkoutScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.async = true;
    const timeout = window.setTimeout(() => { script.remove(); checkoutScript = undefined; reject(new Error("Checkout could not load. Try again.")); }, 20000);
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); script.remove(); checkoutScript = undefined; reject(new Error("Checkout could not load. Try again.")); };
    document.head.append(script);
  });
  return checkoutScript;
}
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "", cls = "") => { const el = document.createElement(tag); el.textContent = text; el.className = cls; return el; };
export function mountUnlock(client: ConvexClient, identity: { id: Id<"firstValueRuns">; token: string }, root: HTMLElement, back: () => void) {
  let alive = true, busy = false, checking = false, message = "", error = "", code = "", inviteOpen = false;
  let checkout: Checkout | undefined, timer: ReturnType<typeof setTimeout> | undefined, checks = 0;
  let state: { accepted: boolean; unlocked: { via: "comped" | "test" | "paid" } | null; paymentReady: boolean; inviteReady: boolean; orderPending: boolean; testMode: boolean } | undefined;
  function button(text: string, fn: () => void, primary = false) { const b = element("button", text, primary ? "primary" : "secondary"); b.type = "button"; b.disabled = busy; b.onclick = fn; return b; }
  async function work(fn: () => Promise<void>) {
    if (busy || !alive) return; busy = true; error = ""; draw();
    try { await fn(); } catch (cause) { const data = cause && typeof cause === "object" && "data" in cause ? cause.data : null; error = typeof data === "string" ? data : "Payment couldn’t be confirmed. Your first-value results are safe."; }
    finally { busy = false; if (alive) draw(); }
  }
  async function checkPayment() {
    if (!alive || checking || state?.unlocked || !state?.orderPending || !state.paymentReady) return;
    checking = true;
    try {
      const confirmed = await client.action(api.payments.reconcile, identity);
      if (!confirmed && alive) message = "Payment hasn’t been confirmed yet. You can check again without paying twice.";
    } catch { if (alive) error = "Payment couldn’t be confirmed. Your first-value results are safe."; }
    finally { checking = false; if (alive) draw(); }
    if (alive && !state?.unlocked && ++checks < 12) timer = setTimeout(() => void checkPayment(), 5000);
  }
  function draw() {
    if (!alive) return;
    root.replaceChildren();
    if (!state) { root.append(element("p", "Opening your saved run…")); return; }
    if (state.unlocked) {
      root.append(element("h2", state.unlocked.via === "test" ? "Test payment confirmed." : "Your full run is unlocked."));
      root.append(element("p", state.unlocked.via === "comped" ? "Invite code applied. Your full run is unlocked." : state.unlocked.via === "test" ? "No money was charged. Your test unlock is saved." : "Payment received. Your unlock is saved."));
      root.append(element("p", "Your confirmed cards and corrections are saved. Full research and website planning are the next stage being built; they haven’t started yet."));
      root.append(button("Back to your cards", back)); return;
    }
    if (!state.accepted) { root.append(element("p", "Confirm your cards before unlocking this run."), button("Back to your cards", back, true)); return; }
    root.append(element("h2", "Unlock the full Topic Gibbon plan"), element("p", "You’ve seen the first demand areas. Unlock the full India demand map and prioritised website plan."), element("p", "₹399 · one-time", "count"), element("p", "No subscription. No account needed."));
    root.append(element("p", "Payment testing only: no money will be charged. Full research and website planning aren’t available yet.", "small"));
    const pay = button("Pay ₹399 with UPI", () => void work(async () => {
      await loadCheckout();
      const order = await client.action(api.payments.createOrder, identity);
      if (!alive) return;
      checkout = new window.Razorpay!({ key: order.key, amount: order.amount, currency: order.currency, order_id: order.orderId, name: "Topic Gibbon", description: "Full India research and website plan — test payment", theme: { color: "#21634A" },
        config: { display: { blocks: { upi: { name: "Pay via UPI", instruments: [{ method: "upi" }] } }, sequence: ["block.upi"], preferences: { show_default_blocks: false } } },
        handler: (result: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          if (!alive) return;
          void work(async () => {
            message = "Checking your payment…";
            const confirmed = await client.action(api.payments.verify, { ...identity, paymentId: result.razorpay_payment_id, orderId: result.razorpay_order_id, signature: result.razorpay_signature });
            if (!confirmed) { checks = 0; void checkPayment(); }
          });
        }, modal: { ondismiss: () => { if (!alive || state?.unlocked) return; message = "Payment wasn’t completed. You can try again when you’re ready."; draw(); void checkPayment(); } } });
      checkout.on("payment.failed", () => { if (alive) { error = "Payment couldn’t be confirmed. Your first-value results are safe."; draw(); } });
      checkout.open();
    }), true);
    pay.disabled = busy || !state.paymentReady; root.append(pay);
    if (!state.paymentReady) root.append(element("p", "Test payments aren’t set up yet. Your review is saved.", "small muted"));
    root.append(element("p", "On a phone, use an available UPI app. On a computer, scan the QR shown by Razorpay. Test mode may use a simulated payment screen.", "small muted"), element("p", "Secure payments powered by Razorpay", "small muted"));
    root.append(button("Have an invite code?", () => { inviteOpen = !inviteOpen; draw(); if (inviteOpen) root.querySelector<HTMLInputElement>("#invite-code")?.focus(); }));
    if (inviteOpen) {
      const form = element("form", "", "invite-form"), label = element("label", "Enter invite code"), input = element("input"); input.id = "invite-code"; input.type = "password"; input.autocomplete = "off"; input.maxLength = 128; input.value = code; input.disabled = busy;
      const apply = button("Apply", () => {}, true); apply.type = "submit"; apply.disabled = busy || !code.trim() || !state.inviteReady;
      input.oninput = () => { code = input.value; apply.disabled = busy || !code.trim() || !state?.inviteReady; }; label.append(input); form.append(label, apply);
      if (!state.inviteReady) form.append(element("p", "Invite codes aren’t available yet. Your review is saved.", "small muted"));
      form.onsubmit = event => { event.preventDefault(); void work(async () => { const result = await client.mutation(api.payments.invite, { ...identity, code }); if (!result.ok) error = result.message; else { code = ""; message = result.message; } }); };
      root.append(form);
    }
    if (message) { const p = element("p", message); p.setAttribute("role", "status"); root.append(p); }
    if (error) { const p = element("p", error, "error"); p.setAttribute("role", "alert"); root.append(p); }
    if (state.orderPending) root.append(button(checking ? "Checking your payment…" : "Check payment status", () => { checks = 0; void checkPayment(); }));
    root.append(button("Close", back));
  }
  const stop = client.onUpdate(api.payments.get, identity, next => {
    const first = !state; state = next;
    if (state?.unlocked) { clearTimeout(timer); checkout?.close(); }
    draw(); if (first && state?.orderPending) void checkPayment();
  }, () => { error = "Your saved run couldn’t be opened. Reload to reconnect."; root.replaceChildren(element("p", error, "error"), button("Back to your cards", back)); });
  const onFocus = () => { checks = 0; void checkPayment(); }; window.addEventListener("focus", onFocus);
  draw();
  return () => { alive = false; stop(); clearTimeout(timer); window.removeEventListener("focus", onFocus); checkout?.close(); };
}
