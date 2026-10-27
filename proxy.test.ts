import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./src/proxy";

describe("per-request content security policy", () => {
  it("uses a fresh nonce instead of allowing arbitrary inline scripts", () => {
    const first = proxy(new NextRequest("https://evokeink.example/"));
    const second = proxy(new NextRequest("https://evokeink.example/"));
    const firstPolicy = first.headers.get("content-security-policy");
    const secondPolicy = second.headers.get("content-security-policy");

    expect(firstPolicy).toMatch(
      /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
    );
    expect(firstPolicy).not.toContain("'unsafe-inline'");
    expect(secondPolicy).not.toBe(firstPolicy);
  });
});
