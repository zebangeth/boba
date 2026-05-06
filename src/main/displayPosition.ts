export type WindowBounds = {
  width: number;
  height: number;
  x: number;
  y: number;
};

export type WorkArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DisplayBounds = {
  id: number;
  workArea: WorkArea;
};

export type SavedWindowPosition = {
  x: number;
  y: number;
  displayId?: number;
  relativeX?: number;
  relativeY?: number;
};

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function center(bounds: WindowBounds): { x: number; y: number } {
  return {
    x: bounds.x + Math.round(bounds.width / 2),
    y: bounds.y + Math.round(bounds.height / 2)
  };
}

function containsPoint(workArea: WorkArea, point: { x: number; y: number }): boolean {
  return (
    point.x >= workArea.x &&
    point.x <= workArea.x + workArea.width &&
    point.y >= workArea.y &&
    point.y <= workArea.y + workArea.height
  );
}

function distanceToWorkArea(workArea: WorkArea, point: { x: number; y: number }): number {
  const dx =
    point.x < workArea.x
      ? workArea.x - point.x
      : point.x > workArea.x + workArea.width
        ? point.x - (workArea.x + workArea.width)
        : 0;
  const dy =
    point.y < workArea.y
      ? workArea.y - point.y
      : point.y > workArea.y + workArea.height
        ? point.y - (workArea.y + workArea.height)
        : 0;
  return Math.hypot(dx, dy);
}

export function displayForBounds(
  displays: DisplayBounds[],
  bounds: WindowBounds,
  fallback: DisplayBounds
): DisplayBounds {
  const point = center(bounds);
  return (
    displays.find((display) => containsPoint(display.workArea, point)) ??
    [...displays].sort((left, right) => {
      return distanceToWorkArea(left.workArea, point) - distanceToWorkArea(right.workArea, point);
    })[0] ??
    fallback
  );
}

export function clampBoundsToWorkArea(bounds: WindowBounds, workArea: WorkArea): WindowBounds {
  return {
    ...bounds,
    x: clamp(bounds.x, workArea.x, workArea.x + workArea.width - bounds.width),
    y: clamp(bounds.y, workArea.y, workArea.y + workArea.height - bounds.height)
  };
}

export function savedPositionFromBounds(
  displays: DisplayBounds[],
  bounds: WindowBounds,
  fallback: DisplayBounds
): SavedWindowPosition {
  const display = displayForBounds(displays, bounds, fallback);
  const maxX = Math.max(1, display.workArea.width - bounds.width);
  const maxY = Math.max(1, display.workArea.height - bounds.height);

  return {
    x: bounds.x,
    y: bounds.y,
    displayId: display.id,
    relativeX: clamp((bounds.x - display.workArea.x) / maxX, 0, 1),
    relativeY: clamp((bounds.y - display.workArea.y) / maxY, 0, 1)
  };
}

export function initialWindowBounds({
  displays,
  primaryDisplay,
  size,
  saved
}: {
  displays: DisplayBounds[];
  primaryDisplay: DisplayBounds;
  size: { width: number; height: number };
  saved?: SavedWindowPosition;
}): WindowBounds {
  const fallback: WindowBounds = {
    width: size.width,
    height: size.height,
    x: Math.round(primaryDisplay.workArea.x + primaryDisplay.workArea.width / 2 - size.width / 2),
    y: primaryDisplay.workArea.y + primaryDisplay.workArea.height - size.height
  };

  if (!saved) return fallback;

  const savedDisplay =
    typeof saved.displayId === "number"
      ? displays.find((display) => display.id === saved.displayId)
      : undefined;
  const targetDisplay = savedDisplay ?? displayForBounds(displays, { ...fallback, x: saved.x, y: saved.y }, primaryDisplay);
  const hasRelativePosition =
    typeof saved.relativeX === "number" &&
    Number.isFinite(saved.relativeX) &&
    typeof saved.relativeY === "number" &&
    Number.isFinite(saved.relativeY);
  const restored: WindowBounds =
    savedDisplay && hasRelativePosition
      ? {
          ...fallback,
          x: Math.round(
            targetDisplay.workArea.x +
              clamp(saved.relativeX ?? 0, 0, 1) *
                Math.max(0, targetDisplay.workArea.width - size.width)
          ),
          y: Math.round(
            targetDisplay.workArea.y +
              clamp(saved.relativeY ?? 0, 0, 1) *
                Math.max(0, targetDisplay.workArea.height - size.height)
          )
        }
      : {
          ...fallback,
          x: saved.x,
          y: saved.y
        };

  return clampBoundsToWorkArea(restored, targetDisplay.workArea);
}

export function visibleWindowBounds(
  displays: DisplayBounds[],
  primaryDisplay: DisplayBounds,
  bounds: WindowBounds
): WindowBounds {
  const targetDisplay = displayForBounds(displays, bounds, primaryDisplay);
  return clampBoundsToWorkArea(bounds, targetDisplay.workArea);
}
