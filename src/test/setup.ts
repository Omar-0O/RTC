import '@testing-library/jest-dom';

// Provide stub env vars so the Supabase client module can be imported
// in CI without real credentials (unit tests don't hit the network).
if (!import.meta.env.VITE_SUPABASE_URL) {
  // @ts-expect-error - test environment only
  import.meta.env.VITE_SUPABASE_URL = 'https://placeholder.supabase.co';
}
if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  // @ts-expect-error - test environment only
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'placeholder-key';
}
