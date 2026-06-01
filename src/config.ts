import "dotenv/config";

export interface Stock {
  /** Yahoo Finance 티커. 한국 주식은 .KS(코스피)/.KQ(코스닥) 접미사를 붙입니다. */
  symbol: string;
  /** 브리핑에 표시할 이름 */
  name: string;
}

/**
 * 관심종목 목록 — 여기만 수정하면 됩니다.
 * 티커 찾는 법: finance.yahoo.com 에서 종목 검색 후 심볼 확인.
 *   삼성전자 005930.KS / 카카오 035720.KS / 에코프로 086520.KQ(코스닥)
 *   Apple AAPL / NVIDIA NVDA / Tesla TSLA
 */
export const WATCHLIST: Stock[] = [
  { symbol: "005930.KS", name: "삼성전자" },
  { symbol: "000660.KS", name: "SK하이닉스" },
  { symbol: "035720.KS", name: "카카오" },
  { symbol: "AAPL", name: "Apple" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "TSLA", name: "Tesla" },
];

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`환경변수 ${key} 가 설정되지 않았습니다. .env 파일을 확인하세요.`);
  }
  return value;
}

/** AI 뉴스·코멘트 사용 여부 (ENABLE_AI=false 면 가격 정보만 전송) */
const enableAi = process.env.ENABLE_AI !== "false";

export const config = {
  openai: {
    // AI를 쓸 때만 키를 강제합니다. (ENABLE_AI=false 면 가격 정보만 전송하므로 불필요)
    apiKey: enableAi ? required("OPENAI_API_KEY") : (process.env.OPENAI_API_KEY ?? ""),
    model: process.env.OPENAI_MODEL ?? "gpt-4.1",
  },
  kakao: {
    restApiKey: required("KAKAO_REST_API_KEY"),
    refreshToken: required("KAKAO_REFRESH_TOKEN"),
  },
  enableAi,
};
