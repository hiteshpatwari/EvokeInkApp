import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("production response headers", () => {
  it("applies browser security headers to every route", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    const rules = await nextConfig.headers!();
    const allRoutes = rules.find((rule) => rule.source === "/(.*)");
    const headers = new Map(
      allRoutes?.headers.map(({ key, value }) => [key, value]),
    );

    expect(headers.get("Content-Security-Policy")).toContain(
      "default-src 'self'",
    );
    expect(headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
  });

  it("prevents prompt API responses from being stored", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    const rules = await nextConfig.headers!();
    const promptApi = rules.find(
      (rule) => rule.source === "/api/prompts/:path*",
    );
    const headers = new Map(
      promptApi?.headers.map(({ key, value }) => [key, value]),
    );

    expect(headers.get("Cache-Control")).toBe("no-store");
  });
});
