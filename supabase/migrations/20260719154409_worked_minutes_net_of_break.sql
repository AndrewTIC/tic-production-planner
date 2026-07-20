-- Worked time is elapsed time MINUS the unpaid lunch break.
--
-- The standard day is 07:30–16:00 with 12:00–13:00 unpaid: 8.5 hours on the
-- clock, 7.5 productive (CLAUDE.md rule 5). Until now every consumer
-- measured ended_at - started_at, so a normal full day credited 8.5 hours to
-- a build — overstating actuals against estimates, and every report built on
-- them. Reported by Andrew, 19 Jul 2026.
--
-- Deriving this centrally means the app, the reports, and any CSV export
-- cannot disagree about what a day is worth. It is exposed on the
-- active_time_entries view, which is what everything except the admin audit
-- screen already queries.
--
-- Policy: the break is deducted whenever an entry spans it. The system
-- cannot know that someone worked through lunch — if they did, an Admin
-- corrects the entry, which is the same route as any other mis-clock.

create or replace function public.worked_minutes(
  started timestamptz,
  ended timestamptz
)
returns integer
language sql
stable
set search_path = ''
as $$
  select case
    when ended is null or ended <= started then null
    else greatest(
      0,
      (extract(epoch from (ended - started)) / 60)::int
      -- Subtract the overlap with 12:00–13:00 local on every date the entry
      -- touches, so an entry spanning midnight (an admin correction, say) is
      -- still charged only for the breaks it actually covers.
      - coalesce((
          select sum(
                   greatest(
                     0,
                     extract(epoch from (
                       least(ended, ((d::date + time '13:00') at time zone 'Europe/London'))
                       - greatest(started, ((d::date + time '12:00') at time zone 'Europe/London'))
                     )) / 60
                   )
                 )::int
            from generate_series(
                   (started at time zone 'Europe/London')::date::timestamp,
                   (ended   at time zone 'Europe/London')::date::timestamp,
                   interval '1 day'
                 ) as d
        ), 0)
    )
  end
$$;

comment on function public.worked_minutes(timestamptz, timestamptz) is
  'Productive minutes for a time entry: elapsed less any overlap with the unpaid 12:00-13:00 break. Null while the entry is open.';


-- Republish the view with the derived column appended, so every existing
-- consumer keeps working and gains net hours for free.
create or replace view public.active_time_entries
with (security_invoker = true) as
  select *,
         public.worked_minutes(started_at, ended_at) as worked_minutes
    from public.time_entries
   where not voided;

-- The Admin audit view (spec §6.6), as a view rather than a raw table read:
-- voided entries carry the same derived worked_minutes, and the one screen
-- allowed to show them has a named thing to query. security_invoker keeps
-- the caller's RLS in force.
create or replace view public.voided_time_entries
with (security_invoker = true) as
  select *,
         public.worked_minutes(started_at, ended_at) as worked_minutes
    from public.time_entries
   where voided;

grant select on public.voided_time_entries to authenticated, service_role;
