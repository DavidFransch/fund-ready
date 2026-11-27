"use client";

import { Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBooks } from "@/books/store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { setFlag, useFeature, type Feature } from "@/features";
import { cn } from "@/lib/utils";
import { tour } from "@/tour/state";
import { SHEET_HANDLE, SHEET_OR_DIALOG } from "./sheet-style";

const STROKE = 1.75;

function Toggle({ feature, label, detail }: { feature: Feature; label: string; detail: string }) {
  const on = useFeature(feature);
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => setFlag(feature, !on)} className="flex min-h-14 items-center gap-3 rounded-2xl bg-panel px-4 py-2.5 text-left">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{label}</span>
        <span className="text-[13px] text-ink-muted">{detail}</span>
      </span>
      <span aria-hidden className={cn("flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors", on ? "bg-brand" : "bg-input-border")}>
        <span className={cn("size-6 rounded-full bg-page shadow-sm transition-transform", on && "translate-x-5")} />
      </span>
    </button>
  );
}

/** The switches and "Restart tour". Used in the sidebar's dialog and inside the phone menu. */
export function DemoSettingsPanel({ onDone }: { onDone: () => void }) {
  const { reset } = useBooks();
  const router = useRouter();
  const [restarting, setRestarting] = useState(false);
  // The tour begins on Home, wherever it was restarted from.
  const start = (fresh: boolean) => {
    if (fresh) reset();
    setFlag("tour", true);
    tour.start();
    setRestarting(false);
    onDone();
    router.push("/");
  };
  return (
    <div className="flex flex-col gap-2">
      <Toggle feature="tour" label="Guided tour" detail="A short tour of one sale, from Home to the books" />
      <Toggle feature="bankImport" label="Bank statement (preview)" detail="Match a sample bank statement to the books" />
      {!restarting ? (
        <Button variant="outline" size="touch" className="mt-1" onClick={() => setRestarting(true)}>
          Restart tour
        </Button>
      ) : (
        <div className="mt-1 flex flex-col gap-2 rounded-2xl bg-brand-tint p-4">
          <p className="text-[15px] leading-snug">Start from a fresh shop so the numbers match the tour?</p>
          <Button size="touch" onClick={() => start(true)}>
            Reset demo and start tour
          </Button>
          <Button size="touch" variant="outline" onClick={() => start(false)}>
            Keep my changes and start
          </Button>
        </div>
      )}
    </div>
  );
}

/** "Demo settings" in the desktop sidebar. */
export function DemoSettingsButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Settings2 className="size-[18px]" strokeWidth={STROKE} aria-hidden /> Demo settings
      </button>
      <SheetContent side="bottom" showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()} className={cn(SHEET_OR_DIALOG, "gap-3")}>
        <span aria-hidden className={SHEET_HANDLE} />
        <SheetHeader className="gap-1 p-0">
          <SheetTitle className="text-[22px] font-semibold tracking-[-0.02em]">Demo settings</SheetTitle>
          <SheetDescription className="text-[15px] text-ink-muted">Saved in this browser. Reset demo doesn&apos;t change them.</SheetDescription>
        </SheetHeader>
        <DemoSettingsPanel onDone={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
