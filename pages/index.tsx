import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import MarketSelector from '../components/MarketSelector';

// Chart 컴포넌트는 SSR에서 Chart.js 관련 에러 방지를 위해 dynamic import
const Chart = dynamic(() => import('../components/Chart'), { ssr: false });

const INTERVAL_OPTIONS = [1, 5, 10];
const MAX_CHARTS = 10;

interface UpbitMarket {
  market: string;
  korean_name: string;
  english_name: string;
}

interface TradeTick {
  ask_bid: 'ASK' | 'BID';
  trade_volume: number;
  trade_time: string;
  trade_timestamp: number;
  trade_price: number;
  code: string; // market code
}

interface TickerInfo {
  trade_price: number;
  signed_change_rate: number;
}

export default function Home() {
  const [markets, setMarkets] = useState<string[]>([]);
  const [intervalMinutes, setIntervalMinutes] = useState<number>(1);
  const [marketList, setMarketList] = useState<UpbitMarket[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [tradeBuffers, setTradeBuffers] = useState<Record<string, TradeTick[]>>({});
  const [tickerMap, setTickerMap] = useState<Record<string, TickerInfo>>({});
  const wsRef = useRef<WebSocket | null>(null);

  // 업비트에서 KRW마켓 코인리스트 fetch
  useEffect(() => {
    async function fetchMarkets() {
      setLoadingMarkets(true);
      try {
        const res = await fetch('https://api.upbit.com/v1/market/all?isDetails=false');
        const data: UpbitMarket[] = await res.json();
        const krwMarkets = data.filter(m => m.market.startsWith('KRW-'));
        setMarketList(krwMarkets);
        // 최초 4개만 기본 선택
        setMarkets(krwMarkets.slice(0, 10).map(m => m.market));
      } catch { 
        setMarketList([]);
      } finally {
        setLoadingMarkets(false); 
      }
    }
    fetchMarkets();
  }, []);

  // WebSocket 한 번만 연결, markets가 바뀔 때마다 구독 마켓 갱신
  useEffect(() => {
    if (!markets.length) return;
    if (wsRef.current) wsRef.current.close();
    let isUnmounted = false;
    const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
    wsRef.current = ws;
    // 버퍼 초기화
    setTradeBuffers(markets.reduce((acc, m) => { acc[m] = []; return acc; }, {} as Record<string, TradeTick[]>));
    ws.onopen = () => {
      ws.send(
        JSON.stringify([
          { ticket: 'tick' },
          { type: 'trade', codes: markets },
        ])
      );
    };
    ws.onmessage = e => {
      const blob = e.data;
      const reader = new FileReader();
      reader.onload = () => {
        if (isUnmounted) return;
        const text = reader.result as string;
        try {
          const data = JSON.parse(text);
          if (data.type === 'trade' && data.code) {
            setTradeBuffers(prev => {
              // 버퍼에 새 체결 데이터 추가 (최대 2000개 유지)
              const code = data.code;
              if (!markets.includes(code)) return prev;
              const tick: TradeTick = {
                ask_bid: data.ask_bid,
                trade_volume: data.trade_volume,
                trade_time: data.trade_time,
                trade_timestamp: data.trade_timestamp,
                trade_price: data.trade_price,
                code,
              };
              const next = { ...prev };
              next[code] = [...(prev[code] || []), tick].slice(-2000);
              return next;
            });
          }
        } catch {}
      };
      reader.readAsText(blob);
    };
    ws.onerror = () => ws.close();
    ws.onclose = () => {};
    return () => {
      isUnmounted = true;
      ws.close();
    };
  }, [markets]);

  // 선택된 코인들의 현재가/상승률을 주기적으로 fetch
  useEffect(() => {
    if (!markets.length) return;
    let timer: NodeJS.Timeout;
    async function fetchTicker() {
      try {
        const url = 'https://api.upbit.com/v1/ticker?markets=' + markets.join(',');
        const res = await fetch(url);
        const data = await res.json();
        const map: Record<string, TickerInfo> = {};
        data.forEach((item: any) => {
          map[item.market] = {
            trade_price: item.trade_price,
            signed_change_rate: item.signed_change_rate,
          };
        });
        setTickerMap(map);
      } catch {}
    }
    fetchTicker();
    timer = setInterval(fetchTicker, 1500);
    return () => clearInterval(timer);
  }, [markets]);

  const handleMarketChange = (idx: number, newMarket: string) => {
    setMarkets(prev => prev.map((m, i) => (i === idx ? newMarket : m)));
  };

  const handleAddChart = () => {
    if (marketList.length === 0) return;
    // 중복 없는 첫 마켓 추가
    const unused = marketList.find(m => !markets.includes(m.market));
    if (unused) setMarkets(prev => [...prev, unused.market]);
  };

  const handleRemoveChart = (idx: number) => {
    setMarkets(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa' }}>
      {/* 헤더 */}
      <header style={{ background: '#1976d2', color: '#fff', padding: '28px 0 18px 0', textAlign: 'center', boxShadow: '0 2px 8px #e3e3e3' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: '-1px' }}>업비트 코인 실시간 매수/매도 비율</h1>
        <div style={{ fontSize: 16, marginTop: 8, opacity: 0.93 }}>
          KRW마켓 코인별로 1, 5, 10분 누적 매수/매도 비율과 거래대금을 실시간으로 비교하세요.
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '40px auto 0 auto', padding: 16 }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <label htmlFor="interval-select" style={{ fontWeight: 500, marginRight: 8 }}>누적 구간:</label>
          <select
            id="interval-select"
            value={intervalMinutes}
            onChange={e => setIntervalMinutes(Number(e.target.value))}
            style={{ fontSize: 15, padding: '4px 8px', borderRadius: 4 }}
          >
            {INTERVAL_OPTIONS.map(min => (
              <option key={min} value={min}>{min}분</option>
            ))}
          </select>
          <button
            onClick={handleAddChart}
            disabled={markets.length >= MAX_CHARTS || loadingMarkets}
            style={{ padding: '4px 12px', fontSize: 15, borderRadius: 4, background: '#1976d2', color: '#fff', border: 'none', cursor: 'pointer', opacity: markets.length >= MAX_CHARTS ? 0.5 : 1 }}
          >
            + 코인 추가
          </button>
        </div>
        {loadingMarkets ? (
          <div style={{ textAlign: 'center', color: '#888', marginTop: 40 }}>코인 목록을 불러오는 중...</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 24,
            }}
          >
            {markets.map((market, idx) => (
              <div key={market + '-' + intervalMinutes} style={{ background: '#f9f9f9', borderRadius: 10, padding: 12, boxShadow: '0 1px 4px #eee', position: 'relative' }}>
                <button
                  onClick={() => handleRemoveChart(idx)}
                  style={{ position: 'absolute', top: 8, right: 8, background: '#eee', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontWeight: 700, color: '#888' }}
                  title="차트 삭제"
                  disabled={markets.length <= 1}
                >
                  -
                </button>
                <MarketSelector market={market} setMarket={m => handleMarketChange(idx, m)} marketList={marketList} />
                <Chart key={market + '-' + intervalMinutes} market={market} intervalMinutes={intervalMinutes} tradeBuffer={tradeBuffers[market] || []} ticker={tickerMap[market]} />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 푸터 */}
      <footer style={{ marginTop: 48, padding: '24px 0 18px 0', background: '#222', color: '#fff', textAlign: 'center', fontSize: 15, letterSpacing: '0.2px', opacity: 0.97 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>ⓒ {new Date().getFullYear()} CoinVolumePower</div>
        <div style={{ marginTop: 6, color: '#bbb', fontSize: 14 }}>
          본 서비스는 업비트 공개 API를 활용한 비공식 실시간 데이터 시각화 도구입니다.<br />
          투자 참고용이며, 데이터의 정확성 및 실시간성은 보장되지 않습니다.
        </div>
      </footer>
    </div>
  );
} 