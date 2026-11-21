-- Phase 3 Hardening: Audit trigger on expenses
-- Automatically logs updates and soft deletes to public.expense_audit

create or replace function public.fn_audit_expense_changes()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if (TG_OP = 'UPDATE') then
    if (OLD.deleted_at is null and NEW.deleted_at is not null) then
      -- Soft delete event
      insert into public.expense_audit (
        expense_id,
        group_id,
        action,
        old_data,
        new_data,
        changed_by
      ) values (
        OLD.id,
        OLD.group_id,
        'SOFT_DELETE',
        to_jsonb(OLD),
        to_jsonb(NEW),
        auth.uid()
      );
    else
      -- Regular edit / update event
      insert into public.expense_audit (
        expense_id,
        group_id,
        action,
        old_data,
        new_data,
        changed_by
      ) values (
        OLD.id,
        OLD.group_id,
        'UPDATE',
        to_jsonb(OLD),
        to_jsonb(NEW),
        auth.uid()
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists tr_audit_expense_changes on public.expenses;
create trigger tr_audit_expense_changes
  after update on public.expenses
  for each row
  execute function public.fn_audit_expense_changes();
