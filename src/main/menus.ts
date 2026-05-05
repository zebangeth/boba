import type { I18nBundle } from "../shared/i18n";
import type { DemoTrigger } from "../shared/types";

type MenuLabels = I18nBundle["menu"];

type MenuState = {
  appName: string;
  dogVisible: boolean;
  focusActive: boolean;
  isPackaged: boolean;
};

type MenuActions = {
  toggleDog: () => void;
  hideDog: () => void;
  startFocus: () => void;
  stopFocusFromMenu: () => void;
  stopFocusFromContext: () => void;
  openSettings: () => void;
  quit: () => void;
  triggerDemo: (trigger: DemoTrigger) => void;
};

function demoItems(
  labels: MenuLabels,
  actions: MenuActions
): Electron.MenuItemConstructorOptions[] {
  return [
    { type: "separator" as const },
    { label: labels.demoBreakReminder, click: () => actions.triggerDemo("break") },
    { label: labels.demoHydrationReminder, click: () => actions.triggerDemo("hydration") },
    { label: labels.demoFocusWarning, click: () => actions.triggerDemo("focusWarning") },
    { label: labels.demoHappyReaction, click: () => actions.triggerDemo("happy") }
  ];
}

function actionItems(
  labels: MenuLabels,
  state: MenuState,
  actions: MenuActions
): Electron.MenuItemConstructorOptions[] {
  return [
    {
      label: state.dogVisible ? labels.hideDog : labels.showDog,
      click: actions.toggleDog
    },
    {
      label: state.focusActive ? labels.stopFocusMode : labels.startFocusMode,
      click: state.focusActive ? actions.stopFocusFromMenu : actions.startFocus
    },
    ...(state.isPackaged ? [] : demoItems(labels, actions)),
    { type: "separator" },
    { label: labels.settings, click: actions.openSettings }
  ];
}

export function buildApplicationMenuTemplate(
  labels: MenuLabels,
  state: MenuState,
  actions: MenuActions
): Electron.MenuItemConstructorOptions[] {
  return [
    {
      label: state.appName,
      submenu: [
        ...actionItems(labels, state, actions),
        { type: "separator" },
        { role: "quit", label: labels.quit }
      ]
    },
    { role: "editMenu" },
    { role: "windowMenu" }
  ];
}

export function buildTrayMenuTemplate(
  labels: MenuLabels,
  state: MenuState,
  actions: MenuActions
): Electron.MenuItemConstructorOptions[] {
  return [
    { label: state.appName, enabled: false },
    { type: "separator" },
    ...actionItems(labels, state, actions),
    { type: "separator" },
    {
      label: labels.quit,
      click: actions.quit
    }
  ];
}

export function buildPetContextMenuTemplate(
  labels: MenuLabels,
  state: MenuState,
  actions: MenuActions
): Electron.MenuItemConstructorOptions[] {
  return [
    { label: labels.settings, click: actions.openSettings },
    {
      label: state.focusActive ? labels.stopFocusMode : labels.startFocusMode,
      click: state.focusActive ? actions.stopFocusFromContext : actions.startFocus
    },
    ...(state.isPackaged ? [] : demoItems(labels, actions)),
    { type: "separator" },
    {
      label: labels.hideDog,
      click: actions.hideDog
    }
  ];
}
