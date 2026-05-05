import { app, net } from "electron";
import type { UpdateCheckResult } from "../shared/types";
import { APP_NAME, RELEASES_API_URL, RELEASES_URL } from "./config";

type GitHubReleasePayload = {
  tag_name?: unknown;
  html_url?: unknown;
  name?: unknown;
};

export function createInitialUpdateCheck(): UpdateCheckResult {
  return {
    status: "idle",
    currentVersion: app.getVersion(),
    latestVersion: null,
    releaseUrl: RELEASES_URL,
    checkedAt: null,
    error: null
  };
}

export function createCheckingUpdateCheck(current: UpdateCheckResult): UpdateCheckResult {
  return {
    ...current,
    status: "checking",
    currentVersion: app.getVersion(),
    checkedAt: Date.now(),
    error: null
  };
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

function compareVersions(left: string, right: string): number {
  const [leftCore, leftPreRelease = ""] = normalizeVersion(left).split("-", 2);
  const [rightCore, rightPreRelease = ""] = normalizeVersion(right).split("-", 2);
  const leftParts = leftCore.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = rightCore.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  if (!leftPreRelease && rightPreRelease) return 1;
  if (leftPreRelease && !rightPreRelease) return -1;
  return leftPreRelease.localeCompare(rightPreRelease);
}

function isGitHubReleasePayload(value: unknown): value is GitHubReleasePayload {
  return typeof value === "object" && value !== null;
}

export async function checkGitHubReleasesForUpdates(
  current: UpdateCheckResult
): Promise<UpdateCheckResult> {
  try {
    const response = await net.fetch(RELEASES_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `${APP_NAME}/${app.getVersion()}`
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!isGitHubReleasePayload(payload)) {
      throw new Error("Unexpected release response");
    }

    const latestVersion =
      typeof payload.tag_name === "string"
        ? payload.tag_name
        : typeof payload.name === "string"
          ? payload.name
          : "";

    if (!latestVersion) {
      throw new Error("Latest release has no version tag");
    }

    const releaseUrl = typeof payload.html_url === "string" ? payload.html_url : RELEASES_URL;
    const currentVersion = app.getVersion();
    return {
      status: compareVersions(latestVersion, currentVersion) > 0 ? "available" : "up-to-date",
      currentVersion,
      latestVersion,
      releaseUrl,
      checkedAt: Date.now(),
      error: null
    };
  } catch (error) {
    return {
      ...current,
      status: "error",
      currentVersion: app.getVersion(),
      checkedAt: Date.now(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
