import assert from "node:assert/strict";
import { compareVersions } from "../src/shared/versions";

export const tests = [
  {
    name: "compareVersions treats a newer patch as greater",
    run(): void {
      assert.equal(compareVersions("0.1.4", "0.1.3"), 1);
    }
  },
  {
    name: "compareVersions normalizes v-prefixed tags",
    run(): void {
      assert.equal(compareVersions("v1.2.0", "1.2.0"), 0);
    }
  },
  {
    name: "compareVersions treats prerelease as lower than stable",
    run(): void {
      assert.equal(compareVersions("1.0.0-beta.1", "1.0.0"), -1);
      assert.equal(compareVersions("1.0.0", "1.0.0-beta.1"), 1);
    }
  }
];
