import YahooFinance from "yahoo-finance2";
import type { Stock } from "./config.js";

// yahoo-finance2 v2는 default export가 클래스라 인스턴스를 생성해 사용합니다.
const yf = new YahooFinance();
// 최초 1회 표시되는 설문 안내 메시지 억제 (런타임 동작 무관)
(yf as { suppressNotices?: (n: string[]) => void }).suppressNotices?.(["yahooSurvey"]);

// quote 메서드는 strict 모드에서 `this` 컨텍스트 타입 이슈가 있어 가볍게 캐스팅합니다.
const quote = (yf.quote as Function).bind(yf) as (
  symbol: string,
) => Promise<{
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  currency?: string;
}>;

export interface Quote {
  name: string;
  symbol: string;
  /** 현재가(장중) 또는 종가 */
  price: number;
  /** 전일 종가 */
  previousClose: number;
  /** 전일 대비 변동액 */
  change: number;
  /** 전일 대비 등락률(%) */
  changePercent: number;
  /** 통화 코드 (KRW, USD 등) */
  currency: string;
}

/**
 * 관심종목들의 시세를 병렬로 조회합니다.
 * 일부 종목 조회에 실패해도 나머지는 정상 반환합니다.
 */
export async function fetchQuotes(stocks: Stock[]): Promise<Quote[]> {
  const results = await Promise.all(
    stocks.map(async (stock): Promise<Quote | null> => {
      try {
        const q = await quote(stock.symbol);
        const price = q.regularMarketPrice ?? 0;
        const previousClose = q.regularMarketPreviousClose ?? price;
        return {
          name: stock.name,
          symbol: stock.symbol,
          price,
          previousClose,
          change: q.regularMarketChange ?? price - previousClose,
          changePercent: q.regularMarketChangePercent ?? 0,
          currency: q.currency ?? "",
        };
      } catch (error) {
        console.error(`[시세 조회 실패] ${stock.name}(${stock.symbol}):`, error);
        return null;
      }
    }),
  );

  return results.filter((q): q is Quote => q !== null);
}
