import { createEmptyStats, todayKey } from "../shared/constants";
import type { StatsHistory, TodayStats } from "../shared/types";

export type StatsStore = {
  get(key: "stats", defaultValue: TodayStats): TodayStats;
  get(key: "statsHistory", defaultValue: StatsHistory): StatsHistory;
  set(key: "stats", value: TodayStats): void;
  set(key: "statsHistory", value: StatsHistory): void;
};

export function getStatsHistory(store: StatsStore): StatsHistory {
  return store.get("statsHistory", {});
}

export function isSameStats(left: TodayStats | undefined, right: TodayStats): boolean {
  return Boolean(
    left &&
      left.date === right.date &&
      left.breaksTaken === right.breaksTaken &&
      left.watersLogged === right.watersLogged &&
      left.focusMinutes === right.focusMinutes &&
      left.focusWarnings === right.focusWarnings
  );
}

export function saveStatsToHistory(store: StatsStore, stats: TodayStats): void {
  if (!stats.date) return;
  const history = getStatsHistory(store);
  if (isSameStats(history[stats.date], stats)) return;
  store.set("statsHistory", {
    ...history,
    [stats.date]: stats
  });
}

export function getCurrentStats(store: StatsStore, date = todayKey()): TodayStats {
  const stats = store.get("stats", createEmptyStats());
  if (stats.date !== date) {
    saveStatsToHistory(store, stats);
    const current = getStatsHistory(store)[date] ?? createEmptyStats(date);
    store.set("stats", current);
    saveStatsToHistory(store, current);
    return current;
  }

  saveStatsToHistory(store, stats);
  return stats;
}

export function updateCurrentStats(
  store: StatsStore,
  mutator: (stats: TodayStats) => TodayStats
): TodayStats {
  const next = mutator(getCurrentStats(store));
  store.set("stats", next);
  saveStatsToHistory(store, next);
  return next;
}

export function resetCurrentStats(store: StatsStore, date = todayKey()): TodayStats {
  const reset = createEmptyStats(date);
  store.set("stats", reset);
  saveStatsToHistory(store, reset);
  return reset;
}
