-- Shopfloor clocking support (spec §6.6).
--
-- Two domain rules that cannot live in the UI:
--
-- 1. A build moves to In-Build at the first clock-on. The kiosk runs as the
--    workshop role, which has no write access to builds under RLS — and it
--    shouldn't: this is a consequence of clocking, not an operator choice.
--    A security definer trigger performs it regardless of the caller.
-- 2. The end-of-shift auto clock-off, likewise, must close entries the
--    operator forgot. It runs as a scheduled job, not as a signed-in user.

-- ── In-Build on first clock-on ────────────────────────────────────
-- Only ever moves a build FORWARD to In-Build: a build already at
-- Ready for despatch, or deliberately parked On-hold, is left alone
-- (both sit after In-Build in the status sequence).
create or replace function public.set_build_in_build_on_clock_on()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  in_build_id uuid;
  in_build_seq int;
begin
  select id, sequence into in_build_id, in_build_seq
  from public.build_statuses where code = 'IN_BUILD';

  if in_build_id is null then
    return new;  -- reference data not seeded; nothing to do
  end if;

  update public.builds b
     set status_id = in_build_id
    from public.operations o, public.build_statuses s
   where o.id = new.operation_id
     and b.id = o.build_id
     and b.status_id = s.id
     and s.sequence < in_build_seq;

  return new;
end;
$$;

create trigger set_build_in_build_on_clock_on
  after insert on time_entries
  for each row execute function public.set_build_in_build_on_clock_on();

-- ── End-of-shift auto clock-off ───────────────────────────────────
-- Closes entries left open, stamping auto_closed so the Admin review
-- screen can surface them (spec §6.6: "flags the entry for review").
-- Entries are closed at the end of the standard day on the date they
-- started — never at "now", which would silently bank hours nobody
-- worked if the job ran late or a machine was left on over a weekend.
--
-- Scheduling belongs to deployment (Phase 5): pg_cron on the office
-- server, or a route handler behind the host's scheduler. Kept as a
-- callable function so it can be run by hand during the trial and
-- tested deterministically.
create or replace function public.auto_close_open_time_entries(
  before_ts timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  closed_count integer;
begin
  with to_close as (
    select id,
           -- 16:00 Europe/London on the entry's own start date.
           ((started_at at time zone 'Europe/London')::date
              + time '16:00') at time zone 'Europe/London' as shift_end
      from public.time_entries
     where ended_at is null
       and not voided
  )
  update public.time_entries te
     set ended_at = greatest(tc.shift_end, te.started_at + interval '1 minute'),
         auto_closed = true
    from to_close tc
   where te.id = tc.id
     and tc.shift_end < before_ts;

  get diagnostics closed_count = row_count;
  return closed_count;
end;
$$;

-- Called by a scheduler, never by a signed-in user.
revoke execute on function public.auto_close_open_time_entries(timestamptz)
  from authenticated, anon;
