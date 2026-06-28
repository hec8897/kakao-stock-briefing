import http from "node:http";
import "dotenv/config";

/**
 * 카카오 리프레시 토큰 1회 발급용 스크립트.
 *
 *   npm run auth
 *
 * 실행하면 출력되는 URL을 브라우저에서 열어 카카오 로그인·동의하면,
 * 터미널에 refresh_token이 출력됩니다. 이 값을 .env(또는 GitHub Secret)의
 * KAKAO_REFRESH_TOKEN 에 저장하세요.
 *
 * 사전 준비: 카카오 개발자 콘솔에서 Redirect URI에
 *   http://localhost:5000/oauth 를 등록해야 합니다.
 */

const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const PORT = 5001;
const REDIRECT_URI = `http://localhost:${PORT}/oauth`;

if (!REST_API_KEY) {
  console.error("먼저 .env에 KAKAO_REST_API_KEY를 설정하세요.");
  process.exit(1);
}

const authUrl =
  "https://kauth.kakao.com/oauth/authorize?response_type=code" +
  `&client_id=${REST_API_KEY}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  "&scope=talk_message";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "", `http://localhost:${PORT}`);
  if (url.pathname !== "/oauth") {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h2>인가 코드(code)가 없습니다.</h2>");
    return;
  }

  try {
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: REST_API_KEY,
      redirect_uri: REDIRECT_URI,
      code,
    });
    // Client Secret을 사용 중이면 함께 전송 (KOE010 방지)
    if (process.env.KAKAO_CLIENT_SECRET) {
      tokenParams.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
    }

    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams,
    });

    const data = (await tokenRes.json()) as Record<string, unknown>;

    res.writeHead(tokenRes.ok ? 200 : 400, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      tokenRes.ok
        ? "<h2>✅ 인증 완료! 터미널에서 refresh_token을 확인하세요.</h2>"
        : `<h2>❌ 토큰 발급 실패</h2><pre>${JSON.stringify(data, null, 2)}</pre>`,
    );

    console.log("\n=== 토큰 발급 결과 ===");
    console.log(JSON.stringify(data, null, 2));
    if (data.refresh_token) {
      console.log("\n👉 아래 refresh_token을 .env의 KAKAO_REFRESH_TOKEN에 저장하세요:\n");
      console.log(data.refresh_token);
    }
  } catch (error) {
    console.error("토큰 요청 중 오류:", error);
    res.writeHead(500).end();
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log("\n아래 URL을 브라우저에서 열어 카카오 로그인 후 동의하세요:\n");
  console.log(authUrl + "\n");
});
