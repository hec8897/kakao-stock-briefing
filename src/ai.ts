import OpenAI from "openai";
import { config } from "./config.js";
import { fetchIndices, groupByCategory, type Quote } from "./stocks.js";

/**
 * 관심종목 브리핑을 웹 검색으로 한국어 생성합니다.
 *
 * 30종목을 한 번에 넣으면 모델이 검색을 몇 번만 돌려 일부 종목(특히 국내
 * 소형주)을 누락하므로, 뉴스는 카테고리별로 분리 호출해 커버리지를 높인다.
 * (호출 = 지수·코멘트 1회 + 카테고리 수. web_search는 호출당 과금됨)
 */
export async function generateBriefing(quotes: Quote[]): Promise<string> {
  const client = new OpenAI({ apiKey: config.openai.apiKey });

  // 모델이 학습 시점 날짜로 착각하지 않도록 실제 오늘/일주일 전 날짜(KST)를 주입한다.
  const fmt = (d: Date) =>
    d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });
  const now = new Date();
  const today = fmt(now);
  const weekAgo = fmt(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const dateRule = `오늘은 ${today}입니다. 반드시 ${weekAgo}부터 ${today}까지 최근 일주일 이내에 보도된 뉴스만 사용하세요. 그보다 오래된 뉴스는 절대 포함하지 말고, 각 뉴스의 보도 날짜를 웹 검색으로 확인하세요.`;

  const search = async (prompt: string): Promise<string> => {
    const res = await client.responses.create({
      model: config.openai.model,
      tools: [{ type: "web_search" }],
      input: prompt,
    });
    return res.output_text.trim();
  };

  const categories = groupByCategory(quotes);

  // 카테고리별 뉴스 — 각 그룹 종목당 최소 1개를 목표로 병렬 검색.
  const newsTasks = categories.map(async ([category, group]) => {
    const list = group.map((q) => `- ${q.name} (${q.symbol})`).join("\n");
    const block = await search(
      `당신은 한국어 주식 뉴스 큐레이터입니다. ${dateRule}

아래는 "${category}" 카테고리 종목입니다.
${list}

각 종목마다 최근 일주일 핵심 뉴스를 웹에서 검색해 종목당 최소 1개를 40자 이내 한 줄로 요약하세요. 종목 직접 뉴스가 없으면 해당 섹터/공급망 뉴스라도 한 줄 넣고, 일주일 내 어떤 관련 뉴스도 없을 때만 그 종목을 생략하세요.

다른 말 없이 아래 형식만 출력(날짜는 MM/DD):
• 종목명: 한줄요약 (MM/DD)
- 매수/매도 추천·단정적 전망 금지, 사실 기반 간결하게.`,
    );
    return block ? `《${category}》\n${block}` : "";
  });

  // 지수 숫자는 web_search가 못 잡으므로 네이버에서 직접 가져와 코드로 박는다.
  // AI에는 "움직인 이슈 + 코멘트"만 맡긴다.
  const indices = await fetchIndices();
  const indexLines = indices
    .map((i) => `• ${i.name} ${i.close.toLocaleString("en-US")} (${i.changePercent >= 0 ? "+" : ""}${i.changePercent.toFixed(2)}%)`)
    .join("\n");
  const indexFacts = indices
    .map((i) => `${i.name} ${i.changePercent >= 0 ? "+" : ""}${i.changePercent.toFixed(2)}%`)
    .join(", ");
  const overall = quotes
    .map((q) => `- ${q.name}: ${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%`)
    .join("\n");
  const issueTask = search(
    `당신은 한국어 주식 브리핑 어시스턴트입니다. ${dateRule}

가장 최근 마감 지수: ${indexFacts}.
이 지수들을 움직인 핵심 이슈(매크로·정책·실적)를 웹에서 검색해 1~2줄로 정리하고, 이어서 아래 포트폴리오 관점의 시황 코멘트를 2~3문장 작성하세요.
${overall}

다른 말 없이 아래 형식만 출력:
→ 지수를 움직인 핵심 이슈
[코멘트]
시황 코멘트

- 매수/매도 추천·단정적 전망 금지, 사실 기반 간결하게.`,
  );

  const [issueComment, ...newsBlocks] = await Promise.all([issueTask, ...newsTasks]);
  const news = newsBlocks.filter(Boolean).join("\n");

  // 이슈·코멘트 응답을 [코멘트] 기준으로 분리한다.
  const ci = issueComment.indexOf("[코멘트]");
  const issue = ci >= 0 ? issueComment.slice(0, ci).trim() : issueComment.trim();
  const commentBlock = ci >= 0 ? issueComment.slice(ci).trim() : "";

  const indexBlock = indexLines ? `[지수]\n${indexLines}${issue ? `\n${issue}` : ""}` : issue;

  return [indexBlock, news && `[뉴스]\n${news}`, commentBlock].filter(Boolean).join("\n\n");
}
