// src/commands/branch.ts — start work on a board ticket: cut/adopt its branch.
//
// The local companion to the kanban board's "Create branch" button. Given a
// ticket key, it finds the ticket on the board, makes sure its branch exists
// (adopting the one the board already cut, or asking the board to cut it), then
// fetches and switches you onto it — in one command.
//
//   lla-ma branch CLI-5        →  on feat/CLI-5-cli-m3-logs-env-deploy
//
// Auth: the board lives on admin.lla.ma and validates the SAME lla_session the
// CLI stores (it forwards to api.lla.ma/api/auth/me). No GitHub token needed —
// branch creation goes through the board's own route; the local half is plain
// git (fetch + switch) using whatever credentials you already push with.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Command } from "commander";

import { resolveHosts, readCredentials } from "../lib/config.js";
import { apiGet, apiPost } from "../lib/api.js";
import { ok, fail, info, json } from "../lib/output.js";

const execFileP = promisify(execFile);

/** Minimal shape of a board task (see llama-admin lib/llama-base/board.ts). */
interface BoardTaskLite {
  id: string;
  key: string | null;
  title: string;
  product: string;
  repo: string | null;
  branch: string | null;
  status: string;
}

/** Run git; never throws — returns { ok, stdout, stderr } like the api helpers. */
async function git(
  args: string[],
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileP("git", args);
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, stdout: (e.stdout ?? "").trim(), stderr: (e.stderr ?? e.message ?? "").trim() };
  }
}

/** Pull `owner/repo` out of a github remote URL (ssh or https). */
function repoSlugFromRemote(url: string): string | null {
  const m = url.match(/github\.com[:/](.+?)(?:\.git)?$/i);
  return m?.[1] ?? null;
}

export function registerBranch(program: Command): void {
  program
    .command("branch")
    .argument("<key>", "board ticket key, e.g. CLI-5")
    .description("cut/adopt a board ticket's branch and switch to it")
    .action(async (keyArg: string, _opts: unknown, command: Command) => {
      const { endpoint, json: asJson } = command.optsWithGlobals();

      const session = readCredentials()?.session;
      if (!session) {
        fail("Not logged in. Run `llma login` first.");
        process.exitCode = 1;
        return;
      }

      const hosts = resolveHosts({ endpoint });
      const key = keyArg.trim().toUpperCase();

      // 1. Read the board and find the ticket.
      const boardRes = await apiGet(hosts.admin, "/api/board", session);
      if (!boardRes.ok) {
        if (boardRes.status === 401) fail("Not authorized — run `llma login`.");
        else if (boardRes.status === 403) fail("This account isn't an admin on the board.");
        else fail(boardRes.data?.error ?? `Could not read the board (HTTP ${boardRes.status}).`);
        process.exitCode = 1;
        return;
      }
      const tasks: BoardTaskLite[] = boardRes.data?.tasks ?? [];
      const task = tasks.find((t) => (t.key ?? "").toUpperCase() === key);
      if (!task) {
        fail(`No ticket ${key} on the active board.`);
        info("It may be archived or on another sprint.");
        process.exitCode = 1;
        return;
      }
      if (!task.repo) {
        fail(`${task.key} (${task.product}) has no linked repo — can't branch.`);
        process.exitCode = 1;
        return;
      }

      // 2. Guard: make sure we're standing in the ticket's repo.
      const remote = await git(["remote", "get-url", "origin"]);
      if (!remote.ok) {
        fail("Not inside a git repo with an `origin` remote.");
        process.exitCode = 1;
        return;
      }
      const localSlug = repoSlugFromRemote(remote.stdout);
      if (localSlug && localSlug.toLowerCase() !== task.repo.toLowerCase()) {
        fail(`This checkout is ${localSlug}, but ${task.key} belongs to ${task.repo}.`);
        info(`cd into your ${task.repo} checkout and re-run.`);
        process.exitCode = 1;
        return;
      }

      // 3. Ensure the branch exists: adopt the board's, or ask it to cut one.
      let branch = task.branch;
      let created = false;
      if (!branch) {
        if (!asJson) info(`No branch yet for ${task.key} — asking the board to cut one…`);
        const createRes = await apiPost(
          hosts.admin,
          `/api/board/tasks/${task.id}/branch`,
          {},
          session,
        );
        if (!createRes.ok) {
          fail(createRes.data?.error ?? `Could not create the branch (HTTP ${createRes.status}).`);
          process.exitCode = 1;
          return;
        }
        branch = createRes.data?.branch;
        created = true;
      }
      if (!branch) {
        fail("The board did not return a branch name.");
        process.exitCode = 1;
        return;
      }

      // 4. Fetch it and switch onto it (git DWIMs a local tracking branch).
      const fetched = await git(["fetch", "origin", branch]);
      if (!fetched.ok) {
        fail(`git fetch failed: ${fetched.stderr}`);
        process.exitCode = 1;
        return;
      }
      const switched = await git(["switch", branch]);
      if (!switched.ok) {
        fail(`git switch failed: ${switched.stderr}`);
        process.exitCode = 1;
        return;
      }

      if (asJson) {
        json({ key: task.key, branch, repo: task.repo, created, switched: true });
        return;
      }
      ok(`On ${branch}`);
      info(
        `${task.key} · ${task.title}${created ? " · branch cut + card moved to in_progress" : ""}`,
      );
    });
}
