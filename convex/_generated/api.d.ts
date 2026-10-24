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
import type * as credits from "../credits.js";
import type * as files from "../files.js";
import type * as glossaries from "../glossaries.js";
import type * as http from "../http.js";
import type * as maps from "../maps.js";
import type * as pages from "../pages.js";
import type * as patterns from "../patterns.js";
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
  credits: typeof credits;
  files: typeof files;
  glossaries: typeof glossaries;
  http: typeof http;
  maps: typeof maps;
  pages: typeof pages;
  patterns: typeof patterns;
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

export declare const components: {};
