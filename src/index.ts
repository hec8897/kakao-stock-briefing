import { WATCHLIST, config } from "./config.js";
import { fetchQuotes } from "./stocks.js";
import { generateBriefing } from "./ai.js";
import { formatPriceSection, splitForKakao } from "./format.js";
import { sendMessages } from "./kakao.js";

async function main(): Promise<void> {
  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  // 1) 시세 수집
  console.log("시세 조회 중...");
  const quotes = await fetchQuotes(WATCHLIST);
  if (quotes.length === 0) {
    throw new Error("모든 종목의 시세 조회에 실패했습니다.");
  }

  let body = `📈 ${today} 관심종목 브리핑\n\n${formatPriceSection(quotes)}`;

  // 2) AI 뉴스 요약 + 시황 코멘트 (실패해도 가격 정보는 전송)
  if (config.enableAi) {
    try {
      console.log("AI 뉴스·코멘트 생성 중...");
      const aiText = await generateBriefing(quotes);
      if (aiText) body += `\n\n${aiText}`;
    } catch (error) {
      console.error("AI 브리핑 생성 실패 — 가격 정보만 전송합니다.", error);
    }
  }

  // 3) 카카오톡 전송 (200자 제한 → 분할)
  const chunks = splitForKakao(body);
  console.log(`카카오톡 전송 중... (${chunks.length}개 메시지)`);
  await sendMessages(chunks);

  console.log("✅ 브리핑 전송 완료");
}

main().catch((error) => {
  console.error("❌ 브리핑 실패:", error);
  process.exit(1);
});
