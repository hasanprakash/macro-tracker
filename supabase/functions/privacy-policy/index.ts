Deno.serve(async (req) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - Day Fuel</title>
  <style>
    :root {
      --bg: #0F172A;
      --card-bg: #1E293B;
      --text: #F8FAFC;
      --text-muted: #94A3B8;
      --primary: #10B981;
      --border: #334155;
      --accent: #6366F1;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      margin: 0;
      padding: 24px 16px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: var(--card-bg);
      padding: 36px 28px;
      border-radius: 16px;
      border: 1px solid var(--border);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    }
    h1 {
      font-size: 28px;
      color: var(--primary);
      margin-top: 0;
      margin-bottom: 8px;
    }
    .subtitle {
      color: var(--text-muted);
      font-size: 14px;
      margin-bottom: 28px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }
    h2 {
      font-size: 20px;
      color: var(--text);
      margin-top: 28px;
      margin-bottom: 12px;
      border-left: 4px solid var(--primary);
      padding-left: 10px;
    }
    p, li {
      color: var(--text-muted);
      font-size: 15px;
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
    }
    strong {
      color: var(--text);
    }
    .highlight-box {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 16px;
      border-radius: 12px;
      margin: 20px 0;
    }
    .footer {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      font-size: 13px;
      color: var(--text-muted);
      text-align: center;
    }
    a {
      color: var(--primary);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Privacy Policy for Day Fuel</h1>
    <div class="subtitle">Effective Date: September 1, 2026 | Last Updated: September 1, 2026</div>

    <p>Welcome to <strong>Day Fuel</strong> ("we", "our", or "the App"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains what information we collect, how we use it, how we protect it, and your rights regarding your data.</p>

    <h2>1. Information We Collect</h2>
    <p>To provide you with personalized nutrition and fitness tracking, we collect the following categories of information:</p>
    <ul>
      <li><strong>Account Information:</strong> When you register or sign in (via Email or Google Sign-In), we receive your email address and basic profile identifier.</li>
      <li><strong>Profile & Physical Metrics:</strong> Information you provide such as age, gender, height, weight, target weight, activity level, and dietary goals to calculate Basal Metabolic Rate (BMR) and recommended daily calorie/macro targets.</li>
      <li><strong>Nutrition & Meal Data:</strong> Food names, quantities, calorie estimates, macronutrients (protein, carbs, fat), meal timestamps, and optional user notes.</li>
      <li><strong>Photo / Camera Data:</strong> Food images captured or selected by you for AI-powered nutritional estimation.</li>
    </ul>

    <div class="highlight-box">
      <h2 style="margin-top: 0; border: none; padding-left: 0; color: #10B981;">2. Google Health Connect & Health Data Disclosure</h2>
      <p><strong>Day Fuel integrates with Android Health Connect</strong> to read daily physical activity data. Specifically:</p>
      <ul>
        <li><strong>Permissions Requested:</strong> <code>READ_STEPS</code> and <code>READ_ACTIVE_CALORIES_BURNED</code>.</li>
        <li><strong>Purpose of Use:</strong> We access step counts and active burned calories solely to compute your daily activity calorie credits in real time and adjust your target calorie budget.</li>
        <li><strong>Privacy Commitment:</strong> Health Connect data is <strong>never</strong> transferred to third parties, data brokers, or advertising platforms. It is <strong>never</strong> used for advertising, marketing, or training artificial intelligence models without explicit permission.</li>
        <li><strong>User Control:</strong> You can grant or revoke Health Connect access at any time through the Health Connect system settings on your Android device.</li>
      </ul>
    </div>

    <h2>3. Artificial Intelligence & Image Processing</h2>
    <p>When you use the AI Food Scanner feature, your meal photo or text description is transmitted securely to our backend AI processing pipeline (powered by Google Gemini API) to identify food items and estimate macronutrients. Images are processed ephemerally for nutritional estimation and are never used to train public AI models.</p>

    <h2>4. How We Use Your Information</h2>
    <p>We use the collected information exclusively to:</p>
    <ul>
      <li>Calculate personalized daily calorie and macronutrient targets.</li>
      <li>Log and display your meals, workouts, and weight progress history.</li>
      <li>Sync workout and step data from Health Connect to update your daily energy balance.</li>
      <li>Provide customer support, bug fixes, and feature improvements.</li>
    </ul>

    <h2>5. Data Storage, Security & Retention</h2>
    <p>All data is transmitted securely over encrypted channels using <strong>HTTPS and TLS 1.3</strong>. Data is stored in secure, access-controlled cloud databases (Supabase / PostgreSQL) protected by Row-Level Security (RLS) policies ensuring only you can access your records.</p>

    <h2>6. Account & Data Deletion Requests</h2>
    <p>You have full control over your data. You may request complete deletion of your account and all associated records (meals, weight logs, profile metrics, feedback) at any time. To request account deletion, you can:</p>
    <ul>
      <li>Submit an in-app request via <strong>Settings &gt; Report a Bug / Feedback</strong>, or</li>
      <li>Email us directly at <a href="mailto:support@dayfuelapp.com">support@dayfuelapp.com</a> with the subject line <em>"Data Deletion Request"</em>.</li>
    </ul>
    <p>Upon receiving your request, all personal data associated with your account will be permanently deleted within 30 days.</p>

    <h2>7. Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date. Continued use of the App after changes indicates acceptance of the updated policy.</p>

    <h2>8. Contact Us</h2>
    <p>If you have any questions or concerns regarding this Privacy Policy or your data, please contact us at:</p>
    <p><strong>Day Fuel Support Team</strong><br>
    Email: <a href="mailto:support@dayfuelapp.com">support@dayfuelapp.com</a><br>
    Website: <a href="https://oakkfndpfsbusdcfozyv.supabase.co/functions/v1/privacy-policy">https://oakkfndpfsbusdcfozyv.supabase.co/functions/v1/privacy-policy</a></p>

    <div class="footer">
      &copy; 2026 Day Fuel. All rights reserved.
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
