import { Resend } from "resend";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Programming Lightning <noreply@programminglightning.com>";

async function getReplitCredentials(): Promise<{ apiKey: string; fromEmail: string } | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!hostname || !xReplitToken) return null;

  try {
    const data = await fetch(
      "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
      { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } }
    ).then((res) => res.json());

    const settings = data.items?.[0]?.settings;
    if (settings?.api_key) {
      return { apiKey: settings.api_key, fromEmail: settings.from_email || FROM_EMAIL };
    }
  } catch {}
  return null;
}

async function getResendClient(): Promise<{ client: Resend; fromEmail: string }> {
  // Try Replit connector first (works on Replit deployments)
  const replitCreds = await getReplitCredentials();
  if (replitCreds) {
    return { client: new Resend(replitCreds.apiKey), fromEmail: replitCreds.fromEmail };
  }

  // Fall back to env var (works locally)
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("No Resend credentials found. Set RESEND_API_KEY in .env or connect Resend on Replit.");
  }
  return { client: new Resend(apiKey), fromEmail: FROM_EMAIL };
}

export async function sendVerificationEmail(
  toEmail: string,
  verificationUrl: string
) {
  const { client, fromEmail } = await getResendClient();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f5f0e1;font-family:'VT323',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f0e1;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#fffdf5;border:4px solid #b8860b;max-width:600px;">
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:2px solid #b8860b;">
              <h1 style="margin:0;font-family:'Press Start 2P',monospace;font-size:16px;color:#b8860b;letter-spacing:1px;">
                PROGRAMMING LIGHTNING
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;font-family:'Press Start 2P',monospace;font-size:13px;color:#b8860b;">
                VERIFY YOUR EMAIL
              </h2>
              <p style="margin:0 0 20px;font-family:'VT323',monospace;font-size:20px;color:#1a1a1a;line-height:1.5;">
                Welcome to Programming Lightning! Click the button below to verify your email address.
              </p>
              <p style="margin:0 0 24px;font-family:'VT323',monospace;font-size:20px;color:#1a1a1a;line-height:1.5;">
                Throughout the educational material, there are checkpoints that offer real bitcoin rewards when completed successfully. To mitigate spam, users must either verify their email or log in with LNURL-Auth to claim these rewards.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#FFD700;border:2px solid #b8860b;padding:14px 28px;">
                    <a href="${verificationUrl}" style="font-family:'Press Start 2P',monospace;font-size:12px;color:#000;text-decoration:none;display:block;">
                      VERIFY EMAIL
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-family:'VT323',monospace;font-size:18px;color:#555;line-height:1.4;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-family:monospace;font-size:13px;color:#333;word-break:break-all;background-color:#f0ead6;border:2px solid #b8860b;padding:12px;">
                ${verificationUrl}
              </p>
              <p style="margin:0;font-family:'VT323',monospace;font-size:16px;color:#777;line-height:1.4;">
                This link expires in 24 hours. If you did not create an account, you can ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:2px solid #b8860b;">
              <p style="margin:0;font-family:'VT323',monospace;font-size:16px;color:#777;text-align:center;">
                programminglightning.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const result = await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: "Verify your email - Programming Lightning",
    html,
  });

  return result;
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string
) {
  const { client, fromEmail } = await getResendClient();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f5f0e1;font-family:'VT323',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f0e1;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#fffdf5;border:4px solid #b8860b;max-width:600px;">
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:2px solid #b8860b;">
              <h1 style="margin:0;font-family:'Press Start 2P',monospace;font-size:16px;color:#b8860b;letter-spacing:1px;">
                PROGRAMMING LIGHTNING
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;font-family:'Press Start 2P',monospace;font-size:13px;color:#b8860b;">
                RESET YOUR PASSWORD
              </h2>
              <p style="margin:0 0 20px;font-family:'VT323',monospace;font-size:20px;color:#1a1a1a;line-height:1.5;">
                We received a request to reset your password. Click the button below to choose a new password.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#FFD700;border:2px solid #b8860b;padding:14px 28px;">
                    <a href="${resetUrl}" style="font-family:'Press Start 2P',monospace;font-size:12px;color:#000;text-decoration:none;display:block;">
                      RESET PASSWORD
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-family:'VT323',monospace;font-size:18px;color:#555;line-height:1.4;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-family:monospace;font-size:13px;color:#333;word-break:break-all;background-color:#f0ead6;border:2px solid #b8860b;padding:12px;">
                ${resetUrl}
              </p>
              <p style="margin:0;font-family:'VT323',monospace;font-size:16px;color:#777;line-height:1.4;">
                This link expires in 1 hour. If you did not request a password reset, you can ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:2px solid #b8860b;">
              <p style="margin:0;font-family:'VT323',monospace;font-size:16px;color:#777;text-align:center;">
                programminglightning.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const result = await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: "Reset your password - Programming Lightning",
    html,
  });

  return result;
}
