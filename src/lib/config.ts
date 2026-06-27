// src/lib/config.ts — where the CLI keeps its state on disk.
//
// Two kinds of state:
//   • credentials (global, per-user): the logged-in session + which API host.
//     Lives in ~/.config/lla-ma/credentials.json, mode 0600 (owner-only) so
//     other users on the machine can't read the session id.
//   • the linked project (per-directory): added in a later milestone.
//
// Nothing here touches the network — this module is pure read/write + path math.

import { homedir } from "node:os";
import { join } from "node:path";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";

/** Default identity/Platform API host when nothing else is configured. */
export const DEFAULT_API = "https://api.lla.ma";

/** Shape of what we persist after a successful login. */
export interface Credentials {
  /** The opaque `lla_session` id returned by api.lla.ma. */
  session: string;
  /** The signed-in email, shown by `whoami` without a network call. */
  email: string;
  /** The API host this session belongs to. */
  api: string;
}

/** ~/.config/lla-ma (honors XDG_CONFIG_HOME if set). */
export function configDir(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "lla-ma");
}

function credentialsPath(): string {
  return join(configDir(), "credentials.json");
}

/** Read stored credentials, or null if not logged in / unreadable. */
export function readCredentials(): Credentials | null {
  const path = credentialsPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Credentials;
  } catch {
    return null;
  }
}

/** Persist credentials with owner-only (0600) permissions. */
export function writeCredentials(creds: Credentials): void {
  mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  writeFileSync(credentialsPath(), JSON.stringify(creds, null, 2), {
    mode: 0o600,
  });
}

/** Remove stored credentials (used by `logout`). */
export function clearCredentials(): void {
  rmSync(credentialsPath(), { force: true });
}

/**
 * Decide which API host a command should talk to. Precedence:
 *   1. an explicit --endpoint flag (one-off override)
 *   2. the host saved with the current login
 *   3. the hosted default (api.lla.ma)
 */
export function resolveApi(endpointFlag?: string): string {
  if (endpointFlag) return endpointFlag;
  return readCredentials()?.api ?? DEFAULT_API;
}
