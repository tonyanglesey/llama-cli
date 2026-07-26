// src/commands/deploy.ts — trigger a git deploy of the linked apps project.
//
// The lla.ma analogue of `vercel deploy`: it only means something inside a
// directory linked to an lla.ma apps project (requireContext enforces that,
// like the other project-scoped commands). It's a *thin trigger* — the apps
// control plane does the real work (clone → nixpacks/Docker build → run →
// Caddy route); the CLI just POSTs and reports the deployment id it gets back.
//
//   lla-ma deploy                 deploy the linked project's default branch HEAD
//   lla-ma deploy --branch dev    deploy a specific branch instead
//
// Endpoint (CONFIRMED against llama-apps):
//   POST {apps}/api/projects/:project/deploy  { branch? }  → 202 { deployment }
//
// No --prod flag: the platform is container-first with no preview/prod split
// (deploying the default branch IS production), so --branch is the only knob
// the control plane's triggerDeploy actually accepts.

import type { Command } from "commander";
import { requireContext } from "../lib/context.js";
import { apiPost } from "../lib/api.js";
import { line, ok, fail, info, json } from "../lib/output.js";

interface DeployOpts {
  branch?: string;
}

export function registerDeploy(program: Command): void {
  program
    .command("deploy")
    .description("deploy the linked lla.ma app (git → build → run)")
    .option("--branch <name>", "deploy a branch other than the project's default")
    .action(async (opts: DeployOpts, command: Command) => {
      const { json: asJson, endpoint } = command.optsWithGlobals();
      const ctx = requireContext({ endpoint, json: asJson });
      if (!ctx) return;

      const body: { branch?: string } = {};
      if (opts.branch) body.branch = opts.branch;

      if (!asJson) {
        info(
          `Deploying ${ctx.project}${opts.branch ? ` (branch ${opts.branch})` : ""} → ${ctx.hosts.apps}`,
        );
      }

      const res = await apiPost(
        ctx.hosts.apps,
        `/api/projects/${ctx.project}/deploy`,
        body,
        ctx.session,
      );
      if (!res.ok) {
        if (asJson) json({ error: res.data?.error ?? `HTTP ${res.status}` });
        else if (res.status === 404) fail(`No such project: ${ctx.project}.`);
        else fail(res.data?.error ?? `Deploy failed (HTTP ${res.status}).`);
        process.exitCode = 1;
        return;
      }

      // The apps route returns 202 { deployment: "<id>" }.
      const deployment: string | undefined = res.data?.deployment;

      if (asJson) {
        json({ deploying: true, project: ctx.project, branch: opts.branch ?? null, deployment: deployment ?? null });
        return;
      }

      ok("Deploy queued.");
      if (deployment) {
        line(`  deployment  ${deployment}`);
        info(`Follow the build:  llma logs ${deployment} --watch`);
      }
    });
}
