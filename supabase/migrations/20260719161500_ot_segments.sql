-- Overtime is timestamped and collated separately (Andrew, 19 Jul 2026).
--
-- Until now ot_class was a single label on a whole entry, so a shift clocked
-- 07:30–18:00 classed ALL of its hours as 1.5x when only the two hours after
-- 16:00 were actually overtime. Premium hours were overstated and could not
-- be totalled on their own.
--
-- A clock-on/off is still ONE row — workers should not have to clock twice
-- to cross 16:00. The split is derived: each entry is cut into segments at
-- the standard-day boundaries, and every segment carries its own start and
-- end timestamp, so overtime has a date and time of its own and can be
-- summed independently of standard time.
--
-- Rules (spec §6.4 / CLAUDE.md rule 5), applied per date the entry spans:
--   Sunday          → all of it is 2.0
--   Saturday        → all of it is 1.5
--   Monday–Friday   → 07:30–16:00 is standard; anything before or after
--                     that window is 1.5
-- The unpaid 12:00–13:00 break is deducted from whichever segment covers it,
-- on any day, consistent with worked_minutes().
--
-- time_entries.ot_class is left alone: it remains the entry-level flag that
-- the derivation trigger sets and existing tests rely on. For HOURS, these
-- segments are authoritative — ot_class answers "did this entry involve
-- overtime at all", not "how much".

create or replace function public.time_entry_segments(
  started timestamptz,
  ended timestamptz
)
returns table (
  ot_class text,
  segment_start timestamptz,
  segment_end timestamptz,
  minutes integer
)
language plpgsql
stable
set search_path = ''
as $$
declare
  d date;
  dow int;
  day_start timestamptz;
  day_end timestamptz;
  std_start timestamptz;
  std_end timestamptz;
  seg_start timestamptz;
  seg_end timestamptz;
begin
  if ended is null or ended <= started then
    return;
  end if;

  for d in
    select generate_series(
             (started at time zone 'Europe/London')::date::timestamp,
             (ended   at time zone 'Europe/London')::date::timestamp,
             interval '1 day'
           )::date
  loop
    dow := extract(isodow from d);  -- 1 = Mon … 7 = Sun

    -- Clip the entry to this local day.
    day_start := greatest(started, (d::timestamp) at time zone 'Europe/London');
    day_end   := least(ended, ((d + 1)::timestamp) at time zone 'Europe/London');
    continue when day_end <= day_start;

    if dow = 7 then
      ot_class := '2.0';
      segment_start := day_start;
      segment_end := day_end;
      minutes := coalesce(public.worked_minutes(day_start, day_end), 0);
      return next;

    elsif dow = 6 then
      ot_class := '1.5';
      segment_start := day_start;
      segment_end := day_end;
      minutes := coalesce(public.worked_minutes(day_start, day_end), 0);
      return next;

    else
      std_start := (d::timestamp + time '07:30') at time zone 'Europe/London';
      std_end   := (d::timestamp + time '16:00') at time zone 'Europe/London';

      -- Early start, before the standard day opens.
      seg_start := day_start;
      seg_end   := least(day_end, std_start);
      if seg_end > seg_start then
        ot_class := '1.5';
        segment_start := seg_start;
        segment_end := seg_end;
        minutes := coalesce(public.worked_minutes(seg_start, seg_end), 0);
        return next;
      end if;

      -- The standard day itself.
      seg_start := greatest(day_start, std_start);
      seg_end   := least(day_end, std_end);
      if seg_end > seg_start then
        ot_class := 'none';
        segment_start := seg_start;
        segment_end := seg_end;
        minutes := coalesce(public.worked_minutes(seg_start, seg_end), 0);
        return next;
      end if;

      -- Evening overtime, after the standard day closes.
      seg_start := greatest(day_start, std_end);
      seg_end   := day_end;
      if seg_end > seg_start then
        ot_class := '1.5';
        segment_start := seg_start;
        segment_end := seg_end;
        minutes := coalesce(public.worked_minutes(seg_start, seg_end), 0);
        return next;
      end if;
    end if;
  end loop;
end;
$$;

comment on function public.time_entry_segments(timestamptz, timestamptz) is
  'Splits a time entry at the standard-day boundaries into timestamped standard / 1.5x / 2.0x segments. Segment minutes are net of the unpaid break and sum to worked_minutes().';

-- Collation surface: one row per segment, carrying the entry it came from
-- so hours can be grouped by worker, build, phase, week, or OT class.
-- Voided entries are excluded, exactly as active_time_entries excludes them.
create or replace view public.active_time_entry_segments
with (security_invoker = true) as
  select te.id           as time_entry_id,
         te.worker_id,
         te.operation_id,
         te.auto_closed,
         s.ot_class,
         s.segment_start,
         s.segment_end,
         s.minutes,
         (s.segment_start at time zone 'Europe/London')::date as segment_date
    from public.time_entries te
    cross join lateral public.time_entry_segments(te.started_at, te.ended_at) s
   where not te.voided;

grant select on public.active_time_entry_segments to authenticated, service_role;
