const SUPABASE_URL = 'https://oakkfndpfsbusdcfozyv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lC89Gu7yVCtUp2h-ClPsuQ_Y78QAG3c';

async function testFeedback() {
  console.log('Testing submit-feedback without auth token (Expect 401):');
  const resNoAuth = await fetch(`${SUPABASE_URL}/functions/v1/submit-feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      type: 'bug',
      title: 'Test Bug',
      description: 'This is a test bug description for verification.',
    })
  });
  console.log('Status:', resNoAuth.status);
  console.log('Response:', await resNoAuth.json());
}

testFeedback();
