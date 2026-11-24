"use client";

import { BookOpen, ChartLine, ChevronLeft, FileText, House, Package, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BUSINESS } from "@/books/seed";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ResetDemoButton } from "./demo-menu";

/** Lucide icons are drawn at the design's 1.75 stroke everywhere. */
export const STROKE = 1.75;

const NAV: { href: string; label: string; icon: LucideIcon; also?: string[] }[] = [
  { href: "/", label: "Home", icon: House, also: ["/sell", "/pay", "/expense", "/invoice", "/suppliers"] },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/petty-cash", label: "Petty cash", icon: Wallet },
  { href: "/reports", label: "Reports", icon: ChartLine },
  { href: "/accountant", label: "Books", icon: BookOpen },
];

function useActive() {
  const path = usePathname();
  return (item: (typeof NAV)[number]) =>
    item.href === "/" ? path === "/" || !!item.also?.some((p) => path.startsWith(p)) : path.startsWith(item.href);
}

/** Phone and tablet navigation. Hidden on desktop, where the sidebar takes over. */
export function BottomNav() {
  const isActive = useActive();
  return (
    <nav aria-label="Main" className="sticky bottom-0 z-20 mx-auto grid h-[78px] w-full grid-cols-5 border-t border-hairline bg-page pb-2 md:max-w-[640px] lg:hidden">
      {NAV.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex flex-col items-center justify-center gap-1 text-xs", active ? "font-semibold text-ink" : "font-medium text-ink-muted")}
          >
            <Icon className="size-[22px]" strokeWidth={STROKE} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Desktop navigation (≥1024px): same style as the accountant view's sidebar. */
export function AppSidebar() {
  const isActive = useActive();
  const item = "flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-sm";
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-5 border-r border-hairline px-3.5 py-5 lg:flex">
      <div className="flex items-center gap-2.5 p-2">
        <Logo size={32} />
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">{BUSINESS.name}</span>
          <span className="text-xs text-ink-muted">{BUSINESS.area}</span>
        </span>
      </div>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {NAV.map((n) => {
          const active = isActive(n);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cn(item, active ? "bg-panel-strong font-semibold text-ink" : "font-medium text-[#3E4642] hover:bg-panel")}
            >
              <Icon className="size-[18px]" strokeWidth={STROKE} aria-hidden />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-0.5">
        <Link href="/invoice" className={cn(item, "font-medium text-[#3E4642] hover:bg-panel")}>
          <FileText className="size-[18px]" strokeWidth={STROKE} aria-hidden /> Invoice a customer
        </Link>
        <ResetDemoButton className={cn(item, "font-medium text-[#3E4642] hover:bg-panel")} />
      </div>
    </aside>
  );
}

/**
 * One screen of the app, mobile-first:
 * phone = single column with bottom nav; tablet = same, centred, max 640px;
 * desktop = sidebar + content up to 1120px ("form" screens: a centred 560px column).
 */
export function Screen({
  title,
  back,
  nav = false,
  width = "wide",
  header,
  actions,
  footer,
  children,
}: {
  title?: string;
  back?: string;
  nav?: boolean;
  width?: "wide" | "form";
  header?: React.ReactNode;
  /** Buttons shown beside the title on desktop. */
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-page">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className={cn("mx-auto flex w-full flex-1 flex-col md:max-w-[640px] lg:px-8 lg:pt-8", width === "form" ? "lg:max-w-[624px]" : "lg:max-w-[1184px]")}>
          {header ??
            (title && (
              <header className={cn("flex items-center gap-1", back ? "px-3 pt-3.5 lg:px-0 lg:pt-0" : "px-5 pt-[22px] lg:px-0 lg:pt-0")}>
                {back && (
                  <Link href={back} aria-label="Back" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-panel lg:-ml-3">
                    <ChevronLeft className="size-[22px]" strokeWidth={STROKE} aria-hidden />
                  </Link>
                )}
                <h1 className={cn("min-w-0 flex-1 font-semibold lg:text-[28px]", back ? "text-xl" : "text-2xl")}>{title}</h1>
                {actions && <div className="hidden items-center gap-2 lg:flex">{actions}</div>}
              </header>
            ))}
          <main className="flex flex-1 flex-col gap-4 px-4 pt-3.5 pb-6 lg:flex-none lg:px-0 lg:pt-6">{children}</main>
          {footer && (
            <div className="sticky bottom-0 z-10 flex flex-col gap-3 bg-page px-4 pt-3 pb-6 lg:static lg:px-0 lg:pt-0 lg:pb-10">{footer}</div>
          )}
        </div>
        {nav && <BottomNav />}
      </div>
    </div>
  );
}

/**
 * The form's main action. Phone: full-width sticky button (with the hint above).
 * Desktop: a right-aligned row with Cancel and the primary button.
 */
export function FormActions({ hint, cancelHref, label, disabled, onClick }: { hint?: string | null; cancelHref: string; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
      {hint && <p className="text-center text-[13px] text-ink-muted lg:mr-auto lg:text-left">{hint}</p>}
      <Button asChild variant="outline" size="touch" className="hidden lg:inline-flex lg:px-6">
        <Link href={cancelHref}>Cancel</Link>
      </Button>
      <Button size="primary" disabled={disabled} onClick={onClick} className="lg:h-12 lg:w-auto lg:min-w-44">
        {label}
      </Button>
    </div>
  );
}

export function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col gap-4 p-4 pt-6 md:max-w-[640px] lg:max-w-[1120px] lg:p-8" aria-busy="true" aria-label="Loading your books">
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

