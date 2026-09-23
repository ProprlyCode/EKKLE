import { supabase } from '@/lib/supabase';

/** Homepage waitlist — anonymous, insert-only via the join_waitlist RPC. */
export async function joinWaitlist(input: {
  name: string;
  email: string;
  ministry: string;
}): Promise<void> {
  const { error } = await supabase.rpc('join_waitlist', {
    p_name: input.name,
    p_email: input.email,
    p_ministry: input.ministry,
  });
  if (error) throw error;
}
