-- Run once in Supabase to repair legacy employee colors.
-- Only businesses with repeated or unsupported colors are updated.
-- Colors remain stored in employees.color_token after this repair.
-- The palette repeats when a business has more than twelve employees.
begin;

with colors as (
  select array[
    'employee-blue', 'employee-coral', 'employee-green', 'employee-violet',
    'employee-amber', 'employee-teal', 'employee-indigo', 'employee-rose',
    'employee-cyan', 'employee-olive', 'employee-magenta', 'employee-orange'
  ]::text[] as palette
), businesses_to_repair as (
  select employee.business_id
  from public.employees employee
  cross join colors
  group by employee.business_id
  having count(*) > count(distinct employee.color_token)
    or bool_or(employee.color_token is null or not (employee.color_token = any(colors.palette)))
), ranked_employees as (
  select employee.id,
    colors.palette[
      (((row_number() over (
        partition by employee.business_id
        order by employee.is_active desc, employee.id
      )) - 1) % cardinality(colors.palette))::integer + 1
    ] as assigned_color
  from public.employees employee
  join businesses_to_repair repair on repair.business_id = employee.business_id
  cross join colors
)
update public.employees employee
set color_token = ranked.assigned_color
from ranked_employees ranked
where employee.id = ranked.id
  and employee.color_token is distinct from ranked.assigned_color;

commit;
