# Onboarding System Setup

## What Changed

The application has been transformed from a one-time survey to a persistent onboarding system:

1. **User Profiles**: Full profile data is now saved and associated with authenticated users
2. **Persistent Results**: When users log back in, they see their previous results
3. **Resubmit Feature**: Users can resubmit their interests to get updated matches
4. **Profile Restoration**: All form data is restored when users return

## Database Migration Required

Run this SQL in your Supabase SQL Editor:

```sql
-- See scripts/migrate-user-profiles.sql
```

This adds:
- `profile_data` (JSONB) - Full onboarding profile
- `search_results` (JSONB) - Last search results
- `last_search_query` (TEXT) - Last query used
- `onboarding_completed` (BOOLEAN) - Completion status

## How It Works

### First Time User:
1. User registers and logs in
2. Completes onboarding form
3. Profile and results are saved
4. Results are displayed

### Returning User:
1. User logs in
2. System loads their saved profile
3. If results exist, they're displayed immediately
4. If no results, search is re-run automatically
5. User can click "Resubmit Interests" to update matches

### Resubmit Interests:
- Button appears when user has completed onboarding
- Re-runs search with current profile data
- Updates saved results

## API Endpoints

### GET `/api/profile`
- Loads user's saved profile and results
- Requires authentication
- Returns: `{ profile: {...} }`

### POST `/api/submit`
- Saves full profile data and search results
- Requires authentication
- Saves: `profileData`, `searchResults`, `last_search_query`

## Key Features

- ✅ Persistent user profiles
- ✅ Automatic result restoration
- ✅ Resubmit interests functionality
- ✅ Full profile data storage
- ✅ Search result caching
- ✅ User-specific data (linked via `user_id`)

## Testing

1. Register a new user
2. Complete onboarding
3. Log out
4. Log back in
5. Verify results are shown automatically
6. Click "Resubmit Interests" to update matches

