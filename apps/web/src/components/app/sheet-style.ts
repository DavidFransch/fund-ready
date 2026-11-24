/**
 * Bottom sheet on phone and tablet; a centred 520px dialog with a scrim on desktop.
 * Applied to SheetContent side="bottom".
 */
export const SHEET_OR_DIALOG =
  "mx-auto max-h-[92dvh] w-full max-w-[640px] gap-4 overflow-y-auto rounded-t-[28px] border-0 px-5 pt-2.5 pb-6 shadow-[0_-8px_32px_rgba(12,26,20,0.12)] " +
  "lg:inset-auto lg:top-1/2 lg:left-1/2 lg:max-h-[86dvh] lg:w-[520px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-[28px] lg:px-6 lg:pt-6 lg:shadow-[0_24px_64px_rgba(12,26,20,0.18)] " +
  "lg:data-[state=open]:slide-in-from-bottom-4 lg:data-[state=closed]:slide-out-to-bottom-4";

/** The drag handle only makes sense on the phone sheet. */
export const SHEET_HANDLE = "h-1 w-10 self-center rounded-sm bg-input-border lg:hidden";
