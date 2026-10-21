export type AppScreen =
  | "home"
  | "profile"
  | "create"
  | "review"
  | "preview"
  | "saved";

export const NATIVE_BACK_EVENT = "read-reflect:native-back";

export function getPreviousScreen(screen: AppScreen): AppScreen | null {
  switch (screen) {
    case "preview":
      return "review";
    case "review":
      return "create";
    case "profile":
    case "create":
    case "saved":
      return "home";
    case "home":
      return null;
  }
}
