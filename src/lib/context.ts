// src/lib/context.ts — shared "am I logged in, is this directory linked to a
// project?" check for commands that act on a specific project (list, logs,
// inspect, remove, env, and eventually deploy).

import { readCredentials, readLink, resolveHosts, type Hosts } from "./config.js";
import { fail, json } from "./output.js";

export interface ProjectContext {
  hosts: Hosts;
  project: string;
  session: string;
}

/**
 * Resolve everything a project-scoped command needs, or print an error and
 * return null (the caller should just return after a null check — the error
 * message and process.exitCode are already handled here).
 */
export function requireContext(opts: { endpoint?: string; json?: boolean }): ProjectContext | null {
  const creds = readCredentials();
  if (!creds) {
    if (opts.json) json({ error: "not_logged_in" });
    else fail("Not logged in. Run `lla-ma login`.");
    process.exitCode = 1;
    return null;
  }

  const link = readLink();
  if (!link?.project) {
    if (opts.json) json({ error: "not_linked" });
    else fail("This directory isn't linked to a project. Run `lla-ma link --project <slug>`.");
    process.exitCode = 1;
    return null;
  }

  return {
    hosts: resolveHosts({ endpoint: opts.endpoint }),
    project: link.project,
    session: creds.session,
  };
}
