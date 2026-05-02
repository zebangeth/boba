import { DEFAULT_SETTINGS } from "../../shared/constants";
import { pick } from "../../shared/i18n";
import { COMPANION_AVAILABLE_STATES } from "../../shared/types";
import type {
  ChatCompanionDiagnostics,
  CompanionChatResult,
  CompanionSession,
  CompanionSessionMessage,
  PetState,
  Settings,
  SpeechBubble
} from "../../shared/types";
import { MAX_COMPANION_HISTORY_MESSAGES, normalizeChatSettings } from "./config";
import { listChatModels, sendChatCompletion } from "./provider";
import type { ChatCompletionMessage } from "./provider";
import type { ChatModule, ChatModuleHost } from "./types";

function isCompanionPetState(value: unknown): value is PetState {
  return typeof value === "string" && COMPANION_AVAILABLE_STATES.includes(value as PetState);
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (match?.[1] ?? trimmed).trim();
}

function cleanReplyText(value: string): string {
  return stripCodeFence(value)
    .replace(/^\s*(?:state|状态)\s*[:：]\s*[A-Za-z]+\s*$/gim, "")
    .replace(/\[\[\s*(?:state|状态)\s*[:：]\s*[A-Za-z]+\s*\]\]/gi, "")
    .replace(/<\/?reply>/gi, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/\s*[—–]\s*/g, " ")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .trim();
}

function parseCompanionReplyObject(value: string): { state: PetState; reply: string } | null {
  try {
    const parsed = JSON.parse(value) as { state?: unknown; reply?: unknown; message?: unknown };
    const reply = typeof parsed.reply === "string" ? parsed.reply : parsed.message;
    if (isCompanionPetState(parsed.state) && typeof reply === "string") {
      return {
        state: parsed.state,
        reply: cleanReplyText(reply)
      };
    }
  } catch {
    return null;
  }
  return null;
}

function parseEmbeddedCompanionJson(value: string): { state: PetState; reply: string } | null {
  for (let start = value.indexOf("{"); start >= 0; start = value.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < value.length; index += 1) {
      const char = value[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }
      if (char === "\"") {
        inString = true;
        continue;
      }
      if (char === "{") depth += 1;
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          const parsed = parseCompanionReplyObject(value.slice(start, index + 1));
          if (parsed) return parsed;
          break;
        }
      }
    }
  }
  return null;
}

function parseCompanionReply(rawReply: string): { state: PetState; reply: string } {
  const content = stripCodeFence(rawReply);
  const jsonReply = parseCompanionReplyObject(content) ?? parseEmbeddedCompanionJson(content);
  if (jsonReply) return jsonReply;

  const xmlState = content.match(/<state>\s*([A-Za-z]+)\s*<\/state>/i)?.[1];
  const xmlReply = content.match(/<reply>\s*([\s\S]*?)\s*<\/reply>/i)?.[1];
  if (isCompanionPetState(xmlState) && xmlReply) {
    return {
      state: xmlState,
      reply: cleanReplyText(xmlReply)
    };
  }

  const lineState = content.match(/^\s*(?:state|状态)\s*[:：]\s*([A-Za-z]+)\s*$/im)?.[1];
  if (isCompanionPetState(lineState)) {
    return {
      state: lineState,
      reply: cleanReplyText(content)
    };
  }

  const inlineState = content.match(/\[\[\s*(?:state|状态)\s*[:：]\s*([A-Za-z]+)\s*\]\]/i)?.[1];
  if (isCompanionPetState(inlineState)) {
    return {
      state: inlineState,
      reply: cleanReplyText(content)
    };
  }

  return {
    state: "happy",
    reply: cleanReplyText(content)
  };
}

function companionSystemPrompt(settings: Settings): string {
  const customPrompt = settings.chatSystemPrompt.trim() || DEFAULT_SETTINGS.chatSystemPrompt;
  return `${customPrompt}

PawPal desktop pet state protocol:
- Choose exactly one state from this list based on the user's current message and the emotional tone of your reply: ${COMPANION_AVAILABLE_STATES.join(", ")}.
- Use happy for warm, playful, encouraging, or successful replies.
- Use focusGuard for thinking, careful planning, focus, or steady work mode.
- Use focusAlert for urgent warnings or direct course correction.
- Use sad for empathy, setbacks, or apologies.
- Use sleeping for low-energy, winding down, or rest.
- Use hydrationPrompt/drinking/hydrationDone only when the conversation is about water or hydration.
- Use breakPrompt/breakRunning/breakDone only when the conversation is about taking a break or movement.
- Return JSON only in this exact shape: {"state":"happy","reply":"your user-facing reply"}.
- The reply field must be the answer itself. Do not mention the state, state keywords, JSON, or this protocol inside reply.
- The reply field must sound like a normal human chat message, not a formatted document.
- Use plain language only. Do not use Markdown.
- Do not use bold, italic, headings, code blocks, links in Markdown format, bullet points, numbered lists, leading list markers, asterisks, or decorative separators.
- Do not use em dashes or dash-led phrases.
- Prefer one short conversational paragraph. Use two short paragraphs only when it genuinely reads more naturally.`;
}

