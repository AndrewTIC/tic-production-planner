-- Per-build document repository (spec §6.7) — the last item from the
-- original core-schema outline.
--
-- The documents TABLE already exists with its RLS; this adds the Storage
-- bucket the files actually live in, with policies mirroring that table so
-- the two cannot disagree.
--
-- Private bucket: nothing is served by public URL. Downloads go through
-- short-lived signed URLs minted server-side, so a link that escapes the
-- building expires rather than exposing customer drawings indefinitely.

insert into storage.buckets (id, name, public, file_size_limit)
values ('build-documents', 'build-documents', false, 52428800)  -- 50 MiB
on conflict (id) do nothing;

-- MIME types are deliberately unrestricted: the workshop photographs
-- red-penned drawings on whatever is to hand, and a rejected upload at the
-- bench is worse than an unexpected file type in the repository.

-- Everyone signed in can read: viewers need drawings as much as builders.
create policy "build documents read"
  on storage.objects for select to authenticated
  using (bucket_id = 'build-documents');

-- Workshop may upload because they attach photos to notes; the documents
-- table is what enforces that a workshop upload must belong to a note
-- (its insert policy requires note_id). An object with no matching row is
-- invisible to the app, so the table remains the gatekeeper for meaning.
create policy "build documents insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'build-documents'
    and (select public.app_role()) in ('admin', 'commercial', 'workshop')
  );

create policy "build documents update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'build-documents'
    and (select public.app_role()) in ('admin', 'commercial')
  );

create policy "build documents delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'build-documents'
    and (select public.app_role()) in ('admin', 'commercial')
  );
