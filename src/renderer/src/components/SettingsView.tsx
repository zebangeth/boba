import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX, ReactNode } from "react";
import { CHAT_PROVIDER_PRESETS, DEFAULT_SETTINGS } from "../../../shared/constants";
import { i18n, LANGUAGE_OPTIONS, resolveLanguage } from "../../../shared/i18n";
import { petAppearanceOptions, resolvePetAppearanceId } from "../../../shared/petAppearances";
import type {
  ChatProviderId,
  ChatProviderModel,
  DemoTrigger,
  PetAppearanceId,
  Settings
} from "../../../shared/types";
import { getPetAsset } from "../assets";
import { distractionHelp, formatDistractionState, formatTimer, formatTimestamp, localeFor } from "../format";
import { useNow, useSnapshot } from "../hooks";

type SettingsCopy = ReturnType<typeof i18n>["settings"];
type ChatModelsState = {
  status: "idle" | "loading" | "success" | "error";
  models: ChatProviderModel[];
  error?: string;
};

function Row({
  label,
  hint,
  control
}: {
  label: string;
  hint?: string;
  control: JSX.Element;
}): JSX.Element {
  return (
    <div className="pref-row">
      <div className="pref-row__label">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
      <div className="pref-row__control">{control}</div>
    </div>
  );
}

function ToggleControl({
  checked,
  onChange,
  ariaLabel
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`pref-toggle${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="pref-toggle__thumb" />
    </button>
  );
}

function NumberControl({
  value,
  min,
  max,
  unit,
  onChange
}: {
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (next: number) => void;
}): JSX.Element {
  return (
    <div className="pref-stepper">
      <button
        type="button"
        className="pref-stepper__btn"
        aria-label="−"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
      />
      <span className="pref-stepper__unit">{unit}</span>
      <button
        type="button"
        className="pref-stepper__btn"
        aria-label="+"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

function SelectControl({
  value,
  options,
  onChange
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <select className="pref-select" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function TextControl({
  value,
  type = "text",
  placeholder,
  onChange
}: {
  value: string;
  type?: "text" | "password" | "url";
  placeholder?: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <input
      className="pref-text-input"
      type={type}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function TextAreaControl({
  value,
  placeholder,
  onChange
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <textarea
      className="pref-textarea"
      rows={4}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ChipsControl({
  value,
  onChange,
  labels
}: {
  value: string[];
  onChange: (next: string[]) => void;
  labels: SettingsCopy;
}): JSX.Element {
  const [draft, setDraft] = useState("");

  function commit(raw: string): void {
    const trimmed = raw.trim().replace(/,$/, "").trim();
    if (!trimmed) return;
    if (value.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  }

  return (
    <div className="pref-chips">
      <div className="pref-chips__list">
        {value.map((entry) => (
          <span key={entry} className="pref-chip">
            {entry}
            <button
              type="button"
              aria-label={labels.removeListItem(entry)}
              onClick={() => onChange(value.filter((item) => item !== entry))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="pref-chips__input"
          placeholder={labels.addListItem}
          value={draft}
          onChange={(event) => {
            const next = event.target.value;
            if (next.endsWith(",")) commit(next);
            else setDraft(next);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(draft);
            }
            if (event.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => commit(draft)}
        />
      </div>
    </div>
  );
}

function chatModelsStatusLabel(state: ChatModelsState, labels: SettingsCopy): string {
  switch (state.status) {
    case "loading":
      return labels.chatModelsLoading;
    case "success":
      return state.models.length ? labels.chatModelsLoaded(state.models.length) : labels.chatModelsEmpty;
    case "error":
      return `${labels.chatModelsError}: ${state.error ?? labels.none}`;
    case "idle":
    default:
      return labels.chatModelsIdle;
  }
}

function ChatModelControl({
  value,
  labels,
  modelsState,
  placeholder,
  onChange,
  onRefresh
}: {
  value: string;
  labels: SettingsCopy;
  modelsState: ChatModelsState;
  placeholder: string;
  onChange: (value: string) => void;
  onRefresh: () => void;
}): JSX.Element {
  return (
    <div className="chat-model-control">
      <TextControl value={value} placeholder={placeholder} onChange={onChange} />
      <div className="chat-model-control__bar">
        <span>{chatModelsStatusLabel(modelsState, labels)}</span>
        <button
          type="button"
          className="pref-chip-button"
          disabled={modelsState.status === "loading"}
          onClick={onRefresh}
        >
          {labels.refreshChatModels}
        </button>
      </div>
      {modelsState.models.length ? (
        <div className="chat-model-list" aria-label={labels.chatModelList}>
          {modelsState.models.map((model) => (
            <button
              key={model.id}
              type="button"
              className={`chat-model-option${model.id === value ? " is-selected" : ""}`}
              onClick={() => onChange(model.id)}
            >
              <span>{model.id}</span>
              {model.ownedBy ? <small>{model.ownedBy}</small> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  unit
}: {
  label: string;
  value: number;
  unit?: string;
}): JSX.Element {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </strong>
    </div>
  );
}

function formatDurationMs(durationMs: number | null, language: string, labels: SettingsCopy): string {
  if (durationMs === null) return labels.none;
  const totalMinutes = Math.max(0, Math.floor(durationMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours}${labels.hourUnit}`);
  if (minutes || !parts.length) parts.push(`${minutes}${labels.minuteUnit}`);
  return parts.join(language === "zh-CN" ? "" : " ");
}

