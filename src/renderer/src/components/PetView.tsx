import { useEffect, useRef, useState } from "react";
import type { JSX, PointerEvent } from "react";
import { i18n, resolveLanguage } from "../../../shared/i18n";
import type { SpeechBubble } from "../../../shared/types";
import { getPetAsset } from "../assets";
import { useNow, useSnapshot } from "../hooks";

type DragRef = {
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
};

function formatFocusCountdown(endsAt: number | null, now: number): string {
  const remainingSeconds = Math.max(0, Math.ceil(((endsAt ?? now) - now) / 1000));
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function PetView(): JSX.Element {
  const snapshot = useSnapshot();
  const now = useNow(1000);
  const [bubble, setBubble] = useState<SpeechBubble | null>(null);
  const dragRef = useRef<DragRef | null>(null);
  const labels = i18n(resolveLanguage(snapshot.settings.language)).settings;

  useEffect(() => {
    const offBubble = window.pawse.onShowBubble(setBubble);
    const offHide = window.pawse.onHideBubble(() => setBubble(null));
    return () => {
      offBubble();
      offHide();
    };
  }, []);

  const state = snapshot.petState;
  const altText = `Pawse ${state}`;
  const facingClass = snapshot.petFacing === "left" ? "facing-left" : "facing-right";
  const asset = getPetAsset(snapshot.settings.petAppearanceId, state);

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
    if (!drag.dragging && distance > 4) {
      drag.dragging = true;
      window.pawse.petDragStart({ offsetX: drag.startX, offsetY: drag.startY });
    }
  }

  function stopPointer(event: PointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    if (drag.dragging) {
      window.pawse.petDragStop();
      return;
    }
    window.pawse.petClicked();
  }

  function cancelPointer(event: PointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.dragging) window.pawse.petDragStop();
  }

  return (
    <main
      className="pet-shell"
      aria-label="Pawse desktop pet"
      onContextMenu={(event) => {
        event.preventDefault();
        window.pawse.petContextMenu();
      }}
    >
      {bubble ? (
        <section className="speech-bubble">
          <p>{bubble.message}</p>
          {bubble.actions?.length ? (
            <div className="bubble-actions">
              {bubble.actions.map((action) => (
                <button
                  className={`bubble-button ${action.kind ?? "secondary"}`}
                  key={action.id}
                  onClick={() => window.pawse.bubbleAction(action.id)}
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
        onPointerMove={movePointer}
        onPointerUp={stopPointer}
        type="button"
      >
        <img draggable={false} src={asset.src} alt={altText} />
      </button>
    </main>
  );
}
