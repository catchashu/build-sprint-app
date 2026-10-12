import test from "node:test";
import assert from "node:assert/strict";
import { nextSearchQuery, searchAttemptLimit } from "../shared/searchRecovery.ts";
const failed = (query: string) => ({ query, status: "failed", error: "SerpAPI returned HTTP 503. No substitute results were used." });
test("reported four-attempt failure can recover missing searches without repeating successes", () => {
 const run = { seeds: ["a", "b", "c", "d"], searchCount: 4, searches: [failed("a"), {query:"a",status:"complete"}, {query:"b",status:"complete"}, failed("c")] };
 assert.equal(searchAttemptLimit(run), 6); assert.equal(nextSearchQuery(run), "c");
 run.searches.push({query:"c",status:"complete"}); run.searchCount++;
 assert.equal(nextSearchQuery(run), "d");
 run.searches.push(failed("d")); run.searchCount++;
 assert.equal(nextSearchQuery(run), undefined);
});
test("persistent outage and permanent errors cannot cause unlimited retries", () => {
 const run = { seeds:["a","b","c","d"], searchCount:6, searches:[failed("a"),failed("a"),failed("b"),failed("b"),failed("c"),failed("c")] };
 assert.equal(nextSearchQuery(run), undefined);
 assert.equal(nextSearchQuery({ seeds:["a"], searchCount:1, searches:[{query:"a",status:"failed",error:"SerpAPI returned HTTP 401."}] }), undefined);
});
