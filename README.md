# @lla-ma/cli

The lla.ma command-line tool — deploy, logs, env, and db from the terminal.
The `vercel`/`supabase` of the lla.ma suite.

> Status: **early scaffold** (milestone 1). `whoami` and `logout` work locally;
> `login` and `link` are stubs. See `LLAMA_DOCS/LLAMA_CLI_SPEC.md` for the plan.

## Commands

```
lla-ma login        log in with an email one-time code   (stub)
lla-ma logout       log out and clear the stored session
lla-ma whoami       show the current account
lla-ma link [url]   link this directory to a project     (stub)
lla-ma --help       full command list
lla-ma --version    print version
```

`lla-ma` is the canonical command; `llma` is a shorter alias for the same tool.

## Develop

```bash
npm install
npm run dev -- whoami     # run from source (no build) via tsx
npm run build             # compile TypeScript to dist/
npm link                  # make `lla-ma` / `llma` available on your PATH
```
