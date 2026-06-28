import { WATCHLIST, config } from "./config.js";
import { fetchQuotes } from "./stocks.js";
import { generateBriefing } from "./ai.js";
import { formatPriceSection, splitForKakao } from "./format.js";
import { sendMessages } from "./kakao.js";
import { mailEnabled, buildHtml, sendEmail } from "./email.js";

async function main(): Promise<void> {
  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const title = `${today} 관심종목 브리핑`;

  // 1) 시세 수집
  console.log("시세 조회 중...");
  const quotes = await fetchQuotes(WATCHLIST);
  if (quotes.length === 0) {
    throw new Error("모든 종목의 시세 조회에 실패했습니다.");
  }

  // 2) AI 뉴스 요약 + 시황 코멘트 (실패해도 가격 정보는 전송)
  let aiText = "";
  if (config.enableAi) {
    try {
      console.log("AI 뉴스·코멘트 생성 중...");
      aiText = await generateBriefing(quotes);
    } catch (error) {
      console.error("AI 브리핑 생성 실패 — 가격 정보만 전송합니다.", error);
    }
  }

  const body = `📈 ${title}\n\n${formatPriceSection(quotes)}${aiText ? `\n\n${aiText}` : ""}`;

  // 3) 발송 — 카카오/메일 각각 독립 실행해 하나가 실패해도 다른 채널은 전송.
  const tasks: Promise<void>[] = [];

  tasks.push(
    (async () => {
      const chunks = splitForKakao(body);
      console.log(`카카오톡 전송 중... (${chunks.length}개 메시지)`);
      await sendMessages(chunks);
      console.log("✅ 카카오톡 전송 완료");
    })(),
  );

  if (mailEnabled) {
    tasks.push(
      (async () => {
        console.log("메일 전송 중...");
        await sendEmail(`📈 ${title}`, buildHtml(title, quotes, aiText), body);
        console.log("✅ 메일 전송 완료");
      })(),
    );
  }

  const results = await Promise.allSettled(tasks);
  const failed = results.filter((r) => r.status === "rejected");
  failed.forEach((r) => console.error("전송 실패:", (r as PromiseRejectedResult).reason));
  if (failed.length === results.length) {
    throw new Error("모든 채널 전송에 실패했습니다.");
  }
}

main().catch((error) => {
  console.error("❌ 브리핑 실패:", error);
  process.exit(1);
});
