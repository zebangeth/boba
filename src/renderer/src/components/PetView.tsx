import { useEffect, useRef, useState } from "react";
import type { FormEvent, JSX, PointerEvent, ReactNode } from "react";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import { i18n, resolveLanguage } from "../../../shared/i18n";
import type { PetState, SpeechBubble } from "../../../shared/types";
import { getPetAsset, getPetAssetVariantCount } from "../assets";
import { useNow, useSnapshot } from "../hooks";

type DragRef = {
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
};

const CONTINUOUS_ASSET_STATES = new Set<PetState>(["idle", "focusGuard"]);
const CONTINUOUS_ASSET_ROTATION_MS = 15 * 60 * 1000;
const DRAG_START_DISTANCE_PX = 10;
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const TRAILING_URL_PUNCTUATION = new Set([
  ",",
  ".",
  "!",
  "?",
  ";",
  ":",
  ")",
  "]",
  "}",
  "，",
  "。",
  "！",
  "？",
  "；",
  "：",
  "）",
  "】",
  "」",
  "』"
]);

function randomVariant(count: number, previous?: number): number {
  if (count <= 1) return 0;
  let next = Math.floor(Math.random() * count);
  if (previous !== undefined && next === previous) {
    next = (next + 1) % count;
  }
  return next;
}

function formatFocusCountdown(endsAt: number | null, now: number): string {
  const remainingSeconds = Math.max(0, Math.ceil(((endsAt ?? now) - now) / 1000));
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function trimTrailingUrlPunctuation(rawUrl: string): { url: string; suffix: string } {
  let url = rawUrl;
  let suffix = "";
  while (url && TRAILING_URL_PUNCTUATION.has(url[url.length - 1])) {
    suffix = `${url[url.length - 1]}${suffix}`;
    url = url.slice(0, -1);
  }
  return { url, suffix };
}

function renderMessageWithLinks(message: string, linkLabel: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of message.matchAll(URL_PATTERN)) {
    const rawUrl = match[0];
    const start = match.index ?? 0;
    const { url, suffix } = trimTrailingUrlPunctuation(rawUrl);
    if (!url) continue;

    if (start > lastIndex) {
      nodes.push(message.slice(lastIndex, start));
    }
    nodes.push(
      <a
        className="speech-bubble__link"
        href={url}
        key={`${url}-${start}`}
        rel="noreferrer"
        target="_blank"
      >
        [{linkLabel}]
      </a>
    );
    if (suffix) nodes.push(suffix);
    lastIndex = start + rawUrl.length;
  }

  if (lastIndex < message.length) {
    nodes.push(message.slice(lastIndex));
  }
  return nodes.length ? nodes : [message];
}

