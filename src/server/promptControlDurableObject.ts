const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const HASH_KEY_PATTERN = /^[a-f0-9]{64}$/;

export type PromptControlReservation =
  | "allowed"
  | "installation_quota"
  | "ip_quota"
  | "budget_open";

export interface DurablePromptControlRequest {
  installationKey: string;
  ipKey: string;
  nowMs: number;
  installationLimit: number;
  ipLimit: number;
  budgetMicros: number;
  estimatedCostMicros: number;
  useProviderBudget: boolean;
}

interface StoredCounter {
  count: number;
  startedAt: number;
}

interface PromptControlTransaction {
  get(keys: string[]): Promise<Map<string, StoredCounter>>;
  put(entries: Record<string, StoredCounter>): Promise<void>;
}

interface PromptControlStorage {
  transaction<T>(
    operation: (transaction: PromptControlTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface PromptControlDurableObjectState {
  storage: PromptControlStorage;
}

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function validateReservation(input: DurablePromptControlRequest): void {
  if (
    !HASH_KEY_PATTERN.test(input.installationKey) ||
    !HASH_KEY_PATTERN.test(input.ipKey) ||
    !Number.isSafeInteger(input.nowMs) ||
    input.nowMs < 0 ||
    !isPositiveInteger(input.installationLimit) ||
    !isPositiveInteger(input.ipLimit) ||
    !isPositiveInteger(input.budgetMicros) ||
    !isPositiveInteger(input.estimatedCostMicros) ||
    typeof input.useProviderBudget !== "boolean"
  ) {
    throw new TypeError("Invalid prompt-control reservation.");
  }
}

function currentCounter(
  value: StoredCounter | undefined,
  nowMs: number,
): StoredCounter {
  if (value && nowMs - value.startedAt < MONTH_MS) return value;
  return { count: 0, startedAt: nowMs };
}

/**
 * One named instance owns all prompt reservations. Its storage transaction is
 * the authoritative atomic boundary for installation, IP, and budget checks.
 */
export class PromptControlDurableObjectCore {
  constructor(private readonly ctx: PromptControlDurableObjectState) {}

  async reserve(
    input: DurablePromptControlRequest,
  ): Promise<PromptControlReservation> {
    validateReservation(input);
    const installationStorageKey = `installation:${input.installationKey}`;
    const ipStorageKey = `ip:${input.ipKey}`;
    const budgetStorageKey = "budget:global";

    return this.ctx.storage.transaction(async (transaction) => {
      const stored = await transaction.get([
        installationStorageKey,
        ipStorageKey,
        budgetStorageKey,
      ]);
      const installation = currentCounter(
        stored.get(installationStorageKey),
        input.nowMs,
      );
      const ip = currentCounter(stored.get(ipStorageKey), input.nowMs);
      const budget = currentCounter(stored.get(budgetStorageKey), input.nowMs);

      if (installation.count >= input.installationLimit) {
        return "installation_quota";
      }
      if (ip.count >= input.ipLimit) return "ip_quota";

      installation.count += 1;
      ip.count += 1;
      const budgetWouldOpen =
        input.useProviderBudget &&
        budget.count + input.estimatedCostMicros > input.budgetMicros;
      if (input.useProviderBudget && !budgetWouldOpen) {
        budget.count += input.estimatedCostMicros;
      }

      await transaction.put({
        [installationStorageKey]: installation,
        [ipStorageKey]: ip,
        [budgetStorageKey]: budget,
      });
      return budgetWouldOpen ? "budget_open" : "allowed";
    });
  }
}
