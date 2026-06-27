// src/commands/link.ts — point the current directory at a project / endpoint.
//
// STUB (milestone 1). A later milestone writes a per-directory .lla-ma/project.json
// recording the linked project and the api/apps/base hosts to talk to.

import type { Command } from "commander";
import { info } from "../lib/output.js";

export function registerLink(program: Command): void {
  program
    .command("link")
    .argument("[url]", "API endpoint to link this directory to")
    .description("link the current directory to an lla.ma project/endpoint")
    .action((url?: string) => {
      info(
        url
          ? `link is not implemented yet — would link this dir to ${url}`
          : "link is not implemented yet",
      );
      process.exitCode = 1;
    });
}
