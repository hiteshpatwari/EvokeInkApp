import { NATIVE_BACK_EVENT } from "../../src/client/nativeBack";

interface ListenerHandle {
  remove(): Promise<void>;
}

interface NativeAppBridge {
  addListener(
    eventName: "backButton",
    listener: () => void,
  ): Promise<ListenerHandle>;
  exitApp(): Promise<void>;
}

export async function installNativeBackHandler(
  app: NativeAppBridge,
  target: EventTarget,
): Promise<() => Promise<void>> {
  const handle = await app.addListener("backButton", () => {
    const event = new Event(NATIVE_BACK_EVENT, { cancelable: true });
    const handled = !target.dispatchEvent(event);
    if (!handled) void app.exitApp();
  });

  return () => handle.remove();
}
