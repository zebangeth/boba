import type { ChatProviderId, Settings, TodayStats } from "./types";

export type ChatProviderPreset = {
  baseUrl: string;
  model: string;
  thinkingPrefix: string;
};

export const CHAT_PROVIDER_PRESETS: Record<ChatProviderId, ChatProviderPreset> = {
  openai: {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4.1-mini",
    thinkingPrefix: ""
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
    thinkingPrefix: ""
  },
  kimi: {
    baseUrl: "https://api.moonshot.ai/v1",
    model: "kimi-k2.6",
    thinkingPrefix: ""
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    thinkingPrefix: ""
  },
  openclaw: {
    baseUrl: "http://127.0.0.1:18789/v1/chat/completions",
    model: "openclaw/default",
    thinkingPrefix: "/think:low"
  },
  "openai-compatible": {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4.1-mini",
    thinkingPrefix: ""
  }
};

export const DEFAULT_SETTINGS: Settings = {
  language: "zh-CN",
  petAppearanceId: "lineDog",
  onboardingDismissed: false,
  breakReminderEnabled: true,
  breakIntervalMinutes: 45,
  hydrationReminderEnabled: true,
  hydrationIntervalMinutes: 90,
  focusDurationMinutes: 25,
  distractionDetectionEnabled: false,
  distractionGraceSeconds: 8,
  distractionBlockedApps: [
    "Steam",
    "Discord",
    "Telegram",
    "WeChat",
    "QQ"
  ],
  distractionBlockedKeywords: [
    "youtube",
    "youtu.be",
    "twitter",
    "x.com",
    "instagram",
    "reddit",
    "tiktok",
    "netflix",
    "twitch",
    "facebook",
    "bilibili",
    "weibo",
    "douyin",
    "xiaohongshu",
    "zhihu",
    "douban",
    "taobao",
    "jd.com",
    "小红书",
    "微博",
    "抖音",
    "知乎",
    "豆瓣",
    "淘宝",
    "京东",
    "哔哩哔哩",
    "虎扑",
    "贴吧"
  ],
  chatCompanionEnabled: false,
  chatProviderId: "openai",
  chatBaseUrl: CHAT_PROVIDER_PRESETS.openai.baseUrl,
  chatApiKey: "",
  chatModel: CHAT_PROVIDER_PRESETS.openai.model,
  chatThinkingPrefix: CHAT_PROVIDER_PRESETS.openai.thinkingPrefix,
  chatSystemPrompt:
    "You are now in PawPal, a desktop companion application. Your persona is a warm and friendly dog. Keep replies concise, practical, and gently encouraging. Help the user return to focused work. Reply in the user's language.",
  chatCompanionInactivityMinutes: 3,
  chatSessionExpiryHours: 8
};

export function todayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createEmptyStats(date = todayKey()): TodayStats {
  return {
    date,
    breaksTaken: 0,
    watersLogged: 0,
    focusMinutes: 0,
    focusWarnings: 0
  };
}
