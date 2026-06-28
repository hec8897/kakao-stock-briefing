import type { Stock } from "./config.js";

// Yahoo Finance가 quote/chart 엔드포인트를 429로 차단해 네이버 금융으로 교체.
// 국내: 6자리 숫자 코드(005930) / 해외: 심볼.거래소(AAPL.O) — config.ts 참조.
// ponytail: 비공식 API, 키 불필요. 막히면 한국투자 OpenAPI(국내)+Finnhub(해외)로 분리.

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
  /** 브리핑에서 묶을 카테고리(섹터) */
  category: string;
}

/** 시세를 카테고리별로 묶습니다(WATCHLIST 순서 유지). */
export function groupByCategory(quotes: Quote[]): [string, Quote[]][] {
  const groups = new Map<string, Quote[]>();
  for (const q of quotes) {
    if (!groups.has(q.category)) groups.set(q.category, []);
    groups.get(q.category)!.push(q);
  }
  return [...groups];
}

const UA = "Mozilla/5.0";
const isDomestic = (symbol: string) => /^\d{6}$/.test(symbol);

/** "339,500" / "-19,000" 같은 문자열을 숫자로. */
function toNumber(value: unknown): number {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/** 등락 방향 코드(RISING/FALLING)에 맞춰 변동액·등락률 부호를 보정. */
function signed(raw: number, direction: unknown): number {
  const name = (direction as { name?: string } | undefined)?.name;
  const magnitude = Math.abs(raw);
  return name === "FALLING" || name === "LOWER_LIMIT" ? -magnitude : magnitude;
}

async function fetchDomestic(stock: Stock): Promise<Quote> {
  const data = await fetchJson(
    `https://polling.finance.naver.com/api/realtime/domestic/stock/${stock.symbol}`,
  );
  const d = (data.datas as Record<string, unknown>[])[0];
  const price = toNumber(d.closePrice);
  const change = signed(toNumber(d.compareToPreviousClosePrice), d.compareToPreviousPrice);
  return {
    name: stock.name,
    symbol: stock.symbol,
    price,
    previousClose: price - change,
    change,
    changePercent: signed(toNumber(d.fluctuationsRatio), d.compareToPreviousPrice),
    currency: "KRW",
    category: stock.category,
  };
}

async function fetchOverseas(stock: Stock): Promise<Quote> {
  const d = await fetchJson(`https://api.stock.naver.com/stock/${stock.symbol}/basic`);
  const price = toNumber(d.closePrice);
  const change = signed(toNumber(d.compareToPreviousClosePrice), d.compareToPreviousPrice);
  return {
    name: stock.name,
    symbol: stock.symbol,
    price,
    previousClose: price - change,
    change,
    changePercent: signed(toNumber(d.fluctuationsRatio), d.compareToPreviousPrice),
    currency: "USD",
    category: stock.category,
  };
}

export interface Index {
  name: string;
  close: number;
  changePercent: number;
}

// 네이버 지수 심볼 — 국내는 polling, 해외는 api.stock 엔드포인트를 쓴다.
const INDICES = [
  { name: "KOSPI", symbol: "KOSPI", domestic: true },
  { name: "KOSDAQ", symbol: "KOSDAQ", domestic: true },
  { name: "S&P500", symbol: ".INX", domestic: false },
  { name: "나스닥", symbol: ".IXIC", domestic: false },
];

/** 주요 지수 마감값을 조회합니다(실패한 지수는 제외). */
export async function fetchIndices(): Promise<Index[]> {
  const results = await Promise.all(
    INDICES.map(async (i): Promise<Index | null> => {
      try {
        const data = await fetchJson(
          i.domestic
            ? `https://polling.finance.naver.com/api/realtime/domestic/index/${i.symbol}`
            : `https://api.stock.naver.com/index/${i.symbol}/basic`,
        );
        const d = i.domestic ? (data.datas as Record<string, unknown>[])[0] : data;
        return {
          name: i.name,
          close: toNumber(d.closePrice),
          changePercent: signed(toNumber(d.fluctuationsRatio), d.compareToPreviousPrice),
        };
      } catch (error) {
        console.error(`[지수 조회 실패] ${i.name}:`, error);
        return null;
      }
    }),
  );
  return results.filter((i): i is Index => i !== null);
}

/**
 * 관심종목들의 시세를 병렬로 조회합니다.
 * 일부 종목 조회에 실패해도 나머지는 정상 반환합니다.
 */
export async function fetchQuotes(stocks: Stock[]): Promise<Quote[]> {
  const results = await Promise.all(
    stocks.map(async (stock): Promise<Quote | null> => {
      try {
        return isDomestic(stock.symbol)
          ? await fetchDomestic(stock)
          : await fetchOverseas(stock);
      } catch (error) {
        console.error(`[시세 조회 실패] ${stock.name}(${stock.symbol}):`, error);
        return null;
      }
    }),
  );

  return results.filter((q): q is Quote => q !== null);
}
