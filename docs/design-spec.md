# FundReady design spec (v2)

Source of truth: the "FundReady v2" page of the design canvas
https://claude.ai/artifact/DmTXphEKfAiYP3F5fYHjbs (8 screens: Home, Buy stock, Check and save,
New sale, Count stock, Petty cash, Reports, Accountant view).

Direction: quiet, trustworthy fintech. White page, soft grey grouped panels, near-black ink,
one evergreen brand colour for primary actions and positive money, a lime accent only on the
dark balance card. Money is the hero of every screen. No gradients, no emoji, no bordered
"cards with coloured left edges", no pastel tiles.

## Tokens

Replace the tokens in `apps/web/src/app/globals.css` with these (keep names semantic).

| Token | Value | Use |
|---|---|---|
| `--color-page` | `#FFFFFF` | App background |
| `--color-panel` | `#F4F5F4` | Grouped panels, list containers, input wells |
| `--color-panel-strong` | `#F1F2F1` | Segmented-control track, active nav item (desktop) |
| `--color-divider` | `#E7E9E8` | Dividers inside panels |
| `--color-hairline` | `#ECEEED` | Page-level borders (bottom nav, desktop columns) |
| `--color-input-border` | `#DCE3DF` | Inputs and outline buttons |
| `--color-ink` | `#111412` | Primary text, active nav, selected chips, secondary buttons |
| `--color-ink-muted` | `#5F6763` | Secondary text and labels |
| `--color-ink-faint` | `#8A918D` | Cents after the main figure, disabled |
| `--color-brand` | `#0F5D43` | Primary buttons, links, chart highlight |
| `--color-brand-strong` | `#0A4231` | Hover/pressed brand, text on brand tint |
| `--color-brand-tint` | `#E8F3EE` | Info strips ("Stock after this…"), positive icon tiles |
| `--color-positive` | `#12764F` | Money in, "Balanced" |
| `--color-negative` | `#B4401A` | Money out, losses, "short" |
| `--color-negative-tint` | `#FBEDE6` | Negative icon tile, "Lost or stolen" selected |
| `--color-night` | `#0E1F18` | Dark balance card / count result card |
| `--color-night-raised` | `#17302A` | Tiles inside the dark card |
| `--color-night-line` | `#23392F` | Divider inside the dark card |
| `--color-night-muted` | `#A9BDB4` | Labels on the dark card |
| `--color-accent` | `#C6F36B` | Lime: "money in" on the dark card and the logo's second bar only |

Contrast: all text/background pairs above meet WCAG AA at their used sizes.

## Type

- One family: **Geist** (`@fontsource-variable/geist`), plus **Geist Mono** for account codes and
  journal references. Replace Atkinson Hyperlegible and Bricolage Grotesque.
- `font-variant-numeric: tabular-nums` on the app root, so amounts line up.
- Scale: 52 (sale amount), 38–40 (balances), 28 (desktop page title), 24 (screen title),
  20–22 (sheet title, sub-screen title), 16–17 (item names, panel figures), 15 (body, list titles),
  13 (secondary), 12 (labels, nav). Weights 400/500/600 only. Headings `letter-spacing: -0.02em`.
- Big amounts: whole rand at full size, cents at ~55% size in `--color-ink-faint`
  (e.g. R1 300<small>.00</small>).

## Shape, spacing, elevation

- Screen gutter 16px (panels), 20px (titles). Gaps between sections 12–22px.
- Radius: panels 18–20, dark card 24, list rows inside panels 0, inputs 12, icon tiles 10–12,
  bottom sheet 28 (top corners), **buttons and segmented controls fully round (999px)**.
- No borders on panels: grey fill does the grouping. Dividers inside panels are 1px `--color-divider`,
  inset to the text start where rows have an icon.
- Shadows only on: the selected segment (`0 1px 3px rgba(17,20,18,.1)`) and the bottom sheet.
- Touch targets ≥ 44px everywhere (steppers, back buttons, chips, nav).

## Components

- **Buttons**: primary = brand fill, white text, 54px high, pill. Secondary = `--color-ink` fill
  (desktop) or outline `--color-input-border` (mobile), pill. Tertiary = text only.
- **Segmented control**: pill track `--color-panel-strong`, selected segment white with the small shadow.
- **Choice tiles** (how are you paying): grey panel tile; selected = 1.5px brand border, very light
  brand fill `#F2F8F5`, filled check icon before the label, secondary line under it.
