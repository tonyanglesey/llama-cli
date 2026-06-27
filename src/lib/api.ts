// src/lib/api.ts — the one place the CLI talks to the network.
//
// A thin wrapper over the built-in `fetch` (Node 20 has it globally). It:
//   • joins the base URL + path
//   • sends/receives JSON
//   • attaches the session as a `Cookie: lla_session=<id>` header
//     (api.lla.ma's requireSession reads the cookie — there is no Bearer path
//      for management yet; see LLAMA_CLI_SPEC.md)
//   • pulls a newly-issued lla_session out of the response Set-Cookie
//   • never throws on a network error — it returns { ok:false, status:0 } so
//     callers handle everything with one shape.

const COOKIE_NAME = "lla_session";

export interface ApiResult {
  /** true when the HTTP status was 2xx. */
  ok: boolean;
  /** HTTP status, or 0 if the host was unreachable. */
  status: number;
  /** Parsed JSON body (or raw text, or null). */
  data: any;
  /** A fresh lla_session id if the response set one (login flow). */
  session?: string;
}

function joinUrl(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/+$/, "") + path;
}

/** Pull `lla_session=<id>` out of one or more Set-Cookie headers. */
function extractSession(headers: Headers): string | undefined {
  let cookies: string[] = [];
  // Node 20's fetch exposes getSetCookie() which correctly splits multiple
  // Set-Cookie headers; fall back to the single combined header otherwise.
  const anyHeaders = headers as unknown as { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    cookies = anyHeaders.getSetCookie();
  } else {
    const raw = headers.get("set-cookie");
    if (raw) cookies = [raw];
  }
  for (const c of cookies) {
    const m = c.match(/lla_session=([^;]+)/);
    if (m?.[1]) return m[1];
  }
  return undefined;
}

async function request(
  baseUrl: string,
  path: string,
  init: RequestInit,
  session?: string,
): Promise<ApiResult> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
  if (session) headers["cookie"] = `${COOKIE_NAME}=${session}`;

  let res: Response;
  try {
    res = await fetch(joinUrl(baseUrl, path), { ...init, headers });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: { error: `Could not reach ${baseUrl} (${(err as Error).message})` },
    };
  }

  // Read the body once as text, then try to parse it as JSON.
  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return { ok: res.ok, status: res.status, data, session: extractSession(res.headers) };
}

export function apiGet(baseUrl: string, path: string, session?: string): Promise<ApiResult> {
  return request(baseUrl, path, { method: "GET" }, session);
}

export function apiPost(
  baseUrl: string,
  path: string,
  body: unknown,
  session?: string,
): Promise<ApiResult> {
  return request(baseUrl, path, { method: "POST", body: JSON.stringify(body ?? {}) }, session);
}
