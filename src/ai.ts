import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import type { Quote } from "./stocks.js";

/**
 * 관심종목에 대한 (1) 종목별 최신 뉴스 한줄 요약과 (2) 전체 시황 코멘트를
 * 웹 검색을 활용해 한국어로 생성합니다.
 *
 * Anthropic API의 server-side web_search 도구를 사용하므로
 * 별도의 뉴스 API 키가 필요 없습니다. (웹 검색은 별도 과금됨)
 */
export async function generateBriefing(quotes: Quote[]): Promise<string> {
  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  const stockList = quotes
    .map((q) => `- ${q.name} (${q.symbol}): ${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%`)
    .join("\n");

  const prompt = `당신은 한국어 주식 브리핑 어시스턴트입니다. 아래는 오늘 사용자의 관심종목과 전일 대비 등락률입니다.

${stockList}

다음을 수행하세요.
1. 각 종목별로 최근 1~2일 내 주요 뉴스를 웹에서 검색해 핵심을 40자 이내 한 줄로 요약합니다. 관련 뉴스가 없으면 생략합니다.
2. 마지막에 전체 포트폴리오 관점의 시황 코멘트를 2~3문장으로 작성합니다.

출력 형식(다른 말 없이 이 형식만):
[뉴스]
• 종목명: 한줄요약
• 종목명: 한줄요약

[코멘트]
시황 코멘트

규칙:
- 매수/매도를 추천하거나 단정적 전망을 하지 마세요.
- 사실에 기반해 간결하게, 군더더기 없이 작성하세요.`;

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 1500,
    // server-side 웹 검색 도구
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 8,
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  // 최종 텍스트 블록만 모아서 반환 (검색 중간 블록 제외)
  let text = "";
  for (const block of response.content) {
    if (block.type === "text") {
      text += block.text;
    }
  }
  return text.trim();
}
