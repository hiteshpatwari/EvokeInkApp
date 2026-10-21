declare module "cloudflare:workers" {
  type PromptControlReservation =
    | "allowed"
    | "installation_quota"
    | "ip_quota"
    | "budget_open";

  interface DurablePromptControlRequest {
    installationKey: string;
    ipKey: string;
    nowMs: number;
    installationLimit: number;
    ipLimit: number;
    budgetMicros: number;
    estimatedCostMicros: number;
    useProviderBudget: boolean;
  }

  interface PromptControlDurableObjectStub {
    reserve(
      input: DurablePromptControlRequest,
    ): Promise<PromptControlReservation>;
  }

  export class DurableObject {
    protected readonly ctx: import("@/server/promptControlDurableObject").PromptControlDurableObjectState;
  }

  export const env: {
    PROMPT_CONTROLS: {
      getByName(name: string): PromptControlDurableObjectStub;
    };
  };
}
