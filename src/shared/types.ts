export type PetState =
  | "walking"
  | "idle"
  | "sitting"
  | "happy"
  | "knocking"
  | "thirsty"
  | "drinking"
  | "focusGuard"
  | "annoyed";

export type BubbleAction = {
  id: string;
  label: string;
  kind?: "primary" | "secondary" | "danger";
};

export type SpeechBubble = {
  id: string;
  message: string;
  actions?: BubbleAction[];
  autoDismissMs?: number;
};

export type BlockingMode = "break" | "hydration" | "focusWarning" | null;

export type Settings = {
  breakReminderEnabled: boolean;
  breakIntervalMinutes: number;
  hydrationReminderEnabled: boolean;
  hydrationIntervalMinutes: number;
  focusDurationMinutes: number;
  distractionDetectionEnabled: boolean;
  soundEnabled: boolean;
};

export type TodayStats = {
  date: string;
  breaksTaken: number;
  watersLogged: number;
  focusMinutes: number;
  focusWarnings: number;
};

export type TimerStatus = {
  breakDueAt: number | null;
  hydrationDueAt: number | null;
  focusEndsAt: number | null;
};

export type AppSnapshot = {
  settings: Settings;
  stats: TodayStats;
  timers: TimerStatus;
  petState: PetState;
  blockingMode: BlockingMode;
  focusActive: boolean;
  petParked: boolean;
  dogVisible: boolean;
};

export type DemoTrigger =
  | "break"
  | "hydration"
  | "focusWarning"
  | "happy";

export type RendererEventMap = {
  "pet:set-state": PetState;
  "pet:show-bubble": SpeechBubble;
  "pet:hide-bubble": void;
  "settings:updated": Settings;
  "stats:updated": TodayStats;
  "app:snapshot": AppSnapshot;
};
