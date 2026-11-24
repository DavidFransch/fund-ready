"use client";

import { BookOpen, ChartColumn, ChevronLeft, House, Package, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/petty-cash", label: "Petty cash", icon: Wallet },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/reports", label: "Reports", icon: ChartColumn },
  { href: "/accountant", label: "Books", icon: BookOpen },
] as const;

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="sticky bottom-0 z-20 grid h-[72px] grid-cols-5 border-t border-divider bg-page">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("flex flex-col items-center justify-center gap-1 text-[13px]", active ? "font-bold text-brand" : "text-ink-muted")}
          >
            <Icon className="size-6" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** One screen of the app: phone-width column, optional back link, title, bottom nav or a footer action. */
export function Screen({
  title,
  back,
  wide = false,
  nav = false,
  header,
  footer,
  children,
}: {
  title?: string;
  back?: string;
  wide?: boolean;
  nav?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto flex min-h-dvh w-full flex-col bg-page", wide ? "max-w-6xl" : "max-w-[440px] sm:border-x sm:border-divider")}>
      {header ?? (
        <header className="flex items-center gap-2 px-3 pt-4">
          {back && (
            <Link href={back} aria-label="Back" className="flex size-11 items-center justify-center rounded-full hover:bg-panel-strong">
              <ChevronLeft className="size-6" aria-hidden />
            </Link>
          )}
          {title && <h1 className={cn("text-2xl font-bold", !back && "px-3")}>{title}</h1>}
        </header>
      )}
      <main className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-6">{children}</main>
      {footer && <div className="sticky bottom-0 z-10 flex flex-col gap-2 bg-page/95 px-5 pt-2 pb-5 backdrop-blur">{footer}</div>}
      {nav && <BottomNav />}
    </div>
  );
}

export function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col gap-4 p-6" aria-busy="true" aria-label="Loading your books">
      <div className="h-10 w-2/3 animate-pulse rounded-xl bg-panel-strong" />
      <div className="h-44 animate-pulse rounded-3xl bg-panel-strong" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 animate-pulse rounded-2xl bg-panel-strong" />
        <div className="h-28 animate-pulse rounded-2xl bg-panel-strong" />
      </div>
    </div>
  );
}

export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-[18px] border-[1.5px] border-divider bg-page p-4", className)} {...props} />;
}

export function NightCard({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-[22px] bg-night p-5 text-white", className)} {...props} />;
}

export function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm text-ink-muted", className)} {...props} />;
}

export function SectionTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-[15px] font-bold text-ink-muted", className)} {...props} />;
}
