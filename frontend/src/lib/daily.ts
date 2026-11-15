import { ensureDaily, errorMessage } from "./api";
import { todayISO } from "./dates";
import { useUi } from "../stores/ui";

export async function openDaily(day = todayISO()): Promise<string | null> {
  try {
    const item = await ensureDaily(day);
    return item.id;
  } catch (error) {
    const message = errorMessage(error);
    if (message) useUi.getState().pushToast(message);
    return null;
  }
}
