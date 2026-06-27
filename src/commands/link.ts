// src/commands/link.ts — bind the current directory to a set of lla.ma hosts.
//
// Writes ./.lla-ma/project.json so later commands (deploy, db, ...) know which
// api/apps/base hosts — and optionally which project — to act on.
//
//   lla-ma link                         link to the hosted defaults (api.lla.ma)
//   lla-ma link http://localhost:3000   link to a self-hosted box (all 3 hosts)
//   lla-ma link --apps https://deploy.lla.ma --project my-app
//
// A bare positional <url> is treated as the api host; apps/base are derived from
// it (sibling subdomains, or the same origin for self-host) unless overridden.

import type { Command } from "commander";
import {
  deriveHosts,
  writeLink,
  readCredentials,
  DEFAULT_API,
  type LinkConfig,
} from "../lib/config.js";
import { ok, info, line, json } from "../lib/output.js";

interface LinkOpts {
  api?: string;
  apps?: string;
  base?: string;
  project?: string;
}

export function registerLink(program: Command): void {
  program
    .command("link")
    .argument("[url]", "api host to link to (e.g. a self-hosted origin)")
    .description("link the current directory to a set of lla.ma hosts")
    .option("--api <url>", "override the api (identity/Platform) host")
    .option("--apps <url>", "override the apps (deploy) host")
    .option("--base <url>", "override the base (database) host")
    .option("--project <slug>", "bind this directory to a project")
    .action((url: string | undefined, opts: LinkOpts, command: Command) => {
      const { json: asJson } = command.optsWithGlobals();

      // Decide the api host: explicit --api, else the positional <url>, else the
      // host we're logged into, else the hosted default.
      const api = opts.api ?? url ?? readCredentials()?.api ?? DEFAULT_API;
      const derived = deriveHosts(api);

      const cfg: LinkConfig = {
        api,
        apps: opts.apps ?? derived.apps,
        base: opts.base ?? derived.base,
      };
      if (opts.project) cfg.project = opts.project;

      writeLink(cfg);

      if (asJson) {
        json({ linked: true, ...cfg });
        return;
      }
      ok("Linked this directory.");
      line(`  api   ${cfg.api}`);
      line(`  apps  ${cfg.apps}`);
      line(`  base  ${cfg.base}`);
      if (cfg.project) line(`  project ${cfg.project}`);
      info("Saved to ./.lla-ma/project.json");
    });
}
