import assert from "node:assert/strict";
import { createEmptyStats } from "../src/shared/constants";
import {
  getCurrentStats,
  getStatsHistory,
  resetCurrentStats,
  updateCurrentStats
} from "../src/main/statsStore";
import type { StatsStore } from "../src/main/statsStore";
import type { StatsHistory, TodayStats } from "../src/shared/types";

class MemoryStatsStore implements StatsStore {
  stats: TodayStats;
  statsHistory: StatsHistory;

  constructor(stats = createEmptyStats("2026-05-05"), statsHistory: StatsHistory = {}) {
    this.stats = stats;
    this.statsHistory = statsHistory;
  }

  get(key: "stats", defaultValue: TodayStats): TodayStats;
  get(key: "statsHistory", defaultValue: StatsHistory): StatsHistory;
  get(key: "stats" | "statsHistory", defaultValue: TodayStats | StatsHistory): TodayStats | StatsHistory {
    return this[key] ?? defaultValue;
  }

  set(key: "stats", value: TodayStats): void;
  set(key: "statsHistory", value: StatsHistory): void;
  set(key: "stats" | "statsHistory", value: TodayStats | StatsHistory): void {
    if (key === "stats") this.stats = value as TodayStats;
    else this.statsHistory = value as StatsHistory;
  }
}

export const tests = [
  {
    name: "getCurrentStats keeps today's stats and mirrors them to history",
    run(): void {
      const store = new MemoryStatsStore({
        date: "2026-05-05",
        breaksTaken: 1,
        watersLogged: 2,
        focusMinutes: 3,
        focusWarnings: 4
      });

      const stats = getCurrentStats(store, "2026-05-05");

      assert.equal(stats.breaksTaken, 1);
      assert.deepEqual(getStatsHistory(store)["2026-05-05"], stats);
    }
  },
  {
    name: "getCurrentStats rolls over to an existing history entry for today",
    run(): void {
      const yesterday = {
        date: "2026-05-04",
        breaksTaken: 1,
        watersLogged: 0,
        focusMinutes: 25,
        focusWarnings: 1
      };
      const today = {
        date: "2026-05-05",
        breaksTaken: 3,
        watersLogged: 2,
        focusMinutes: 50,
        focusWarnings: 0
      };
      const store = new MemoryStatsStore(yesterday, { "2026-05-05": today });

      assert.deepEqual(getCurrentStats(store, "2026-05-05"), today);
      assert.deepEqual(getStatsHistory(store)["2026-05-04"], yesterday);
    }
  },
  {
    name: "updateCurrentStats persists the mutation",
    run(): void {
      const store = new MemoryStatsStore(createEmptyStats("2026-05-05"));

      const stats = updateCurrentStats(store, (current) => ({
        ...current,
        watersLogged: current.watersLogged + 1
      }));

      assert.equal(stats.watersLogged, 1);
      assert.equal(store.stats.watersLogged, 1);
      assert.equal(getStatsHistory(store)["2026-05-05"].watersLogged, 1);
    }
  },
  {
    name: "resetCurrentStats clears today's counters",
    run(): void {
      const store = new MemoryStatsStore({
        date: "2026-05-05",
        breaksTaken: 4,
        watersLogged: 3,
        focusMinutes: 80,
        focusWarnings: 2
      });

      const stats = resetCurrentStats(store, "2026-05-05");

      assert.equal(stats.breaksTaken, 0);
      assert.deepEqual(store.stats, createEmptyStats("2026-05-05"));
    }
  }
];
