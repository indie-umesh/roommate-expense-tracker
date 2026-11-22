import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jwmbpehhosqhcrgvyfeb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bWJwZWhob3NxaGNyZ3Z5ZmViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyNzMwODksImV4cCI6MjExMDg0OTA4OX0.R-IOdAapIQmW4Lyak1B8UPDMpRGLsSQo0R_Pd39VDfA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'phone8888888888@roommate.com',
    password: 'DemoPassword!123',
  });
  console.log("Auth:", { user: authData?.user?.id, session: !!authData?.session, authError });

  if (authData?.session) {
    // Test RPC create_group
    const rpcRes = await supabase.rpc('create_group', { p_name: 'Test Vikas Nagar' });
    console.log("RPC create_group result:", rpcRes);
  }
}

test().catch(console.error);
