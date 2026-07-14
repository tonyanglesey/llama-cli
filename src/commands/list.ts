// src/commands/list.ts — list deployments for the linked project.
//
// GET {apps}/api/projects/:project/deployments
//   lla-ma list
//   lla-ma ls --json
//
// NOTE: the apps-host deployment API this hits is assumed, not yet confirmed
// against a real backend — adjust the path/response shape once it ships.

import type { Command } from "commander";
import { requireContext } from "../lib/context.js";
import { apiGet } from "../lib/api.js";
import { line, info, fail, json } from "../lib/output.js";

interface Deployment {
  id: string;
  url?: string;
  state?: string;
  target?: string;
  createdAt?: string;
}

export function registerList(program: Command): void {
  program
    .command("list")
    .alias("ls")
    .description("list deployments for the linked project")
    .action(async (_opts, command: Command) => {
      const { json: asJson, endpoint } = command.optsWithGlobals();
      const ctx = requireContext({ endpoint, json: asJson });
      if (!ctx) return;

      const res = await apiGet(ctx.hosts.apps, `/api/projects/${ctx.project}/deployments`, ctx.session);
      if (!res.ok) {
        if (asJson) json({ error: res.data?.error ?? `HTTP ${res.status}` });
        else fail(res.data?.error ?? `Could not list deployments (HTTP ${res.status}).`);
        process.exitCode = 1;
        return;
      }

      const deployments: Deployment[] = res.data?.deployments ?? [];
      if (asJson) {
        json({ deployments });
        return;
      }
      if (deployments.length === 0) {
        info("No deployments yet. Run `lla-ma deploy`.");
        return;
      }
      for (const d of deployments) {
        line(`${d.id}  ${d.state ?? "?"}  ${d.target ?? ""}  ${d.url ?? ""}`.trimEnd());
      }
    });
}
