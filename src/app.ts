import { explainerClose, audienceTabs } from "./explainerControls";
import { randomId } from "./randomId";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { materializeCards } from "../shared/firstValue";
import "./style.css";
import { mountReview } from "./cardReview";
import { mountResearch } from "./research";
import { mountUnlock } from "./unlock";
import { mountWebsitePlan } from "./websitePlan";
import { readSavedState, saveState } from "./savedPlan";
import { canvasMode, setCanvasMode, watchCanvasViewport } from "./canvasLayout";
import { createRestingStage } from "./restingStage";
import { arriveReady } from "./arrival";
import { trayGeometry, transitionTray } from "./trayTransition";
const client = new ConvexClient(import.meta.env.VITE_CONVEX_URL);
const app = document.querySelector<HTMLElement>("#app")!;
const storageKey = `topic-gibbon-m2:${import.meta.env.VITE_CONVEX_URL}`;
type State = { offering: string; website: string; references: string[]; websiteText: string; referenceText: string; screen: "landing" | "arrival" | "website" | "references" | "result" | "unlock" | "research" | "plan"; id?: Id<"firstValueRuns">; token: string };
const blank = (): State => ({ offering: "", website: "", references: ["", ""], websiteText: "", referenceText: "", screen: "landing", token: randomId() });
let state: State;
state = readSavedState(sessionStorage, localStorage, storageKey, blank);
let unsubscribe: (() => void) | undefined;
let stopReview: (() => void) | undefined;
const { stage, select: selectAnimation, stop: stopStage } = createRestingStage();
let stopArrival: (() => void) | undefined;
const panel = node("section", "", "panel"); app.append(stage, panel);
const stopViewport = watchCanvasViewport(app);
import.meta.hot?.dispose(() => { stopArrival?.(); stopStage(); stopViewport(); unsubscribe?.(); stopReview?.(); });
let busy = false;
function save() { saveState(sessionStorage, localStorage, storageKey, state); }
function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = "") { const e = document.createElement(tag); e.textContent = text; e.className = className; return e; }
function button(text: string, action: () => void, primary = false) { const b = node("button", text, primary ? "primary" : "secondary"); b.type = "button"; b.onclick = action; return b; }
function message(text: string) { document.querySelector<HTMLElement>("#message")!.textContent = text; }
async function work(fn: () => Promise<void>) {
  if (busy) return; busy = true;
  panel.querySelectorAll<HTMLButtonElement>("button").forEach(b => b.disabled = true);
  try { await fn(); } catch { message("This step couldn’t finish. Your context is saved. Please try again."); }
  finally { busy = false; panel.querySelectorAll<HTMLButtonElement>("button").forEach(b => b.disabled = false); }
}
let trayAnimation: Animation | undefined;
function go(screen: State["screen"]) {
  const previous = app.dataset.canvasStep;
  const animate = (previous === 'landing' && screen === 'website') || (previous === 'website' && screen === 'landing');
  const from = animate ? trayGeometry(app) : undefined;
  trayAnimation?.cancel(); trayAnimation = undefined; delete app.dataset.trayMoving;
  state.screen = screen; save(); render();
  if (screen !== 'arrival') document.querySelector<HTMLElement>('h1, h2')?.focus({ preventScroll: true });
  if (from) trayAnimation = transitionTray(app, from, trayGeometry(app));
}
function field(label: string, value: string, placeholder: string, update: (value: string) => void, multiline = false) {
  const wrapper = node("label", label); const input = multiline ? node("textarea") : node("input");
  input.value = value; input.placeholder = placeholder; input.maxLength = multiline ? 2000 : 500;
  if (input instanceof HTMLInputElement) { input.type = "url"; input.autocomplete = "off"; }
  input.oninput = () => { update(input.value); save(); }; wrapper.append(input); return wrapper;
}
function render() {
  stopArrival?.(); stopArrival = undefined;
  // Keep the current tray painted during the already-settled placeholder handoff.
  if (state.screen === 'arrival') {
    stopArrival = arriveReady(state.offering, () => go('website'), () => { go('landing'); message('I lost that first detail. Tell me what you offer again.'); });
    return;
  }
  unsubscribe?.(); unsubscribe = undefined; stopReview?.(); stopReview = undefined; panel.replaceChildren(); panel.scrollTop = 0;
  app.className = state.screen === "landing" ? "landing" : "canvas";
  app.dataset.canvasStep = state.screen;
  setCanvasMode(app, canvasMode(state.screen));
  selectAnimation(canvasMode(state.screen));
  if (state.screen === "landing" || state.screen === "website") {
    const brand = node("div", "", "landing-logo");
    const logo = node("img"); logo.src = "/images/topic-gibbon-logo-transparent.png"; logo.alt = "Topic Gibbon";
    logo.width = 1040; logo.height = 440; brand.append(logo); panel.append(brand);
  } else panel.append(node("p", "Topic Gibbon", "brand"));
  const error = node("p", "", "error"); error.id = "message"; error.setAttribute("role", "alert");
  if (state.screen === "landing") {
    const h = node("h1"); h.tabIndex = -1;
    h.innerHTML = 'Plan your website<span class="phone-break"></span> around<span class="wide-break"></span> what<span class="phone-break"></span> customers search for.';
    panel.append(h);
    const form = node("form");
    form.append(field("What do you offer?", state.offering, "Example: We supply hospital beds, examination tables & medical trolleys to hospitals across India.", value => state.offering = value, true));
    const next = button("Plan my website", () => {}, true); next.type = "submit"; form.append(error, next);
    form.onsubmit = event => { event.preventDefault(); if (state.screen !== "landing") return; if (state.offering.trim().length < 10) { message("Tell us a little more about what you offer."); return; } go("arrival"); };
    panel.append(form);
    const explainers = node("nav", "", "explainers"); explainers.setAttribute("aria-label", "About Topic Gibbon");
    for (const label of ["What?", "Why?", "How?", "For me?"]) explainers.append(button(label, () => explain(label)));
    panel.append(explainers);
    if (localStorage.getItem(`${storageKey}:plan`)) panel.append(button("Reopen saved website plan", () => {
      try { const saved = JSON.parse(localStorage.getItem(`${storageKey}:plan`)!); if (saved?.id && saved?.token) { state = saved; go("plan"); } }
      catch { message("The saved plan could not be opened in this browser."); }
    }));
  } else if (state.screen === "website" || state.screen === "references") {
    const own = state.screen === "website";
    const title = node("h2", own ? "Do you have a website I should use as context?" : "Any competitor or inspiration sites I should look at?"); title.tabIndex = -1;
    panel.append(title, node("p", own ? "Leave this blank if you don’t have one." : "Optional · Add up to 2.", "muted"));
    const form = node("form");
    if (own) form.append(field("Your website (optional)", state.website, "Paste your website URL", value => { state.website = value; state.websiteText = ""; }));
    else for (let i = 0; i < 2; i++) form.append(field(`Reference website ${i + 1} (optional)`, state.references[i], "Paste a URL", value => { state.references[i] = value; state.referenceText = ""; }));
    const controls = node("div", "", "controls"); controls.append(button("Back", () => go(own ? "landing" : "website")));
    const next = button("Continue", () => {}, true); next.type = "submit"; controls.append(next);
    const skip = button("Continue without it", () => void work(async () => { if (own) { state.website = ""; state.websiteText = ""; go("references"); } else { state.references = ["", ""]; state.referenceText = ""; await launch(); } })); skip.hidden = true;
    form.append(error, controls, skip); panel.append(form);
    form.onsubmit = event => { event.preventDefault(); void work(async () => {
      const urls = (own ? [state.website] : state.references).filter(url => url.trim());
      message(urls.length ? (own ? "Reading your website…" : "Reading the reference websites…") : "");
      let texts: string[];
      try { texts = await Promise.all(urls.map(async url => `${own ? "Business website" : "Competitor/inspiration ONLY, not our offering"}: ${url}\n${await client.action(api.websiteContext.read, { url })}`)); }
      catch { message(own ? "I couldn’t read that website. Check the URL or continue without it." : "I couldn’t read one of those sites. Check the URL or continue without it."); skip.hidden = false; return; }
      if (own) { state.websiteText = texts.join("\n"); go("references"); }
      else { state.referenceText = texts.join("\n"); await launch(); }
    }); };
  } else if (state.screen === "plan") {
    if (!state.id) { go("landing"); return; }
    app.classList.add("plan-screen");
    stopReview = mountWebsitePlan(client, { id: state.id, token: state.token }, panel, () => go("research"), () => { state = blank(); go("landing"); });
  } else if (state.screen === "research") {
    if (!state.id) { go("landing"); return; }
    stopReview = mountResearch(client, { id: state.id, token: state.token }, panel, () => go("plan"));
  } else if (state.screen === "unlock") {
    if (!state.id) { go("landing"); return; }
    const unlock = node("div", "", "unlock"); panel.append(unlock);
    stopReview = mountUnlock(client, { id: state.id, token: state.token }, unlock, () => go("result"), () => go("research"));
  } else {
    const title = node("h2", "Preparing your first search…"); title.tabIndex = -1;
    const count = node("p", "Searches used: 0 / 4", "count");
    const status = node("p", "", "muted"); status.setAttribute("role", "status");
    const cards = node("div", "", "review");
    const searches = node("details"); searches.append(node("summary", "Search activity")); const log = node("ul"); searches.append(log);
    const controls = node("div", "", "controls");
    const retry = button("Try again", () => void work(async () => { await client.mutation(api.firstValue.start, { id: state.id!, token: state.token }); }), true); retry.hidden = true;
    const edit = button("Edit context", () => { state.id = undefined; state.token = randomId(); go("landing"); }); edit.hidden = true;
    controls.append(retry, edit); panel.append(title, count, status, error, cards, searches, controls);
    if (!state.id) { message("This run couldn’t be opened. Your context is saved."); edit.hidden = false; return; }
    unsubscribe = client.onUpdate(api.firstValue.get, { id: state.id, token: state.token }, run => {
      if (!run) { setCanvasMode(app, "review"); message("This saved run couldn’t be opened."); edit.hidden = false; return; }
      setCanvasMode(app, canvasMode("result", run.state));
      count.textContent = `Searches used: ${run.searchCount} / ${run.searchLimit}`;
      log.replaceChildren(...run.searches.map((s: { query: string; status: string; error?: string }) => node("li", `${s.query} — ${s.status}${s.error ? `: ${s.error}` : ""}`, s.status === "failed" ? "error" : "")));
      if (run.searches.some((s: { status: string }) => s.status === "failed")) searches.open = true;
      message(run.error || ""); if (!stopReview) cards.replaceChildren();
      title.textContent = run.state === "complete" ? "Here’s what people in India are searching for around your offering." : run.state === "failed" ? "Your first view needs another step" : "Finding your customers’ questions";
      status.textContent = run.state === "searching" ? "Looking for real search demand around your offering…" : run.state === "grouping" ? "Organising the search evidence into a first view…" : run.state === "working" ? "Choosing searches around your offering…" : "";
      retry.hidden = !["ready", "failed"].includes(run.state) || !run.canRetry;
      retry.textContent = run.retryUsesSaved ? "Use saved searches" : "Try again";
      edit.hidden = !["ready", "failed", "complete"].includes(run.state);
      if (run.state === "complete" && run.cards) {
        const values: ReturnType<typeof materializeCards> = JSON.parse(run.cards);
        status.textContent = `Search evidence collected ${values[0].queries[0].sources[0].retrievedAt}. This is the saved first view for this run.`;
        if (run.searches.some((s: { status: string }) => s.status === "failed")) status.textContent += " Some searches failed. These cards use only the successful saved results; coverage may be incomplete.";
        if (!stopReview) stopReview = mountReview(client, { id: state.id!, token: state.token }, cards, () => go("unlock"));
      }
    }, () => { message("The connection was interrupted. Your context is saved. Reload to reconnect."); });
  }
}
async function launch() {
  save();
  state.id = await client.mutation(api.firstValue.create, { offering: state.offering, context: [state.websiteText, state.referenceText].filter(Boolean).join("\n\n"), token: state.token });
  save(); go("result"); await client.mutation(api.firstValue.start, { id: state.id, token: state.token });
}
const copy: Record<string, { title: string; paragraphs: string[] }> = {
  "What?": { title: "What Is Topic Gibbon?", paragraphs: ["Topic Gibbon is a pay-as-you-go topic & keyword research tool. It turns real searches in India into a website plan: suggested pages, what each should cover & what to prioritise.", "Download the completed plan as an Excel file to use with your designer, writer or team. You get a plan for what to create, not a built website or finished page copy."] },
  "Why?": { title: "Why Topic Gibbon?", paragraphs: ["A keyword list still leaves you asking, “What do I put on my website?” Topic Gibbon turns that research into decisions about pages, sections & FAQs, so you can build the foundations for getting found in search & AI before spending on design & content."] },
  "How?": { title: "How Does Topic Gibbon Work?", paragraphs: ["Describe what you offer, then optionally add your website & up to two competitor or inspiration sites.", "Topic Gibbon checks real searches in India & shows 2–4 groups of customer needs, with 2–3 sourced search examples in each. This first view is free. Confirm or correct its understanding before deciding whether to pay.", "A one-time ₹399 UPI payment unlocks the full research & website plan for this offering. Topic Gibbon builds a fuller demand map for you to review, then turns it into a prioritised website plan. You can inspect the searches behind the recommendations."] },
  "For me?": { title: "Is Topic Gibbon for Me?", paragraphs: ["Know which pages your website needs, what each should cover & what to prioritise. Give your designer or writer a clear starting point, so your website addresses what potential customers are searching for, rather than just what you think it should say.", "Turn search demand into a website architecture you can explain & defend, with topic clusters, page recommendations & the underlying queries available to inspect. Show your client or team what to build first, what belongs together & why, so you can agree on the direction before design & content production begin."] },
};
function explain(label: string) {
  const dialog = node("dialog", "", "explainer-dialog"); const content = copy[label]; dialog.setAttribute("aria-label", content.title);
  const header = node("div", "", "explainer-header"); header.append(node("h2", content.title), explainerClose(() => dialog.close())); dialog.append(header);
  if (label === "What?") dialog.append(node("p", "Get a website plan based on real searches in India, with suggested pages, what each should cover & what to prioritise. Just tell us what you offer."));
  if (label === "How?") dialog.append(node("p", "Start free & see the first search results. Then choose whether to pay ₹399 once via UPI for the full research & website plan."), node("p", "No subscription or account needed."));
  if (label === "For me?") {
    const audience = audienceTabs(["I\u2019m planning my own website", "I\u2019m doing this for a client/team"], content.paragraphs);
    dialog.append(audience.tabs, audience.content);
  } else for (const paragraph of content.paragraphs) dialog.append(node("p", paragraph));
  dialog.onclose = () => dialog.remove(); document.body.append(dialog); dialog.showModal();
}
render();
