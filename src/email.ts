import nodemailer from "nodemailer";
import { config } from "./config.js";
import type { Quote } from "./stocks.js";

/** 메일 설정(아이디/비번/수신처)이 모두 있을 때만 발송 대상. */
export const mailEnabled = Boolean(config.mail.user && config.mail.pass && config.mail.to);

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

function formatPrice(q: Quote): string {
  if (q.currency === "KRW") return `${Math.round(q.price).toLocaleString("ko-KR")}원`;
  if (q.currency === "USD") return `$${q.price.toFixed(2)}`;
  return q.price.toLocaleString("en-US");
}

/** 등락에 따른 색/화살표 (상승=빨강, 하락=파랑 — 국내 관습). */
function tone(pct: number): { color: string; arrow: string } {
  if (pct > 0) return { color: "#e03131", arrow: "▲" };
  if (pct < 0) return { color: "#1971c2", arrow: "▼" };
  return { color: "#868e96", arrow: "―" };
}

/** 종목 시세 테이블 행. */
function quoteRows(quotes: Quote[]): string {
  return quotes
    .map((q) => {
      const { color, arrow } = tone(q.changePercent);
      const sign = q.changePercent > 0 ? "+" : "";
      return `<tr>
  <td style="padding:10px 12px;border-bottom:1px solid #f1f3f5;font-weight:600;color:#212529;">${escapeHtml(q.name)}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #f1f3f5;text-align:right;color:#212529;">${formatPrice(q)}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #f1f3f5;text-align:right;color:${color};font-weight:600;white-space:nowrap;">${arrow} ${sign}${q.changePercent.toFixed(2)}%</td>
</tr>`;
    })
    .join("\n");
}

/**
 * AI 텍스트([뉴스]/[코멘트] 섹션)를 HTML 블록으로.
 * 형식이 안 맞아도 통째로 표시되도록 fallback.
 */
function aiBlock(aiText: string): string {
  if (!aiText) return "";
  const safe = escapeHtml(aiText)
    .replace(/^\[뉴스\]\s*$/gm, '<div style="font-weight:700;color:#495057;margin:16px 0 6px;">📰 뉴스</div>')
    .replace(/^\[코멘트\]\s*$/gm, '<div style="font-weight:700;color:#495057;margin:16px 0 6px;">💬 시황 코멘트</div>')
    .replace(/^[•·-]\s*(.+)$/gm, '<div style="padding:3px 0;color:#343a40;">• $1</div>')
    .replace(/\n/g, "<br>");
  return `<div style="margin-top:20px;font-size:14px;line-height:1.6;">${safe}</div>`;
}

/** 브리핑 HTML 본문 생성. */
export function buildHtml(title: string, quotes: Quote[], aiText: string): string {
  return `<!DOCTYPE html>
<html lang="ko"><body style="margin:0;background:#f8f9fa;padding:24px 0;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);">
    <div style="background:linear-gradient(135deg,#228be6,#4263eb);padding:24px 28px;">
      <div style="color:#fff;font-size:20px;font-weight:700;">📈 ${escapeHtml(title)}</div>
      <div style="color:#dbe4ff;font-size:13px;margin-top:4px;">관심종목 데일리 브리핑</div>
    </div>
    <div style="padding:20px 28px 28px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead><tr>
          <th style="padding:8px 12px;text-align:left;color:#868e96;font-size:12px;font-weight:600;border-bottom:2px solid #e9ecef;">종목</th>
          <th style="padding:8px 12px;text-align:right;color:#868e96;font-size:12px;font-weight:600;border-bottom:2px solid #e9ecef;">현재가</th>
          <th style="padding:8px 12px;text-align:right;color:#868e96;font-size:12px;font-weight:600;border-bottom:2px solid #e9ecef;">등락률</th>
        </tr></thead>
        <tbody>${quoteRows(quotes)}</tbody>
      </table>
      ${aiBlock(aiText)}
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #f1f3f5;color:#adb5bd;font-size:11px;line-height:1.5;">
        시세: 네이버 금융 · AI 코멘트는 참고용이며 투자 권유가 아닙니다.
      </div>
    </div>
  </div>
</body></html>`;
}

/**
 * 네이버 SMTP로 HTML 브리핑을 발송합니다.
 * 네이버 메일 > 환경설정 > POP3/IMAP 설정에서 사용 ON + 앱 비밀번호 발급 필요.
 */
export async function sendEmail(subject: string, html: string, text: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: "smtp.naver.com",
    port: 465,
    secure: true,
    auth: { user: config.mail.user, pass: config.mail.pass },
  });

  await transporter.sendMail({
    from: config.mail.user,
    to: config.mail.to,
    subject,
    text, // HTML 미지원 클라이언트용 fallback
    html,
  });
}
