import { config } from "./config.js";

interface TokenResponse {
  access_token: string;
  /** 리프레시 토큰은 만료가 임박했을 때만 갱신되어 내려옵니다. */
  refresh_token?: string;
  expires_in: number;
}

/**
 * 저장된 refresh_token으로 새 access_token을 발급받습니다.
 * access_token은 약 6시간, refresh_token은 약 2개월간 유효합니다.
 */
export async function refreshAccessToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.kakao.restApiKey,
    refresh_token: config.kakao.refreshToken,
  });
  // Client Secret을 사용 중이면 함께 전송 (KOE010 방지)
  if (config.kakao.clientSecret) params.set("client_secret", config.kakao.clientSecret);

  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!res.ok) {
    throw new Error(`카카오 토큰 갱신 실패 (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as TokenResponse;

  if (data.refresh_token) {
    console.warn(
      "⚠️ 새 refresh_token이 발급되었습니다. KAKAO_REFRESH_TOKEN(또는 GitHub Secret)을 아래 값으로 갱신하세요:\n" +
        data.refresh_token,
    );
  }

  return data.access_token;
}

/**
 * 카카오톡 '나에게 보내기'(메모) — 텍스트 템플릿 전송.
 * 텍스트 템플릿은 최대 200자까지 표시되므로 호출부에서 분할해 보냅니다.
 */
export async function sendMemo(accessToken: string, text: string): Promise<void> {
  const templateObject = {
    object_type: "text",
    text,
    link: {
      web_url: "https://finance.naver.com",
      mobile_web_url: "https://finance.naver.com",
    },
  };

  const res = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ template_object: JSON.stringify(templateObject) }),
  });

  if (!res.ok) {
    throw new Error(`카카오 메시지 전송 실패 (${res.status}): ${await res.text()}`);
  }
}

/** 토큰을 한 번 갱신한 뒤 분할된 메시지들을 순차 전송합니다. */
export async function sendMessages(chunks: string[]): Promise<void> {
  const accessToken = await refreshAccessToken();
  for (const chunk of chunks) {
    await sendMemo(accessToken, chunk);
    await new Promise((resolve) => setTimeout(resolve, 400)); // 연속 전송 간 여유
  }
}
