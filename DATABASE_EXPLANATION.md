# How the Database Works

## Two Separate Tables

### 1. `auth.users` (Supabase Auth - Built-in)
This is managed by Supabase automatically. When someone registers:
- Creates a row in `auth.users`
- Gets a unique UUID: `user.id` (like `a1b2c3d4-...`)
- Stores: email, password hash, etc.

**You don't touch this table directly.**

### 2. `public.users` (Your Custom Table)
This is YOUR table where you store user data:

```sql
CREATE TABLE users (
  email TEXT PRIMARY KEY,           -- Primary key (unique identifier)
  name TEXT NOT NULL,
  user_id UUID,                      -- Links to auth.users(id)
  latest_query TEXT,                 -- Original query string
  latest_cleansed_query TEXT,        -- The query used for search
  last_updated TIMESTAMP,
  first_seen TIMESTAMP
);
```

## How They Connect

```
auth.users                    public.users
┌─────────────┐              ┌─────────────┐
│ id: uuid    │─────────────│ user_id     │  ← Links them together
│ email       │              │ email       │  ← Also matches
│ password    │              │ name        │
│ ...         │              │ latest_...  │
└─────────────┘              └─────────────┘
```

**When user registers:**
1. Supabase creates row in `auth.users` → gets `user.id = "abc-123"`
2. Trigger creates row in `public.users` → sets `user_id = "abc-123"`

**When user submits survey:**
1. Get `user.id` from auth token
2. Find row in `public.users` where `user_id = user.id`
3. Update that row with the query

## The Problem Right Now

Your code does:
```typescript
.upsert({...}, { onConflict: 'user_id' })
```

But `user_id` is NOT a unique constraint! The PRIMARY KEY is `email`.

So Supabase doesn't know what to do on conflict.

## The Solution

You have two options:

### Option 1: Use email as conflict (simpler)
```typescript
.upsert({
  email: normalizedEmail,
  user_id: user.id,
  latest_cleansed_query: cleansedQuery,
  ...
}, {
  onConflict: 'email'  // ← Use email since it's the primary key
})
```

### Option 2: Check first, then update (more explicit)
```typescript
// Check if user exists by user_id
const { data: existing } = await supabaseAdmin
  .from('users')
  .select('email')
  .eq('user_id', user.id)
  .single()

if (existing) {
  // Update by user_id
  await supabaseAdmin
    .from('users')
    .update({ latest_cleansed_query: cleansedQuery, ... })
    .eq('user_id', user.id)
} else {
  // Insert new (upsert by email)
  await supabaseAdmin
    .from('users')
    .upsert({ email, user_id, latest_cleansed_query, ... }, { onConflict: 'email' })
}
```

## Current Flow

1. **User registers** → `auth.users` row created → trigger creates `public.users` row
2. **User submits survey** → Code tries to save query to `public.users`
3. **User logs back in** → Code looks up `public.users` by `user_id` → gets saved query

## What Gets Saved

When user submits:
- `latest_query` - Full query string
- `latest_cleansed_query` - The weighted query used for search (THIS IS THE IMPORTANT ONE)
- `user_id` - Links to auth.users
- `email` - Also stored (for reference)

When user logs back in:
- Code gets `latest_cleansed_query` from `public.users`
- Re-runs search with that query
- Shows results

## Visual Example

```
User: john@tamu.edu
├── auth.users
│   └── id: "abc-123-uuid"
│
└── public.users
    ├── email: "john@tamu.edu" (PRIMARY KEY)
    ├── user_id: "abc-123-uuid" (links to auth)
    ├── name: "John Doe"
    └── latest_cleansed_query: "Engineering | Engineering | Volunteering | ..."
```

When John logs in:
1. Get token → verify → get `user.id = "abc-123-uuid"`
2. Query: `SELECT latest_cleansed_query FROM users WHERE user_id = 'abc-123-uuid'`
3. Get query: `"Engineering | Engineering | Volunteering | ..."`
4. Re-run search with that query
5. Show results