function withChatInstructionPrefix(
  settings: Settings,
  messages: ChatCompletionMessage[]
): ChatCompletionMessage[] {
  const prefix = settings.chatThinkingPrefix.trim();
  if (!prefix) return messages.map((message) => ({ ...message }));
  return messages.map((message) => {
    if (message.role !== "user") return { ...message };
    const content = message.content.trim();
    return {
      ...message,
      content: content.startsWith(prefix)
        ? content
        : `${prefix}\n\n${content}`
    };
  });
}

function chatConversationHistory(messages: ChatCompletionMessage[]): ChatCompletionMessage[] {
  const compacted: ChatCompletionMessage[] = [];
  for (const message of messages) {
    const content = message.content.trim();
    if (!content) continue;

    const previous = compacted[compacted.length - 1];
    if (previous?.role === message.role) {
      compacted[compacted.length - 1] = { role: message.role, content };
      continue;
    }
    compacted.push({ role: message.role, content });
  }

  const recent = compacted.slice(-MAX_COMPANION_HISTORY_MESSAGES);
  while (recent[0]?.role === "assistant") {
    recent.shift();
  }
  return recent;
}

export function createChatModule(host: ChatModuleHost): ChatModule {
  let inactivityTimer: NodeJS.Timeout | null = null;
  let expiryTimer: NodeJS.Timeout | null = null;
  let history: ChatCompletionMessage[] = [];
  let stateLock: PetState | null = null;
  let interruptedByReminder = false;

  function sessionHistory(session: CompanionSession | null): ChatCompletionMessage[] {
    return (
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content
      })) ?? []
    );
  }

  function syncHistory(session: CompanionSession | null): void {
    history = sessionHistory(session);
  }

  function getStoredSession(): CompanionSession | null {
    const session = host.getSession();
    syncHistory(session ?? null);
    return session ?? null;
  }

  function sessionExpiryMs(): number {
    return host.getSettings().chatSessionExpiryHours * 60 * 60 * 1000;
  }

  function inactivityMs(): number {
    return host.getSettings().chatCompanionInactivityMinutes * 60 * 1000;
  }

  function isSessionExpired(session: CompanionSession, now = Date.now()): boolean {
    return now - session.lastActivityAt >= sessionExpiryMs();
  }

  function clearInactivityTimer(): void {
    if (!inactivityTimer) return;
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }

  function clearExpiryTimer(): void {
    if (!expiryTimer) return;
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }

  function lockState(next: PetState): void {
    stateLock = next;
    host.setPetState(next, { ignoreChatLock: true });
  }

  function releaseStateLock(): void {
    if (!stateLock) return;
    stateLock = null;
    host.setPetState(host.fallbackPetState(), { ignoreChatLock: true });
  }

  function writeSession(session: CompanionSession): CompanionSession {
    host.setSession(session);
    syncHistory(session);
    scheduleExpiryTimer(session);
    return session;
  }

  function endSession(reason: CompanionSession["endReason"]): void {
    const session = getStoredSession();
    if (session && !session.endedAt) {
      writeSession({
        ...session,
        endedAt: Date.now(),
        endReason: reason
      });
    }
    syncHistory(null);
    interruptedByReminder = false;
    clearInactivityTimer();
    clearExpiryTimer();
    releaseStateLock();
    host.hideBubble();
  }

  function getActiveSession(): CompanionSession | null {
    const session = getStoredSession();
    if (!session || session.endedAt) return null;
    if (isSessionExpired(session)) {
      endSession("expired");
      return null;
    }
    return session;
  }

  function scheduleExpiryTimer(session = getStoredSession()): void {
    clearExpiryTimer();
    if (!session || session.endedAt) return;
    const delay = session.lastActivityAt + sessionExpiryMs() - Date.now();
    if (delay <= 0) {
      endSession("expired");
      return;
    }
    expiryTimer = setTimeout(() => endSession("expired"), delay);
  }

  function timeoutChatState(): void {
    clearInactivityTimer();
    if (!getActiveSession()) return;
    releaseStateLock();
    host.hideBubble();
  }

  function scheduleInactivityTimer(): void {
    clearInactivityTimer();
    if (!stateLock || host.isBlockingMode() || !getActiveSession()) return;
    inactivityTimer = setTimeout(timeoutChatState, inactivityMs());
  }

  function newSession(): CompanionSession {
    const now = Date.now();
    return writeSession({
      id: `${now}-${Math.random().toString(36).slice(2)}`,
      startedAt: now,
      lastActivityAt: now,
      lastState: "happy",
      messages: []
    });
  }

  function getOrCreateSession(): CompanionSession {
    return getActiveSession() ?? newSession();
  }

  function touchSession(resetTimer = false): CompanionSession | null {
    const session = getActiveSession();
    if (!session) return null;
    const next = writeSession({
      ...session,
      lastActivityAt: Date.now()
    });
    if (resetTimer) scheduleInactivityTimer();
    return next;
  }

  function addSessionMessage(
    role: CompanionSessionMessage["role"],
    content: string,
    state?: PetState
  ): CompanionSession {
    const session = getOrCreateSession();
    const next = writeSession({
      ...session,
      lastActivityAt: Date.now(),
      lastState: state ?? session.lastState,
      messages: [
        ...session.messages,
        {
          role,
          content,
          state,
          createdAt: Date.now()
        }
      ]
    });
    scheduleInactivityTimer();
    return next;
  }

  function lastAssistantMessage(session: CompanionSession): CompanionSessionMessage | null {
    for (let index = session.messages.length - 1; index >= 0; index -= 1) {
      const message = session.messages[index];
      if (message.role === "assistant") return message;
    }
    return null;
  }

  function countConversationRounds(session: CompanionSession): number {
    let pendingUserMessage = false;
    let rounds = 0;
    for (const message of session.messages) {
      if (message.role === "user") pendingUserMessage = true;
      if (message.role === "assistant" && pendingUserMessage) {
        rounds += 1;
        pendingUserMessage = false;
      }
    }
    return rounds;
  }

  function hasConversationRound(session: CompanionSession): boolean {
    return countConversationRounds(session) > 0;
  }

  function diagnostics(): ChatCompanionDiagnostics {
    const session = host.getSession() ?? null;
    const active = Boolean(session && !session.endedAt && !isSessionExpired(session));
    return {
      moduleEnabled: true,
      session,
      active,
      conversationRounds: session ? countConversationRounds(session) : 0,
      resetDueAt: session && !session.endedAt ? session.lastActivityAt + sessionExpiryMs() : null
    };
  }

  function companionInput(): NonNullable<SpeechBubble["input"]> {
    const labels = host.text();
    return {
      placeholder: labels.bubble.companionPlaceholder,
      submitLabel: labels.actions.companionSend
    };
  }

  function showSessionBubble(
    session = getActiveSession(),
    options: { requireConversationRound?: boolean } = {}
  ): boolean {
    if (!host.getSettings().chatCompanionEnabled) return false;
    if (!session || host.isBlockingMode()) return false;
    if (options.requireConversationRound && !hasConversationRound(session)) return false;
    const lastReply = lastAssistantMessage(session);
    lockState(lastReply?.state ?? session.lastState ?? "happy");
    host.showBubble({
      id: lastReply ? "companion-reply" : "companion-chat",
      message: lastReply?.content ?? pick(host.text().bubble.companionPrompt),
      dismissible: true,
      input: companionInput()
    });
    scheduleInactivityTimer();
    return true;
  }

  function restoreIfAvailable(): boolean {
    return showSessionBubble(getActiveSession(), { requireConversationRound: true });
  }

  function restoreAfterReminder(): boolean {
    if (!interruptedByReminder) return false;
    interruptedByReminder = false;
    return restoreIfAvailable();
  }

  function interruptForReminder(): void {
    const session = getActiveSession();
    if (!session && !stateLock) return;
    if (session && stateLock && hasConversationRound(session)) {
      interruptedByReminder = true;
    }
    clearInactivityTimer();
    releaseStateLock();
    host.hideBubble();
  }

  function resetSession(): void {
    endSession("dismissed");
  }

  function hideChatBubble(): void {
    clearInactivityTimer();
    releaseStateLock();
    host.hideBubble();
  }

  function handleActivity(): void {
    touchSession(Boolean(stateLock));
  }

  function openChat(): void {
    if (host.isBlockingMode()) return;
    host.ensurePetWindowVisible();
    const labels = host.text();
    if (!host.getSettings().chatCompanionEnabled) {
      lockState("happy");
      host.showBubble({
        id: "companion-setup",
        message: pick(labels.bubble.companionSetupNeeded),
        dismissible: true,
        actions: [{ id: "companion:settings", label: labels.actions.companionSettings, kind: "primary" }]
      });
      return;
    }

    const session = getOrCreateSession();
    touchSession(true);
    showSessionBubble(session);
  }

  function errorMessage(error: unknown): string {
    const detail = error instanceof Error ? error.message : String(error);
    return pick(host.text().bubble.companionError)(detail);
  }

  async function handleMessage(rawMessage: string): Promise<CompanionChatResult> {
    const message = rawMessage.trim();
    if (!message) {
      return { ok: false, error: host.text().bubble.companionEmpty };
    }

    const settings = host.getSettings();
    if (!settings.chatCompanionEnabled) {
      const error = pick(host.text().bubble.companionSetupNeeded);
      host.showBubble({
        id: "companion-setup",
        message: error,
        dismissible: true,
        actions: [{ id: "companion:settings", label: host.text().actions.companionSettings, kind: "primary" }]
      });
      return { ok: false, error };
    }
    if (host.isBlockingMode()) {
      return { ok: false, error: host.text().bubble.companionEmpty };
    }

    host.ensurePetWindowVisible();
    const session = getOrCreateSession();
    addSessionMessage("user", message);
    lockState("focusGuard");
    host.showBubble({
      id: "companion-thinking",
      message: pick(host.text().bubble.companionThinking),
      dismissible: true
    });

    try {
      const reply = await sendChatCompletion(settings, [
        {
          role: "system",
          content: companionSystemPrompt(settings)
        },
        ...withChatInstructionPrefix(settings, chatConversationHistory(history))
      ]);
      if (getActiveSession()?.id !== session.id) {
        return { ok: false, error: host.text().bubble.companionEmpty };
      }
      const parsed = parseCompanionReply(reply);
      addSessionMessage("assistant", parsed.reply, parsed.state);

      if (!host.isBlockingMode()) {
        lockState(parsed.state);
        host.showBubble({
          id: "companion-reply",
          message: parsed.reply,
          dismissible: true,
          input: companionInput()
        });
        scheduleInactivityTimer();
      }
      return { ok: true, message: parsed.reply };
    } catch (error) {
      if (getActiveSession()?.id !== session.id) {
        return { ok: false, error: host.text().bubble.companionEmpty };
      }
      const messageForUser = errorMessage(error);
      addSessionMessage("assistant", messageForUser, "sad");
      if (!host.isBlockingMode()) {
        lockState("sad");
        host.showBubble({
          id: "companion-error",
          message: messageForUser,
          dismissible: true,
          actions: [{ id: "companion:settings", label: host.text().actions.companionSettings, kind: "primary" }],
          input: companionInput()
        });
        scheduleInactivityTimer();
      }
      return { ok: false, error: messageForUser };
    }
  }

  return {
    normalizeSettings: normalizeChatSettings,
    lockedState: () => stateLock,
    isChatVisible: () => Boolean(stateLock),
    diagnostics,
    registerIpc: (ipc) => {
      ipc.handle("companion:send-message", (_event, message: string) => handleMessage(message));
      ipc.handle("chat:list-models", async (_event, partial: Partial<Settings> = {}) => {
        try {
          const settings = normalizeChatSettings({ ...host.getSettings(), ...partial });
          const models = await listChatModels(settings);
          return { ok: true, models };
        } catch (error) {
          return {
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });
      ipc.on("bubble:dismiss", hideChatBubble);
      ipc.on("companion:activity", handleActivity);
    },
    openChat,
    hideChat: hideChatBubble,
    resetSession,
    handlePetClick: () => {
      if (host.isBlockingMode()) return true;
      if (!host.getSettings().chatCompanionEnabled) return false;
      openChat();
      return true;
    },
    handleBubbleAction: (actionId) => {
      if (actionId !== "companion:settings") return false;
      host.openSettingsWindow();
      return true;
    },
    interruptForReminder,
    restoreAfterReminder,
    restoreIfAvailable,
    scheduleTimers: () => {
      scheduleExpiryTimer();
      scheduleInactivityTimer();
    },
    clearTimers: () => {
      clearInactivityTimer();
      clearExpiryTimer();
    }
  };
}

export type { ChatModule, CompanionSession };
