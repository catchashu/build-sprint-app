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
export function mountUnlock(client: ConvexClient, identity: { id: Id<"firstValueRuns">; token: string }, root: HTMLElement, back: () => void, onUnlocked: () => void) {
  let transitioned = false;
  const content = element("div"), inviteSlot = element("div"), feedback = element("div"), footer = element("div");
  root.replaceChildren(content, inviteSlot, feedback, footer);
  let inviteInput: HTMLInputElement | undefined, inviteApply: HTMLButtonElement | undefined, inviteClear: HTMLButtonElement | undefined, inviteShow: HTMLButtonElement | undefined, inviteHelp: HTMLParagraphElement | undefined;
  let codeVisible = false;
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
  function drawFeedback() {
    feedback.replaceChildren();
    if (message) { const p = element("p", message); p.setAttribute("role", "status"); feedback.append(p); }
    if (error) { const p = element("p", error, "error"); p.setAttribute("role", "alert"); feedback.append(p); }
  }
  function drawInvite() {
    if (!inviteInput) {
      const form = element("form", "", "invite-form"), label = element("label", "Enter invite code"), input = element("input");
      inviteInput = input; input.id = "invite-code"; input.type = "password"; input.autocomplete = "off"; input.maxLength = 128;
      input.setAttribute("autocapitalize", "none"); input.setAttribute("autocorrect", "off"); input.spellcheck = false;
      input.placeholder = "Paste your invite code"; input.setAttribute("aria-describedby", "invite-help");
      const controls = element("div", "", "invite-edit-controls");
      inviteShow = button("Show code", () => {
        const start = input.selectionStart, end = input.selectionEnd;
        codeVisible = !codeVisible; drawInvite(); input.focus();
        if (start !== null && end !== null) input.setSelectionRange(start, end);
      });
      inviteShow.setAttribute("aria-controls", "invite-code");
      inviteClear = button("Clear code", () => {
        code = ""; input.value = ""; error = ""; message = "Invite code cleared. Enter a new code.";
        drawInvite(); drawFeedback(); input.focus();
      });
      inviteApply = button("Apply", () => {}, true); inviteApply.type = "submit";
      inviteHelp = element("p", "", "small muted"); inviteHelp.id = "invite-help";
      input.oninput = () => { code = input.value; error = ""; message = ""; drawInvite(); drawFeedback(); };
      controls.append(inviteShow, inviteClear); label.append(input); form.append(label, controls, inviteHelp, inviteApply);
      form.onsubmit = event => {
        event.preventDefault(); if (busy || !code.trim() || !state?.inviteReady) return;
        const submittedCode = code;
        void work(async () => {
          const result = await client.mutation(api.payments.invite, { ...identity, code: submittedCode });
          if (!result.ok) error = result.message;
          else { code = ""; input.value = ""; message = result.message; }
        });
      };
      inviteSlot.append(form);
    }
    const type = codeVisible ? "text" : "password";
    if (inviteInput.type !== type) inviteInput.type = type;
    inviteInput.disabled = busy;
    inviteShow!.textContent = codeVisible ? "Hide code" : "Show code"; inviteShow!.disabled = busy;
    inviteShow!.setAttribute("aria-pressed", String(codeVisible));
    inviteClear!.disabled = busy || !code;
    inviteApply!.disabled = busy || !code.trim() || !state?.inviteReady;
    inviteApply!.textContent = busy ? "Applying..." : "Apply";
    inviteHelp!.textContent = state?.inviteReady ? "Capital and small letters must match. Use Show code to check what you entered." : "Invite codes aren?t available yet. Your review is saved.";
  }
  function draw() {
    if (!alive) return;
    content.replaceChildren(); feedback.replaceChildren(); footer.replaceChildren(); inviteSlot.hidden = true;
    if (!state) { content.append(element("p", "Opening your saved run…")); return; }
    if (state.unlocked) {
      content.append(element("p", "Opening your full research..."));
      if (!transitioned) { transitioned = true; queueMicrotask(() => { if (alive) onUnlocked(); }); }
      return;
    }
    if (!state.accepted) { content.append(element("p", "Confirm your cards before unlocking this run."), button("Back to your cards", back, true)); return; }
    content.append(element("h2", "Unlock the full Topic Gibbon plan"), element("p", "You’ve seen the first demand areas. Unlock the full India demand map and prioritised website plan."), element("p", "₹399 · one-time", "count"), element("p", "No subscription. No account needed."));
    content.append(element("p", "Payment testing only: no money will be charged. Full research and website planning aren’t available yet.", "small"));
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
    pay.disabled = busy || !state.paymentReady; content.append(pay);
    if (!state.paymentReady) content.append(element("p", "Test payments aren’t set up yet. Your review is saved.", "small muted"));
    content.append(element("p", "On a phone, use an available UPI app. On a computer, scan the QR shown by Razorpay. Test mode may use a simulated payment screen.", "small muted"), element("p", "Secure payments powered by Razorpay", "small muted"));
    content.append(button("Have an invite code?", () => { inviteOpen = !inviteOpen; draw(); if (inviteOpen) root.querySelector<HTMLInputElement>("#invite-code")?.focus(); }));
    if (inviteOpen) { inviteSlot.hidden = false; drawInvite(); }
    drawFeedback();
    if (state.orderPending) footer.append(button(checking ? "Checking your payment…" : "Check payment status", () => { checks = 0; void checkPayment(); }));
    footer.append(button("Close", back));
  }
  const stop = client.onUpdate(api.payments.get, identity, next => {
    const first = !state; state = next;
    if (state?.unlocked) { clearTimeout(timer); checkout?.close(); }
    draw(); if (first && state?.orderPending) void checkPayment();
  }, () => { error = "Your saved run couldn’t be opened. Reload to reconnect."; content.replaceChildren(element("p", error, "error"), button("Back to your cards", back)); inviteSlot.hidden = true; feedback.replaceChildren(); footer.replaceChildren(); });
  const onFocus = () => { checks = 0; void checkPayment(); }; window.addEventListener("focus", onFocus);
  draw();
  return () => { alive = false; stop(); clearTimeout(timer); window.removeEventListener("focus", onFocus); checkout?.close(); };
}
