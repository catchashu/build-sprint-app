import test from "node:test";
import assert from "node:assert/strict";
import { searchPlanSchema } from "../shared/firstValuePrompts.ts";
test("search plans reject long bundled requests and duplicate searches", () => {
 assert.throws(()=>searchPlanSchema.parse({queries:["family office portfolio management wealth planning and investment advisory Singapore","family office services Singapore"]}));
 assert.throws(()=>searchPlanSchema.parse({queries:["Wealth management Singapore"," wealth management singapore "]}));
 assert.deepEqual(searchPlanSchema.parse({queries:["family office services Singapore","wealth management Singapore","investment advisory Singapore"]}).queries.length,3);
});
