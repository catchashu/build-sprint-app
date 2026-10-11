import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const fields = {
  context: v.string(), evidenceJson: v.string(), source: v.string(),
  researchRequests: v.array(v.string()), rawEvidenceJson: v.string(),
};
export const save = internalMutation({
  args: fields,
  returns: v.id("researchInputs"),
  handler: (ctx, args) => ctx.db.insert("researchInputs", args),
});
export const get = internalQuery({
  args: { id: v.id("researchInputs") },
  returns: v.union(v.null(), v.object({ ...fields, _id: v.id("researchInputs"), _creationTime: v.number() })),
  handler: (ctx, { id }) => ctx.db.get(id),
});
