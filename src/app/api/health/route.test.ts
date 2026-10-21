import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("health route", () => {
  it("reports availability without exposing configuration", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