- **Chips** (paid with): outline pill; selected = ink fill, white text.
- **Stepper**: white pill inside a grey panel (or grey pill on white), − value + with 44px buttons.
- **List rows**: 40px icon tile (tint by meaning: brand tint for in, negative tint for out,
  white/neutral for stock), title 15/500, secondary 13 muted, amount right 15/600 coloured by
  direction (in = positive with "+", out = negative with "−", neutral = ink).
- **Status** is coloured text, not badges, except the small "Balanced" pill and margin pill.
- **Dark balance card** (Home): label, big figure, two raised tiles (Petty cash, Bank), divider,
  "This week" with lime money-in and white money-out.
- **Info strip**: brand tint background, brand-strong text, icon left, one sentence.
- **Bottom nav** (mobile): Home, Stock, Petty cash, Reports, Books. 22px line icons, 12px labels,
  active = ink + 600 weight, inactive = muted. White, hairline top border.
- **Bottom sheet** ("Check and save"): handle, title, one-line description, plain-language
  outcome rows, collapsible "What your books record" with a mini journal table and Balanced pill,
  primary "Save …" + tertiary "Edit".
- **Journal table**: Account (mono code + name) | Debit | Credit, right-aligned figures,
  totals row, em dash for empty cells in the sheet, blank in the desktop panel.
- **Icons**: lucide-react, stroke 1.75, size 18–24.
- **Logo**: 40px brand rounded square with two horizontal bars (white over lime) = balance.
  Wordmark "FundReady" in Geist 600 where needed.

## Screens (behaviour notes)

1. **Home**: business name + date, notifications button; dark balance card; four quick actions
   (Sell = filled brand, Buy stock, Expense, Count = grey); "Customers owe you" / "You owe suppliers";
   "Today" activity list (tap → journal entry).
2. **Buy stock**: segmented Stock for the shop / Other expense; item panel with quantity stepper
   and cost each, live total; supplier; 2×2 payment tiles (Petty cash, Bank, Pay later,
   My own pocket) with available balances; info strip "Stock after this: 4 → 12 bottles";
   sticky "Review purchase".
3. **Check and save**: bottom sheet as above. Demo values: Stock 4 → 12, You owe the supplier
   R176.00, Petty cash and bank no change; Dr 1200 Stock 176.00 / Cr 2000 Trade creditors 176.00.
4. **New sale**: big amount centred, "2 × Cooldrink 2L at R30.00 (list price)"; item panel with
   stepper; paid-with chips Cash/Card/EFT/Later; panel: Stock 12 → 10, What these cost you R44.00,
   Profit on this sale R16.00 with "27% margin" pill; info strip on where the money goes.
5. **Count stock**: panel of items with expected vs counted steppers; a short item shows
   "Expected 10 · 2 short" in negative and reason radio pills (Lost or stolen / Used in the shop);
   dark result card "R44.00 stock loss"; sticky "Save count".
6. **Petty cash**: balance panel (big figure, today in/out), Top up (brand) and Bank it (outline)
   pills; movements grouped by day (TODAY / YESTERDAY), each with amount and running balance.
7. **Reports**: Day/Week/Month segmented; period navigator with prev/next (next disabled for the
   current period); Profit as the hero; sales bar chart in a grey panel (current bar brand, others
   `#CDD3D0`); breakdown panel: Sales, Cost of what you sold (incl. stock lost), Expenses with
   categories, Profit.
8. **Accountant view** (desktop, fluid): left sidebar (business switcher, Journal, Trial balance,
   Profit and loss, Balance sheet, Exports, Back to the app); main: title, "Export for accountant"
   ink pill, four grey KPI tiles (Entries today, Total debits, Total credits, Trial balance
   Balanced); underline tabs (Today, All, Sales, Purchases, Stock, Petty cash); dense table
   grouped by day (Time | What happened | Type | Amount), selected row light brand fill;
   right panel shows the selected entry: reference (mono), title, journal table, "Debits equal
   credits", Recorded from / by, "Can it be edited? No · reverse it instead". Stacks at narrow widths.

## Demo numbers (keep consistent with the seed)

Hero item Cooldrink 2L, cost R22.00, list price R30.00: 4 on hand → buy 8 on pay later (R176.00,
Gugulethu Cash & Carry) → 12 → sell 2 for cash (R60.00, cost R44.00, profit R16.00) → 10 →
count 8, lost or stolen (R44.00 stock loss). Packaging: carrier bags R85.00 from petty cash.
Petty cash top-up R500.00 from bank.
