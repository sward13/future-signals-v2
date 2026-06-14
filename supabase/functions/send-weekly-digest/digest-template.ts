// Email copy and markup for the weekly signal digest. Kept separate from
// index.ts so all subject/body text lives in one place.

const c = {
  bg: "#F7F7F5",
  white: "#ffffff",
  ink: "#1A1A1A",
  muted: "#6B7280",
  faint: "#9CA3AF",
  border: "rgba(0,0,0,0.09)",
  brand: "#3B82F6",
  brandBg: "#EFF6FF",
};

const FONT_HEADING = "Roboto, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif";
const FONT_BODY = "'Open Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif";

const APP_URL = "https://app.futuresignals.io";

export interface DigestSignal {
  candidate_id: string;
  title: string;
  summary: string;
  source_url: string;
  steepled_category: string;
}

export interface DigestMeta {
  userEmail: string;
  domains: string[];
  unsubscribeUrl: string;
  date: string;
}

export function generateDigestSubject(date: Date): string {
  const formatted = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(date);
  return `Your weekly signals — ${formatted}`;
}

export function generateDigestEmail(signals: DigestSignal[], meta: DigestMeta): string {
  const intro = `Here are ${signals.length} signals in your inbox that haven't been added to a project yet. Open any signal to review it or add it to one of your active projects.`;

  const rows = signals.map((s, idx) => `
    <tr>
      <td style="padding-top:${idx === 0 ? "0" : "20px"}; padding-bottom:${idx === signals.length - 1 ? "0" : "20px"}; ${idx > 0 ? `border-top:1px solid ${c.border};` : ""}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-top:${idx > 0 ? "20px" : "0"}; padding-bottom:8px;">
              <span style="display:inline-block; font-family:${FONT_BODY}; font-size:10px; font-weight:600; letter-spacing:0.07em; text-transform:uppercase; color:${c.brand}; background:${c.brandBg}; border-radius:4px; padding:3px 8px;">
                ${escapeHtml(s.steepled_category)}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:6px;">
              <a href="${escapeHtml(s.source_url)}" style="font-family:${FONT_HEADING}; font-size:15px; font-weight:500; color:${c.ink}; text-decoration:none; line-height:1.4;">
                ${escapeHtml(s.title)}
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:10px; font-family:${FONT_BODY}; font-size:13px; color:${c.muted}; line-height:1.55;">
              ${escapeHtml(s.summary)}
            </td>
          </tr>
          <tr>
            <td>
              <a href="${APP_URL}/inbox?candidate=${encodeURIComponent(s.candidate_id)}" style="font-family:${FONT_BODY}; font-size:12px; font-weight:500; color:${c.brand}; text-decoration:none;">
                Add to project →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background:${c.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.bg};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:${c.white}; border-radius:8px; border:1px solid ${c.border};">
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <div style="font-family:${FONT_HEADING}; font-size:18px; font-weight:500; color:${c.ink};">Future Signals</div>
                <div style="font-family:${FONT_BODY}; font-size:12px; color:${c.faint}; margin-top:2px;">Weekly signals — ${escapeHtml(meta.date)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 32px 24px 32px; font-family:${FONT_BODY}; font-size:13px; color:${c.muted}; line-height:1.55;">
                ${intro}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${rows}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px 32px; border-top:1px solid ${c.border};">
                <div style="font-family:${FONT_BODY}; font-size:11px; color:${c.faint}; line-height:1.6;">
                  You're receiving this because scanning is enabled for your workspace.
                  <a href="${escapeHtml(meta.unsubscribeUrl)}" style="color:${c.faint}; text-decoration:underline;">Unsubscribe from weekly signals</a>.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
