// src/commands/whoami.ts — "who am I logged in as?"
//
// Reads the stored session, then confirms it's still valid by calling
// GET /api/auth/me. A stored-but-expired session reports as logged out.

import type { Command } from "commander";
import { readCredentials } from "../lib/config.js";
import { apiGet } from "../lib/api.js";
import { line, info, fail, json } from "../lib/output.js";

export function registerWhoami(program: Command): void {
  program
    .command("whoami")
    .description("show the currently logged-in account")
    .action(async (_opts, command: Command) => {
      const { json: asJson, endpoint } = command.optsWithGlobals();
      const creds = readCredentials();

      if (!creds) {
        if (asJson) json({ loggedIn: false });
        else info("Not logged in. Run `lla-ma login`.");
        process.exitCode = 1;
        return;
      }

      const api = endpoint ?? creds.api;
      const res = await apiGet(api, "/api/auth/me", creds.session);

      if (res.ok) {
        const email = res.data?.user?.email ?? creds.email;
        if (asJson) json({ loggedIn: true, email, api });
        else {
          line(email);
          info(`via ${api}`);
        }
        return;
      }

      if (res.status === 401) {
        if (asJson) json({ loggedIn: false, reason: "session_expired" });
        else info("Session expired. Run `lla-ma login`.");
        process.exitCode = 1;
        return;
      }

      // Network error or unexpected status — say so but don't pretend.
      if (asJson) json({ loggedIn: null, error: res.data?.error ?? `HTTP ${res.status}`, email: creds.email });
      else fail(res.data?.error ?? `Could not verify session (HTTP ${res.status}).`);
      process.exitCode = 1;
    });
}
