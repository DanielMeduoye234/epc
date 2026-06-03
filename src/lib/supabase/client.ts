import { createBrowserClient } from '@supabase/ssr';
import { isDemoMode } from '@/lib/demo-data';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (isDemoMode()) {
    if (!client) {
      client = createBrowserClient(
        'https://demo.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
      );
    }
    return client;
  }
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
