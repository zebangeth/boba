import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "../../shared/constants";
import type { AppSnapshot, TodayStats } from "../../shared/types";

const initialStats: TodayStats = {
  date: "",
  breaksTaken: 0,
  watersLogged: 0,
  focusMinutes: 0,
  focusWarnings: 0
};

export function useSnapshot(): AppSnapshot {
  const [snapshot, setSnapshot] = useState<AppSnapshot>({
    settings: DEFAULT_SETTINGS,
    stats: initialStats,
    statsHistory: {},
    timers: {
      breakDueAt: null,
      hydrationDueAt: null,
      focusEndsAt: null
    },
    distraction: {
      state: "idle",
      activeApp: "",
      activeWindowTitle: "",
      matchedRule: null,
      lastCheckedAt: null,
      lastWarningAt: null,
      error: null
    },
    petState: "walking",
    petFacing: "right",
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

export function useNow(refreshMs = 30_000): number {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), refreshMs);
    return () => window.clearInterval(timer);
  }, [refreshMs]);

  return now;
}
