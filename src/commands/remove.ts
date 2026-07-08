// src/commands/remove.ts — delete a deployment.
//
// DELETE {apps}/api/projects/:project/deployments/:id
//   lla-ma remove <deployment>
//   lla-ma rm <deployment> --yes
//
// NOTE: assumed apps-host API (see list.ts).

import type { Command } from "commander";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { requireContext } from "../lib/context.js";
import { apiDelete } from "../lib/api.js";
import { ok, fail, json } from "../lib/output.js";

interface RemoveOpts {
  yes?: boolean;
}

export function registerRemove(program: Command): void {
  program
    .command("remove")
    .alias("rm")
    .argument("<deployment>", "deployment id or url")
    .description("remove a deployment")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(async (deployment: string, opts: RemoveOpts, command: Command) => {
      const { json: asJson, endpoint } = command.optsWithGlobals();
      const ctx = requireContext({ endpoint, json: asJson });
      if (!ctx) return;

      if (!opts.yes) {
        const rl = readline.createInterface({ input: stdin, output: stdout });
        const answer = (await rl.question(`Remove deployment ${deployment}? (y/N) `)).trim().toLowerCase();
        rl.close();
        if (answer !== "y" && answer !== "yes") {
          fail("Cancelled.");
          return;
        }
      }

      const res = await apiDelete(
        ctx.hosts.apps,
        `/api/projects/${ctx.project}/deployments/${encodeURIComponent(deployment)}`,
        ctx.session,
      );
      if (!res.ok) {
        if (asJson) json({ error: res.data?.error ?? `HTTP ${res.status}` });
        else fail(res.data?.error ?? `Could not remove deployment (HTTP ${res.status}).`);
        process.exitCode = 1;
        return;
      }

      if (asJson) json({ removed: deployment });
      else ok(`Removed ${deployment}.`);
    });
}
