# @lla-ma/cli

The lla.ma command-line tool — deploy, logs, env, and db from the terminal.
The `vercel`/`supabase` of the lla.ma suite.

> Status: **early scaffold** (milestone 4 + deploy). Auth (`login`/`logout`/
> `whoami`) and directory linking (`link`/`unlink`) are live. `deploy` and
> `logs` target endpoints **confirmed** against `llama-apps`
> (`POST /api/projects/:id/deploy`, `GET /api/logs/:id` SSE): `deploy` is the
> git-connected model — the CLI triggers, the apps control plane clones/builds/
> runs — and `logs` streams the build over SSE (`--watch` to follow live).
> `list`, `inspect`, `remove`, and `env` are wired up but call an assumed
> project API shape not yet confirmed against a real backend, so expect to
> adjust those `src/lib/context.ts` callers once it ships.

## Commands

```
lla-ma login                      log in with an email one-time code
lla-ma logout                     log out and clear the stored session
lla-ma whoami                     show the current account
lla-ma link [url]                 link this directory to a project
lla-ma unlink                     remove the link from this directory
lla-ma deploy [--branch <name>]   deploy the linked project (git → build → run)
lla-ma list (ls)                  list deployments for the linked project
lla-ma logs <deployment> [-w]     stream a deployment's build logs (--watch to follow)
lla-ma inspect <deployment>       show details for a deployment
lla-ma remove (rm) <deployment>   remove a deployment
lla-ma env ls                     list environment variables
lla-ma env add <key> [value]      add or update an environment variable
lla-ma env rm <key>               remove an environment variable
lla-ma env pull [file]            write env vars to a local file (default .env.local)
lla-ma --help                     full command list
lla-ma --version                  print version
```

`lla-ma` is the canonical command; `llma` is a shorter alias for the same tool.

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
