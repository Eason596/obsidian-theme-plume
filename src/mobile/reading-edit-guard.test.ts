import { describe, expect, it, vi } from "vitest";
import {
  disguiseTouchAsMouse,
  installReadingEditGuard,
  isSecondTap
} from "./reading-edit-guard";

function mountNote(): { leaf: HTMLElement; body: HTMLElement; header: HTMLButtonElement } {
  document.body.innerHTML = `
    <div class="workspace-leaf">
      <div class="view-header"><button class="mod-edit">edit</button></div>
      <div class="markdown-reading-view"><p>note</p></div>
    </div>
  `;
  const leaf = document.querySelector(".workspace-leaf");
  const body = document.querySelector(".markdown-reading-view p");
  const header = document.querySelector(".view-header button");
  if (!(leaf instanceof HTMLElement) || !(body instanceof HTMLElement) || !(header instanceof HTMLButtonElement)) {
    throw new Error("fixture missing");
  }
  return { leaf, body, header };
}

function pointer(
  type: string,
  target: Element,
  init: PointerEventInit
): void {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, ...init }));
}

describe("isSecondTap", () => {
  const first = { time: 1_000, x: 10, y: 20 };

  it("accepts a second tap inside the time and distance window", () => {
    expect(isSecondTap(first, { time: 1_400, x: 18, y: 24 })).toBe(true);
  });

  it("rejects a slow tap and a drag", () => {
    expect(isSecondTap(first, { time: 1_600, x: 12, y: 20 })).toBe(false);
    expect(isSecondTap(first, { time: 1_100, x: 80, y: 20 })).toBe(false);
    expect(isSecondTap(null, { time: 1_100, x: 12, y: 20 })).toBe(false);
  });
});

describe("disguiseTouchAsMouse", () => {
  it("reports a finger pointer as a mouse and leaves a real mouse alone", () => {
    const touch = new PointerEvent("pointerdown", { pointerType: "touch" });
    disguiseTouchAsMouse(touch);
    expect(touch.pointerType).toBe("mouse");

    const mouse = new PointerEvent("pointerdown", { pointerType: "mouse" });
    disguiseTouchAsMouse(mouse);
    expect(mouse.pointerType).toBe("mouse");
  });
});

describe("installReadingEditGuard", () => {
  it("turns a finger press in the reading view into a mouse press", () => {
    const { body } = mountNote();
    const teardown = installReadingEditGuard(document, { onFingerDoubleTap: () => {} });
    let seen = "";
    body.addEventListener("pointerdown", (event) => {
      seen = event.pointerType;
    });
    pointer("pointerdown", body, { pointerType: "touch", clientX: 4, clientY: 4 });
    expect(seen).toBe("mouse");
    teardown();
  });

  it("reports one finger double-tap and swallows the click that would open the editor", () => {
    const { leaf, body } = mountNote();
    const onFingerDoubleTap = vi.fn();
    const teardown = installReadingEditGuard(document, { onFingerDoubleTap });

    pointer("pointerdown", body, { pointerType: "touch", clientX: 10, clientY: 10 });
    pointer("pointerup", body, { pointerType: "touch", clientX: 10, clientY: 10 });
    pointer("pointerdown", body, { pointerType: "touch", clientX: 12, clientY: 11 });
    const click = new MouseEvent("dblclick", { bubbles: true, cancelable: true });
    body.dispatchEvent(click);

    expect(onFingerDoubleTap).toHaveBeenCalledTimes(1);
    expect(onFingerDoubleTap).toHaveBeenCalledWith(leaf);
    expect(click.defaultPrevented).toBe(true);
    teardown();
  });

  it("leaves a single tap, a mouse double-click, and the header button alone", () => {
    const { body, header } = mountNote();
    const onFingerDoubleTap = vi.fn();
    const teardown = installReadingEditGuard(document, { onFingerDoubleTap });

    pointer("pointerdown", body, { pointerType: "touch", clientX: 10, clientY: 10 });
    pointer("pointerup", body, { pointerType: "touch", clientX: 10, clientY: 10 });
    pointer("pointerdown", header, { pointerType: "touch", clientX: 10, clientY: 10 });
    pointer("dblclick", body, { pointerType: "mouse", clientX: 10, clientY: 10 });

    expect(onFingerDoubleTap).not.toHaveBeenCalled();
    teardown();
  });

  it("does not cancel the next press, so scrolling can start", () => {
    const { body } = mountNote();
    const teardown = installReadingEditGuard(document, { onFingerDoubleTap: () => {} });

    pointer("pointerdown", body, { pointerType: "touch", clientX: 10, clientY: 10 });
    pointer("pointerup", body, { pointerType: "touch", clientX: 10, clientY: 10 });
    pointer("pointerdown", body, { pointerType: "touch", clientX: 12, clientY: 11 });
    pointer("pointerup", body, { pointerType: "touch", clientX: 12, clientY: 11 });

    const next = new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerType: "touch",
      clientX: 12,
      clientY: 30
    });
    body.dispatchEvent(next);
    const touchStart = new Event("touchstart", { bubbles: true, cancelable: true });
    body.dispatchEvent(touchStart);

    expect(next.defaultPrevented).toBe(false);
    expect(touchStart.defaultPrevented).toBe(false);
    teardown();
  });
});
