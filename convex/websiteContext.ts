"use node";
import { resolve4 } from "node:dns/promises";
import { isIP } from "node:net";
import { v, ConvexError } from "convex/values";
import { action } from "./_generated/server";
import { publicWebsite } from "../shared/firstValue";
export const read = action({ args: { url: v.string() }, returns: v.string(), handler: async (_ctx, { url }) => {
  try {
    let target = publicWebsite(url);
    for (let redirects = 0; redirects < 4; redirects++) {
      const host = new URL(target).hostname;
      if (isIP(host)) throw new Error("Private address");
      const addresses = await resolve4(host);
      if (!addresses.length || addresses.some(a => /^(0|10|127|169\.254|192\.168|172\.(1[6-9]|2\d|3[01])|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7]))\./.test(a))) throw new Error("Private address");
      const response = await fetch(target, { redirect: "manual", signal: AbortSignal.timeout(12000), headers: { Accept: "text/html" } });
      if (response.status >= 300 && response.status < 400) { target = publicWebsite(new URL(response.headers.get("location") ?? "", target).href); continue; }
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) throw new Error("Unreadable");
      const reader = response.body!.getReader(); let html = ""; const decoder = new TextDecoder();
      while (html.length < 150000) { const chunk = await reader.read(); if (chunk.done) break; html += decoder.decode(chunk.value, { stream: true }); }
      await reader.cancel();
      const text = html.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, 5000);
      if (text.length < 60) throw new Error("Unreadable");
      return text;
    }
  } catch { /* Never expose URLs from network exceptions or substitute prior context. */ }
  throw new ConvexError("I couldn’t read that website. Check the URL or continue without it.");
} });
