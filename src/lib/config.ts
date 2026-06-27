// src/lib/config.ts — where the CLI keeps its state on disk.
//
// Two kinds of state:
//   • credentials (global, per-user): the logged-in session + which API host.
//     Lives in ~/.config/lla-ma/credentials.json, mode 0600 (owner-only).
//   • the linked project (per-directory): which hosts (api/apps/base) and which
//     project this folder acts on. Lives in <project>/.lla-ma/project.json and
//     is found by walking up from the current directory (like git).
//
// Nothing here touches the network — this module is pure read/write + path math.

import { homedir } from "node:os";
import { join, dirname, parse as parsePath } from "node:path";
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

/** The three cooperating hosts the CLI talks to. */
export interface Hosts {
  /** identity + Platform (auth, projects, models, workflows). */
  api: string;
  /** git deploy console (apps). */
  apps: string;
  /** database console (base). */
  base: string;
}

/** Per-directory link, written to .lla-ma/project.json. */
export interface LinkConfig {
  api?: string;
  apps?: string;
  base?: string;
  /** optional project slug/id this directory is bound to. */
  project?: string;
}

// ─── credentials (global) ───────────────────────────────────────────────────

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
  writeFileSync(credentialsPath(), JSON.stringify(creds, null, 2), { mode: 0o600 });
}

/** Remove stored credentials (used by `logout`). */
export function clearCredentials(): void {
  rmSync(credentialsPath(), { force: true });
}

// ─── link (per-directory) ────────────────────────────────────────────────────

const LINK_DIR = ".lla-ma";
const LINK_FILE = "project.json";

/** Walk up from `start` looking for a .lla-ma/project.json; return its path. */
function findLinkPath(start: string = process.cwd()): string | null {
  let dir = start;
  // Stop at the filesystem root (parse().root, e.g. "/" or "C:\").
  const root = parsePath(dir).root;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = join(dir, LINK_DIR, LINK_FILE);
    if (existsSync(candidate)) return candidate;
    if (dir === root) return null;
    dir = dirname(dir);
  }
}

/** Read the nearest link config (searching upward), or null. */
export function readLink(): LinkConfig | null {
  const path = findLinkPath();
  if (!path) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as LinkConfig;
  } catch {
    return null;
  }
}

/** Write a link into the CURRENT directory's .lla-ma/project.json. */
export function writeLink(cfg: LinkConfig): string {
  const dir = join(process.cwd(), LINK_DIR);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, LINK_FILE);
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n");
  return path;
}

/** Remove the nearest link (the .lla-ma directory it lives in). */
export function clearLink(): boolean {
  const path = findLinkPath();
  if (!path) return false;
  rmSync(dirname(path), { recursive: true, force: true });
  return true;
}

// ─── host resolution ─────────────────────────────────────────────────────────

/**
 * Derive the apps/base hosts from the api host.
 *   • api.lla.ma            → apps.lla.ma / base.lla.ma   (sibling subdomains)
 *   • localhost / IP / bare → all three collapse to the same origin (self-host)
 * These are sensible defaults; a link file can override any of them explicitly.
 */
export function deriveHosts(api: string): Hosts {
  try {
    const u = new URL(api);
    const host = u.hostname;
    const parts = host.split(".");
    const isSelfHost = host === "localhost" || /^\d+$/.test(parts[0]!) || parts.length < 3;
    if (!isSelfHost && parts[0] === "api") {
      const rootDomain = parts.slice(1).join(".");
      const port = u.port ? `:${u.port}` : "";
      const sub = (label: string) => `${u.protocol}//${label}.${rootDomain}${port}`;
      return { api, apps: sub("apps"), base: sub("base") };
    }
  } catch {
    /* fall through to single-origin */
  }
  return { api, apps: api, base: api };
}

/**
 * Resolve the host-set for a command. Precedence:
 *   --endpoint flag  >  link file  >  saved login host  >  hosted default
 * apps/base fall back to whatever we derive from the resolved api host.
 */
export function resolveHosts(opts: { endpoint?: string } = {}): Hosts {
  const link = readLink();
  const api = opts.endpoint ?? link?.api ?? readCredentials()?.api ?? DEFAULT_API;
  const derived = deriveHosts(api);
  return {
    api,
    apps: link?.apps ?? derived.apps,
    base: link?.base ?? derived.base,
  };
}

/** Convenience: just the api host (used by login/whoami/logout). */
export function resolveApi(endpointFlag?: string): string {
  return resolveHosts({ endpoint: endpointFlag }).api;
}
