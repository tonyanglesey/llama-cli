// src/lib/output.ts — tiny console helpers.
//
// Convention for the whole CLI: human-friendly text by default, but if the user
// passed --json we print a single JSON object so scripts can parse our output.
// Status/among messages always go to stderr so they never pollute --json stdout.

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/** A normal line of output (stdout). */
export function line(msg = ""): void {
  process.stdout.write(msg + "\n");
}

/** Success note (stderr, green check). */
export function ok(msg: string): void {
  process.stderr.write(`${GREEN}✓${RESET} ${msg}\n`);
}

/** Informational/dim note (stderr). */
export function info(msg: string): void {
  process.stderr.write(`${DIM}${msg}${RESET}\n`);
}

/** Error note (stderr, red). Does NOT exit — caller decides. */
export function fail(msg: string): void {
  process.stderr.write(`${RED}✗${RESET} ${msg}\n`);
}

/** Print a value as pretty JSON (stdout). Use when --json is set. */
export function json(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}
