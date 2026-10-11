import { parse } from "csv-parse/sync";

export function csvTable(text: string, header: string): Record<string, string>[] {
  const rows: string[][] = parse(text, { bom: true, relax_column_count: true, skip_empty_lines: true });
  const start = rows.findIndex(row => row[0] === header);
  if (start < 0) throw new Error(`CSV is missing the ${header} header.`);
  return rows.slice(start + 1).filter(row => row.some(Boolean)).map(row =>
    Object.fromEntries(rows[start].map((name, i) => [name, row[i] ?? ""])));
}
export type RawNode = { id: string; parentId: string; path: string; request: string; query: string; sourceType: string; depth: number; reference: string };
export type EvidenceItem = { id: string; query: string; volume: null; occurrences: RawNode[] };
export type BusinessFact = { id: string; field: string; value: string };
export type ExperimentInput = ReturnType<typeof importExperiment> & { businessFacts: BusinessFact[]; sourceHash: string };

export function importExperiment(text: string) {
  const rawNodes: RawNode[] = csvTable(text, "Node ID").map(row => ({
    id: row["Node ID"], parentId: row["Parent Node ID"], path: row.Path,
    request: row["Search Query Typed"], query: row["Discovered Query"],
    sourceType: row["Source Type"], depth: Number(row.Depth), reference: row["Source / Screenshot Ref"],
  }));
  const ids = new Set(rawNodes.map(row => row.id));
  if (rawNodes.length !== 406 || ids.size !== 406 || Array.from({ length: 406 }, (_, i) => `N${String(i + 1).padStart(3, "0")}`).some(id => !ids.has(id))) throw new Error("Expected the complete frozen N001–N406 dataset.");
  for (const row of rawNodes) {
    if (!row.query || !row.sourceType || !row.reference || !row.path || !Number.isInteger(row.depth) || row.depth < 1) throw new Error(`Incomplete source row ${row.id}.`);
    if (row.parentId !== "ROOT" && !ids.has(row.parentId)) throw new Error(`Unknown parent on ${row.id}.`);
  }
  const seedOnly = rawNodes.filter(row => row.sourceType === "Google Search seed");
  const evidence: EvidenceItem[] = [];
  const seen = new Map<string, EvidenceItem>();
  for (const row of rawNodes.filter(row => row.sourceType !== "Google Search seed")) {
    const key = row.query.trim().replace(/\s+/g, " ").toLowerCase();
    const existing = seen.get(key);
    if (existing) existing.occurrences.push(row);
    else { const item: EvidenceItem = { id: row.id, query: row.query, volume: null, occurrences: [row] }; seen.set(key, item); evidence.push(item); }
  }
  return { market: "India" as const, rawNodes, evidence, seedOnly,
    importReport: { originalNodes: rawNodes.length, reasoningQueries: evidence.length, seedOnly: seedOnly.length,
      duplicateOccurrences: rawNodes.length - seedOnly.length - evidence.length,
      sourceTypes: Object.fromEntries([...new Set(rawNodes.map(row => row.sourceType))].map(type => [type, rawNodes.filter(row => row.sourceType === type).length])),
      note: "User-supplied historical observations. Screenshot references and narrated searches have not been independently verified. No dates or volumes were supplied." } };
}

export function neutralBusinessContext(contextCsv: string, seedCsv: string): BusinessFact[] {
  const allowed = new Set(["Current website URL", "Target market", "Known offer: training", "Known non-offer", "Known service: MRI Faraday cage"]);
  const facts = csvTable(contextCsv, "Field").filter(row => allowed.has(row.Field)).map(row => ({ field: row.Field, value: row.Value }));
  for (const row of csvTable(seedCsv, "Seed ID")) {
    if (["Existing website product menu", "User-described existing product/category"].includes(row.Source)) facts.push({ field: "Known catalogue item; not evidence of demand", value: row["Candidate Seed / Product"] });
  }
  return facts.map((fact, i) => ({ id: `B${i + 1}`, ...fact }));
}
