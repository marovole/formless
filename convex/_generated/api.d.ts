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
import type * as _lib_ensure_user from "../_lib/ensure_user.js";
import type * as admin from "../admin.js";
import type * as agent_memories from "../agent_memories.js";
import type * as api_keys from "../api_keys.js";
import type * as api_usage from "../api_usage.js";
import type * as chat_prep from "../chat_prep.js";
import type * as conversations from "../conversations.js";
import type * as guanzhao from "../guanzhao.js";
import type * as guanzhao_actions from "../guanzhao/actions.js";
import type * as guanzhao_budget from "../guanzhao/budget.js";
import type * as guanzhao_constants from "../guanzhao/constants.js";
import type * as guanzhao_push from "../guanzhao/push.js";
import type * as guanzhao_session_events from "../guanzhao/session_events.js";
import type * as guanzhao_triggers from "../guanzhao/triggers.js";
import type * as guanzhao_types from "../guanzhao/types.js";
import type * as guanzhao_utils from "../guanzhao/utils.js";
import type * as guanzhao_validation from "../guanzhao/validation.js";
import type * as letter_threads from "../letter_threads.js";
import type * as letters from "../letters.js";
import type * as memories from "../memories.js";
import type * as messages from "../messages.js";
import type * as prompts from "../prompts.js";
import type * as resources from "../resources.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_lib/auth": typeof _lib_auth;
  "_lib/ensure_user": typeof _lib_ensure_user;
  admin: typeof admin;
  agent_memories: typeof agent_memories;
  api_keys: typeof api_keys;
  api_usage: typeof api_usage;
  chat_prep: typeof chat_prep;
  conversations: typeof conversations;
  guanzhao: typeof guanzhao;
  "guanzhao/actions": typeof guanzhao_actions;
  "guanzhao/budget": typeof guanzhao_budget;
  "guanzhao/constants": typeof guanzhao_constants;
  "guanzhao/push": typeof guanzhao_push;
  "guanzhao/session_events": typeof guanzhao_session_events;
  "guanzhao/triggers": typeof guanzhao_triggers;
  "guanzhao/types": typeof guanzhao_types;
  "guanzhao/utils": typeof guanzhao_utils;
  "guanzhao/validation": typeof guanzhao_validation;
  letter_threads: typeof letter_threads;
  letters: typeof letters;
  memories: typeof memories;
  messages: typeof messages;
  prompts: typeof prompts;
  resources: typeof resources;
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
