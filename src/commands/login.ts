// src/commands/login.ts — email-OTP login against api.lla.ma.
//
// Flow (mirrors api/routes/auth.js):
//   1. prompt for email   → POST {api}/api/auth/otp/send  { email }
//   2. prompt for code    → POST {api}/api/auth/otp/verify { email, code }
//   3. read lla_session from the verify response's Set-Cookie
//   4. writeCredentials({ session, email, api })
//
// OTP works directly in a terminal, so there's no browser/device-flow dance.

import type { Command } from "commander";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { resolveApi, writeCredentials } from "../lib/config.js";
import { apiPost } from "../lib/api.js";
import { solvePow } from "../lib/pow.js";
import { ok, fail, info } from "../lib/output.js";

export function registerLogin(program: Command): void {
  program
    .command("login")
    .description("log in to lla.ma with an email one-time code")
    .option("-e, --email <email>", "skip the email prompt")
    .action(async (opts: { email?: string }, command: Command) => {
      const { endpoint } = command.optsWithGlobals();
      const api = resolveApi(endpoint);

      const rl = readline.createInterface({ input: stdin, output: stdout });
      try {
        const email = (opts.email ?? (await rl.question("email: "))).trim();
        if (!email) {
          fail("No email given.");
          process.exitCode = 1;
          return;
        }

        // Step 1 — ask the server to email a 6-digit code.
        let send = await apiPost(api, "/api/auth/otp/send", { email });
        // Proof-of-work gate: when the server's anti-spam PoW is enabled it
        // answers a bare send with 428 { powChallenge, bits }. Solve it
        // (~sub-second) and retry once. Harmless when PoW is off — never 428s.
        if (
          send.status === 428 &&
          typeof send.data?.powChallenge === "string" &&
          typeof send.data?.bits === "number"
        ) {
          const powNonce = solvePow(send.data.powChallenge, send.data.bits);
          send = await apiPost(api, "/api/auth/otp/send", {
            email,
            powChallenge: send.data.powChallenge,
            powNonce,
          });
        }
        if (!send.ok) {
          fail(send.data?.error ?? `Could not send a code (HTTP ${send.status}).`);
          process.exitCode = 1;
          return;
        }
        info(`Code sent to ${email}.`);

        // Step 2 — exchange the code for a session.
        const code = (await rl.question("code: ")).trim();
        const verify = await apiPost(api, "/api/auth/otp/verify", { email, code });
        if (!verify.ok || !verify.session) {
          fail(verify.data?.error ?? `Login failed (HTTP ${verify.status}).`);
          process.exitCode = 1;
          return;
        }

        // Step 3/4 — persist the session for every later command.
        const user = verify.data?.user;
        const signedInEmail = user?.email ?? email;
        writeCredentials({ session: verify.session, email: signedInEmail, api });
        ok(`Logged in as ${signedInEmail}.`);
      } finally {
        rl.close();
      }
    });
}
