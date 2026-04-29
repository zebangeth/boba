import { useEffect, useState } from "react";
import type { JSX } from "react";
import { i18n, LANGUAGE_OPTIONS, resolveLanguage } from "../../../shared/i18n";
import { petAppearanceOptions, resolvePetAppearanceId } from "../../../shared/petAppearances";
import type { DemoTrigger, Settings } from "../../../shared/types";
import { distractionHelp, formatTimer, formatTimestamp, localeFor } from "../format";
import { useNow, useSnapshot } from "../hooks";
import { ListField, NumberField, SelectField, ToggleField } from "./FormFields";

function DemoButton({
  trigger,
  children
}: {
  trigger: DemoTrigger;
  children: string;
}): JSX.Element {
  return (
    <button className="command-button" type="button" onClick={() => window.pawse.triggerDemo(trigger)}>
      {children}
    </button>
  );
}

export function SettingsView(): JSX.Element {
  const snapshot = useSnapshot();
  const { settings, stats } = snapshot;
  const [draft, setDraft] = useState(settings);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const now = useNow();
  const savedSettingsKey = JSON.stringify(settings);
  const language = resolveLanguage(draft.language);
  const labels = i18n(language).settings;

  useEffect(() => {
    setDraft(settings);
    setSettingsDirty(false);
  }, [savedSettingsKey, settings]);

  function updateDraft(partial: Partial<Settings>): void {
    setDraft((current) => ({ ...current, ...partial }));
    setSettingsDirty(true);
  }

  function save(): void {
    window.pawse.updateSettings(draft);
    setSettingsDirty(false);
  }

  return (
    <main className="settings-shell">
      <header>
        <p className="eyebrow">Pawse</p>
        <h1>{labels.title}</h1>
      </header>

      <section className="settings-section">
        <SelectField
          label={labels.language}
          value={language}
          options={LANGUAGE_OPTIONS}
          onChange={(value) => updateDraft({ language: resolveLanguage(value) })}
        />
        <SelectField
          label={labels.petAppearance}
          value={resolvePetAppearanceId(draft.petAppearanceId)}
          options={petAppearanceOptions(language)}
          onChange={(value) => updateDraft({ petAppearanceId: resolvePetAppearanceId(value) })}
        />
      </section>

      <section className="settings-section">
        <h2>{labels.reminders}</h2>
        <ToggleField
          label={labels.enableBreakReminder}
          checked={draft.breakReminderEnabled}
          onChange={(breakReminderEnabled) => updateDraft({ breakReminderEnabled })}
        />
        <NumberField
          label={labels.breakInterval}
          value={draft.breakIntervalMinutes}
          min={1}
          max={180}
          onChange={(breakIntervalMinutes) => updateDraft({ breakIntervalMinutes })}
        />
        <ToggleField
          label={labels.enableHydrationReminder}
          checked={draft.hydrationReminderEnabled}
          onChange={(hydrationReminderEnabled) => updateDraft({ hydrationReminderEnabled })}
        />
        <NumberField
          label={labels.hydrationInterval}
          value={draft.hydrationIntervalMinutes}
          min={1}
          max={240}
          onChange={(hydrationIntervalMinutes) => updateDraft({ hydrationIntervalMinutes })}
        />
      </section>

      <section className="settings-section">
        <h2>{labels.focus}</h2>
        <NumberField
          label={labels.focusDuration}
          value={draft.focusDurationMinutes}
          min={1}
          max={120}
          onChange={(focusDurationMinutes) => updateDraft({ focusDurationMinutes })}
        />
        <ToggleField
          label={labels.enableDistractionDetection}
          checked={draft.distractionDetectionEnabled}
          onChange={(distractionDetectionEnabled) => updateDraft({ distractionDetectionEnabled })}
        />
        <NumberField
          label={labels.detectionGrace}
          value={draft.distractionGraceSeconds}
          min={0}
          max={120}
          onChange={(distractionGraceSeconds) => updateDraft({ distractionGraceSeconds })}
        />
        <ListField
          label={labels.blockedApps}
          value={draft.distractionBlockedApps}
          onChange={(distractionBlockedApps) => updateDraft({ distractionBlockedApps })}
        />
        <ListField
          label={labels.blockedKeywords}
          value={draft.distractionBlockedKeywords}
          onChange={(distractionBlockedKeywords) => updateDraft({ distractionBlockedKeywords })}
        />
        <ToggleField
          label={labels.enableSoundEffects}
          checked={draft.soundEnabled}
          onChange={(soundEnabled) => updateDraft({ soundEnabled })}
        />
      </section>

      <section className="settings-section">
        <h2>{labels.today}</h2>
        <dl className="stats-grid">
          <div>
            <dt>{labels.breaks}</dt>
            <dd>{stats.breaksTaken}</dd>
          </div>
          <div>
            <dt>{labels.waters}</dt>
            <dd>{stats.watersLogged}</dd>
          </div>
          <div>
            <dt>{labels.focusMin}</dt>
            <dd>{stats.focusMinutes}</dd>
          </div>
          <div>
            <dt>{labels.warnings}</dt>
            <dd>{stats.focusWarnings}</dd>
          </div>
        </dl>
      </section>

      <section className="settings-section">
        <h2>{labels.runtime}</h2>
        <dl className="runtime-grid">
          <div>
            <dt>{labels.state}</dt>
            <dd>{snapshot.petState}</dd>
          </div>
          <div>
            <dt>{labels.mode}</dt>
            <dd>{snapshot.focusActive ? labels.focus : snapshot.petParked ? labels.parked : labels.walking}</dd>
          </div>
          <div>
            <dt>{labels.reminder}</dt>
            <dd>{snapshot.blockingMode ?? labels.none}</dd>
          </div>
          <div>
            <dt>{labels.dog}</dt>
            <dd>{snapshot.dogVisible ? labels.visible : labels.hidden}</dd>
          </div>
        </dl>
      </section>

      <section className="settings-section">
        <h2>{labels.distraction}</h2>
        <dl className="runtime-grid">
          <div>
            <dt>{labels.status}</dt>
            <dd>{snapshot.distraction.state}</dd>
          </div>
          <div>
            <dt>{labels.matched}</dt>
            <dd>{snapshot.distraction.matchedRule ?? labels.none}</dd>
          </div>
          <div>
            <dt>{labels.app}</dt>
            <dd>{snapshot.distraction.activeApp || labels.none}</dd>
          </div>
          <div>
            <dt>{labels.checked}</dt>
            <dd>{formatTimestamp(snapshot.distraction.lastCheckedAt, language, labels)}</dd>
          </div>
        </dl>
        <p className="diagnostic-copy">
          {snapshot.distraction.activeWindowTitle || labels.noActiveWindowTitle}
        </p>
        <p className="diagnostic-copy warning-copy">{distractionHelp(snapshot, labels)}</p>
      </section>

      <section className="settings-section">
        <h2>{labels.timers}</h2>
        <dl className="runtime-grid">
          <div>
            <dt>{labels.break}</dt>
            <dd>{formatTimer(snapshot.timers.breakDueAt, now, language, labels)}</dd>
          </div>
          <div>
            <dt>{labels.water}</dt>
            <dd>{formatTimer(snapshot.timers.hydrationDueAt, now, language, labels)}</dd>
          </div>
          <div>
            <dt>{labels.focusEnd}</dt>
            <dd>{formatTimer(snapshot.timers.focusEndsAt, now, language, labels)}</dd>
          </div>
          <div>
            <dt>{labels.updated}</dt>
            <dd>
              {new Intl.DateTimeFormat(localeFor(language), {
                hour: "2-digit",
                minute: "2-digit"
              }).format(now)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="settings-section">
        <h2>{labels.demo}</h2>
        <div className="demo-grid">
          <DemoButton trigger="break">{labels.demoBreak}</DemoButton>
          <DemoButton trigger="hydration">{labels.demoWater}</DemoButton>
          <DemoButton trigger="focusWarning">{labels.demoFocusWarning}</DemoButton>
          <DemoButton trigger="happy">{labels.demoHappy}</DemoButton>
        </div>
      </section>

      <footer className="settings-actions">
        <button className="secondary-action" type="button" onClick={window.pawse.resetToday}>
          {labels.resetToday}
        </button>
        <button className="secondary-action" type="button" onClick={window.pawse.startFocus}>
          {labels.startFocus}
        </button>
        <button className="secondary-action" type="button" onClick={window.pawse.stopFocus}>
          {labels.stopFocus}
        </button>
        <button className="secondary-action" type="button" onClick={window.pawse.resumeWalking}>
          {labels.resumeWalk}
        </button>
        <button className="primary-action" type="button" disabled={!settingsDirty} onClick={save}>
          {labels.save}
        </button>
      </footer>
    </main>
  );
}
