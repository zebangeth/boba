import type { i18n } from "../../shared/i18n";
import type { AppSnapshot, Language } from "../../shared/types";

type SettingsCopy = ReturnType<typeof i18n>["settings"];
type DistractionState = AppSnapshot["distraction"]["state"];

export function localeFor(language: Language): string {
  return language === "zh-CN" ? "zh-CN" : "en-US";
}

export function formatTimer(
  timestamp: number | null,
  now: number,
  language: Language,
  labels: SettingsCopy
): string {
  if (!timestamp) return labels.off;
  const remainingMs = timestamp - now;
  const absolute = new Intl.DateTimeFormat(localeFor(language), {
    hour: "2-digit",
    minute: "2-digit"
  }).format(timestamp);
  if (remainingMs <= 0) return `${absolute} ${labels.now}`;
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return `${absolute} (${remainingMinutes}m)`;
}

export function formatTimestamp(
  timestamp: number | null,
  language: Language,
  labels: SettingsCopy
): string {
  if (!timestamp) return labels.never;
  return new Intl.DateTimeFormat(localeFor(language), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(timestamp);
}

export function distractionHelp(snapshot: AppSnapshot, labels: SettingsCopy): string {
  if (!snapshot.settings.distractionDetectionEnabled) {
    return labels.detectionOffHelp;
  }
  if (snapshot.distraction.state === "permission-needed") {
    return labels.detectionPermissionHelp;
  }
  if (snapshot.distraction.state === "unsupported") {
    return labels.detectionUnsupportedHelp;
  }
  if (snapshot.distraction.state === "error") {
    return labels.detectionErrorHelp;
  }
  if (!snapshot.distraction.lastCheckedAt) {
    return labels.detectionWaitingHelp;
  }
  if (!snapshot.focusActive) {
    return labels.detectionPreviewHelp;
  }
  return labels.detectionFocusHelp;
}

export function formatDistractionState(state: DistractionState, labels: SettingsCopy): string {
  switch (state) {
    case "watching":
      return labels.statusWatching;
    case "permission-needed":
      return labels.statusPermissionNeeded;
    case "unsupported":
      return labels.statusUnsupported;
    case "error":
      return labels.statusError;
    case "idle":
    default:
      return labels.statusIdle;
  }
}
