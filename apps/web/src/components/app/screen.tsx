"use client";

import { BookOpen, ChartLine, ChevronLeft, House, Package, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Lucide icons are drawn at the design's 1.75 stroke everywhere. */
export const STROKE = 1.75;

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/petty-cash", label: "Petty cash", icon: Wallet },
  { href: "/reports", label: "Reports", icon: ChartLine },
  { href: "/accountant", label: "Books", icon: BookOpen },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="sticky bottom-0 z-20 grid h-[78px] grid-cols-5 border-t border-hairline bg-page pb-2">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("flex flex-col items-center justify-center gap-1 text-xs", active ? "font-semibold text-ink" : "font-medium text-ink-muted")}
          >
            <Icon className="size-[22px]" strokeWidth={STROKE} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * One phone-width screen. Sub-screens get a back button and a 20px title;
 * top-level screens (with the bottom nav) get a 24px title.
 */
export function Screen({
  title,
  back,
  nav = false,
  header,
  footer,
  children,
}: {
  title?: string;
  back?: string;
  nav?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col bg-page sm:border-x sm:border-hairline">
      {header ??
        (back ? (
          <header className="flex items-center gap-1 px-3 pt-3.5">
            <Link href={back} aria-label="Back" className="flex size-11 items-center justify-center rounded-full hover:bg-panel">
              <ChevronLeft className="size-[22px]" strokeWidth={STROKE} aria-hidden />
            </Link>
            {title && <h1 className="text-xl font-semibold">{title}</h1>}
          </header>
        ) : (
          title && (
            <header className="px-5 pt-[22px]">
              <h1 className="text-2xl font-semibold">{title}</h1>
            </header>
          )
        ))}
      <main className="flex flex-1 flex-col gap-4 px-4 pt-3.5 pb-6">{children}</main>
      {footer && <div className="sticky bottom-0 z-10 flex flex-col gap-3 bg-page px-4 pt-3 pb-6">{footer}</div>}
      {nav && <BottomNav />}
    </div>
  );
}

export function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col gap-4 p-4 pt-6" aria-busy="true" aria-label="Loading your books">
      <div className="h-10 w-2/3 animate-pulse rounded-xl bg-panel" />
      <div className="h-48 animate-pulse rounded-3xl bg-panel" />
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-[18px] bg-panel" />
        ))}
      </div>
    </div>
  );
}

/** Grey grouped panel. The fill does the grouping: no border. */
export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-[18px] bg-panel", className)} {...props} />;
}

export function NightCard({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-3xl bg-night p-5 text-white", className)} {...props} />;
}

/** 1px divider inside a panel; `inset` lines it up with the text after a row icon. */
export function Divider({ inset = false, className }: { inset?: boolean; className?: string }) {
  return <div aria-hidden className={cn("h-px bg-divider", inset ? "ml-[66px]" : "mx-3.5", className)} />;
}

export function Label({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("px-1 text-[13px] font-medium text-ink-muted", className)} {...props} />;
}

/** Day heading above a list, e.g. TODAY. */
export function DayHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mx-1 text-[13px] font-semibold tracking-[0.02em] text-ink-muted uppercase">{children}</h2>;
}

/** Brand-tint strip with an icon and one sentence. */
export function InfoStrip({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] bg-brand-tint px-3.5 py-3 text-sm text-brand-strong">
      <Icon className="size-[18px] shrink-0" strokeWidth={STROKE} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/** Big money figure: whole rand at full size, cents smaller and fainter. */
export function Amount({ cents, className, centsClassName }: { cents: number; className?: string; centsClassName?: string }) {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (
    <span className={cn("leading-none font-semibold tracking-[-0.03em]", className)}>
      {negative ? "−" : ""}R{whole}
      <span className={cn("text-[0.55em] font-medium text-ink-faint", centsClassName)}>.{String(abs % 100).padStart(2, "0")}</span>
    </span>
  );
}

/** The FundReady mark: a brand square with two bars, white over lime. */
export function Logo({ size = 40 }: { size?: number }) {
  const bar = Math.round(size * 0.45);
  return (
    <span aria-hidden className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-brand" style={{ width: size, height: size, borderRadius: size * 0.3, gap: size / 10 }}>
      <span className="h-[3px] rounded-sm bg-white" style={{ width: bar }} />
      <span className="h-[3px] rounded-sm bg-accent" style={{ width: bar }} />
    </span>
  );
}

/** Small "Balanced" / "27% margin" pill: the only badges in the design. */
export function Pill({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "negative" }) {
  return (
    <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", tone === "brand" ? "bg-brand-tint text-brand" : "bg-negative-tint text-negative")}>{children}</span>
  );
}

