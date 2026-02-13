-- Feedback/Bug Report System
-- Users can submit bugs or feature requests with descriptions and screenshots
-- Admins can view and manage all submissions

-- Create enum for feedback type
create type feedback_type as enum ('bug', 'feature');

-- Create enum for feedback status
create type feedback_status as enum ('pending', 'in-progress', 'resolved', 'closed');

-- Create feedback table
create table feedback (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    type feedback_type not null,
    title text not null,
    description text not null,
    screenshot_url text,
    status feedback_status not null default 'pending',
    admin_notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Create index for quick lookups
create index idx_feedback_user_id on feedback(user_id);
create index idx_feedback_status on feedback(status);
create index idx_feedback_created_at on feedback(created_at desc);

-- Enable RLS
alter table feedback enable row level security;

-- Users can insert their own feedback
create policy "Users can create feedback"
    on feedback for insert
    to authenticated
    with check (auth.uid() = user_id);

-- Users can view their own feedback
create policy "Users can view own feedback"
    on feedback for select
    to authenticated
    using (auth.uid() = user_id);

-- Add is_admin column to profiles if not exists
alter table profiles add column if not exists is_admin boolean not null default false;

-- Admin policy: admins can view all feedback
create policy "Admins can view all feedback"
    on feedback for select
    to authenticated
    using (
        exists (
            select 1 from profiles 
            where profiles.id = auth.uid() 
            and profiles.is_admin = true
        )
    );

-- Admin policy: admins can update feedback (status, notes)
create policy "Admins can update feedback"
    on feedback for update
    to authenticated
    using (
        exists (
            select 1 from profiles 
            where profiles.id = auth.uid() 
            and profiles.is_admin = true
        )
    );

-- Create storage bucket for feedback screenshots
insert into storage.buckets (id, name, public)
values ('feedback', 'feedback', true)
on conflict (id) do nothing;

-- Storage policy: authenticated users can upload to feedback bucket
create policy "Users can upload feedback screenshots"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'feedback');

-- Storage policy: public can read feedback screenshots
create policy "Public can view feedback screenshots"
    on storage.objects for select
    to public
    using (bucket_id = 'feedback');

-- Function to get all feedback (for admins)
create or replace function get_all_feedback()
returns table (
    id uuid,
    user_id uuid,
    username text,
    avatar_url text,
    type feedback_type,
    title text,
    description text,
    screenshot_url text,
    status feedback_status,
    admin_notes text,
    created_at timestamptz,
    updated_at timestamptz
)
language plpgsql
security definer
as $$
begin
    -- Check if user is admin
    if not exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true) then
        raise exception 'Unauthorized: Admin access required';
    end if;
    
    return query
    select 
        f.id,
        f.user_id,
        p.username,
        p.avatar_url,
        f.type,
        f.title,
        f.description,
        f.screenshot_url,
        f.status,
        f.admin_notes,
        f.created_at,
        f.updated_at
    from feedback f
    join profiles p on p.id = f.user_id
    order by f.created_at desc;
end;
$$;

-- Grant execute to authenticated
grant execute on function get_all_feedback() to authenticated;
