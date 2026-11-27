"use client";

import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { books } from "@/books/store";
import { Button } from "@/components/ui/button";
import { useFeature } from "@/features";
import { cn } from "@/lib/utils";
import { tour, useTour } from "./state";
import { stepAfter, tourSteps, type TourStep } from "./steps";

const CARD_W = 340;
const GAP = 16;
const PAD = 8;
const DESKTOP = 1024;
/** Above the sheets and dialogs (z-50), so the tour can point into them. */
const Z_BLOCK = "z-[100]";
const Z_SPOT = "z-[101]";
const Z_CARD = "z-[102]";

const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/** The on-screen `data-tour` elements for a step (hidden phone or desktop copies are skipped). */
function targetsOf(step: TourStep): HTMLElement[] {
  const names = step.target === undefined ? [] : Array.isArray(step.target) ? step.target : [step.target];
  return names.flatMap((name) => {
    const el = [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)].find(visible);
    return el ? [el] : [];
  });
}

/** One box around all of the step's targets. */
function unionRect(els: HTMLElement[]): DOMRect | null {
  if (!els.length) return null;
  const rs = els.map((el) => el.getBoundingClientRect());
  const top = Math.min(...rs.map((r) => r.top));
  const left = Math.min(...rs.map((r) => r.left));
  return new DOMRect(left, top, Math.max(...rs.map((r) => r.right)) - left, Math.max(...rs.map((r) => r.bottom)) - top);
}

function onRoute(path: string, route: string | null) {
  return route === null || (route === "/" ? path === "/" : path.startsWith(route));
}

const sameRect = (a: DOMRect | null, b: DOMRect | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

/** A sheet or dialog of the app is open (not the tour card). */
const appDialogOpen = () => !!document.querySelector('[role="dialog"][data-state="open"]');

/** `**word**` in a step's text is the thing to tap. */
function Body({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, i) => (
        <Fragment key={i}>{i % 2 ? <strong className="font-semibold text-ink">{part}</strong> : part}</Fragment>
      ))}
    </>
  );
}

/**
 * The guided tour: dims the screen, spotlights the control a step is about and shows a short card
 * beside it. The tour takes the user to each step's screen itself. On "tap this" steps only the
 * spotlighted control can be used; otherwise the app stays usable underneath.
 */
