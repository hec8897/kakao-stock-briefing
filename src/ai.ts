import OpenAI from "openai";
import { config } from "./config.js";
import type { Quote } from "./stocks.js";

/**
 * 관심종목에 대한 (1) 종목별 최신 뉴스 한줄 요약과 (2) 전체 시황 코멘트를
 * 웹 검색을 활용해 한국어로 생성합니다.
 *
 * OpenAI Responses API의 web_search 도구를 사용하므로
 * 별도의 뉴스 API 키가 필요 없습니다. (웹 검색은 별도 과금됨)
 */
export async function generateBriefing(quotes: Quote[]): Promise<string> {
  const client = new OpenAI({ apiKey: config.openai.apiKey });

  // 모델이 학습 시점 날짜로 착각하지 않도록 실제 오늘/일주일 전 날짜(KST)를 주입한다.
  const fmt = (d: Date) =>
    d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });
  const now = new Date();
  const today = fmt(now);
  const weekAgo = fmt(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));

  const stockList = quotes
    .map((q) => `- ${q.name} (${q.symbol}): ${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%`)
    .join("\n");

  const prompt = `당신은 한국어 주식 브리핑 어시스턴트입니다. 아래는 사용자의 관심종목과 전일 대비 등락률입니다.

${stockList}

⚠️ 오늘은 ${today}입니다. 반드시 ${weekAgo}부터 ${today}까지 최근 일주일 이내에 보도된 뉴스만 수집하세요. 그보다 오래된 뉴스는 절대 포함하지 마세요. 각 뉴스의 보도 날짜를 웹 검색으로 확인하세요.

다음을 수행하세요.
1. 가장 최근 마감 기준 주요 지수(KOSPI, KOSDAQ, S&P 500, 나스닥)의 종가와 전일 대비 등락률을 웹에서 검색해 요약하고, 그 지수를 움직인 핵심 이슈(매크로·정책·실적 등)를 1~2줄로 정리합니다.
2. 각 종목마다 최근 일주일 뉴스를 웹에서 검색해 가능한 한 종목별로 최소 1개는 핵심을 40자 이내 한 줄로 요약합니다. 종목 직접 뉴스가 없으면 해당 섹터/공급망 관련 뉴스라도 한 줄 넣되, 일주일 내 어떤 관련 뉴스도 없으면 그 종목만 생략합니다.
3. 뉴스를 종목별이 아니라 카테고리(섹터/테마)로 묶어 정리합니다. 예: 국내 반도체 / 미국 반도체 / 우주·방산 / 그 외. 종목 구성에 맞게 카테고리를 정하세요.
4. 마지막에 전체 포트폴리오 관점의 시황 코멘트를 2~3문장으로 작성합니다.

출력 형식(다른 말 없이 이 형식만, 날짜는 MM/DD):
[지수]
• KOSPI 0,000.00 (±0.00%)
• 나스닥 00,000.00 (±0.00%)
→ 지수를 움직인 핵심 이슈 1~2줄

[뉴스]
《카테고리명》
• 종목명: 한줄요약 (MM/DD)
• 종목명: 한줄요약 (MM/DD)
《카테고리명》
• 종목명: 한줄요약 (MM/DD)

[코멘트]
시황 코멘트

규칙:
- 매수/매도를 추천하거나 단정적 전망을 하지 마세요.
- 사실에 기반해 간결하게, 군더더기 없이 작성하세요.`;

  const response = await client.responses.create({
    model: config.openai.model,
    // server-side 웹 검색 도구
    tools: [{ type: "web_search" }],
    input: prompt,
  });

  // 최종 텍스트만 모아서 반환 (검색 호출 등 비텍스트 블록 제외)
  return response.output_text.trim();
}
