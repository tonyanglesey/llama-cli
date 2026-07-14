// src/commands/env.ts — manage environment variables for the linked project.
//
//   lla-ma env ls
//   lla-ma env add <key> [value]     (prompts for the value if omitted)
//   lla-ma env rm <key>
//   lla-ma env pull [file]           (writes KEY="VALUE" lines, default .env.local)
//
// GET/POST/DELETE {apps}/api/projects/:project/env
//
// NOTE: assumed apps-host API (see list.ts).

import type { Command } from "commander";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { writeFileSync } from "node:fs";
import { requireContext } from "../lib/context.js";
import { apiGet, apiPost, apiDelete } from "../lib/api.js";
import { line, ok, info, fail, json } from "../lib/output.js";

interface EnvVar {
  key: string;
  value: string;
}

/** Quote a value for a .env file so embedded quotes/backslashes stay literal. */
function quoteEnvValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function registerEnv(program: Command): void {
  const env = program.command("env").description("manage environment variables for the linked project");

  env
    .command("ls")
    .description("list environment variables")
    .action(async (_opts, command: Command) => {
      const { json: asJson, endpoint } = command.optsWithGlobals();
      const ctx = requireContext({ endpoint, json: asJson });
      if (!ctx) return;

      const res = await apiGet(ctx.hosts.apps, `/api/projects/${ctx.project}/env`, ctx.session);
      if (!res.ok) {
        if (asJson) json({ error: res.data?.error ?? `HTTP ${res.status}` });
        else fail(res.data?.error ?? `Could not list env vars (HTTP ${res.status}).`);
        process.exitCode = 1;
        return;
      }

      const vars: EnvVar[] = res.data?.env ?? [];
      if (asJson) {
        json({ env: vars });
        return;
      }
      if (vars.length === 0) {
        info("No environment variables set.");
        return;
      }
      for (const v of vars) line(v.key);
    });

  env
    .command("add")
    .argument("<key>", "variable name")
    .argument("[value]", "variable value (prompted for if omitted)")
    .description("add or update an environment variable")
    .action(async (key: string, value: string | undefined, _opts, command: Command) => {
      const { json: asJson, endpoint } = command.optsWithGlobals();
      const ctx = requireContext({ endpoint, json: asJson });
      if (!ctx) return;

      let resolvedValue = value;
      if (resolvedValue === undefined) {
        const rl = readline.createInterface({ input: stdin, output: stdout });
        resolvedValue = (await rl.question(`value for ${key}: `)).trim();
        rl.close();
      }

      const res = await apiPost(
        ctx.hosts.apps,
        `/api/projects/${ctx.project}/env`,
        { key, value: resolvedValue },
        ctx.session,
      );
      if (!res.ok) {
        if (asJson) json({ error: res.data?.error ?? `HTTP ${res.status}` });
        else fail(res.data?.error ?? `Could not set ${key} (HTTP ${res.status}).`);
        process.exitCode = 1;
        return;
      }

      if (asJson) json({ set: key });
      else ok(`Set ${key}.`);
    });

  env
    .command("rm")
    .alias("remove")
    .argument("<key>", "variable name")
    .description("remove an environment variable")
    .action(async (key: string, _opts, command: Command) => {
      const { json: asJson, endpoint } = command.optsWithGlobals();
      const ctx = requireContext({ endpoint, json: asJson });
      if (!ctx) return;

      const res = await apiDelete(
        ctx.hosts.apps,
        `/api/projects/${ctx.project}/env/${encodeURIComponent(key)}`,
        ctx.session,
      );
      if (!res.ok) {
        if (asJson) json({ error: res.data?.error ?? `HTTP ${res.status}` });
        else fail(res.data?.error ?? `Could not remove ${key} (HTTP ${res.status}).`);
        process.exitCode = 1;
        return;
      }

      if (asJson) json({ removed: key });
      else ok(`Removed ${key}.`);
    });

  env
    .command("pull")
    .argument("[file]", "file to write", ".env.local")
    .description("write the project's environment variables to a local file")
    .action(async (file: string, _opts, command: Command) => {
      const { json: asJson, endpoint } = command.optsWithGlobals();
      const ctx = requireContext({ endpoint, json: asJson });
      if (!ctx) return;

      const res = await apiGet(ctx.hosts.apps, `/api/projects/${ctx.project}/env`, ctx.session);
      if (!res.ok) {
        if (asJson) json({ error: res.data?.error ?? `HTTP ${res.status}` });
        else fail(res.data?.error ?? `Could not fetch env vars (HTTP ${res.status}).`);
        process.exitCode = 1;
        return;
      }

      const vars: EnvVar[] = res.data?.env ?? [];
      const contents = vars.map((v) => `${v.key}=${quoteEnvValue(v.value)}`).join("\n") + (vars.length ? "\n" : "");
      writeFileSync(file, contents);

      if (asJson) json({ pulled: vars.length, file });
      else ok(`Wrote ${vars.length} variable(s) to ${file}.`);
    });
}
