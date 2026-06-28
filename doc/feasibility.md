# 구현 가능 여부 체크 — 카카오톡 주식 브리핑 봇

> 검증일: 2026-06-28 / 대상: `desktop/dev/kakao-stock-briefing`
> 요구사항: 매일 아침 카카오톡으로 주식 시황 + 관심종목 뉴스/자료 전달
> 범위: 초기버전 = **나에게만**, 시장 = **국내(KR) + 미국(US)**

## 결론: 구현 가능 (이미 풀 구현됨). 단 데이터 소스에 실동작 블로커 1건.

핵심 흐름(시세 → AI 뉴스요약 → 카카오 '나에게 보내기')은 이미 코드로 존재하고 타입체크도 통과한다.
요구사항을 100% 만족하는 구조이며, **나에게 보내기 방식이라 카카오 앱 심사 불필요**라 가장 빠른 경로다.
다만 시세 수집(Yahoo Finance)이 실측에서 차단됐다 — 이것만 해결하면 끝.

## 검증 결과

| 항목 | 결과 | 비고 |
|------|------|------|
| TypeScript 타입체크 | ✅ 통과 | `tsc --noEmit` exit 0 |
| 카카오 '나에게 보내기' API | ✅ 설계상 가능 | 심사 불필요, 무료. 토큰만 관리 |
| AI 뉴스요약 (OpenAI web_search) | ⚠️ 미실측 | 키 필요. Responses API + web_search 사용, **별도 과금** |
| **Yahoo Finance 시세 수집** | ❌ **실측 실패** | 아래 참조 |
| 매일 자동 실행 | ✅ 가능 | GitHub Actions cron, 서버리스·무료 |

## 블로커: Yahoo Finance (yahoo-finance2 v2)

실측 시 6종목 전부 실패:
```
[yahoo-finance2] v2 is no longer maintained nor supported. Please migrate to v3.
005930.KS FAIL  Too Many Requests
AAPL      FAIL  Too Many Requests
... (전 종목 동일)
```
- 라이브러리 v2가 **유지보수 중단**, v3 마이그레이션 권고.
- 현재 응답이 `Too Many Requests`(429) — 크럼/쿠키 인증 후에도 차단. Yahoo 비공식 API 정책 변화로 보임.

### 해결안 (난이도 낮은 순)
1. **`yahoo-finance2` v3로 업그레이드** — 가장 작은 변경. v2 deprecated 경고가 직접 v3를 가리킴. 먼저 시도.
2. **데이터 소스 교체** — 국내는 한국투자증권 OpenAPI(무료, KR 정확) / FinanceDataReader(파이썬), 미국은 Alpha Vantage·Finnhub(무료 티어). KR/US 분리 수집.
3. GitHub Actions IP에서는 429가 덜 날 수도 있음(로컬 IP 레이트리밋일 가능성) — 워크플로에서 1회 실측 후 판단.

> `ponytail`: 1번부터. 소스 갈아엎기 전에 v3 업글로 되는지부터 확인 — 한 줄 디펜던시 변경이 제일 싸다.

## 남은 확인거리 (키 있어야 실측 가능)
- 카카오: REST 키 발급 + `talk_message` 동의 + `npm run auth`로 refresh_token 1회 발급 → 실제 수신 확인.
- OpenAI: 키 넣고 web_search 1회 호출해 비용/품질 확인. 비용 부담되면 `ENABLE_AI=false`로 가격만 전송 가능.
- refresh_token 약 2개월 만료 — 갱신 운영 부담 존재(만료 임박 시 새 토큰 로그로 안내됨).

## 비용/제약 요약
- 인프라: GitHub Actions 무료(cron 수~십수 분 지연 가능).
- 카카오: 무료, 200자/메시지 제한 → 자동 분할 처리됨.
- OpenAI web_search: 호출당 과금 — 유일한 상시 비용.
