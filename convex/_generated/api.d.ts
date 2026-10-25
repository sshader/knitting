/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as charts from "../charts.js";
import type * as counters from "../counters.js";
import type * as credits from "../credits.js";
import type * as files from "../files.js";
import type * as glossaries from "../glossaries.js";
import type * as http from "../http.js";
import type * as maps from "../maps.js";
import type * as notes from "../notes.js";
import type * as pages from "../pages.js";
import type * as patterns from "../patterns.js";
import type * as pipeline_checks from "../pipeline/checks.js";
import type * as pipeline_convexSource from "../pipeline/convexSource.js";
import type * as pipeline_copy from "../pipeline/copy.js";
import type * as pipeline_pdfService from "../pipeline/pdfService.js";
import type * as pipeline_stages from "../pipeline/stages.js";
import type * as pipeline_start from "../pipeline/start.js";
import type * as pipeline_state from "../pipeline/state.js";
import type * as pipeline_workflow from "../pipeline/workflow.js";
import type * as projects from "../projects.js";
import type * as sections from "../sections.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  admin: typeof admin;
  auth: typeof auth;
  charts: typeof charts;
  counters: typeof counters;
  credits: typeof credits;
  files: typeof files;
  glossaries: typeof glossaries;
  http: typeof http;
  maps: typeof maps;
  notes: typeof notes;
  pages: typeof pages;
  patterns: typeof patterns;
  "pipeline/checks": typeof pipeline_checks;
  "pipeline/convexSource": typeof pipeline_convexSource;
  "pipeline/copy": typeof pipeline_copy;
  "pipeline/pdfService": typeof pipeline_pdfService;
  "pipeline/stages": typeof pipeline_stages;
  "pipeline/start": typeof pipeline_start;
  "pipeline/state": typeof pipeline_state;
  "pipeline/workflow": typeof pipeline_workflow;
  projects: typeof projects;
  sections: typeof sections;
  validators: typeof validators;
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
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