function formatCountdown(timestamp: number | null, now: number, language: string, labels: SettingsCopy): string {
  if (!timestamp) return labels.none;
  const remainingMs = timestamp - now;
  if (remainingMs <= 0) return labels.now;
  return formatDurationMs(remainingMs, language, labels);
}

function formatDateTime(timestamp: number | null, language: string, labels: SettingsCopy): string {
  if (!timestamp) return labels.never;
  return new Intl.DateTimeFormat(localeFor(resolveLanguage(language)), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(timestamp);
}

export function SettingsView(): JSX.Element {
  const snapshot = useSnapshot();
  const { settings, stats } = snapshot;
  const [draft, setDraft] = useState(settings);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [chatModelsState, setChatModelsState] = useState<ChatModelsState>({
    status: "idle",
    models: []
  });
  const chatModelsRequestId = useRef(0);
  const now = useNow();
  const savedSettingsKey = JSON.stringify(settings);
  const lastSyncedSettingsKey = useRef(savedSettingsKey);
  const language = resolveLanguage(draft.language);
  const labels = i18n(language).settings;
  const chatSession = snapshot.chatCompanion.session;
  const chatDurationMs = chatSession
    ? (chatSession.endedAt ?? now) - chatSession.startedAt
    : null;
  const chatSessionStatus = !chatSession
    ? labels.none
    : snapshot.chatCompanion.active
      ? labels.sessionActive
      : chatSession.endedAt
        ? labels.sessionEnded
        : labels.sessionInactive;
  const chatHistoryJson = useMemo(
    () => JSON.stringify(chatSession?.messages ?? [], null, 2),
    [chatSession]
  );

  const petAvatar = useMemo(
    () => getPetAsset(resolvePetAppearanceId(draft.petAppearanceId), "happy"),
    [draft.petAppearanceId]
  );

  useEffect(() => {
    if (savedSettingsKey === lastSyncedSettingsKey.current) return;
    lastSyncedSettingsKey.current = savedSettingsKey;
    setDraft(settings);
    setSettingsDirty(false);
  }, [savedSettingsKey]);

  useEffect(() => {
    if (!settingsDirty) return;
    const timer = window.setTimeout(() => {
      window.pawpal.updateSettings(draft);
      setSettingsDirty(false);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, settingsDirty]);

  useEffect(() => {
    if (!draft.chatCompanionEnabled) {
      chatModelsRequestId.current += 1;
      setChatModelsState({ status: "idle", models: [] });
      return;
    }
    const timer = window.setTimeout(() => {
      void refreshChatModels();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [draft.chatCompanionEnabled, draft.chatProviderId, draft.chatBaseUrl, draft.chatApiKey]);

  function updateDraft(partial: Partial<Settings>): void {
    setDraft((current) => ({ ...current, ...partial }));
    setSettingsDirty(true);
  }

  async function refreshChatModels(): Promise<void> {
    const requestId = chatModelsRequestId.current + 1;
    chatModelsRequestId.current = requestId;
    const settingsForRequest = { ...draft };
    if (!settingsForRequest.chatBaseUrl.trim()) {
      setChatModelsState({ status: "idle", models: [] });
      return;
    }
    setChatModelsState((current) => ({ ...current, status: "loading", error: undefined }));
    const result = await window.pawpal.listChatModels(settingsForRequest);
    if (chatModelsRequestId.current !== requestId) return;
    if (result.ok) {
      setChatModelsState({ status: "success", models: result.models });
      return;
    }
    setChatModelsState({ status: "error", models: [], error: result.error });
  }

  function updateChatProvider(value: string): void {
    const chatProviderId = (
      value in CHAT_PROVIDER_PRESETS ? value : DEFAULT_SETTINGS.chatProviderId
    ) as ChatProviderId;
    const preset = CHAT_PROVIDER_PRESETS[chatProviderId];
    updateDraft({
      chatProviderId,
      chatBaseUrl: preset.baseUrl,
      chatApiKey: "",
      chatModel: preset.model,
      chatThinkingPrefix: preset.thinkingPrefix
    });
  }

  function resetChatSettings(): void {
    updateDraft({
      chatProviderId: DEFAULT_SETTINGS.chatProviderId,
      chatBaseUrl: DEFAULT_SETTINGS.chatBaseUrl,
      chatApiKey: DEFAULT_SETTINGS.chatApiKey,
      chatModel: DEFAULT_SETTINGS.chatModel,
      chatThinkingPrefix: DEFAULT_SETTINGS.chatThinkingPrefix,
      chatSystemPrompt: DEFAULT_SETTINGS.chatSystemPrompt,
      chatCompanionInactivityMinutes: DEFAULT_SETTINGS.chatCompanionInactivityMinutes,
      chatSessionExpiryHours: DEFAULT_SETTINGS.chatSessionExpiryHours
    });
  }

  return (
    <main className="prefs">
      <header className="prefs__head">
        <img className="prefs__avatar" src={petAvatar.src} alt="" />
        <div className="prefs__intro">
          <p className="prefs__eyebrow">PawPal</p>
          <h1 className="prefs__title">{labels.today}</h1>
        </div>
      </header>

      <section className="prefs__stats" aria-label={labels.today}>
        <StatCard label={labels.breaks} value={stats.breaksTaken} unit={labels.countUnit} />
        <StatCard label={labels.waters} value={stats.watersLogged} unit={labels.countUnit} />
        <StatCard label={labels.focusMin} value={stats.focusMinutes} unit={labels.minuteUnit} />
        <StatCard label={labels.warnings} value={stats.focusWarnings} unit={labels.countUnit} />
      </section>

      {!draft.onboardingDismissed ? (
        <aside className="prefs__welcome">
          <p>
            <strong>{labels.welcomeTitle}.</strong> {labels.welcomeCopy}
          </p>
          <button
            type="button"
            className="text-link"
            onClick={() => updateDraft({ onboardingDismissed: true })}
          >
            {labels.dismissWelcome}
          </button>
        </aside>
      ) : null}

      <section className="prefs__group">
        <h2 className="prefs__group-title">{labels.appearance}</h2>
        <Row
          label={labels.language}
          control={
            <SelectControl
              value={language}
              options={[...LANGUAGE_OPTIONS]}
              onChange={(value) => updateDraft({ language: resolveLanguage(value) })}
            />
          }
        />
        <div className="pref-block">
          <span className="pref-block__label">{labels.petAppearance}</span>
          <div className="pet-picker">
            {petAppearanceOptions(language).map((option) => (
              <PetCard
                key={option.value}
                appearanceId={option.value}
                label={option.label}
                selected={resolvePetAppearanceId(draft.petAppearanceId) === option.value}
                onSelect={() =>
                  updateDraft({ petAppearanceId: resolvePetAppearanceId(option.value) })
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section className="prefs__group">
        <h2 className="prefs__group-title">{labels.reminders}</h2>
        <Row
          label={labels.enableBreakReminder}
          control={
            <ToggleControl
              checked={draft.breakReminderEnabled}
              onChange={(breakReminderEnabled) => updateDraft({ breakReminderEnabled })}
              ariaLabel={labels.enableBreakReminder}
            />
          }
        />
        <Row
          label={labels.breakInterval}
          control={
            <NumberControl
              value={draft.breakIntervalMinutes}
              min={1}
              max={180}
              unit={labels.minuteUnit}
              onChange={(breakIntervalMinutes) => updateDraft({ breakIntervalMinutes })}
            />
          }
        />
        <Row
          label={labels.enableHydrationReminder}
          control={
            <ToggleControl
              checked={draft.hydrationReminderEnabled}
              onChange={(hydrationReminderEnabled) => updateDraft({ hydrationReminderEnabled })}
              ariaLabel={labels.enableHydrationReminder}
            />
          }
        />
        <Row
          label={labels.hydrationInterval}
          control={
            <NumberControl
              value={draft.hydrationIntervalMinutes}
              min={1}
              max={240}
              unit={labels.minuteUnit}
              onChange={(hydrationIntervalMinutes) => updateDraft({ hydrationIntervalMinutes })}
            />
          }
        />
      </section>

      <section className="prefs__group">
        <h2 className="prefs__group-title">{labels.focus}</h2>
        <Row
          label={labels.focusDuration}
          control={
            <NumberControl
              value={draft.focusDurationMinutes}
              min={1}
              max={120}
              unit={labels.minuteUnit}
              onChange={(focusDurationMinutes) => updateDraft({ focusDurationMinutes })}
            />
          }
        />
        <Row
          label={labels.enableDistractionDetection}
          hint={
            draft.distractionDetectionEnabled
              ? labels.detectionFocusHelp
              : labels.detectionOffHelp
          }
          control={
            <ToggleControl
              checked={draft.distractionDetectionEnabled}
              onChange={(distractionDetectionEnabled) => updateDraft({ distractionDetectionEnabled })}
              ariaLabel={labels.enableDistractionDetection}
            />
          }
        />
        {draft.distractionDetectionEnabled ? (
          <>
            <Row
              label={labels.detectionGrace}
              control={
                <NumberControl
                  value={draft.distractionGraceSeconds}
                  min={0}
                  max={120}
                  unit={labels.secondUnit}
                  onChange={(distractionGraceSeconds) => updateDraft({ distractionGraceSeconds })}
                />
              }
            />
            <Row
              label={labels.blockedApps}
              control={
                <ChipsControl
                  value={draft.distractionBlockedApps}
                  labels={labels}
                  onChange={(distractionBlockedApps) => updateDraft({ distractionBlockedApps })}
                />
              }
            />
            <Row
              label={labels.blockedKeywords}
              control={
                <ChipsControl
                  value={draft.distractionBlockedKeywords}
                  labels={labels}
                  onChange={(distractionBlockedKeywords) => updateDraft({ distractionBlockedKeywords })}
                />
              }
            />
          </>
        ) : null}
        <div className="prefs__inline-actions">
          {snapshot.focusActive ? (
            <button type="button" className="pref-button" onClick={window.pawpal.stopFocus}>
              {labels.stopFocus}
            </button>
          ) : (
            <button type="button" className="pref-button is-primary" onClick={window.pawpal.startFocus}>
              {labels.startFocus}
            </button>
          )}
        </div>
      </section>

      <section className="prefs__group">
        <h2 className="prefs__group-title">{labels.companion}</h2>
        <Row
          label={labels.enableChatCompanion}
          control={
            <ToggleControl
              checked={draft.chatCompanionEnabled}
              onChange={(chatCompanionEnabled) => updateDraft({ chatCompanionEnabled })}
              ariaLabel={labels.enableChatCompanion}
            />
          }
        />
        {draft.chatCompanionEnabled ? (
          <>
            <Row
              label={labels.chatProvider}
              hint={labels.chatProviderHelp}
              control={
                <SelectControl
                  value={draft.chatProviderId}
                  options={[
                    { value: "openai", label: labels.chatProviderOpenAi },
                    { value: "gemini", label: labels.chatProviderGemini },
                    { value: "kimi", label: labels.chatProviderKimi },
                    { value: "deepseek", label: labels.chatProviderDeepSeek },
                    { value: "openclaw", label: labels.chatProviderOpenClaw },
                    { value: "openai-compatible", label: labels.chatProviderOpenAiCompatible }
                  ]}
                  onChange={updateChatProvider}
                />
              }
            />
            <Row
              label={labels.chatBaseUrl}
              hint={labels.chatBaseUrlHelp}
              control={
                <TextControl
                  type="url"
                  value={draft.chatBaseUrl}
                  placeholder={CHAT_PROVIDER_PRESETS[draft.chatProviderId].baseUrl}
                  onChange={(chatBaseUrl) => updateDraft({ chatBaseUrl })}
                />
              }
            />
            <Row
              label={labels.chatApiKey}
              hint={labels.chatApiKeyHelp}
              control={
                <TextControl
                  type="password"
                  value={draft.chatApiKey}
                  onChange={(chatApiKey) => updateDraft({ chatApiKey })}
                />
              }
            />
            <Row
              label={labels.chatModel}
              hint={labels.chatModelHelp}
              control={
                <ChatModelControl
                  value={draft.chatModel}
                  labels={labels}
                  modelsState={chatModelsState}
                  placeholder={CHAT_PROVIDER_PRESETS[draft.chatProviderId].model}
                  onChange={(chatModel) => updateDraft({ chatModel })}
                  onRefresh={() => void refreshChatModels()}
                />
              }
            />
            <Row
              label={labels.chatThinkingPrefix}
              hint={labels.chatThinkingPrefixHelp}
              control={
                <TextControl
                  value={draft.chatThinkingPrefix}
                  placeholder={CHAT_PROVIDER_PRESETS[draft.chatProviderId].thinkingPrefix}
                  onChange={(chatThinkingPrefix) => updateDraft({ chatThinkingPrefix })}
                />
              }
            />
            <Row
              label={labels.chatCompanionInactivity}
              hint={labels.chatCompanionInactivityHelp}
              control={
                <NumberControl
                  value={draft.chatCompanionInactivityMinutes}
                  min={1}
                  max={120}
                  unit={labels.minuteUnit}
                  onChange={(chatCompanionInactivityMinutes) =>
                    updateDraft({ chatCompanionInactivityMinutes })
                  }
                />
              }
            />
            <Row
              label={labels.chatSessionExpiry}
              hint={labels.chatSessionExpiryHelp}
              control={
                <NumberControl
                  value={draft.chatSessionExpiryHours}
                  min={1}
                  max={168}
                  unit={labels.hourUnit}
                  onChange={(chatSessionExpiryHours) =>
                    updateDraft({ chatSessionExpiryHours })
                  }
                />
              }
            />
            <Row
              label={labels.chatSystemPrompt}
              hint={labels.chatSystemPromptHelp}
              control={
                <TextAreaControl
                  value={draft.chatSystemPrompt}
                  onChange={(chatSystemPrompt) => updateDraft({ chatSystemPrompt })}
                />
              }
            />
          </>
        ) : null}
        <div className="prefs__inline-actions">
          <button type="button" className="pref-button" onClick={resetChatSettings}>
            {labels.resetChatSettings}
          </button>
        </div>
      </section>

      {!window.pawpal.isPackaged && (
        <section className="prefs__group">
          <h2 className="prefs__group-title">{labels.testTools}</h2>
          <div className="test-tools">
            <DemoChip trigger="break" label={labels.demoBreak} />
            <DemoChip trigger="hydration" label={labels.demoWater} />
            <DemoChip trigger="focusWarning" label={labels.demoFocusWarning} />
            <DemoChip trigger="happy" label={labels.demoHappy} />
            <button type="button" className="pref-chip-button" onClick={window.pawpal.resetToday}>
              {labels.resetToday}
            </button>
          </div>
        </section>
      )}

      <section className="prefs__group prefs__group--quiet">
        <button
          type="button"
          className="prefs__disclosure"
          onClick={() => setDiagnosticsOpen((open) => !open)}
          aria-expanded={diagnosticsOpen}
        >
          <span>{labels.diagnostics}</span>
          <span className="prefs__disclosure-caret">{diagnosticsOpen ? "▾" : "▸"}</span>
        </button>
        {diagnosticsOpen ? (
          <div className="prefs__diag">
            <DiagGroup title={labels.runtime}>
              <DiagCard label={labels.state} value={snapshot.petState} />
              <DiagCard
                label={labels.mode}
                value={
                  snapshot.focusActive
                    ? labels.focus
                    : labels.idle
                }
              />
              <DiagCard label={labels.reminder} value={snapshot.blockingMode ?? labels.none} />
              <DiagCard
                label={labels.pawpal}
                value={snapshot.pawpalVisible ? labels.visible : labels.hidden}
              />
            </DiagGroup>

            <DiagGroup title={labels.distraction}>
              <DiagCard
                label={labels.status}
                value={formatDistractionState(snapshot.distraction.state, labels)}
              />
              <DiagCard
                label={labels.matched}
                value={snapshot.distraction.matchedRule ?? labels.none}
              />
              <DiagCard
                label={labels.app}
                value={snapshot.distraction.activeApp || labels.none}
              />
              <DiagCard
                label={labels.checked}
                value={formatTimestamp(snapshot.distraction.lastCheckedAt, language, labels)}
              />
            </DiagGroup>

            {snapshot.distraction.activeWindowTitle ? (
              <p className="prefs__diag-note">{snapshot.distraction.activeWindowTitle}</p>
            ) : null}
            <p className="prefs__diag-hint">{distractionHelp(snapshot, labels)}</p>

            <DiagGroup title={labels.timers}>
              <DiagCard
                label={labels.break}
                value={formatTimer(snapshot.timers.breakDueAt, now, language, labels)}
              />
              <DiagCard
                label={labels.water}
                value={formatTimer(snapshot.timers.hydrationDueAt, now, language, labels)}
              />
              <DiagCard
                label={labels.focusEnd}
                value={formatTimer(snapshot.timers.focusEndsAt, now, language, labels)}
              />
              <DiagCard
                label={labels.updated}
                value={new Intl.DateTimeFormat(localeFor(language), {
                  hour: "2-digit",
                  minute: "2-digit"
                }).format(now)}
              />
            </DiagGroup>

            <DiagGroup title={labels.chatCompanionDiagnostics}>
              <DiagCard label={labels.sessionStatus} value={chatSessionStatus} />
              <DiagCard
                label={labels.sessionCreated}
                value={formatDateTime(chatSession?.startedAt ?? null, language, labels)}
              />
              <DiagCard
                label={labels.sessionDuration}
                value={formatDurationMs(chatDurationMs, language, labels)}
              />
              <DiagCard
                label={labels.conversationRounds}
                value={String(snapshot.chatCompanion.conversationRounds)}
              />
              <DiagCard
                label={labels.resetCountdown}
                value={formatCountdown(snapshot.chatCompanion.resetDueAt, now, language, labels)}
              />
            </DiagGroup>

            <div className="prefs__diag-json">
              <h3 className="prefs__diag-json-title">{labels.sessionHistory}</h3>
              <pre>{chatHistoryJson}</pre>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function PetCard({
  appearanceId,
  label,
  selected,
  onSelect
}: {
  appearanceId: PetAppearanceId;
  label: string;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const asset = useMemo(() => getPetAsset(appearanceId, "idle"), [appearanceId]);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`pet-card${selected ? " is-selected" : ""}`}
      onClick={onSelect}
    >
      <span className="pet-card__preview">
        <img src={asset.src} alt="" />
      </span>
      <span className="pet-card__name">{label}</span>
    </button>
  );
}

function DemoChip({ trigger, label }: { trigger: DemoTrigger; label: string }): JSX.Element {
  return (
    <button
      type="button"
      className="pref-chip-button"
      onClick={() => window.pawpal.triggerDemo(trigger)}
    >
      {label}
    </button>
  );
}

function DiagGroup({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="diag-group">
      <h3 className="diag-group__title">{title}</h3>
      <div className="diag-group__grid">{children}</div>
    </section>
  );
}

function DiagCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="diag-card">
      <span className="diag-card__label">{label}</span>
      <span className="diag-card__value">{value}</span>
    </div>
  );
}
