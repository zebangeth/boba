import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX, PointerEvent } from "react";
import type {
  AppSnapshot,
  DemoTrigger,
  PetState,
  Settings,
  SpeechBubble,
  TodayStats
} from "../../shared/types";

type PawseWindow = Window & { pawse?: Window["pawse"] };

function pawseApi(): Window["pawse"] | undefined {
  return (window as PawseWindow).pawse;
}

function createAssetUrls(): Record<PetState, string> {
  return {
    walking: window.pawse.assetUrl("lovart_footage/puppy/1 - playing outside.gif"),
    idle: window.pawse.assetUrl("lovart_footage/puppy/standing pose.gif"),
    sitting: window.pawse.assetUrl("lovart_footage/puppy/3 - welcome to work.gif"),
    happy: window.pawse.assetUrl("lovart_footage/puppy/1 - waiting for playing outside.gif"),
    knocking: window.pawse.assetUrl("lovart_footage/puppy/2 - standing reminder.gif"),
    thirsty: window.pawse.assetUrl("lovart_footage/water_gifs/want_water.gif"),
    drinking: window.pawse.assetUrl("lovart_footage/water_gifs/got_water.gif"),
    focusGuard: window.pawse.assetUrl("lovart_footage/puppy/standing pose4.gif"),
    annoyed: window.pawse.assetUrl("lovart_footage/puppy/4 - sleeping.gif")
  };
}

const initialSettings: Settings = {
  breakReminderEnabled: true,
  breakIntervalMinutes: 45,
  hydrationReminderEnabled: true,
  hydrationIntervalMinutes: 90,
  focusDurationMinutes: 25,
  distractionDetectionEnabled: false,
  soundEnabled: false
};

const initialStats: TodayStats = {
  date: "",
  breaksTaken: 0,
  watersLogged: 0,
  focusMinutes: 0,
  focusWarnings: 0
};

type DragRef = {
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
};

function useSnapshot(): AppSnapshot {
  const [snapshot, setSnapshot] = useState<AppSnapshot>({
    settings: initialSettings,
    stats: initialStats,
    timers: {
      breakDueAt: null,
      hydrationDueAt: null,
      focusEndsAt: null
    },
    petState: "walking",
    blockingMode: null,
    focusActive: false,
    petParked: false,
    dogVisible: true
  });

  useEffect(() => {
    let mounted = true;
    void window.pawse.getSnapshot().then((next) => {
      if (mounted) setSnapshot(next);
    });
    const offPet = window.pawse.onPetState((petState) =>
      setSnapshot((current) => ({ ...current, petState }))
    );
    const offSettings = window.pawse.onSettingsUpdated((settings) =>
      setSnapshot((current) => ({ ...current, settings }))
    );
    const offStats = window.pawse.onStatsUpdated((stats) =>
      setSnapshot((current) => ({ ...current, stats }))
    );
    const offSnapshot = window.pawse.onSnapshot(setSnapshot);
    return () => {
      mounted = false;
      offPet();
      offSettings();
      offStats();
      offSnapshot();
    };
  }, []);

  return snapshot;
}

function useNow(refreshMs = 30_000): number {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), refreshMs);
    return () => window.clearInterval(timer);
  }, [refreshMs]);

  return now;
}

function formatTimer(timestamp: number | null, now: number): string {
  if (!timestamp) return "off";
  const remainingMs = timestamp - now;
  const absolute = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(timestamp);
  if (remainingMs <= 0) return `${absolute} now`;
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return `${absolute} (${remainingMinutes}m)`;
}

