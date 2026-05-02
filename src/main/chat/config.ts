import { CHAT_PROVIDER_PRESETS, DEFAULT_SETTINGS } from "../../shared/constants";
import type { ChatProviderId, Settings } from "../../shared/types";

const CHAT_DISABLED_VALUES = new Set(["0", "false", "off", "disabled"]);

export const CHAT_MODULE_ENABLED = !CHAT_DISABLED_VALUES.has(
  (process.env.PAWPAL_CHAT_MODULE ?? "1").trim().toLowerCase()
);

export const MAX_COMPANION_HISTORY_MESSAGES = 12;

function resolveChatProviderId(value: unknown): ChatProviderId {
  return typeof value === "string" && value in CHAT_PROVIDER_PRESETS
    ? (value as ChatProviderId)
    : DEFAULT_SETTINGS.chatProviderId;
}

export function normalizeChatSettings(settings: Settings): Settings {
  const chatProviderId = resolveChatProviderId(settings.chatProviderId);
  const preset = CHAT_PROVIDER_PRESETS[chatProviderId];
  return {
    ...settings,
    chatProviderId,
    chatBaseUrl: settings.chatBaseUrl.trim() || preset.baseUrl,
    chatModel: settings.chatModel.trim() || preset.model,
    chatThinkingPrefix: settings.chatThinkingPrefix.trim(),
    chatCompanionInactivityMinutes: Math.min(
      120,
      Math.max(1, Math.round(settings.chatCompanionInactivityMinutes))
    ),
    chatSessionExpiryHours: Math.min(168, Math.max(1, Math.round(settings.chatSessionExpiryHours)))
  };
}
