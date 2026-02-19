import { Resend } from "resend";

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data) => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error("Resend not connected");
  }
  return {
    apiKey: connectionSettings.settings.api_key,
    fromEmail: connectionSettings.settings.from_email,
  };
}

async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail,
  };
}

export async function sendVerificationEmail(
  toEmail: string,
  verificationUrl: string
) {
  const { client, fromEmail } = await getUncachableResendClient();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#0b1220;font-family:'VT323',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b1220;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#0f1930;border:4px solid #2a3552;max-width:600px;">
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:2px solid #2a3552;">
              <h1 style="margin:0;font-family:'Press Start 2P',monospace;font-size:16px;color:#FFD700;letter-spacing:1px;">
                PROGRAMMING LIGHTNING
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;font-family:'Press Start 2P',monospace;font-size:13px;color:#FFD700;">
                VERIFY YOUR EMAIL
              </h2>
              <p style="margin:0 0 24px;font-family:'VT323',monospace;font-size:20px;color:#cbd5e1;line-height:1.5;">
                Welcome to Programming Lightning! Click the button below to verify your email address and unlock sat rewards.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#FFD700;border:2px solid #FFD700;padding:14px 28px;">
                    <a href="${verificationUrl}" style="font-family:'Press Start 2P',monospace;font-size:12px;color:#000;text-decoration:none;display:block;">
                      VERIFY EMAIL
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-family:'VT323',monospace;font-size:18px;color:#64748b;line-height:1.4;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-family:monospace;font-size:13px;color:#94a3b8;word-break:break-all;background-color:#0b1220;border:2px solid #2a3552;padding:12px;">
                ${verificationUrl}
              </p>
              <p style="margin:0;font-family:'VT323',monospace;font-size:16px;color:#475569;line-height:1.4;">
                This link expires in 24 hours. If you did not create an account, you can ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:2px solid #2a3552;">
              <p style="margin:0;font-family:'VT323',monospace;font-size:16px;color:#475569;text-align:center;">
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
    from: fromEmail || "Programming Lightning <noreply@programminglightning.com>",
    to: toEmail,
    subject: "Verify your email - Programming Lightning",
    html,
  });

  return result;
}
