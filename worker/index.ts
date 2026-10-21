import { DurableObject } from "cloudflare:workers";
import handler from "vinext/server/fetch-handler";

import {
  PromptControlDurableObjectCore,
  type DurablePromptControlRequest,
} from "../src/server/promptControlDurableObject";

export class PromptControlDurableObject extends DurableObject {
  reserve(input: DurablePromptControlRequest) {
    return new PromptControlDurableObjectCore(this.ctx).reserve(input);
  }
}

export default handler;
