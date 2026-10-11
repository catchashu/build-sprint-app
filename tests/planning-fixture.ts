import { mriInput } from "../convex/fixtures/mriInput.ts";
import type { Draft } from "../shared/planning.ts";
import type { ExperimentInput } from "../shared/experiment.ts";
// Structural test only, using actual supplied query rows. This is not an AI result or a score.
export const testInput: ExperimentInput = { ...mriInput, market: "India", evidence: mriInput.evidence.filter(row => ["N115", "N143", "N154", "N140", "N112", "N124"].includes(row.id)).map(row => ({ ...row, volume: null })) };
export const testDraft: Draft = {
  limitations: ["Test-only structure, not generated research."],
  clusters: [
    { id: "monitor", parentId: null, label: "Patient monitors", need: "Procure a monitor", kind: "Product family", intent: "Transactional", stage: "Purchase", priority: "First", rationale: "Same product family", evidenceIds: ["N115", "N143", "N154", "N140"], subIntents: [{ label: "Price", intent: "Commercial", stage: "Consideration", evidenceIds: ["N140"] }] },
    { id: "oximeter", parentId: null, label: "Pulse oximeters", need: "Procure an oximeter", kind: "Product family", intent: "Transactional", stage: "Purchase", priority: "First", rationale: "Distinct product family", evidenceIds: ["N112", "N124"], subIntents: [{ label: "Price", intent: "Commercial", stage: "Consideration", evidenceIds: ["N124"] }] },
  ], excluded: [], unresolved: [],
  websitePlan: [
    { id: "p1", parentId: null, label: "Patient monitors", treatment: "Page", role: "Product family page", priority: "First", rationale: "Test", coverage: ["Selection", "Price"], clusterIds: ["monitor"], businessFactIds: [], needsConfirmation: false },
    { id: "p2", parentId: null, label: "Pulse oximeters", treatment: "Page", role: "Product family page", priority: "First", rationale: "Test", coverage: ["Selection", "Price"], clusterIds: ["oximeter"], businessFactIds: [], needsConfirmation: false },
  ],
};
