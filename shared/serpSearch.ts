// A fresh, uncached search can exceed 45 seconds. Keep one bounded request;
// do not silently retry or spend another search slot.
export const SEARCH_TIMEOUT_MS = 120_000;
export async function fetchSerpSearch(params: URLSearchParams, request: typeof fetch = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const response = await request(`https://serpapi.com/search.json?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`SerpAPI returned HTTP ${response.status}. No substitute results were used.`);
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) throw new Error("SerpAPI did not finish within two minutes. This attempt counts toward the four-search limit. Your completed searches are saved; no substitute results were used.");
    if (error instanceof Error && /^SerpAPI returned HTTP \d+\./.test(error.message)) throw error;
    throw new Error("The connection to SerpAPI failed. Your completed searches are saved; no substitute results were used.");
  } finally { clearTimeout(timer); }
}
