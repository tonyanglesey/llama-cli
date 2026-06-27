// src/commands/logout.ts — forget the session, locally and server-side.
//
// Best-effort POST /api/auth/logout so the llama_sessions row is deleted, then
// always clear the local credentials file (even if the server call fails).

import type { Command } from "commander";
import { readCredentials, clearCredentials } from "../lib/config.js";
import { apiPost } from "../lib/api.js";
import { ok, info } from "../lib/output.js";

export function registerLogout(program: Command): void {
  program
    .command("logout")
    .description("log out and remove the stored session")
    .action(async () => {
      const creds = readCredentials();
      if (!creds) {
        info("Already logged out.");
        return;
      }
      // Don't let a server/network hiccup block local logout.
      await apiPost(creds.api, "/api/auth/logout", {}, creds.session).catch(() => {});
      clearCredentials();
      ok(`Logged out ${creds.email}.`);
    });
}
