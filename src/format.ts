import { groupByCategory, type Quote } from "./stocks.js";

/** 통화에 맞춰 가격을 포맷합니다. */
function formatPrice(value: number, currency: string): string {
  if (currency === "KRW") return `${Math.round(value).toLocaleString("ko-KR")}원`;
  if (currency === "USD") return `$${value.toFixed(2)}`;
  return value.toLocaleString("en-US");
}

/** 등락에 따른 화살표 이모지 */
function arrow(changePercent: number): string {
  if (changePercent > 0) return "🔺";
  if (changePercent < 0) return "🔻";
  return "➖";
}

/** 종목별 가격·등락률 섹션 텍스트를 카테고리별로 묶어 만듭니다. */
export function formatPriceSection(quotes: Quote[]): string {
  return groupByCategory(quotes)
    .map(([category, group]) => {
      const lines = group
        .map((q) => {
          const sign = q.changePercent > 0 ? "+" : "";
          return `${arrow(q.changePercent)} ${q.name} ${formatPrice(q.price, q.currency)} (${sign}${q.changePercent.toFixed(2)}%)`;
        })
        .join("\n");
      return `【${category}】\n${lines}`;
    })
    .join("\n\n");
}

/** AI 텍스트에서 [섹션] 본문을 추출합니다(다음 [마커] 전까지). */
function section(aiText: string, name: string): string {
  const start = aiText.indexOf(`[${name}]`);
  if (start < 0) return "";
  const after = aiText.slice(start + name.length + 2);
  const next = after.search(/\n\[[^\]]+\]/);
  return (next < 0 ? after : after.slice(0, next)).trim();
}

/**
 * 카카오용 요약 — 지수 + 카테고리별 등락 한 줄 + 코멘트.
 * 종목별 상세·뉴스는 메일에만 담고, 카톡은 짧게(메시지 수 최소화).
 */
export function formatKakaoSummary(title: string, quotes: Quote[], aiText: string): string {
  const parts: string[] = [`📈 ${title}`];

  const indexLines = section(aiText, "지수")
    .split("\n")
    .filter((l) => l.trim().startsWith("•"))
    .join("\n");
  if (indexLines) parts.push(`[지수]\n${indexLines}`);

  const catSummary = groupByCategory(quotes)
    .map(([category, group]) => {
      const up = group.filter((q) => q.changePercent > 0).length;
      const down = group.filter((q) => q.changePercent < 0).length;
      const avg = group.reduce((sum, q) => sum + q.changePercent, 0) / group.length;
      return `${arrow(avg)} ${category} 평균 ${avg >= 0 ? "+" : ""}${avg.toFixed(1)}% (${up}↑ ${down}↓)`;
    })
    .join("\n");
  parts.push(`[관심종목]\n${catSummary}`);

  const comment = section(aiText, "코멘트");
  if (comment) parts.push(`[코멘트]\n${comment}`);

  return parts.join("\n\n");
}

/**
 * 카카오 텍스트 템플릿의 200자 제한에 맞춰 긴 텍스트를 여러 조각으로 나눕니다.
 * 가능한 한 줄 단위로 끊고, 한 줄이 limit을 넘으면 강제로 분할합니다.
 */
export function splitForKakao(text: string, limit = 190): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const line of text.split("\n")) {
    const candidate = current ? `${current}\n${line}` : line;

    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current);

    if (line.length > limit) {
      for (let i = 0; i < line.length; i += limit) {
        chunks.push(line.slice(i, i + limit));
      }
      current = "";
    } else {
      current = line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
