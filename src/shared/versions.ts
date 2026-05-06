export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

export function compareVersions(left: string, right: string): number {
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
