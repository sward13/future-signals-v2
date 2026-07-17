-- Publish defect fix: a freshly inserted publication row must not read as
-- publicly live before any snapshot has been generated and uploaded.
-- Change the status column default from 'published' to 'unpublished'.
-- Column-default change only — no other schema changes; table has no rows.

alter table public.project_publications alter column status set default 'unpublished';
