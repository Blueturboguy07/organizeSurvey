-- Backfill missing user_profiles for all auth.users who don't have one
-- Only creates profiles for regular users (not org accounts)
INSERT INTO public.user_profiles (id, email, name)
SELECT 
  au.id, 
  au.email, 
  COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1))
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.id = au.id
WHERE up.id IS NULL
  AND (au.raw_user_meta_data->>'is_org_account')::boolean IS NOT TRUE
ON CONFLICT (id) DO NOTHING;
