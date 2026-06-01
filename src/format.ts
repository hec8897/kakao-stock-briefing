import type { Quote } from "./stocks.js";

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

/** 종목별 가격·등락률 섹션 텍스트를 만듭니다. */
export function formatPriceSection(quotes: Quote[]): string {
  return quotes
    .map((q) => {
      const sign = q.changePercent > 0 ? "+" : "";
      return `${arrow(q.changePercent)} ${q.name} ${formatPrice(q.price, q.currency)} (${sign}${q.changePercent.toFixed(2)}%)`;
    })
    .join("\n");
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
