-- Database-level guards so the books stay sound even if application code has a bug.

-- 1. History is append-only: journal, stock movements and commands can never be changed or deleted.
CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: post a reversing entry instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER journal_entries_append_only BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
--> statement-breakpoint
CREATE TRIGGER journal_lines_append_only BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
--> statement-breakpoint
CREATE TRIGGER stock_movements_append_only BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
--> statement-breakpoint
CREATE TRIGGER commands_append_only BEFORE UPDATE OR DELETE ON commands
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
--> statement-breakpoint

-- 2. Every entry balances (checked at commit, once all its lines are in) and its lines belong to the same business.
CREATE OR REPLACE FUNCTION check_entry_balanced() RETURNS trigger AS $$
DECLARE
  diff bigint;
  line_count int;
  entry_business uuid;
BEGIN
  SELECT business_id INTO entry_business FROM journal_entries WHERE id = NEW.entry_id;
  IF entry_business IS DISTINCT FROM NEW.business_id THEN
    RAISE EXCEPTION 'Journal line business does not match its entry (%)', NEW.entry_id;
  END IF;
  SELECT coalesce(sum(debit_cents - credit_cents), 0), count(*) INTO diff, line_count
    FROM journal_lines WHERE entry_id = NEW.entry_id;
  IF diff <> 0 OR line_count < 2 THEN
    RAISE EXCEPTION 'Journal entry % does not balance (difference % cents, % lines)', NEW.entry_id, diff, line_count;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER journal_lines_balanced AFTER INSERT ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_entry_balanced();
--> statement-breakpoint

-- 3. No entries in a closed month.
CREATE OR REPLACE FUNCTION check_period_open() RETURNS trigger AS $$
DECLARE
  closed text;
BEGIN
  SELECT closed_through INTO closed FROM businesses WHERE id = NEW.business_id;
  IF closed IS NOT NULL AND to_char(NEW.date, 'YYYY-MM') <= closed THEN
    RAISE EXCEPTION 'Month % is closed for this business', to_char(NEW.date, 'YYYY-MM');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER journal_entries_period_open BEFORE INSERT ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION check_period_open();
--> statement-breakpoint
CREATE TRIGGER stock_movements_period_open BEFORE INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION check_period_open();
