import "dotenv/config";

export interface Stock {
  /**
   * 네이버 금융 심볼.
   *   국내: 6자리 종목코드 (삼성전자 005930, 카카오 035720)
   *   해외: 심볼.거래소 (나스닥 .O / 뉴욕 .K) — AAPL.O, NVDA.O, TSLA.O
   */
  symbol: string;
  /** 브리핑에 표시할 이름 */
  name: string;
}

/**
 * 관심종목 목록 — 여기만 수정하면 됩니다.
 * 티커 찾는 법: finance.naver.com 에서 종목 검색 후 URL/심볼 확인.
 *   국내는 6자리 숫자 코드, 해외는 "심볼.거래소"(나스닥 .O, 뉴욕증시 .K).
 */
export const WATCHLIST: Stock[] = [
  // 국내 반도체
  { symbol: "005930", name: "삼성전자" },
  { symbol: "000660", name: "SK하이닉스" },
  { symbol: "042700", name: "한미반도체" },
  { symbol: "000990", name: "DB하이텍" },
  { symbol: "058470", name: "리노공업" },
  { symbol: "039030", name: "이오테크닉스" },
  { symbol: "403870", name: "HPSP" },
  { symbol: "240810", name: "원익IPS" },
  { symbol: "036930", name: "주성엔지니어링" },
  { symbol: "067310", name: "하나마이크론" },
  // 미국 반도체
  { symbol: "NVDA.O", name: "NVIDIA" },
  { symbol: "AMD.O", name: "AMD" },
  { symbol: "INTC.O", name: "Intel" },
  { symbol: "MU.O", name: "Micron" },
  { symbol: "AVGO.O", name: "Broadcom" },
  { symbol: "QCOM.O", name: "Qualcomm" },
  { symbol: "TSM", name: "TSMC" },
  { symbol: "ASML.O", name: "ASML" },
  { symbol: "AMAT.O", name: "Applied Materials" },
  { symbol: "LRCX.O", name: "Lam Research" },
  { symbol: "KLAC.O", name: "KLA" },
  { symbol: "TXN.O", name: "Texas Instruments" },
  { symbol: "ARM.O", name: "ARM" },
  { symbol: "MRVL.O", name: "Marvell" },
  // 추가 관심종목
  { symbol: "SPCX.O", name: "SpaceX" },
  { symbol: "RKLB.O", name: "Rocket Lab" },
  { symbol: "PLTR.O", name: "Palantir" },
  { symbol: "035420", name: "네이버" },
  { symbol: "267260", name: "HD현대일렉트릭" },
  { symbol: "298040", name: "효성중공업" },
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
    model: process.env.OPENAI_MODEL || "gpt-4.1",
  },
  kakao: {
    restApiKey: required("KAKAO_REST_API_KEY"),
    refreshToken: required("KAKAO_REFRESH_TOKEN"),
    // Client Secret을 "사용함"으로 켰을 때만 필요. 꺼져 있으면 빈 값으로 두면 됩니다.
    clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
  },
  // 네이버 메일 (SMTP). 셋이 모두 있으면 메일도 함께 발송, 없으면 건너뜀.
  // MAIL_USER: 네이버 아이디(@naver.com 포함) / MAIL_PASS: 네이버 메일 앱 비밀번호
  // MAIL_TO: 받을 주소(미설정 시 MAIL_USER 본인에게)
  mail: {
    user: process.env.MAIL_USER ?? "",
    pass: process.env.MAIL_PASS ?? "",
    to: process.env.MAIL_TO || process.env.MAIL_USER || "",
  },
  enableAi,
};
