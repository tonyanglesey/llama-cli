#!/usr/bin/env node
//
// src/cli.ts — the entry point for the `lla-ma` (and `llma`) command.
//
// The shebang line above (#!/usr/bin/env node) tells the OS "run this file with
// Node." It MUST be the very first line of the file. TypeScript preserves it
// when it compiles to dist/cli.js, and `package.json`'s "bin" field points the
// `lla-ma` / `llma` commands at that compiled file.
//
// This file does only three things:
//   1. read the CLI's own version out of package.json
//   2. define the global program (name, description, version, shared flags)
//   3. register each subcommand (login, logout, whoami, link, ...)
// The actual work lives in src/commands/*.

import { createRequire } from "node:module";
import { Command } from "commander";

import { registerLogin } from "./commands/login.js";
import { registerLogout } from "./commands/logout.js";
import { registerWhoami } from "./commands/whoami.js";
import { registerLink } from "./commands/link.js";
import { registerUnlink } from "./commands/unlink.js";
import { registerList } from "./commands/list.js";
import { registerLogs } from "./commands/logs.js";
import { registerInspect } from "./commands/inspect.js";
import { registerRemove } from "./commands/remove.js";
import { registerEnv } from "./commands/env.js";
import { registerDeploy } from "./commands/deploy.js";
import { registerBranch } from "./commands/branch.js";

// We're an ES module, so there's no `require` by default. createRequire gives us
// one just so we can pull the version string out of our own package.json.
// (dist/cli.js sits one level below the package root, so ../package.json works.)
const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const program = new Command();

program
  .name("lla-ma")
  .description("The lla.ma command-line tool — deploy, logs, env, db, from the terminal.")
  .version(pkg.version, "-v, --version", "print the lla-ma version")
  // Global flags every subcommand can read via `command.optsWithGlobals()`.
  .option("--json", "output machine-readable JSON instead of human text")
  .option(
    "--endpoint <url>",
    "override the linked API endpoint for this one command",
  );

// Each register* function attaches one subcommand to the program. Keeping them
// in separate files means cli.ts stays a readable table of contents.
registerLogin(program);
registerLogout(program);
registerWhoami(program);
registerLink(program);
registerUnlink(program);
registerList(program);
registerLogs(program);
registerInspect(program);
registerRemove(program);
registerEnv(program);
registerDeploy(program);
registerBranch(program);

// parseAsync (not parse) because our command handlers do async work (network,
// reading files). It reads process.argv, matches a subcommand, and runs it.
program.parseAsync(process.argv);
