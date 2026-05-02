import type { Language } from "./types";

export const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "zh-CN", label: "中文" },
  { value: "en", label: "English" }
];

export function resolveLanguage(value: unknown): Language {
  return value === "en" ? "en" : "zh-CN";
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export const I18N = {
  "zh-CN": {
    bubble: {
      woof: ["woof!", "汪！", "汪汪~"],
      breakReminder: [
        "坐太久啦，去走一分钟吧",
        "我想和你玩儿一会儿，去走一分钟吧",
        "坐了好久了……去走一分钟吧！",
        "我想玩儿了，去走一分钟吧"
      ],
      breakDone: [
        "好耶！摇尾巴~",
        "耶耶耶 好喜欢你",
        "开心！"
      ],
      breakRun: [
        (seconds: number) => `我还要玩 ${seconds} 秒！快离开屏幕~`,
        (seconds: number) => `倒计时 ${seconds} 秒，别偷偷回来哦`,
        (seconds: number) => `${seconds} 秒！`
      ],
      breakRunComplete: [
        "玩够啦，回来陪你坐会儿~",
        "回来啦！我在等你呢",
        "休息完毕，蹲好了~"
      ],
      breakIgnore: [
        "好吧……但我会担心你的",
        "呜……那你下次一定站起来",
        "好吧，我先趴着等你……"
      ],
      hydrationReminder: [
        "我有点渴了……你也喝口水吧？",
        "想喝水了！你也来一口嘛",
        "舔舔嘴……该喝水啦",
        "水碗空了！你的杯子呢？"
      ],
      hydrationDone: [
        "咕嘟咕嘟，舒服~",
        "喝饱啦！",
        "汪，水真好喝"
      ],
      focusStart: [
        (minutes: number) => `好，我帮你看着这 ${minutes} 分钟！`,
        (minutes: number) => `专心${minutes} 分钟，我盯着`
      ],
      focusWarning: [
        (rule: string) => `说好专注的，不许看 ${rule}`,
        (rule: string) => `走神啦！${rule} 不能玩`,
        (rule: string) => `你怎么在偷偷看 ${rule} 了`,
      ],
      focusComplete: [
        "专心时间到！",
        "专心结束！摇尾巴~",
      ],
      focusCancelled: [
        "好，我陪你歇会儿",
        "收工！我趴下啦"
      ],
      focusBack: [
        "好，我继续盯着~",
        "嗯！回去干活吧",
        "我也继续专心啦"
      ],
      companionPrompt: [
        "我在！想聊点什么吗？",
        "坐好啦，跟我说吧！",
        "来了来了！",
      ],
      companionThinking: [
        "我想想哈……",
        "挠头ing……",
        "桥豆麻袋……",
      ],
      companionSetupNeeded: [
        "先在设置里启用聊天，我就能陪你聊天了！",
      ],
      companionError: [
        (detail: string) => `出错啦：${detail}`
      ],
      companionEmpty: "先打几个字给我吧。",
      companionPlaceholder: "和 PawPal 说点什么…"
    },
    actions: {
      breakDone: "我站起来了",
      breakRunDone: "我回来了",
      breakSnooze: "10 分钟后提醒",
      breakMute: "今天先别管我",
      hydrationDone: "我喝水了",
      hydrationSnooze: "稍后提醒",
      focusBack: "回去工作",
      focusEnd: "结束专注",
      companionSend: "发送",
      companionSettings: "打开设置",
      linkLabel: "链接",
      dismissBubble: "关闭"
    },
    menu: {
      showPawPal: "显示 PawPal",
      hidePawPal: "隐藏 PawPal",
      chatWithPawPal: "开始聊天",
      stopChat: "隐藏聊天",
      resetChatSession: "重置聊天会话",
      startFocusMode: "开始专注模式",
      stopFocusMode: "停止专注模式",
      demoBreakReminder: "演示：休息提醒",
      demoHydrationReminder: "演示：喝水提醒",
      demoFocusWarning: "演示：分心提醒",
      demoHappyReaction: "演示：开心反馈",
      settings: "设置",
      resetToday: "重置今日",
      quit: "退出"
    },
    settings: {
      title: "设置",
      welcomeTitle: "欢迎使用 PawPal",
      welcomeCopy:
        "PawPal 会住在菜单栏和屏幕底部，定时提醒你休息、喝水和保持专注。分心检测目前仅支持 macOS，需要在系统设置里允许辅助功能权限。",
      dismissWelcome: "知道了",
      appearance: "外观",
      quickActions: "快捷操作",
      testTools: "测试工具",
      language: "语言",
      petAppearance: "宠物形象",
      reminders: "提醒",
      enableBreakReminder: "开启休息提醒",
      breakInterval: "休息间隔",
      enableHydrationReminder: "开启喝水提醒",
      hydrationInterval: "喝水间隔",
      focus: "专注",
      focusDuration: "专注时长",
      enableDistractionDetection: "开启分心检测",
      detectionGrace: "检测宽限时间",
      blockedApps: "屏蔽应用",
      blockedKeywords: "屏蔽关键词",
      companion: "聊天伴侣",
      enableChatCompanion: "启用聊天",
      chatProvider: "聊天 Provider",
      chatProviderHelp: "选择一个 profile 后仍可手动修改 URL、模型和指令前缀。",
      chatProviderOpenAi: "OpenAI",
      chatProviderGemini: "Gemini",
      chatProviderKimi: "Kimi",
      chatProviderDeepSeek: "DeepSeek",
      chatProviderOpenClaw: "OpenClaw",
      chatProviderOpenAiCompatible: "自定义OpenAI-兼容接口",
      chatBaseUrl: "Chat Completions API URL",
      chatBaseUrlHelp:
        "支持完整 /chat/completions endpoint，也支持 provider base URL。",
      chatApiKey: "API Key",
      chatApiKeyHelp: "通过 Authorization: Bearer 发送；不需要鉴权的本地 provider 可留空。",
      chatModel: "模型",
      chatModelHelp: "填写当前 provider 支持的 Chat Completions 模型 ID。",
      chatModelList: "模型一览",
      refreshChatModels: "刷新模型",
      chatModelsIdle: "填写 URL/API Key 后获取 /models。",
      chatModelsLoading: "正在获取 /models…",
      chatModelsEmpty: "这个 provider 没返回模型。",
      chatModelsLoaded: (count: number) => `已获取 ${count} 个模型`,
      chatModelsError: "获取模型失败",
      chatThinkingPrefix: "指令前缀",
      chatThinkingPrefixHelp: "会加在每条用户消息前；OpenClaw 默认 /think:low，其他 provider 通常留空。",
      chatSystemPrompt: "PawPal 人格",
      chatSystemPromptHelp:
        "在这里定义 PawPal 是什么角色、性格和说话方式；会作为 system prompt 发送给聊天 provider。",
      chatCompanionInactivity: "聊天状态超时时长",
      chatCompanionInactivityHelp: "没有互动后，释放聊天气泡和状态锁，但保留本次聊天会话。",
      chatSessionExpiry: "聊天会话过期时长",
      chatSessionExpiryHelp: "超过这个时间没有聊天后，本次聊天会话会结束并重置。",
      resetChatSettings: "重置聊天配置",
      today: "今日",
      breaks: "休息",
      waters: "喝水",
      focusMin: "专注",
      warnings: "分心",
      minuteUnit: "分钟",
      hourUnit: "小时",
      secondUnit: "秒",
      countUnit: "次",
      addListItem: "添加…",
      removeListItem: (entry: string) => `移除 ${entry}`,
      runtime: "运行状态",
      state: "状态",
      mode: "模式",
      reminder: "提醒",
      pawpal: "PawPal",
      distraction: "分心检测",
      status: "状态",
      statusIdle: "未运行",
      statusWatching: "检测中",
      statusPermissionNeeded: "需要权限",
      statusUnsupported: "当前系统不支持",
      statusError: "检测异常",
      matched: "命中",
      app: "应用",
      checked: "检查时间",
      timers: "计时器",
      break: "休息",
      water: "喝水",
      focusEnd: "专注结束",
      updated: "更新",
      demo: "演示",
      demoBreak: "休息",
      demoWater: "喝水",
      demoFocusWarning: "分心提醒",
      demoHappy: "开心",
      resetToday: "重置今日",
      startFocus: "开始专注",
      stopFocus: "停止专注",
      diagnostics: "诊断信息",
      chatCompanionDiagnostics: "聊天伴侣",
      sessionStatus: "会话状态",
      sessionActive: "进行中",
      sessionInactive: "未激活",
      sessionEnded: "已结束",
      sessionCreated: "创建时间",
      sessionDuration: "持续时间",
      conversationRounds: "对话轮数",
      resetCountdown: "重置倒计时",
      sessionHistory: "Session 历史 JSON",
      preloadUnavailable: "Preload 不可用",
      preloadCopy:
        "Electron preload 没有注入，桌宠控制接口暂时不可用。请重启 pnpm dev，或检查 preload 路径和 sandbox 设置。",
      off: "关闭",
      now: "现在",
      never: "从未",
      none: "无",
      visible: "显示",
      hidden: "隐藏",
      idle: "空闲",
      noActiveWindowTitle: "还没有捕获到当前窗口标题。",
      detectionOffHelp: "分心检测已关闭。开启后保存，即可预览当前活动窗口。",
      detectionWaitingHelp: "正在等待第一次活动窗口检查。",
      detectionPermissionHelp:
        "需要在系统设置里允许 PawPal 获取辅助功能权限（macOS），然后重启应用或重新开启分心检测。",
      detectionUnsupportedHelp: "当前系统暂不支持活动窗口检测，分心检测会保持关闭状态。",
      detectionErrorHelp: "活动窗口检测暂时失败。请检查权限后，重新开启分心检测或重启应用。",
      detectionPreviewHelp: "正在预览当前活动窗口。开始专注后，命中规则会触发分心提醒。",
      detectionFocusHelp: "专注期间正在检测。命中屏蔽应用或关键词会触发分心提醒。"
    },
    system: {
      unsupportedDistraction: "分心检测目前仅支持 macOS。"
    }
  },
  en: {
    bubble: {
      woof: ["woof!", "bark bark!", "arf~"],
      breakReminder: [
        "You've been sitting too long, walk for a minute!",
        "I wanna play with you~ walk for a minute!",
        "Sitting for so long… go walk for a minute!",
        "I wanna play! Walk for a minute~"
      ],
      breakDone: [
        "Yay! *tail wag*",
        "Yay yay yay I like you so much",
        "Happy!"
      ],
      breakRun: [
        (seconds: number) => `I still wanna play for ${seconds}s! Get away from the screen~`,
        (seconds: number) => `${seconds}s left, no sneaking back!`,
        (seconds: number) => `${seconds}s!`
      ],
      breakRunComplete: [
        "Done playing~ sitting back down with you",
        "I'm back! Was waiting for you~",
        "Break's over, all settled down~"
      ],
      breakIgnore: [
        "Okay… but I'll worry about you",
        "Hmm… you have to stand up next time",
        "Fine, I'll lie here and wait…"
      ],
      hydrationReminder: [
        "I'm a little thirsty… you should drink some water too?",
        "I want water! You have some too~",
        "*licks lips* …time for water~",
        "My bowl's empty! Where's your cup?"
      ],
      hydrationDone: [
        "*slurp slurp* ahh~",
        "All full!",
        "Woof, water's so good"
      ],
      focusStart: [
        (minutes: number) => `Okay, I'll keep watch for ${minutes} minutes!`,
        (minutes: number) => `Focus for ${minutes} minutes, I'm watching`
      ],
      focusWarning: [
        (rule: string) => `Hey, no ${rule}! We said we'd focus!`,
        (rule: string) => `I saw you open ${rule}~ come back!`,
        (rule: string) => `Stay away from ${rule}!`
      ],
      focusComplete: [
        "Focus time's up!",
        "Focus done! *tail wag*"
      ],
      focusCancelled: [
        "Okay, I'll keep you company for a bit",
        "All done! I'm lying down~"
      ],
      focusBack: [
        "Good, I'll keep watching~",
        "Mm! Back to work then",
        "I'll keep focusing too~"
      ],
      companionPrompt: [
        "I'm here! What's on your mind?",
        "Sit tight! Tell me what's up.",
        "Here I am!"
      ],
      companionThinking: [
        "Thinking…",
        "Rubbing head…",
        "Just a sec…"
      ],
      companionSetupNeeded: [
        "Go and enable chatting in Settings, then we can chat!",
      ],
      companionError: [
        (detail: string) => `Oops, error: ${detail}`,
      ],
      companionEmpty: "Type a few words for me first.",
      companionPlaceholder: "Talk to PawPal…"
    },
    actions: {
      breakDone: "I stood up",
      breakRunDone: "I'm back",
      breakSnooze: "Remind in 10 min",
      breakMute: "Leave me today",
      hydrationDone: "I drank water",
      hydrationSnooze: "Remind later",
      focusBack: "Back to work",
      focusEnd: "End Focus",
      companionSend: "Send",
      companionSettings: "Open Settings",
      linkLabel: "Link",
      dismissBubble: "Dismiss"
    },
    menu: {
      showPawPal: "Show PawPal",
      hidePawPal: "Hide PawPal",
      chatWithPawPal: "Start Chat",
      stopChat: "Hide Chat",
      resetChatSession: "Reset Chat",
      startFocusMode: "Start Focus Mode",
      stopFocusMode: "Stop Focus Mode",
      demoBreakReminder: "Demo: Break Reminder",
      demoHydrationReminder: "Demo: Hydration Reminder",
      demoFocusWarning: "Demo: Distraction Nudge",
      demoHappyReaction: "Demo: Happy Reaction",
      settings: "Settings",
      resetToday: "Reset Today",
      quit: "Quit"
    },
    settings: {
      title: "Settings",
      welcomeTitle: "Welcome to PawPal",
      welcomeCopy:
        "PawPal lives in the menu bar and near the bottom of your screen. It reminds you to take breaks, drink water, and stay focused. Distraction detection is macOS-only and requires accessibility permissions.",
      dismissWelcome: "Got it",
      appearance: "Appearance",
      quickActions: "Quick Actions",
      testTools: "Test Tools",
      language: "Language",
      petAppearance: "Pet",
      reminders: "Reminders",
      enableBreakReminder: "Enable Break Reminder",
      breakInterval: "Break Interval",
      enableHydrationReminder: "Enable Hydration Reminder",
      hydrationInterval: "Hydration Interval",
      focus: "Focus",
      focusDuration: "Focus Duration",
      enableDistractionDetection: "Enable Distraction Detection",
      detectionGrace: "Detection Grace",
      blockedApps: "Blocked Apps",
      blockedKeywords: "Blocked Keywords",
      companion: "Chat Companion",
      enableChatCompanion: "Enable Chat",
      chatProvider: "Chat Provider",
      chatProviderHelp: "Choose a profile, then adjust URL, model, and instruction prefix as needed.",
      chatProviderOpenAi: "OpenAI",
      chatProviderGemini: "Gemini",
      chatProviderKimi: "Kimi",
      chatProviderDeepSeek: "DeepSeek",
      chatProviderOpenClaw: "OpenClaw",
      chatProviderOpenAiCompatible: "Custom OpenAI-compatible API",
      chatBaseUrl: "Chat Completions API URL",
      chatBaseUrlHelp: "Supports a full /chat/completions endpoint or a provider base URL.",
      chatApiKey: "API Key",
      chatApiKeyHelp: "Sent as Authorization: Bearer. Leave blank for local providers without auth.",
      chatModel: "Model",
      chatModelHelp: "Use a Chat Completions model ID supported by the current provider.",
      chatModelList: "Model Overview",
      refreshChatModels: "Refresh Models",
      chatModelsIdle: "Enter URL/API key to fetch /models.",
      chatModelsLoading: "Fetching /models…",
      chatModelsEmpty: "This provider did not return any models.",
      chatModelsLoaded: (count: number) => `${count} models loaded`,
      chatModelsError: "Could not fetch models",
      chatThinkingPrefix: "Instruction Prefix",
      chatThinkingPrefixHelp:
        "Prepended to each user message. OpenClaw defaults to /think:low; other providers usually leave this blank.",
      chatSystemPrompt: "PawPal Persona",
      chatSystemPromptHelp:
        "Define what PawPal is, its personality, and its voice. Sent to the chat provider as the system prompt.",
      chatCompanionInactivity: "Chat State Timeout Duration",
      chatCompanionInactivityHelp:
        "After no interaction, release the chat bubble and state lock but keep the current chat session.",
      chatSessionExpiry: "Chat Session Expiry Duration",
      chatSessionExpiryHelp:
        "After this much time without chat activity, the current chat session ends and resets.",
      resetChatSettings: "Reset Chat Defaults",
      today: "Today",
      breaks: "Breaks",
      waters: "Waters",
      focusMin: "Focus",
      warnings: "Distractions",
      minuteUnit: "min",
      hourUnit: "h",
      secondUnit: "s",
      countUnit: "",
      addListItem: "Add…",
      removeListItem: (entry: string) => `Remove ${entry}`,
      runtime: "Runtime",
      state: "State",
      mode: "Mode",
      reminder: "Reminder",
      pawpal: "PawPal",
      distraction: "Distraction",
      status: "Status",
      statusIdle: "Idle",
      statusWatching: "Watching",
      statusPermissionNeeded: "Permission needed",
      statusUnsupported: "Unsupported",
      statusError: "Detection error",
      matched: "Matched",
      app: "App",
      checked: "Checked",
      timers: "Timers",
      break: "Break",
      water: "Water",
      focusEnd: "Focus End",
      updated: "Updated",
      demo: "Demo",
      demoBreak: "Break",
      demoWater: "Water",
      demoFocusWarning: "Distraction",
      demoHappy: "Happy",
      resetToday: "Reset Today",
      startFocus: "Start Focus",
      stopFocus: "Stop Focus",
      diagnostics: "Diagnostics",
      chatCompanionDiagnostics: "Chat Companion",
      sessionStatus: "Session Status",
      sessionActive: "Active",
      sessionInactive: "Inactive",
      sessionEnded: "Ended",
      sessionCreated: "Created",
      sessionDuration: "Duration",
      conversationRounds: "Conversation Rounds",
      resetCountdown: "Reset Countdown",
      sessionHistory: "Session History JSON",
      preloadUnavailable: "Preload unavailable",
      preloadCopy:
        "Electron preload was not injected, so the pet control API is unavailable. Restart pnpm dev, or check the preload path and sandbox settings.",
      off: "off",
      now: "now",
      never: "never",
      none: "none",
      visible: "visible",
      hidden: "hidden",
      idle: "idle",
      noActiveWindowTitle: "No active window title captured yet.",
      detectionOffHelp: "Detection is off. Enable it and Save to preview the active window.",
      detectionWaitingHelp: "Waiting for the first active-window check.",
      detectionPermissionHelp:
        "Allow PawPal accessibility permissions in System Settings (macOS), then restart the app or toggle detection again.",
      detectionUnsupportedHelp:
        "Active-window detection is not supported on this system yet, so distraction detection will stay inactive.",
      detectionErrorHelp:
        "Active-window detection failed. Check permissions, then toggle detection again or restart the app.",
      detectionPreviewHelp:
        "Previewing the active window. Start Focus to trigger distraction nudges from matched rules.",
      detectionFocusHelp:
        "Watching during Focus. Matched blocked apps or keywords will trigger a distraction nudge."
    },
    system: {
      unsupportedDistraction: "Distraction detection currently supports macOS only."
    }
  }
} as const;

export type I18nBundle = (typeof I18N)[Language];

export function i18n(language: Language): I18nBundle {
  return I18N[language];
}
