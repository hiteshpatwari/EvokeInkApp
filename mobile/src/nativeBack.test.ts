import { describe, expect, it, vi } from "vitest";
import { NATIVE_BACK_EVENT } from "../../src/client/nativeBack";
import { installNativeBackHandler } from "./nativeBack";

describe("Capacitor Back integration", () => {
  it("offers Back to the React workflow before exiting", async () => {
    const target = new EventTarget();
    target.addEventListener(NATIVE_BACK_EVENT, (event) =>
      event.preventDefault(),
    );
    const exitApp = vi.fn(async () => undefined);
    let nativeListener: (() => void) | undefined;
    const remove = vi.fn(async () => undefined);
    const app = {
      addListener: vi.fn(async (_name: string, listener: () => void) => {
        nativeListener = listener;
        return { remove };
      }),
      exitApp,
    };

    const uninstall = await installNativeBackHandler(app, target);
    nativeListener?.();

    expect(exitApp).not.toHaveBeenCalled();
    await uninstall();
    expect(remove).toHaveBeenCalledOnce();
  });

  it("exits only when the workflow leaves Back unhandled on Home", async () => {
    const target = new EventTarget();
    const exitApp = vi.fn(async () => undefined);
    let nativeListener: (() => void) | undefined;
    const app = {
      addListener: vi.fn(async (_name: string, listener: () => void) => {
        nativeListener = listener;
        return { remove: vi.fn(async () => undefined) };
      }),
      exitApp,
    };

    await installNativeBackHandler(app, target);
    nativeListener?.();

    expect(exitApp).toHaveBeenCalledOnce();
  });
});
