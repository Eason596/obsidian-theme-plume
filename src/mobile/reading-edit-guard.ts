/**
 * Obsidian enters edit mode only for a finger double-tap in reading view.
 * A mouse double-click does not. The header pencil sits outside
 * `.markdown-reading-view`, so it still toggles mode.
 *
 * Zoomable Reader called preventDefault on a passive touchend, which the
 * browser ignores, and only after Obsidian had already counted the gesture.
 * This guard reports the finger as a mouse on pointerdown, then swallows the
 * second tap. The host still reverts the mode if the note switched anyway.
 */

export const READING_VIEW_SELECTOR = ".markdown-reading-view";
/** Obsidian treats two taps within this window as a double tap. */
export const DOUBLE_TAP_MS = 500;
export const DOUBLE_TAP_SLOP_PX = 32;
const SWALLOW_MS = 700;
/** pointerup and touchend for one lift arrive a few milliseconds apart. */
const SAME_LIFT_MS = 40;

export interface TapPoint {
  time: number;
  x: number;
  y: number;
}

export function readingViewOf(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest(READING_VIEW_SELECTOR);
}

export function leafOf(readingView: Element): Element | null {
  return readingView.closest(".workspace-leaf");
}

/** Second lift close to the first, without a drag in between. */
export function isSecondTap(
  previous: TapPoint | null,
  next: TapPoint,
  intervalMs = DOUBLE_TAP_MS,
  slopPx = DOUBLE_TAP_SLOP_PX
): boolean {
  if (!previous) {
    return false;
  }
  if (next.time - previous.time > intervalMs || next.time < previous.time) {
    return false;
  }
  return Math.hypot(next.x - previous.x, next.y - previous.y) <= slopPx;
}

/**
 * Obsidian reads `pointerType === "touch"` to decide this tap may enter edit.
 * Reporting mouse leaves links, checkboxes, and scrolling on the click event.
 */
export function disguiseTouchAsMouse(event: Event): void {
  if (!(event instanceof PointerEvent) || event.pointerType !== "touch") {
    return;
  }
  try {
    Object.defineProperty(event, "pointerType", {
      configurable: true,
      get: () => "mouse"
    });
  } catch {
    // A sealed event still hits the second-tap swallow below.
  }
}

export interface ReadingEditGuardOptions {
  /** Leaf that contained the reading view when the finger double-tap started. */
  onFingerDoubleTap: (leafEl: Element) => void;
  /** A finger went down outside the reading view, such as the header pencil. */
  onOutsidePointerDown?: () => void;
  doubleTapMs?: number;
  slopPx?: number;
  now?: () => number;
}

interface PointerDownState {
  x: number;
  y: number;
  moved: boolean;
  readingView: Element;
}

function consume(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

export function installReadingEditGuard(
  doc: Document,
  options: ReadingEditGuardOptions
): () => void {
  const win = doc.defaultView;
  if (!win) {
    return () => {};
  }

  const intervalMs = options.doubleTapMs ?? DOUBLE_TAP_MS;
  const slopPx = options.slopPx ?? DOUBLE_TAP_SLOP_PX;
  const now = options.now ?? (() => Date.now());

  let lastTap: TapPoint | null = null;
  let down: PointerDownState | null = null;
  let swallowUntil = 0;
  let lastLiftAt = 0;
  let reported = false;
  let touchPoints = 0;

  const report = (readingView: Element): void => {
    if (reported) {
      return;
    }
    const leaf = leafOf(readingView);
    if (!leaf) {
      return;
    }
    reported = true;
    options.onFingerDoubleTap(leaf);
  };

  const armSwallow = (readingView: Element, time: number): void => {
    swallowUntil = time + SWALLOW_MS;
    lastTap = null;
    report(readingView);
  };

  const forgetTap = (): void => {
    lastTap = null;
    down = null;
    reported = false;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== "touch" || event.button !== 0) {
      return;
    }
    const readingView = readingViewOf(event.target);
    if (!readingView) {
      forgetTap();
      options.onOutsidePointerDown?.();
      return;
    }
    // Never cancel pointerdown or touchstart. That preventDefault is what
    // freezes scrolling until a later tap outside the note.
    disguiseTouchAsMouse(event);
    const time = now();
    const point = { time, x: event.clientX, y: event.clientY };
    down = { x: point.x, y: point.y, moved: false, readingView };
    if (!isSecondTap(lastTap, point, intervalMs, slopPx)) {
      reported = false;
      return;
    }
    armSwallow(readingView, time);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!down) {
      return;
    }
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > slopPx) {
      down.moved = true;
      lastTap = null;
    }
  };

  const noteLift = (target: EventTarget | null, x: number, y: number): void => {
    const time = now();
    if (time - lastLiftAt <= SAME_LIFT_MS) {
      return;
    }
    lastLiftAt = time;
    const readingView = readingViewOf(target) ?? down?.readingView ?? null;
    const moved = down?.moved ?? false;
    down = null;
    if (time < swallowUntil || !readingView || moved || touchPoints > 1) {
      if (moved || touchPoints > 1) {
        lastTap = null;
      }
      return;
    }
    const point = { time, x, y };
    if (isSecondTap(lastTap, point, intervalMs, slopPx)) {
      armSwallow(readingView, time);
      return;
    }
    lastTap = point;
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") {
      return;
    }
    noteLift(event.target, event.clientX, event.clientY);
  };

  const onTouchStart = (event: TouchEvent): void => {
    touchPoints = event.touches?.length ?? 0;
    if (touchPoints >= 2) {
      forgetTap();
      return;
    }
  };

  const onTouchEnd = (event: TouchEvent): void => {
    const touch = event.changedTouches?.[0];
    if (!touch) {
      touchPoints = event.touches?.length ?? 0;
      return;
    }
    noteLift(event.target, touch.clientX, touch.clientY);
    touchPoints = event.touches?.length ?? 0;
  };

  const onFollowUp = (event: Event): void => {
    if (now() >= swallowUntil) {
      return;
    }
    if (!readingViewOf(event.target)) {
      return;
    }
    consume(event);
  };

  const onPointerDownEvent = (event: Event): void => {
    if (event instanceof PointerEvent) {
      onPointerDown(event);
    }
  };
  const onPointerMoveEvent = (event: Event): void => {
    if (event instanceof PointerEvent) {
      onPointerMove(event);
    }
  };
  const onPointerUpEvent = (event: Event): void => {
    if (event instanceof PointerEvent) {
      onPointerUp(event);
    }
  };
  const onPointerCancel = (event: Event): void => {
    if (!(event instanceof PointerEvent) || event.pointerType !== "touch") {
      return;
    }
    down = null;
    lastTap = null;
  };

  const listeners: Array<[string, EventListener, boolean]> = [
    ["pointerdown", onPointerDownEvent, false],
    ["pointermove", onPointerMoveEvent, true],
    ["pointerup", onPointerUpEvent, false],
    ["pointercancel", onPointerCancel, true],
    ["touchstart", onTouchStart as EventListener, false],
    ["touchend", onTouchEnd as EventListener, false],
    ["click", onFollowUp, false],
    ["dblclick", onFollowUp, false]
  ];

  for (const [type, handler, passive] of listeners) {
    win.addEventListener(type, handler, { capture: true, passive });
  }

  return () => {
    for (const [type, handler] of listeners) {
      win.removeEventListener(type, handler, { capture: true });
    }
    forgetTap();
    swallowUntil = 0;
  };
}