function PetView(): JSX.Element {
  const snapshot = useSnapshot();
  const [bubble, setBubble] = useState<SpeechBubble | null>(null);
  const assetUrls = useMemo(createAssetUrls, []);
  const dragRef = useRef<DragRef | null>(null);

  useEffect(() => {
    const offBubble = window.pawse.onShowBubble(setBubble);
    const offHide = window.pawse.onHideBubble(() => setBubble(null));
    return () => {
      offBubble();
      offHide();
    };
  }, []);

  const state = snapshot.petState;
  const altText = `Pawse ${state}`;

  function startPointer(event: PointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false
    };
  }

  function movePointer(event: PointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.dragging && distance > 4) {
      drag.dragging = true;
      window.pawse.petDragStart({ offsetX: drag.startX, offsetY: drag.startY });
    }
  }

  function stopPointer(event: PointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    if (drag.dragging) {
      window.pawse.petDragStop();
      return;
    }
    window.pawse.petClicked();
  }

  function cancelPointer(event: PointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.dragging) window.pawse.petDragStop();
  }

  return (
    <main
      className="pet-shell"
      aria-label="Pawse desktop pet"
      onContextMenu={(event) => {
        event.preventDefault();
        window.pawse.petContextMenu();
      }}
    >
      {bubble ? (
        <section className="speech-bubble">
          <p>{bubble.message}</p>
          {bubble.actions?.length ? (
            <div className="bubble-actions">
              {bubble.actions.map((action) => (
                <button
                  className={`bubble-button ${action.kind ?? "secondary"}`}
                  key={action.id}
                  onClick={() => window.pawse.bubbleAction(action.id)}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {snapshot.focusActive && state === "focusGuard" ? (
        <div className="focus-badge">Focus</div>
      ) : null}

      <button
        className={`pet-button state-${state}`}
        onPointerCancel={cancelPointer}
        onPointerDown={startPointer}
        onPointerMove={movePointer}
        onPointerUp={stopPointer}
        type="button"
      >
        <img draggable={false} src={assetUrls[state]} alt={altText} />
      </button>
    </main>
  );
}

function ToggleField({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}): JSX.Element {
  return (
    <label className="number-row">
      <span>{label}</span>
      <input
        min={min}
        max={max}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

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

function SettingsView(): JSX.Element {
  const snapshot = useSnapshot();
  const { settings, stats } = snapshot;
  const [draft, setDraft] = useState(settings);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const now = useNow();

  useEffect(() => {
    setDraft(settings);
    setSettingsDirty(false);
  }, [settings]);

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
        <h1>Settings</h1>
      </header>

      <section className="settings-section">
        <h2>Reminders</h2>
        <ToggleField
          label="Enable Break Reminder"
          checked={draft.breakReminderEnabled}
          onChange={(breakReminderEnabled) => updateDraft({ breakReminderEnabled })}
        />
        <NumberField
          label="Break Interval"
          value={draft.breakIntervalMinutes}
          min={1}
          max={180}
          onChange={(breakIntervalMinutes) => updateDraft({ breakIntervalMinutes })}
        />
        <ToggleField
          label="Enable Hydration Reminder"
          checked={draft.hydrationReminderEnabled}
          onChange={(hydrationReminderEnabled) => updateDraft({ hydrationReminderEnabled })}
        />
        <NumberField
          label="Hydration Interval"
          value={draft.hydrationIntervalMinutes}
          min={1}
          max={240}
          onChange={(hydrationIntervalMinutes) => updateDraft({ hydrationIntervalMinutes })}
        />
      </section>

      <section className="settings-section">
        <h2>Focus</h2>
        <NumberField
          label="Focus Duration"
          value={draft.focusDurationMinutes}
          min={1}
          max={120}
          onChange={(focusDurationMinutes) => updateDraft({ focusDurationMinutes })}
        />
        <ToggleField
          label="Enable Distraction Detection"
          checked={draft.distractionDetectionEnabled}
          onChange={(distractionDetectionEnabled) => updateDraft({ distractionDetectionEnabled })}
        />
        <ToggleField
          label="Enable Sound Effects"
          checked={draft.soundEnabled}
          onChange={(soundEnabled) => updateDraft({ soundEnabled })}
        />
      </section>

      <section className="settings-section">
        <h2>Today</h2>
        <dl className="stats-grid">
          <div>
            <dt>Breaks</dt>
            <dd>{stats.breaksTaken}</dd>
          </div>
          <div>
            <dt>Waters</dt>
            <dd>{stats.watersLogged}</dd>
          </div>
          <div>
            <dt>Focus min</dt>
            <dd>{stats.focusMinutes}</dd>
          </div>
          <div>
            <dt>Warnings</dt>
            <dd>{stats.focusWarnings}</dd>
          </div>
        </dl>
      </section>

      <section className="settings-section">
        <h2>Runtime</h2>
        <dl className="runtime-grid">
          <div>
            <dt>State</dt>
            <dd>{snapshot.petState}</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{snapshot.focusActive ? "focus" : snapshot.petParked ? "parked" : "walking"}</dd>
          </div>
          <div>
            <dt>Reminder</dt>
            <dd>{snapshot.blockingMode ?? "none"}</dd>
          </div>
          <div>
            <dt>Dog</dt>
            <dd>{snapshot.dogVisible ? "visible" : "hidden"}</dd>
          </div>
        </dl>
      </section>

      <section className="settings-section">
        <h2>Timers</h2>
        <dl className="runtime-grid">
          <div>
            <dt>Break</dt>
            <dd>{formatTimer(snapshot.timers.breakDueAt, now)}</dd>
          </div>
          <div>
            <dt>Water</dt>
            <dd>{formatTimer(snapshot.timers.hydrationDueAt, now)}</dd>
          </div>
          <div>
            <dt>Focus End</dt>
            <dd>{formatTimer(snapshot.timers.focusEndsAt, now)}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>
              {new Intl.DateTimeFormat(undefined, {
                hour: "2-digit",
                minute: "2-digit"
              }).format(now)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="settings-section">
        <h2>Demo</h2>
        <div className="demo-grid">
          <DemoButton trigger="break">Break</DemoButton>
          <DemoButton trigger="hydration">Water</DemoButton>
          <DemoButton trigger="focusWarning">Focus Warning</DemoButton>
          <DemoButton trigger="happy">Happy</DemoButton>
        </div>
      </section>

      <footer className="settings-actions">
        <button className="secondary-action" type="button" onClick={window.pawse.resetToday}>
          Reset Today
        </button>
        <button className="secondary-action" type="button" onClick={window.pawse.startFocus}>
          Start Focus
        </button>
        <button className="secondary-action" type="button" onClick={window.pawse.stopFocus}>
          Stop Focus
        </button>
        <button className="secondary-action" type="button" onClick={window.pawse.resumeWalking}>
          Resume Walk
        </button>
        <button className="primary-action" type="button" disabled={!settingsDirty} onClick={save}>
          Save
        </button>
      </footer>
    </main>
  );
}

export default function App(): JSX.Element {
  if (!pawseApi()) {
    return (
      <main className="settings-shell">
        <header>
          <p className="eyebrow">Pawse</p>
          <h1>Preload unavailable</h1>
        </header>
        <section className="settings-section">
          <p className="diagnostic-copy">
            Electron preload 没有注入，桌宠控制接口暂时不可用。请重启 pnpm dev，或检查
            preload 路径和 sandbox 设置。
          </p>
        </section>
      </main>
    );
  }

  const route = window.location.hash.replace("#", "");
  if (route === "settings") return <SettingsView />;
  return <PetView />;
}
