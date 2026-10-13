/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as batchedExperiment from "../batchedExperiment.js";
import type * as cardReview from "../cardReview.js";
import type * as checkAi from "../checkAi.js";
import type * as evaluation from "../evaluation.js";
import type * as experiment from "../experiment.js";
import type * as experimentRuns from "../experimentRuns.js";
import type * as firstValue from "../firstValue.js";
import type * as fixtures_mriEvaluation from "../fixtures/mriEvaluation.js";
import type * as fixtures_mriInput from "../fixtures/mriInput.js";
import type * as fullResearch from "../fullResearch.js";
import type * as http from "../http.js";
import type * as inputs from "../inputs.js";
import type * as mapReview from "../mapReview.js";
import type * as payments from "../payments.js";
import type * as research from "../research.js";
import type * as researchAI from "../researchAI.js";
import type * as runFields from "../runFields.js";
import type * as websiteContext from "../websiteContext.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  batchedExperiment: typeof batchedExperiment;
  cardReview: typeof cardReview;
  checkAi: typeof checkAi;
  evaluation: typeof evaluation;
  experiment: typeof experiment;
  experimentRuns: typeof experimentRuns;
  firstValue: typeof firstValue;
  "fixtures/mriEvaluation": typeof fixtures_mriEvaluation;
  "fixtures/mriInput": typeof fixtures_mriInput;
  fullResearch: typeof fullResearch;
  http: typeof http;
  inputs: typeof inputs;
  mapReview: typeof mapReview;
  payments: typeof payments;
  research: typeof research;
  researchAI: typeof researchAI;
  runFields: typeof runFields;
  websiteContext: typeof websiteContext;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
