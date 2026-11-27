"use client";

import { BookOpen, FileText, Landmark, Menu, RotateCcw, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useBooks } from "@/books/store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useFeature } from "@/features";
import { cn } from "@/lib/utils";
import { DemoSettingsPanel } from "./demo-settings";
import { SHEET_HANDLE, SHEET_OR_DIALOG } from "./sheet-style";

const STROKE = 1.75;

function ResetConfirm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { reset } = useBooks();
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-negative-tint p-4">
      <p className="text-[15px] leading-snug text-[#8A2F10]">This removes everything recorded in the demo and brings back the sample shop, with its history up to yesterday.</p>
      <Button
        size="touch"
        variant="destructive"
        onClick={() => {
          reset();
          onDone();
          toast.success("Demo reset", { description: "The sample shop is back." });
        }}
      >
        Yes, reset the demo
      </Button>
      <Button size="touch" variant="outline" onClick={onCancel}>
        Keep my changes
      </Button>
    </div>
  );
}

/** "Reset demo" in the desktop sidebar: opens a confirm dialog (no browser dialogs). */
export function ResetDemoButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <RotateCcw className="size-[18px]" strokeWidth={STROKE} aria-hidden /> Reset demo
      </button>
      <SheetContent side="bottom" showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()} className={SHEET_OR_DIALOG}>
        <span aria-hidden className={SHEET_HANDLE} />
        <SheetHeader className="gap-1 p-0">
          <SheetTitle className="text-[22px] font-semibold tracking-[-0.02em]">Reset the demo?</SheetTitle>
          <SheetDescription className="text-[15px] text-ink-muted">Everything stays on this device.</SheetDescription>
        </SheetHeader>
        <ResetConfirm onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

/** The phone and tablet menu: accountant view, invoice and reset. On desktop the sidebar has these. */
export function DemoMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [settings, setSettings] = useState(false);
  const bank = useFeature("bankImport");
  const close = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setConfirming(false);
      setSettings(false);
    }
  };
  const item = "h-12 justify-start gap-3 rounded-2xl bg-panel px-4 text-[15px] font-medium text-ink hover:bg-panel-strong";
  return (
    <Sheet open={open} onOpenChange={close}>
      <button type="button" aria-label="Menu" onClick={() => setOpen(true)} className={cn("flex size-11 shrink-0 items-center justify-center rounded-full bg-panel hover:bg-panel-strong", className)}>
        <Menu className="size-5" strokeWidth={STROKE} aria-hidden />
      </button>
      <SheetContent side="bottom" showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()} className={cn(SHEET_OR_DIALOG, "gap-3")}>
        <span aria-hidden className={SHEET_HANDLE} />
        <SheetHeader className="gap-1 p-0">
          <SheetTitle className="text-[22px] font-semibold tracking-[-0.02em]">Menu</SheetTitle>
          <SheetDescription className="text-[15px] text-ink-muted">Demo of Mama Tee Spaza. Everything stays on this device.</SheetDescription>
        </SheetHeader>
        <Button asChild className={item}>
          <Link href="/accountant">
            <BookOpen className="size-5" strokeWidth={STROKE} aria-hidden /> Accountant view
          </Link>
        </Button>
        {bank && (
          <Button asChild className={item}>
            <Link href="/bank">
              <Landmark className="size-5" strokeWidth={STROKE} aria-hidden /> Bank statement
              <span className="ml-auto rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand">Preview</span>
            </Link>
          </Button>
        )}
        <Button asChild className={item}>
          <Link href="/invoice">
            <FileText className="size-5" strokeWidth={STROKE} aria-hidden /> Invoice a customer
          </Link>
        </Button>
        {!confirming ? (
          <Button className={item} onClick={() => setConfirming(true)}>
            <RotateCcw className="size-5" strokeWidth={STROKE} aria-hidden /> Reset demo
          </Button>
        ) : (
          <ResetConfirm onDone={() => close(false)} onCancel={() => setConfirming(false)} />
        )}
        {!settings ? (
          <Button className={item} onClick={() => setSettings(true)}>
            <Settings2 className="size-5" strokeWidth={STROKE} aria-hidden /> Demo settings
          </Button>
        ) : (
          <DemoSettingsPanel />
        )}
      </SheetContent>
    </Sheet>
  );
}
