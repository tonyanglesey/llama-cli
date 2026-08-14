// src/lib/pow.ts — proof-of-work solver for the /otp/send anti-spam gate.
//
// When the API has PoW enabled it answers a bare send with 428
// { powChallenge, bits }; the client must find a nonce whose
// SHA-256(`${powChallenge}:${nonce}`) has >= `bits` leading zero bits and retry
// with { powChallenge, powNonce }. Node has a fast native SHA-256, so this is a
// simple synchronous loop — no hand-rolled hash like the browser client needs,
// and it produces digests identical to the server's crypto.createHash('sha256').

import { createHash } from "node:crypto";

// Leading zero bits of a hex digest. Mirrors the server's check exactly.
function leadingZeroBits(hexDigest: string): number {
  let bits = 0;
  for (const chr of hexDigest) {
    const nibble = Number.parseInt(chr, 16);
    if (Number.isNaN(nibble)) break;
    if (nibble === 0) {
      bits += 4;
      continue;
    }
    bits += Math.clz32(nibble) - 28;
    break;
  }
  return bits;
}

// Find a nonce solving `challenge` at `bits` difficulty. `maxIters` guards a
// misconfigured difficulty so the CLI can't spin forever.
export function solvePow(challenge: string, bits: number, maxIters = 1e8): string {
  for (let n = 0; n < maxIters; n++) {
    const nonce = String(n);
    const digest = createHash("sha256").update(`${challenge}:${nonce}`).digest("hex");
    if (leadingZeroBits(digest) >= bits) return nonce;
  }
  throw new Error(`pow: no solution found for ${bits} bits within ${maxIters} iterations`);
}
