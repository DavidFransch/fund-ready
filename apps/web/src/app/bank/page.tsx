"use client";

import { CircleCheck, FileUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BANK_NAME, defaultChoice, extraCommand, sampleStatement, type ExtraChoice, type ExtraLine } from "@/books/bank";
import { CATEGORY_LABEL } from "@/books/describe";
import { formatDay } from "@/books/dates";
import { openInvoices } from "@/books/selectors";
import { useBooks } from "@/books/store";
import { FreshOnEachVisit } from "@/components/app/fresh";
import { Chips } from "@/components/app/inputs";
import { Divider, Loading, Panel, Pill, Screen, STROKE } from "@/components/app/screen";
import { Button } from "@/components/ui/button";
import { useFeature } from "@/features";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function BankPage() {
  return (
    <FreshOnEachVisit>
      <BankPreview />
    </FreshOnEachVisit>
  );
}

const signed = (cents: number) => (cents < 0 ? `−${money(-cents)}` : money(cents));
const day = (d: string) => formatDay(d, { day: "numeric", month: "short" });

function BankPreview() {
  const on = useFeature("bankImport");
  const { snapshot } = useBooks();
  const [stage, setStage] = useState<"upload" | "reading" | "matches">("upload");
  const [notice, setNotice] = useState<string | null>(null);
  const statement = useMemo(() => (snapshot ? sampleStatement(snapshot) : null), [snapshot]);

  useEffect(() => {
    if (stage !== "reading") return;
    const t = setTimeout(() => setStage("matches"), 1200);
    return () => clearTimeout(t);
  }, [stage]);

  if (!snapshot || !statement) return <Loading />;
  const lines = statement.matched.length + statement.extras.length;
  const title = (
    <span className="flex items-center gap-2">
      {stage === "upload" ? "Upload your bank statement" : "Bank statement"} <Pill>Preview</Pill>
    </span>
  );

  if (!on) {
    return (
      <Screen nav header={<h1 className="px-5 pt-[22px] text-2xl font-semibold lg:px-0 lg:pt-0 lg:text-[28px]">Bank statement</h1>}>
        <Panel className="p-5 text-[15px] text-ink-muted">This preview is switched off. Turn on &quot;Bank statement (preview)&quot; in Demo settings.</Panel>
      </Screen>
    );
  }

  const startReading = (dropped?: boolean) => {
    setNotice(dropped ? "In this preview we use a sample statement." : null);
    setStage("reading");
  };

  return (
    <Screen nav header={<h1 className="px-5 pt-[22px] text-2xl font-semibold lg:px-0 lg:pt-0 lg:text-[28px]">{title}</h1>}>
      <div data-tour="bank" className="flex flex-col gap-4">
        {notice && <p className="rounded-[14px] bg-brand-tint px-3.5 py-3 text-sm">{notice}</p>}

        {stage === "upload" && (
          <>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                startReading(true);
              }}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-[20px] border-2 border-dashed border-input-border px-5 py-10 text-center hover:bg-panel"
            >
              <FileUp className="size-8 text-ink-muted" strokeWidth={STROKE} aria-hidden />
              <span className="text-[15px] font-semibold">Drop your statement here</span>
              <span className="text-sm text-ink-muted">PDF or CSV from any bank</span>
              <input type="file" accept=".pdf,.csv" className="sr-only" onChange={(e) => e.target.files?.length && startReading(true)} />
            </label>
            <Button size="primary" onClick={() => startReading()} className="lg:w-auto lg:self-start lg:px-6">
              Use sample statement ({BANK_NAME}, last 14 days)
            </Button>
          </>
        )}

        {stage === "reading" && (
          <Panel role="status" className="flex items-center gap-3 p-5 text-[15px]">
            <Loader2 className="size-5 animate-spin text-brand" aria-hidden /> Reading {lines} lines…
          </Panel>
        )}

        {stage === "matches" && <Matches statement={statement} />}
      </div>
    </Screen>
  );
}

