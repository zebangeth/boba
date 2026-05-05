import { app } from "electron";

export function supportsLoginItemSettings(): boolean {
  return (process.platform === "darwin" || process.platform === "win32") && app.isPackaged;
}

export function applyLaunchAtLoginPreference(enabled: boolean): void {
  if (!supportsLoginItemSettings()) return;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true
  });
}

export function getLaunchAtLoginState(fallback: boolean): boolean {
  if (!supportsLoginItemSettings()) return fallback;
  return app.getLoginItemSettings().openAtLogin;
}
