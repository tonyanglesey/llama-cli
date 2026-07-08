// src/commands/logs.ts — fetch logs for one deployment.
//
// GET {apps}/api/projects/:project/deployments/:id/logs
//   lla-ma logs <deployment>
//
// NOTE: assumed apps-host API (see list.ts). No --follow/streaming yet —
// this is a one-shot fetch of whatever the server has.

import type { Command } from "commander";
import { requireContext } from "../lib/context.js";
import { apiGet } from "../lib/api.js";
import { line, fail, json } from "../lib/output.js";

export function registerLogs(program: Command): void {
  program
    .command("logs")
    .argument("<deployment>", "deployment id or url")
    .description("show logs for a deployment")
    .action(async (deployment: string, _opts, command: Command) => {
      const { json: asJson, endpoint } = command.optsWithGlobals();
      const ctx = requireContext({ endpoint, json: asJson });
      if (!ctx) return;

      const res = await apiGet(
        ctx.hosts.apps,
        `/api/projects/${ctx.project}/deployments/${encodeURIComponent(deployment)}/logs`,
        ctx.session,
      );
      if (!res.ok) {
        if (asJson) json({ error: res.data?.error ?? `HTTP ${res.status}` });
        else fail(res.data?.error ?? `Could not fetch logs (HTTP ${res.status}).`);
        process.exitCode = 1;
        return;
      }

      const logLines: string[] = res.data?.logs ?? [];
      if (asJson) {
        json({ logs: logLines });
        return;
      }
      for (const l of logLines) line(l);
    });
}