function Matches({ statement }: { statement: ReturnType<typeof sampleStatement> }) {
  const { matched, extras, statementBalance, booksBalance } = statement;
  const open = extras.filter((x) => !x.recordedAs).length;
  const reconciled = open === 0 && statementBalance === booksBalance;
  return (
    <>
      <Panel aria-label="Summary" className="flex flex-col gap-1.5 p-4">
        <span className="text-[17px] font-semibold">
          {matched.length + extras.length} lines · {matched.length + extras.length - open} matched · {open} need you
        </span>
        <span className="text-sm text-ink-muted">
          {BANK_NAME}, {day(statement.from)} to {day(statement.to)} · Statement balance {money(statementBalance)} · Books {money(booksBalance)}
        </span>
      </Panel>

      {reconciled && (
        <p role="status" className="flex items-center gap-2 rounded-[14px] bg-brand-tint px-3.5 py-3 text-[15px] font-semibold text-positive">
          <CircleCheck className="size-5" strokeWidth={STROKE} aria-hidden /> Bank reconciled: statement {money(statementBalance)} = books {money(booksBalance)}
        </p>
      )}

      <section aria-label="Need you" className="flex flex-col gap-2">
        <h2 className="px-1 text-[13px] font-semibold tracking-[0.02em] text-ink-muted uppercase">Not in your books yet</h2>
        <Panel className="flex flex-col">
          {extras.map((x, i) => (
            <Fragment key={x.id}>
              {i > 0 && <Divider />}
              <ExtraRow line={x} />
            </Fragment>
          ))}
        </Panel>
      </section>

      <section aria-label="Matched" className="flex flex-col gap-2">
        <h2 className="px-1 text-[13px] font-semibold tracking-[0.02em] text-ink-muted uppercase">Matched to your books</h2>
        <Panel className="flex flex-col py-1">
          <div className="hidden grid-cols-[72px_minmax(0,1fr)_120px_minmax(0,1fr)] gap-3 px-4 py-2 text-xs font-medium text-ink-muted lg:grid">
            <span>Date</span>
            <span>Description</span>
            <span className="text-right">Amount</span>
            <span>In your books</span>
          </div>
          {matched.map((l, i) => (
            <Fragment key={l.id}>
              {i > 0 && <Divider />}
              <Link
                href={`/accountant?entry=${l.entryId}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-panel-strong lg:grid-cols-[72px_minmax(0,1fr)_120px_minmax(0,1fr)] lg:items-center"
              >
                <span className="text-[13px] text-ink-muted lg:order-none lg:text-sm">{day(l.date)}</span>
                <span className={cn("row-span-2 self-center text-right text-[15px] font-semibold lg:order-3 lg:row-span-1", l.amount > 0 && "text-positive")}>{signed(l.amount)}</span>
                <span className="text-[15px] font-medium lg:order-2">{l.description}</span>
                <span className="col-span-2 flex items-center gap-1.5 text-[13px] text-positive lg:order-4 lg:col-span-1">
                  <CircleCheck className="size-4 shrink-0" strokeWidth={STROKE} aria-hidden /> Matched to {l.matchedTo}
                </span>
              </Link>
            </Fragment>
          ))}
        </Panel>
      </section>
    </>
  );
}

function suggestion(x: ExtraLine, c: ExtraChoice): string {
  if (c.kind === "fee") return `Expense · ${CATEGORY_LABEL[c.category]} · paid from Bank`;
  if (c.kind === "interest") return c.as === "income" ? "Other income" : "Owner put money in";
  return `Payment from ${x.invoice?.customer ?? "customer"} for ${c.invoice}`;
}

function ExtraRow({ line }: { line: ExtraLine }) {
  const { snapshot, execute } = useBooks();
  const [choice, setChoice] = useState<ExtraChoice>(() => defaultChoice(line));
  const [changing, setChanging] = useState(false);
  const invoices = useMemo(() => (snapshot ? openInvoices(snapshot) : []), [snapshot]);

  const confirm = () => {
    const r = execute(extraCommand(line, choice, invoices));
    if (r.ok) toast.success("Recorded", { description: suggestion(line, choice) });
    else toast.error(r.message);
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
        <span className="text-[13px] text-ink-muted">{day(line.date)}</span>
        <span className={cn("row-span-2 self-center text-[15px] font-semibold", line.amount > 0 && "text-positive")}>{signed(line.amount)}</span>
        <span className="text-[15px] font-medium">{line.description}</span>
      </div>
      {line.recordedAs ? (
        <span className="flex items-center gap-1.5 text-[13px] text-positive">
          <CircleCheck className="size-4" strokeWidth={STROKE} aria-hidden /> Recorded as {line.recordedAs}
        </span>
      ) : (
        <>
          <span className="text-sm">
            <span className="text-ink-muted">Suggested: </span>
            <span className="font-medium">{suggestion(line, choice)}</span>
          </span>
          {changing && choice.kind === "fee" && (
            <Chips label="Record it as" options={(["bank_fees", "other"] as const).map((v) => ({ value: v, label: CATEGORY_LABEL[v] }))} value={choice.category} onChange={(category) => setChoice({ kind: "fee", category })} />
          )}
          {changing && choice.kind === "interest" && (
            <Chips
              label="Record it as"
              options={[
                { value: "income" as const, label: "Other income" },
                { value: "owner" as const, label: "Owner put money in" },
              ]}
              value={choice.as}
              onChange={(as) => setChoice({ kind: "interest", as })}
            />
          )}
          {changing && choice.kind === "eft" && invoices.length > 0 && (
            <Chips label="Which invoice?" options={invoices.map((i) => ({ value: i.number, label: `${i.number} · ${i.customer} · ${money(i.amount)}` }))} value={choice.invoice} onChange={(invoice) => setChoice({ kind: "eft", invoice })} />
          )}
          <div className="flex gap-2">
            <Button size="touch" className="flex-1 lg:flex-none lg:px-6" onClick={confirm}>
              Confirm
            </Button>
            <Button size="touch" variant="outline" className="flex-1 lg:flex-none lg:px-6" aria-expanded={changing} onClick={() => setChanging((c) => !c)}>
              {changing ? "Done" : "Change"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
