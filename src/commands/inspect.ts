// src/commands/inspect.ts — detail view of one deployment.
//
// GET {apps}/api/projects/:project/deployments/:id
//   lla-ma inspect <deployment>
//
// NOTE: assumed apps-host API (see list.ts).

import type { Command } from "commander";
import { requireContext } from "../lib/context.js";
import { apiGet } from "../lib/api.js";
import { line, fail, json } from "../lib/output.js";

export function registerInspect(program: Command): void {
  program
    .command("inspect")
    .argument("<deployment>", "deployment id or url")
    .description("show details for a deployment")
    .action(async (deployment: string, _opts, command: Command) => {
      const { json: asJson, endpoint } = command.optsWithGlobals();
      const ctx = requireContext({ endpoint, json: asJson });
      if (!ctx) return;

      const res = await apiGet(
        ctx.hosts.apps,
        `/api/projects/${ctx.project}/deployments/${encodeURIComponent(deployment)}`,
        ctx.session,
      );
      if (!res.ok) {
        if (asJson) json({ error: res.data?.error ?? `HTTP ${res.status}` });
        else fail(res.data?.error ?? `Could not inspect deployment (HTTP ${res.status}).`);
        process.exitCode = 1;
        return;
      }

      if (asJson) {
        json(res.data);
        return;
      }
      const d = res.data ?? {};
      line(`id       ${d.id ?? deployment}`);
      line(`state    ${d.state ?? "?"}`);
      line(`target   ${d.target ?? ""}`);
      line(`url      ${d.url ?? ""}`);
      line(`created  ${d.createdAt ?? ""}`);
    });
}
