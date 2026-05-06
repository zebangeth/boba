import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../src/shared/constants";
import { normalizeSettings } from "../src/main/settingsStore";

export const tests = [
  {
    name: "normalizeSettings fills missing values from defaults",
    run(): void {
      assert.deepEqual(normalizeSettings(), DEFAULT_SETTINGS);
    }
  },
  {
    name: "normalizeSettings falls back from invalid language and pet appearance",
    run(): void {
      const settings = normalizeSettings({
        language: "fr" as never,
        petAppearanceId: "cat" as never
      });

      assert.equal(settings.language, DEFAULT_SETTINGS.language);
      assert.equal(settings.petAppearanceId, DEFAULT_SETTINGS.petAppearanceId);
    }
  },
  {
    name: "normalizeSettings preserves valid stored values",
    run(): void {
      const settings = normalizeSettings({
        language: "en",
        petAppearanceId: "lovartPuppy",
        launchAtLoginEnabled: true,
        checkUpdatesOnLaunchEnabled: true
      });

      assert.equal(settings.language, "en");
      assert.equal(settings.petAppearanceId, "lovartPuppy");
      assert.equal(settings.launchAtLoginEnabled, true);
      assert.equal(settings.checkUpdatesOnLaunchEnabled, true);
    }
  }
];
