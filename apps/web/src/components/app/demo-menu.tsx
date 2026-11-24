"use client";

import { BookOpen, FileText, Menu, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useBooks } from "@/books/store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { STROKE } from "./screen";

/** The demo's menu: accountant view, invoice, and "Reset demo" (with a confirm step, no browser dialogs). */
export function DemoMenu() {
  const { reset } = useBooks();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const close = (o: boolean) => {
    setOpen(o);
    if (!o) setConfirming(false);
  };
  const item = "h-12 justify-start gap-3 rounded-2xl bg-panel px-4 text-[15px] font-medium text-ink hover:bg-panel-strong";
  return (
    <Sheet open={open} onOpenChange={close}>
      <button type="button" aria-label="Menu" onClick={() => setOpen(true)} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-panel hover:bg-panel-strong">
        <Menu className="size-5" strokeWidth={STROKE} aria-hidden />
      </button>
      <SheetContent side="bottom" showCloseButton={false} onOpenAutoFocus={(e) => e.preventDefault()} className="mx-auto max-w-[440px] gap-3 rounded-t-[28px] border-0 px-5 pt-2.5 pb-6">
        <span aria-hidden className="h-1 w-10 self-center rounded-sm bg-input-border" />
        <SheetHeader className="gap-1 p-0">
          <SheetTitle className="text-[22px] font-semibold tracking-[-0.02em]">Menu</SheetTitle>
          <SheetDescription className="text-[15px] text-ink-muted">Demo of Mama Tee Spaza. Everything stays on this device.</SheetDescription>
        </SheetHeader>
        <Button asChild className={item}>
          <Link href="/accountant">
            <BookOpen className="size-5" strokeWidth={STROKE} aria-hidden /> Accountant view
          </Link>
        </Button>
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
          <div className="flex flex-col gap-2 rounded-2xl bg-negative-tint p-4">
            <p className="text-[15px] leading-snug text-[#8A2F10]">This removes everything recorded in the demo and brings back the sample shop, with its history up to yesterday.</p>
            <Button
              size="touch"
              variant="destructive"
              onClick={() => {
                reset();
                close(false);
                toast.success("Demo reset", { description: "The sample shop is back." });
              }}
            >
              Yes, reset the demo
            </Button>
            <Button size="touch" variant="outline" onClick={() => setConfirming(false)}>
              Keep my changes
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
