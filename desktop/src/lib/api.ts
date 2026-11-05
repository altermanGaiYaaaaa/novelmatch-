import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { localBackend } from "./localBackend";
import { normalizeError } from "./utils";

export const isDesktopApp =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function call<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isDesktopApp) {
    try {
      return await localBackend<T>(command, args);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function subscribe<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<UnlistenFn> {
  if (!isDesktopApp) {
    return () => undefined;
  }
  return listen<T>(event, (payload) => handler(payload.payload));
}
