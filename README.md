# 관심종목 카카오톡 브리핑 봇

매일 아침 관심종목의 **가격·등락률 + AI 뉴스 요약 + 시황 코멘트**를
카카오톡 "나에게 보내기"로 자동 전송하는 에이전트입니다.

- 서버 없이 **GitHub Actions cron**으로 매일 자동 실행 (무료)
- 카카오 **앱 심사 불필요** (본인에게 보내는 메모 API 사용)
- 한국 주식(코스피/코스닥) + 미국 주식 모두 지원

---

## 동작 구조

```
GitHub Actions(매일 08:00 KST)
   └─ npm start (src/index.ts)
        1. Yahoo Finance에서 관심종목 시세 수집        → src/stocks.ts
        2. Anthropic API(웹검색)로 뉴스요약·시황코멘트 → src/ai.ts
        3. 메시지 조립 + 200자 단위 분할              → src/format.ts
        4. 카카오 토큰 갱신 후 '나에게 보내기' 전송    → src/kakao.ts
```

| 파일 | 역할 |
|------|------|
| `src/config.ts` | 관심종목 목록 + 환경변수 |
| `src/stocks.ts` | yahoo-finance2 시세 조회 |
| `src/ai.ts` | Claude + 웹검색으로 뉴스·코멘트 생성 |
| `src/kakao.ts` | 카카오 토큰 갱신 / 메시지 전송 |
| `src/format.ts` | 메시지 포맷팅 + 200자 분할 |
| `src/index.ts` | 전체 흐름 실행 |
| `scripts/auth.ts` | 카카오 리프레시 토큰 1회 발급 |

---

## 셋업

### 0. 사전 준비

- Node.js 20 이상
- [Anthropic API 키](https://console.anthropic.com) (뉴스·코멘트용, 사용량 과금)
- 카카오 계정

```bash
npm install
cp .env.example .env
```

### 1. 카카오 개발자 앱 만들기

1. <https://developers.kakao.com> → **내 애플리케이션 > 애플리케이션 추가하기**
2. 생성한 앱 > **앱 키**에서 **REST API 키** 복사 → `.env`의 `KAKAO_REST_API_KEY`
3. **카카오 로그인 > 활성화 설정**을 ON
4. **카카오 로그인 > Redirect URI**에 `http://localhost:5000/oauth` 등록
5. **카카오 로그인 > 동의항목**에서 **카카오톡 메시지 전송(`talk_message`)** 을 "사용"으로 설정

### 2. 카카오 리프레시 토큰 발급 (1회)

```bash
npm run auth
```

터미널에 출력되는 URL을 브라우저에서 열어 로그인·동의하면,
`refresh_token`이 출력됩니다. 이 값을 `.env`의 `KAKAO_REFRESH_TOKEN`에 저장하세요.

> refresh_token은 약 2개월간 유효합니다. 매 실행 시 access_token을 자동 갱신하며,
> 만료가 임박하면 새 refresh_token이 발급되는데, 이때는 로그에 안내된 값으로 교체하면 됩니다.

### 3. Anthropic 키 설정

`.env`에 `ANTHROPIC_API_KEY`를 입력합니다.
뉴스·코멘트가 필요 없으면 `ENABLE_AI=false`로 두면 가격 정보만 전송됩니다.

### 4. 관심종목 수정

`src/config.ts`의 `WATCHLIST` 배열만 고치면 됩니다.

```ts
export const WATCHLIST: Stock[] = [
  { symbol: "005930.KS", name: "삼성전자" },   // 코스피: .KS
  { symbol: "086520.KQ", name: "에코프로" },   // 코스닥: .KQ
  { symbol: "NVDA",      name: "NVIDIA" },      // 미국: 접미사 없음
];
```

티커는 [finance.yahoo.com](https://finance.yahoo.com)에서 종목 검색 후 확인하세요.

### 5. 로컬 테스트

```bash
npm start
```

카카오톡으로 브리핑이 오면 성공입니다.

---

## 매일 자동 실행 (GitHub Actions)

1. 이 폴더를 GitHub 저장소(private 권장)에 push
2. 저장소 **Settings > Secrets and variables > Actions > New repository secret** 에 등록:
   - `ANTHROPIC_API_KEY`
   - `KAKAO_REST_API_KEY`
   - `KAKAO_REFRESH_TOKEN`
   - (선택) `ANTHROPIC_MODEL`, `ENABLE_AI`
3. `.github/workflows/briefing.yml`이 **평일 오전 8시(KST)** 자동 실행합니다.
   - **Actions 탭 > Run workflow** 로 수동 테스트 가능
   - 시간 변경: `cron` 값 수정 (UTC 기준. KST = UTC+9)

> GitHub Actions의 schedule은 부하에 따라 수 분~십수 분 지연될 수 있습니다.

---

## 알아두면 좋은 점

- **카카오 텍스트 메시지는 200자 제한**이 있어, 브리핑이 길면 여러 개로 쪼개 전송됩니다.
- **시세 데이터**는 Yahoo Finance 비공식 API라 종목/시장에 따라 지연되거나 누락될 수 있습니다. 투자 판단의 근거로 삼지 마세요.
- **AI 코멘트는 참고용**입니다. 매수/매도 추천이 아니며, 웹검색 결과의 정확성은 보장되지 않습니다.
- 웹검색은 Anthropic API에서 **별도 과금**됩니다. 비용이 부담되면 `ENABLE_AI=false`.

---

## 자주 묻는 질문

**Q. 친구/단톡방에도 보낼 수 있나요?**
A. 가능하지만 카카오 앱 심사 또는 비즈니스 채널(알림톡)이 필요해 복잡·유료입니다. 이 봇은 가장 간단한 "나에게 보내기" 방식입니다.

**Q. 토큰이 만료됐다고 나와요.**
A. `npm run auth`를 다시 실행해 새 `refresh_token`을 발급받아 교체하세요.

**Q. 주말에도 보내고 싶어요.**
A. `briefing.yml`의 cron을 `0 23 * * *`로 바꾸면 매일 전송됩니다.
