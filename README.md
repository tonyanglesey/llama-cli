# @lla-ma/cli

The lla.ma command-line tool — deploy, logs, env, and db from the terminal.
The `vercel`/`supabase` of the lla.ma suite.

> Status: **early scaffold** (milestone 4). Auth (`login`/`logout`/`whoami`) and
> directory linking (`link`/`unlink`) are live. `list`, `logs`, `inspect`,
> `remove`, and `env` are wired up and call the `apps` host's project API —
> that API's exact shape isn't confirmed against a real backend yet, so
> expect to adjust `src/lib/context.ts` callers once it ships. `deploy` isn't
> implemented yet, pending a decision on the deploy model (git-connected vs.
> local upload).

## Commands

```
lla-ma login                      log in with an email one-time code
lla-ma logout                     log out and clear the stored session
lla-ma whoami                     show the current account
lla-ma link [url]                 link this directory to a project
lla-ma unlink                     remove the link from this directory
lla-ma list (ls)                  list deployments for the linked project
lla-ma logs <deployment>          show logs for a deployment
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
npm link                  # make `lla-ma` / `llma` available on your PATH
```
