drop view if exists public.member_form_completion cascade;
create view public.member_form_completion as
select s.user_id as member_user_id,
       s.unit_id,
       s.form_id,
       s.form_name,
       s.kind,
       coalesce(
         s.total_count::bigint,
         case
           when s.task_ids is not null then jsonb_array_length(s.task_ids)::bigint
           when s.tasks is not null then (select count(*) from jsonb_array_elements(s.tasks))::bigint
           else 0::bigint
         end
       ) as total_count,
       coalesce(
         s.completed_count::bigint,
         case
           when s.tasks is not null then (
             select count(*) from jsonb_array_elements(s.tasks) t where (t->>'status') = 'Cleared'
           )::bigint
           else 0::bigint
         end
       ) as cleared_count,
       case
         when coalesce(s.total_count::bigint,
           case
             when s.task_ids is not null then jsonb_array_length(s.task_ids)::bigint
             when s.tasks is not null then (select count(*) from jsonb_array_elements(s.tasks))::bigint
             else 0::bigint
           end
         ) > 0
          and coalesce(s.completed_count::bigint,
           case
             when s.tasks is not null then (
               select count(*) from jsonb_array_elements(s.tasks) t where (t->>'status') = 'Cleared'
             )::bigint
             else 0::bigint
           end
         ) = coalesce(s.total_count,
           case
             when s.task_ids is not null then jsonb_array_length(s.task_ids)::bigint
             when s.tasks is not null then (select count(*) from jsonb_array_elements(s.tasks))::bigint
             else 0::bigint
           end
         )
         then 'Completed'
         else 'In_Progress'
       end as status
from public.my_form_submissions s
join (
  select user_id, form_id, kind, max(created_at) as latest
  from public.my_form_submissions
  group by user_id, form_id, kind
) latest
  on latest.user_id = s.user_id
 and coalesce(latest.form_id, -1) = coalesce(s.form_id, -1)
 and latest.kind = s.kind
 and latest.latest = s.created_at;
