import { describe, expect, it } from "vitest";
import { PromptControlDurableObjectCore } from "./promptControlDurableObject";

type StoredValue = { count: number; startedAt: number };

class TransactionalMemoryStorage {
  private readonly values = new Map<string, StoredValue>();
  private tail = Promise.resolve();

  transaction<T>(
    operation: (transaction: {
      get(keys: string[]): Promise<Map<string, StoredValue>>;
      put(entries: Record<string, StoredValue>): Promise<void>;
    }) => Promise<T>,
  ): Promise<T> {
    const result = this.tail.then(() =>
      operation({
        get: async (keys) =>
          new Map(
            keys.flatMap((key) => {
              const value = this.values.get(key);
              return value ? [[key, { ...value }] as const] : [];
            }),
          ),
        put: async (entries) => {
          for (const [key, value] of Object.entries(entries)) {
            this.values.set(key, { ...value });
          }
        },
      }),
    );
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

const installationKey = "a".repeat(64);
const ipKey = "b".repeat(64);

function reservation(overrides: Record<string, unknown> = {}) {
  return {
    installationKey,
    ipKey,
    nowMs: Date.parse("2026-10-20T12:00:00.000Z"),
    installationLimit: 20,
    ipLimit: 200,
    ipHourlyLimit: 200,
    budgetMicros: 250_000_000,
    estimatedCostMicros: 10_000,
    useProviderBudget: true,
    ...overrides,
  };
}

describe("PromptControlDurableObject", () => {
  it("atomically enforces installation quota under concurrent reservations", async () => {
    const durableObject = new PromptControlDurableObjectCore({
      storage: new TransactionalMemoryStorage(),
    });

    const results = await Promise.all(
      Array.from({ length: 100 }, () => durableObject.reserve(reservation())),
    );

    expect(results.filter((result) => result === "allowed")).toHaveLength(20);
    expect(
      results.filter((result) => result === "installation_quota"),
    ).toHaveLength(80);
  });

  it("atomically opens the shared budget after the configured reservations", async () => {
    const durableObject = new PromptControlDurableObjectCore({
      storage: new TransactionalMemoryStorage(),
    });

    const results = await Promise.all(
      Array.from({ length: 40 }, () =>
        durableObject.reserve(
          reservation({
            installationLimit: 100,
            ipLimit: 100,
            ipHourlyLimit: 100,
            budgetMicros: 50_000,
          }),
        ),
      ),
    );

    expect(results.filter((result) => result === "allowed")).toHaveLength(5);
    expect(results.filter((result) => result === "budget_open")).toHaveLength(
      35,
    );
  });

  it("stops a burst from one IP before it can consume the shared budget", async () => {
    const durableObject = new PromptControlDurableObjectCore({
      storage: new TransactionalMemoryStorage(),
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        durableObject.reserve(
          reservation({
            installationLimit: 100,
            ipLimit: 100,
            ipHourlyLimit: 5,
          }),
        ),
      ),
    );

    expect(results.filter((result) => result === "allowed")).toHaveLength(5);
    expect(results.filter((result) => result === "ip_quota")).toHaveLength(5);
  });

  it("resets quota and budget windows after thirty days", async () => {
    const durableObject = new PromptControlDurableObjectCore({
      storage: new TransactionalMemoryStorage(),
    });
    const first = reservation({
      installationLimit: 1,
      ipLimit: 1,
      budgetMicros: 10_000,
    });

    await expect(durableObject.reserve(first)).resolves.toBe("allowed");
    await expect(durableObject.reserve(first)).resolves.toBe(
      "installation_quota",
    );
    await expect(
      durableObject.reserve({
        ...first,
        nowMs: first.nowMs + 30 * 24 * 60 * 60 * 1000,
      }),
    ).resolves.toBe("allowed");
  });

  it("rejects malformed RPC input without changing stored counters", async () => {
    const durableObject = new PromptControlDurableObjectCore({
      storage: new TransactionalMemoryStorage(),
    });

    await expect(
      durableObject.reserve(reservation({ installationKey: "raw-token" })),
    ).rejects.toThrow("Invalid prompt-control reservation");
    await expect(
      durableObject.reserve(reservation({ installationLimit: 1 })),
    ).resolves.toBe("allowed");
  });
});