export function PetView(): JSX.Element {
  const snapshot = useSnapshot();
  const now = useNow(1000);
  const [bubble, setBubble] = useState<SpeechBubble | null>(null);
  const [assetVariant, setAssetVariant] = useState(0);
  const [assetReplayKey, setAssetReplayKey] = useState(0);
  const [stateSignal, setStateSignal] = useState(0);
  const [chatDraft, setChatDraft] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const dragRef = useRef<DragRef | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const copy = i18n(resolveLanguage(snapshot.settings.language));
  const labels = copy.settings;
  const actionLabels = copy.actions;

  useEffect(() => {
    const offBubble = window.pawpal.onShowBubble(setBubble);
    const offHide = window.pawpal.onHideBubble(() => setBubble(null));
    const offPetState = window.pawpal.onPetState(() => setStateSignal((current) => current + 1));
    return () => {
      offBubble();
      offHide();
      offPetState();
    };
  }, []);

  const state = snapshot.petState;
  const altText = `PawPal ${state}`;
  const facingClass = snapshot.petFacing === "left" ? "facing-left" : "facing-right";
  const appearanceId = snapshot.settings.petAppearanceId;
  const asset = getPetAsset(appearanceId, state, assetVariant, assetReplayKey);

  function finishPointerDrag(clicked: boolean): void {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (drag.dragging) {
      window.pawpal.petDragStop();
      return;
    }
    if (clicked) window.pawpal.petClicked();
  }

  useEffect(() => {
    const variantCount = getPetAssetVariantCount(appearanceId, state);
    setAssetVariant(randomVariant(variantCount));
    setAssetReplayKey(0);
    if (!CONTINUOUS_ASSET_STATES.has(state) || variantCount <= 1) return;
    const timer = window.setInterval(() => {
      setAssetVariant((current) => randomVariant(variantCount, current));
    }, CONTINUOUS_ASSET_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [appearanceId, state, stateSignal]);

  useEffect(() => {
    if (!asset.replayIntervalMs) return;
    const timer = window.setInterval(() => {
      setAssetReplayKey((current) => current + 1);
    }, asset.replayIntervalMs);
    return () => window.clearInterval(timer);
  }, [asset.replayIntervalMs]);

  useEffect(() => {
    const cancelActiveDrag = (): void => finishPointerDrag(false);
    window.addEventListener("pointerup", cancelActiveDrag);
    window.addEventListener("pointercancel", cancelActiveDrag);
    window.addEventListener("blur", cancelActiveDrag);
    return () => {
      window.removeEventListener("pointerup", cancelActiveDrag);
      window.removeEventListener("pointercancel", cancelActiveDrag);
      window.removeEventListener("blur", cancelActiveDrag);
    };
  }, []);

  useEffect(() => {
    if (!bubble?.input) {
      setChatDraft("");
      setChatSending(false);
      return;
    }
    window.setTimeout(() => chatInputRef.current?.focus(), 0);
  }, [bubble?.id, bubble?.input]);

  useEffect(() => {
    function blurChatInput(): void {
      chatInputRef.current?.blur();
    }

    window.addEventListener("blur", blurChatInput);
    return () => window.removeEventListener("blur", blurChatInput);
  }, []);

  async function submitChat(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const message = chatDraft.trim();
    if (!message || chatSending || bubble?.input?.disabled) return;
    setChatSending(true);
    setChatDraft("");
    await window.pawpal.sendCompanionMessage(message);
    setChatSending(false);
  }

  function startPointer(event: PointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false
    };
  }

  function movePointer(event: PointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.dragging && distance > DRAG_START_DISTANCE_PX) {
      drag.dragging = true;
      window.pawpal.petDragStart({ offsetX: drag.startX, offsetY: drag.startY });
    }
  }

  function stopPointer(event: PointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const shouldReleaseCapture = event.currentTarget.hasPointerCapture(event.pointerId);
    finishPointerDrag(true);
    if (shouldReleaseCapture) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function cancelPointer(event: PointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    finishPointerDrag(false);
  }

  return (
    <main
      className="pet-shell"
      aria-label="PawPal desktop pet"
      onContextMenu={(event) => {
        event.preventDefault();
        window.pawpal.petContextMenu();
      }}
    >
      {bubble ? (
        <section
          className={`speech-bubble${bubble.input ? " has-input" : ""}`}
          onPointerDownCapture={() => {
            if (bubble.input) window.pawpal.companionActivity();
          }}
        >
          {bubble.dismissible ? (
            <div className="bubble-window-controls">
              <button
                type="button"
                className="bubble-window-control"
                aria-label={actionLabels.dismissBubble}
                title={actionLabels.dismissBubble}
                onClick={window.pawpal.dismissBubble}
              >
                ×
              </button>
            </div>
          ) : null}
          <SimpleBar className="speech-bubble__scroll" autoHide={false}>
            <p className="speech-bubble__message">
              {renderMessageWithLinks(bubble.message, actionLabels.linkLabel)}
            </p>
          </SimpleBar>
          {bubble.input ? (
            <form className="bubble-chat" onSubmit={submitChat}>
              <input
                ref={chatInputRef}
                value={chatDraft}
                disabled={chatSending || bubble.input.disabled}
                placeholder={bubble.input.placeholder}
                onChange={(event) => {
                  setChatDraft(event.target.value);
                  window.pawpal.companionActivity();
                }}
              />
              <button
                type="submit"
                className="bubble-button primary bubble-chat__submit"
                disabled={chatSending || !chatDraft.trim() || bubble.input.disabled}
              >
                {bubble.input.submitLabel}
              </button>
            </form>
          ) : null}
          {bubble.actions?.length ? (
            <div className="bubble-actions">
              {bubble.actions.map((action) => (
                <button
                  className={`bubble-button ${action.kind ?? "secondary"}`}
                  key={action.id}
                  onClick={() => window.pawpal.bubbleAction(action.id)}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {snapshot.focusActive ? (
        <div className="focus-badge">
          <span>{labels.focus}</span>
          <strong>{formatFocusCountdown(snapshot.timers.focusEndsAt, now)}</strong>
        </div>
      ) : null}

      <button
        className={`pet-button state-${state} ${facingClass} ${
          asset.isPlaceholder ? "placeholder-asset" : ""
        }`}
        onPointerCancel={cancelPointer}
        onPointerDown={startPointer}
        onLostPointerCapture={() => finishPointerDrag(false)}
        onPointerMove={movePointer}
        onPointerUp={stopPointer}
        type="button"
      >
        <img draggable={false} src={asset.src} alt={altText} />
      </button>
    </main>
  );
}
