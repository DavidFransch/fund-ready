"use client";

import { BookOpen, EllipsisVertical, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useBooks } from "@/books/store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** The demo's menu: accountant view and "Reset demo" (with a confirm step, no browser dialogs). */
export function DemoMenu() {
  const { reset } = useBooks();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const close = (o: boolean) => {
    setOpen(o);
    if (!o) setConfirming(false);
  };
  return (
    <Sheet open={open} onOpenChange={close}>
      <button
        type="button"
        aria-label="Menu"
        onClick={() => setOpen(true)}
        className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-line-strong bg-card"
      >
        <EllipsisVertical className="size-5" aria-hidden />
      </button>
      <SheetContent side="bottom" className="mx-auto max-w-[440px] gap-3 rounded-t-3xl px-5 pb-6">
        <SheetHeader className="px-0 pb-0">
          <SheetTitle className="font-display text-xl font-bold">Menu</SheetTitle>
          <SheetDescription>Demo of Mama Tee Spaza. Everything stays on this device.</SheetDescription>
        </SheetHeader>
        <Button asChild size="touch" variant="outline" className="justify-start">
          <Link href="/accountant">
            <BookOpen className="size-5" aria-hidden /> Accountant view
          </Link>
        </Button>
        {!confirming ? (
          <Button size="touch" variant="outline" className="justify-start" onClick={() => setConfirming(true)}>
            <RotateCcw className="size-5" aria-hidden /> Reset demo
          </Button>
        ) : (
          <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-spend-line bg-spend-soft p-4">
            <p className="text-[15px] leading-snug text-spend-dark">
              This removes everything recorded in the demo and brings back the sample shop, with its history up to yesterday.
            </p>
            <Button
              size="touch"
              variant="spend"
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