export function GuidedTour() {
  const enabled = useFeature("tour");
  const bank = useFeature("bankImport");
  const state = useTour();
  const steps = useMemo(() => tourSteps(bank), [bank]);
  const path = usePathname();
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0, card: 160 });
  const [restarting, setRestarting] = useState(false);

  const active = enabled && state.active;
  const index = Math.min(state.step, steps.length - 1);
  const step = steps[index]!;
  const last = index === steps.length - 1;
  const here = onRoute(path, step.route);
  const waits = (s: TourStep | undefined) => !!(s?.advance || s?.nextWhen || s?.done);
  const waitsForUser = waits(step);
  // Going back to a step that waits for a tap or a save would only bounce straight forward again.
  const canBack = index > 0 && !waits(steps[index - 1]);

  /** Show step `i`, opening its screen when the user is somewhere else. */
  const go = (i: number) => {
    const route = steps[i]?.route;
    tour.goTo(i);
    if (route && !onRoute(path, route)) router.push(route);
  };

  // First visit with the tour switched on (it is off by default): start it once, on Home.
  useEffect(() => {
    if (enabled && !state.seen && path === "/") tour.start();
  }, [enabled, state.seen, path]);

  // Follow the target every frame (scrolling, sheets sliding in, layout changes), and move on
  // when the step's "next" element appears.
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let scrolled = false;
    const tick = () => {
      const els = here ? targetsOf(step) : [];
      if (els[0] && !scrolled) {
        scrolled = true;
        els[0].scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      const r = unionRect(els);
      setRect((prev) => (sameRect(prev, r) ? prev : r));
      const card = cardRef.current?.offsetHeight ?? 160;
      setViewport((v) => (v.w === window.innerWidth && v.h === window.innerHeight && v.card === card ? v : { w: window.innerWidth, h: window.innerHeight, card }));
      if (here && step.nextWhen && [...document.querySelectorAll(step.nextWhen)].some(visible)) tour.goTo(index + 1);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active, here, step, index]);

  // "Tap this" steps: a tap on the target moves on, and the tap still does its job (opens the screen).
  useEffect(() => {
    if (!active || !here || step.advance !== "click") return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && targetsOf(step).some((el) => el.contains(t))) tour.goTo(index + 1);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active, here, step, index]);

  // Saving what a step asks for moves the tour on (the form takes the user to the next screen).
  useEffect(() => {
    if (!active) return;
    let seen = books.getSnapshot()?.commands.length ?? 0;
    return books.subscribe(() => {
      const s = books.getSnapshot();
      if (!s) return;
      const fresh = s.commands.slice(seen).filter((c) => s.userCommandIds.has(c.id));
      seen = s.commands.length;
      for (const cmd of fresh) {
        const next = stepAfter(steps, tour.get().step, cmd);
        if (next !== null) tour.goTo(next);
      }
    });
  }, [active, steps]);

  // Esc ends the tour and the arrow keys move between steps, except while a sheet or dialog is
  // open (Esc closes that) or while typing.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || appDialogOpen()) return;
      if (e.key === "Escape") tour.end();
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight" && !last && !waitsForUser) go(index + 1);
      if (e.key === "ArrowLeft" && canBack) go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!active) return null;

  const desktop = viewport.w >= DESKTOP;
  const cardH = viewport.card;
  const spot = rect && { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };

  // Desktop: beside the spotlight (right, else left, else below or above); centred when there is
  // nothing to point at. Phone: full width, on whichever side of the spotlight has more room.
  let style: React.CSSProperties;
  if (desktop && spot) {
    const right = spot.left + spot.width + GAP;
    const besideLeft = spot.left - GAP - CARD_W;
    if (right + CARD_W < viewport.w - GAP || besideLeft > GAP) {
      const left = right + CARD_W < viewport.w - GAP ? right : besideLeft;
      style = { width: CARD_W, left, top: Math.min(Math.max(GAP, spot.top), viewport.h - cardH - GAP) };
    } else {
      const below = spot.top + spot.height + GAP;
      const top = below + cardH < viewport.h - GAP ? below : Math.max(GAP, spot.top - GAP - cardH);
      style = { width: CARD_W, left: Math.min(Math.max(GAP, spot.left), viewport.w - CARD_W - GAP), top };
    }
  } else if (desktop) {
    style = { width: CARD_W, left: (viewport.w - CARD_W) / 2, top: Math.max(GAP, (viewport.h - cardH) / 2) };
  } else if (spot) {
    const roomAbove = spot.top;
    const roomBelow = viewport.h - spot.top - spot.height;
    style = roomBelow >= roomAbove ? { left: 12, right: 12, bottom: 12 } : { left: 12, right: 12, top: 12 };
  } else {
    style = { left: 12, right: 12, bottom: 90 };
  }

  // On "tap this" steps, four transparent blocks around the spotlight keep other taps away.
  const blockers =
    spot && step.advance === "click"
      ? [
          { top: 0, left: 0, right: 0, height: Math.max(0, spot.top) },
          { top: spot.top + spot.height, left: 0, right: 0, bottom: 0 },
          { top: spot.top, left: 0, width: Math.max(0, spot.left), height: spot.height },
          { top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height },
        ]
      : [];

  return (
    <>
      {blockers.map((b, i) => (
        <div key={i} aria-hidden className={cn("pointer-events-auto fixed", Z_BLOCK)} style={b} />
      ))}
      {spot ? (
        <div
          aria-hidden
          className={cn("tour-pulse pointer-events-none fixed rounded-[20px] ring-2 ring-brand transition-all duration-200", Z_SPOT)}
          style={{ ...spot, boxShadow: "0 0 0 9999px rgba(12, 26, 20, 0.5)" }}
        />
      ) : (
        here && <div aria-hidden className={cn("pointer-events-none fixed inset-0 bg-[rgba(12,26,20,0.5)]", Z_SPOT)} />
      )}
      <div
        ref={cardRef}
        data-tour-card
        role="dialog"
        aria-label="Guided tour"
        className={cn("pointer-events-auto fixed flex flex-col gap-3 rounded-[18px] bg-page p-4 shadow-[0_12px_40px_rgba(12,26,20,0.25)]", Z_CARD)}
        style={style}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5" aria-label={`Step ${index + 1} of ${steps.length}`}>
            {steps.map((s, i) => (
              <span key={s.id} aria-hidden className={cn("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-brand" : i < index ? "w-1.5 bg-brand/40" : "w-1.5 bg-hairline")} />
            ))}
          </span>
          <button type="button" aria-label="End tour" onClick={() => tour.end()} className="-mr-2 flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-panel hover:text-ink">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <p aria-live="polite" className="text-[15px] leading-snug text-ink-muted">
          <Body text={step.body} />
        </p>

        {!here && step.route ? (
          <Button size="touch" variant="outline" onClick={() => go(index)}>
            Back to the tour
          </Button>
        ) : last ? (
          restarting ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm">Reset the demo first, so the numbers match?</p>
              <Button size="touch" onClick={() => (books.reset(), setRestarting(false), tour.start(), router.push("/"))}>
                Reset and restart
              </Button>
              <Button size="touch" variant="outline" onClick={() => (setRestarting(false), tour.start(), router.push("/"))}>
                Restart without resetting
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="touch" variant="outline" className="flex-1" onClick={() => setRestarting(true)}>
                Restart tour
              </Button>
              <Button size="touch" className="flex-1" onClick={() => tour.end()}>
                Finish
              </Button>
            </div>
          )
        ) : (
          (canBack || !waitsForUser) && (
            <div className="flex justify-end gap-2">
              {canBack && (
                <Button size="touch" variant="outline" className="min-w-24" onClick={() => go(index - 1)}>
                  Back
                </Button>
              )}
              {!waitsForUser && (
                <Button size="touch" className="min-w-24" onClick={() => go(index + 1)}>
                  Next
                </Button>
              )}
            </div>
          )
        )}
      </div>
    </>
  );
}
