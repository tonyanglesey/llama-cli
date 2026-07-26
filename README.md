# @lla-ma/cli

The lla.ma command-line tool — deploy, logs, env, and db from the terminal.
The `vercel`/`supabase` of the lla.ma suite.

> **Status (milestone 4 + deploy).** Auth (`login`/`logout`/`whoami`) and
> directory linking (`link`/`unlink`) are live. `deploy` and `logs` are live and
> hit endpoints **confirmed** against `llama-apps` — `deploy` is git-connected
> (the CLI triggers; the apps control plane clones → builds → runs), and `logs`
> streams the build over SSE (`--watch` to follow live). `list`, `inspect`,
> `remove`, and `env` are wired up but call a project API shape **not yet
> confirmed** against the deployed backend (see the note under Commands). `db`
> and `rollback` are planned — see [Roadmap](#roadmap).

`lla-ma` is the canonical command; `llma` is a shorter alias for the same tool.

## Commands

### Identity & linking

```
lla-ma login                      log in with an email one-time code
lla-ma logout                     log out and clear the stored session
lla-ma whoami                     show the current account
lla-ma link [url]                 link this directory to a project / host-set
lla-ma unlink                     remove the link from this directory
```

### Apps — deploy & inspect

```
lla-ma deploy [--branch <name>]   deploy the linked project (git → build → run)
lla-ma logs <deployment> [-w]     stream a deployment's build logs (--watch to follow)
lla-ma list (ls)                  list deployments for the linked project
lla-ma inspect <deployment>       show details for a deployment
lla-ma remove (rm) <deployment>   remove a deployment
lla-ma env ls                     list environment variables
lla-ma env add <key> [value]      add or update an environment variable
lla-ma env rm <key>               remove an environment variable
lla-ma env pull [file]            write env vars to a local file (default .env.local)
```

### Board (kanban → git)

```
lla-ma branch <key>               cut/adopt a ticket's branch and switch to it (e.g. CLI-5)
```

Reads the kanban board on `admin.lla.ma` using your `lla-ma login` session and
runs local git — no GitHub token in the CLI. If the ticket already has a branch
(cut from the board's button) it adopts it; otherwise it asks the board to cut
one, then `git fetch` + `git switch` onto it. Run it inside the ticket's repo.

### Global

```
--json                            machine-readable JSON instead of human text
--endpoint <url>                  override the linked API endpoint for one command
-h, --help                        full command list
-v, --version                     print version
```

> **Backend confirmation.** `deploy` (`POST /api/projects/:id/deploy`) and `logs`
> (`GET /api/logs/:id`, SSE) target routes confirmed in `llama-apps`. `list`,
> `inspect`, `remove`, and `env` currently assume an apps project API
> (`/api/projects/:project/deployments/…`) that isn't confirmed against the
> deployed backend yet — they may 404 until the CLI paths or the apps routes are
> reconciled.

## Roadmap

Planned, not yet built:

- **`rollback <deployment>`** — re-point production to a previous deployment (apps).
- **`db` group** — `db ls`, `db query "<sql>"`, `db tables` against the base
  (database) host through the gateway.
- **`db push`** — apply local migrations (backlog).
- **Non-interactive / CI auth** — account-scoped, revocable CLI tokens (today's
  management auth is the interactive OTP session cookie only).

## Develop

```bash
npm install
npm run dev -- whoami     # run from source (no build) via tsx
npm run build             # compile TypeScript to dist/
npm link                  # dev: symlink `lla-ma` / `llma` onto your PATH (tracks the working tree)
npm run release           # install a self-contained global copy (build → pack → install -g)
```

Use `npm link` while iterating (it points at this checkout, so it breaks if
`node_modules`/`dist` get wiped); use `npm run release` to install a standalone
global build that survives independent of the working tree.
