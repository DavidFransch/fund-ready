"use client";

import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { books } from "@/books/store";
import { Button } from "@/components/ui/button";
import { useFeature } from "@/features";
import { cn } from "@/lib/utils";
import { tour, useTour } from "./state";
import { stepAfter, tourSteps } from "./steps";

const CARD_W = 340;
const GAP = 16;
const DESKTOP = 1024;

/** The first `data-tour` element with that name that is actually on screen (hidden pages stay mounted). */
function findTarget(name: string | undefined): HTMLElement | null {
  if (!name) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function onRoute(path: string, route: string | null) {
  return route === null || (route === "/" ? path === "/" : path.startsWith(route));
}

const sameRect = (a: DOMRect | null, b: DOMRect | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

/**
 * The guided tour: a small card and a light spotlight on the element it talks about.
 * It never blocks the app: the spotlight lets clicks through, and the card can be ended any time.
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
  const [viewport, setViewport] = useState({ w: 0, h: 0, card: 200 });
  const [restarting, setRestarting] = useState(false);

  const active = enabled && state.active;
  const index = Math.min(state.step, steps.length - 1);
  const step = steps[index]!;
  const last = index === steps.length - 1;
  const here = onRoute(path, step.route);

  // First visit with the tour switched on: start it once.
  useEffect(() => {
    if (enabled && !state.seen) tour.start();
  }, [enabled, state.seen]);

  // Follow the target every frame (scrolling, sheets sliding in, layout changes), and move on
  // when a step's next screen appears.
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let scrolled = false;
    const tick = () => {
      const el = here ? findTarget(step.target) : null;
      if (el && !scrolled) {
        scrolled = true;
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      const r = el?.getBoundingClientRect() ?? null;
      setRect((prev) => (sameRect(prev, r) ? prev : r));
      const card = cardRef.current?.offsetHeight ?? 200;
      setViewport((v) => (v.w === window.innerWidth && v.h === window.innerHeight && v.card === card ? v : { w: window.innerWidth, h: window.innerHeight, card }));
      if (step.nextWhenVisible && findTarget(step.nextWhenVisible)) tour.goTo(index + 1);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active, here, step, index]);

  // Saving what a step asks for moves the tour on.
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

  // Esc ends the tour; the arrow keys move between steps (not while typing).
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tour.end();
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight" && !last) tour.goTo(index + 1);
      if (e.key === "ArrowLeft" && index > 0) tour.goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, index, last]);

  if (!active) return null;

  // Desktop: beside the target (right, else left, else below). Phone: docked above the bottom
  // nav, or at the top when the target sits low on the screen.
  const desktop = viewport.w >= DESKTOP;
  const cardH = viewport.card;
  let style: React.CSSProperties;
  if (desktop && rect) {
    const left = rect.right + GAP + CARD_W < viewport.w ? rect.right + GAP : rect.left - GAP - CARD_W > 0 ? rect.left - GAP - CARD_W : Math.min(rect.left, viewport.w - CARD_W - GAP);
    const beside = left !== Math.min(rect.left, viewport.w - CARD_W - GAP);
    const top = beside ? rect.top : rect.bottom + GAP + cardH < viewport.h ? rect.bottom + GAP : rect.top - GAP - cardH;
    style = { width: CARD_W, left: Math.max(GAP, left), top: Math.min(Math.max(GAP, top), viewport.h - cardH - GAP) };
  } else if (desktop) {
    style = { width: CARD_W, right: 24, bottom: 24 };
  } else {
    style = rect && rect.top > viewport.h / 2 ? { left: 12, right: 12, top: 12 } : { left: 12, right: 12, bottom: 90 };
  }

  return (
    <>
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[60] rounded-[20px] ring-2 ring-brand transition-all duration-200"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: "0 0 0 9999px rgba(12, 26, 20, 0.16)" }}
        />
      )}
      <div
        ref={cardRef}
        data-tour-card
        role="dialog"
        aria-label="Guided tour"
        className="pointer-events-auto fixed z-[70] flex flex-col gap-3 rounded-[18px] bg-page p-4 shadow-[0_12px_40px_rgba(12,26,20,0.18)]"
        style={style}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-ink-muted">
            Step {index + 1} of {steps.length}
          </span>
          <button type="button" onClick={() => tour.end()} className="-mr-1.5 flex min-h-8 items-center gap-1 rounded-lg px-1.5 text-xs font-medium text-ink-muted hover:text-ink">
            End tour <X className="size-3.5" aria-hidden />
          </button>
        </div>
        <div aria-live="polite" className="flex flex-col gap-1">
          <span className="text-[17px] font-semibold">{step.title}</span>
          <p className="text-[15px] leading-snug text-ink-muted">{step.body}</p>
        </div>

        {!here && step.route && (
          <Button size="touch" onClick={() => router.push(step.route!)}>
            Go to {step.screen}
          </Button>
        )}

        {last ? (
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
          <div className={cn("flex gap-2", index === 0 && "justify-end")}>
            {index > 0 && (
              <Button size="touch" variant="outline" className="flex-1" onClick={() => tour.goTo(index - 1)}>
                Back
              </Button>
            )}
            <Button size="touch" variant={here ? "default" : "outline"} className={index === 0 ? "min-w-28" : "flex-1"} onClick={() => tour.goTo(index + 1)}>
              Next
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
