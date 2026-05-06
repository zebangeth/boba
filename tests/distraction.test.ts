import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../src/shared/constants";
import { classifyDistraction } from "../src/main/distraction";
import type { ActiveWindowInfo } from "../src/main/distraction";
import type { Settings } from "../src/shared/types";

function settings(partial: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    distractionBlockedApps: [],
    distractionBlockedKeywords: [],
    ...partial
  };
}

function active(appName: string, windowTitle = ""): ActiveWindowInfo {
  return { appName, windowTitle };
}

export const tests = [
  {
    name: "classifyDistraction matches blocked apps case-insensitively",
    run(): void {
      assert.equal(
        classifyDistraction(active("Discord"), settings({ distractionBlockedApps: ["discord"] })),
        "app:discord"
      );
    }
  },
  {
    name: "classifyDistraction matches blocked keywords in window title",
    run(): void {
      assert.equal(
        classifyDistraction(
          active("Safari", "Watching YouTube"),
          settings({ distractionBlockedKeywords: ["youtube"] })
        ),
        "keyword:youtube"
      );
    }
  },
  {
    name: "classifyDistraction ignores the app itself",
    run(): void {
      assert.equal(
        classifyDistraction(active("PawPal", "youtube"), settings({ distractionBlockedKeywords: ["youtube"] })),
        null
      );
    }
  }
];
