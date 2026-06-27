// src/commands/unlink.ts — remove the current directory's link.

import type { Command } from "commander";
import { clearLink } from "../lib/config.js";
import { ok, info } from "../lib/output.js";

export function registerUnlink(program: Command): void {
  program
    .command("unlink")
    .description("remove the link from the current directory")
    .action(() => {
      if (clearLink()) ok("Unlinked.");
      else info("Nothing to unlink.");
    });
}
