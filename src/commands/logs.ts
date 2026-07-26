// src/commands/logs.ts — stream a deployment's build logs.
//
// Upgrades milestone 4's one-shot stub to real streaming. Reads the apps host's
// SSE endpoint, which replays the persisted build log in order then follows
// live until the deployment reaches a terminal state (running / failed /
// cancelled), ending with an `event: done` carrying the final status.
//
//   lla-ma logs <deployment>            print the logs so far, then exit
//   lla-ma logs <deployment> --watch    follow live until the deploy finishes
//   lla-ma logs <deployment> --json     collect all lines → one JSON object
//
// Pairs with deploy:  lla-ma deploy  →  copy the deployment id  →  lla-ma logs <id> -w
//
// Endpoint (CONFIRMED against llama-apps):  GET {apps}/api/logs/:id  (text/event-stream)
// Note: the shipped apps proxy keys logs by deployment id, not by project — so
// the URL doesn't use ctx.project. requireContext is still the right gate: it
// resolves the host + session the same way every other project command does.
//
// SSE wire format (from the control plane, proxied unchanged by apps):
//   id: <seq>\n data: {"seq","stream","line","ts"}\n\n     one log line
//   event: done\n data: {"status"}\n\n                     terminal state
//   : keep-alive\n\n                                       heartbeat (ignored)

import type { Command } from "commander";
import { requireContext } from "../lib/context.js";
import { apiStream } from "../lib/api.js";
import { line, ok, fail, info, json } from "../lib/output.js";

interface LogsOpts {
  watch?: boolean;
}

interface SseEvent {
  event: string;
  data: string;
}

interface LogLine {
  seq: number;
  stream: "stdout" | "stderr";
  line: string;
  ts?: string;
}

// Deployment states the server treats as terminal failures (mirrors the control plane).
const FAILED = new Set(["failed", "cancelled"]);

// Snapshot mode: if no new line arrives for this long and the deploy isn't
// finished, assume we've caught up to "now" and disconnect. Comfortably longer
// than the server's 600ms poll so a normal build cadence never trips it.
const IDLE_MS = 1200;

/** Parse a byte stream of SSE into discrete events (only those carrying data). */
async function* sseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let sep: number;
      // Events are separated by a blank line (\n\n).
      while ((sep = buf.indexOf("\n\n")) !== -1) {
        const raw = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        let event = "message";
        const dataLines: string[] = [];
        for (const l of raw.split("\n")) {
          if (l.startsWith(":")) continue; // comment / heartbeat
          if (l.startsWith("event:")) event = l.slice(6).trim();
          else if (l.startsWith("data:")) dataLines.push(l.slice(5).replace(/^ /, ""));
          // id:/retry: are irrelevant to us
        }
        if (dataLines.length) yield { event, data: dataLines.join("\n") };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function registerLogs(program: Command): void {
  program
    .command("logs")
    .argument("<deployment>", "deployment id (from `llma deploy`)")
    .description("stream a deployment's build logs")
    .option(
      "-w, --watch",
      "follow live until the deploy finishes (default: print current logs and exit)",
    )
    .action(async (deployment: string, opts: LogsOpts, command: Command) => {
      const { json: asJson, endpoint } = command.optsWithGlobals();
      const ctx = requireContext({ endpoint, json: asJson });
      if (!ctx) return;

      // --json needs the final status, so it always follows to completion.
      const follow = Boolean(opts.watch) || asJson;

      // One controller drives every early exit: idle cutoff (snapshot mode),
      // Ctrl-C, and normal completion all abort the underlying fetch.
      const controller = new AbortController();
      const res = await apiStream(
        ctx.hosts.apps,
        `/api/logs/${encodeURIComponent(deployment)}`,
        ctx.session,
        controller.signal,
      );
      if (!res.ok || !res.body) {
        if (asJson) json({ error: res.data?.error ?? `HTTP ${res.status}` });
        else if (res.status === 404) fail(`No such deployment: ${deployment}.`);
        else fail(res.data?.error ?? `Could not stream logs (HTTP ${res.status}).`);
        process.exitCode = 1;
        return;
      }

      const collected: LogLine[] = [];
      let finalStatus: string | undefined;

      // Snapshot mode disconnects once the backlog stops flowing.
      let idle: ReturnType<typeof setTimeout> | undefined;
      const armIdle = () => {
        if (follow) return;
        clearTimeout(idle);
        idle = setTimeout(() => controller.abort(), IDLE_MS);
      };

      // Ctrl-C detaches cleanly rather than dumping a stack trace.
      const onSigint = () => controller.abort();
      process.on("SIGINT", onSigint);

      armIdle();
      try {
        for await (const ev of sseEvents(res.body)) {
          if (ev.event === "done") {
            try {
              finalStatus = JSON.parse(ev.data)?.status;
            } catch {
              /* ignore a malformed terminal frame */
            }
            break;
          }
          // A normal log line.
          let parsed: LogLine | undefined;
          try {
            parsed = JSON.parse(ev.data) as LogLine;
          } catch {
            /* fall through: treat the raw data as the line */
          }
          const text = parsed?.line ?? ev.data;
          if (asJson) {
            collected.push(parsed ?? { seq: -1, stream: "stdout", line: text });
          } else {
            line(text);
          }
          armIdle();
        }
      } catch (err) {
        // AbortError is our own doing (idle cutoff or Ctrl-C) — not a failure.
        if ((err as Error).name !== "AbortError") {
          clearTimeout(idle);
          process.removeListener("SIGINT", onSigint);
          if (asJson) json({ error: (err as Error).message });
          else fail(`Log stream interrupted (${(err as Error).message}).`);
          process.exitCode = 1;
          return;
        }
      } finally {
        clearTimeout(idle);
        process.removeListener("SIGINT", onSigint);
      }

      if (asJson) {
        json({ deployment, status: finalStatus ?? null, lines: collected });
      } else if (finalStatus) {
        if (FAILED.has(finalStatus)) fail(`Deployment ${finalStatus}.`);
        else ok(`Deployment ${finalStatus}.`);
      } else if (!follow) {
        info("Caught up to current logs. Re-run with --watch to follow the build.");
      }

      if (finalStatus && FAILED.has(finalStatus)) process.exitCode = 1;
    });
}
