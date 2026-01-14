/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _lib_auth from "../_lib/auth.js";
import type * as admin from "../admin.js";
import type * as api_keys from "../api_keys.js";
import type * as api_usage from "../api_usage.js";
import type * as conversations from "../conversations.js";
import type * as guanzhao from "../guanzhao.js";
import type * as letter_threads from "../letter_threads.js";
import type * as letters from "../letters.js";
import type * as memories from "../memories.js";
import type * as messages from "../messages.js";
import type * as prompts from "../prompts.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_lib/auth": typeof _lib_auth;
  admin: typeof admin;
  api_keys: typeof api_keys;
  api_usage: typeof api_usage;
  conversations: typeof conversations;
  guanzhao: typeof guanzhao;
  letter_threads: typeof letter_threads;
  letters: typeof letters;
  memories: typeof memories;
  messages: typeof messages;
  prompts: typeof prompts;
  seed: typeof seed;
  users: typeof users;
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
