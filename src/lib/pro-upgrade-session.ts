const promptStorageKey = "miturnolisto_pro_prompt_seen";

type PromptStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function resetProUpgradePrompt(storage: PromptStorage) {
  storage.removeItem(promptStorageKey);
}

export function consumeProUpgradePrompt(storage: PromptStorage, userId: string, usage: number, tier: string) {
  if (storage.getItem(promptStorageKey) === userId) {
    return false;
  }

  storage.setItem(promptStorageKey, userId);
  return tier === "free" && usage >= 10;
}
