import React from 'react';

interface MarketSelectorProps {
  market: string;
  setMarket: (market: string) => void;
  marketList?: { market: string; korean_name: string; english_name: string }[];
}

const DEFAULT_MARKETS = [
  { market: 'KRW-BTC', korean_name: '비트코인', english_name: 'Bitcoin' },
  { market: 'KRW-ETH', korean_name: '이더리움', english_name: 'Ethereum' },
  { market: 'KRW-XRP', korean_name: '리플', english_name: 'Ripple' },
  { market: 'KRW-SOL', korean_name: '솔라나', english_name: 'Solana' },
  { market: 'KRW-ADA', korean_name: '에이다', english_name: 'ADA' },
];

const MarketSelector: React.FC<MarketSelectorProps> = ({ market, setMarket, marketList }) => {
  const list = marketList && marketList.length > 0 ? marketList : DEFAULT_MARKETS;
  return (
    <div>
      <label htmlFor="market-select">코인 선택: </label>
      <select
        id="market-select"
        value={market}
        onChange={e => setMarket(e.target.value)}
        style={{ fontSize: 16, padding: '4px 8px', marginBottom: 8, width: 170, minWidth: 120, maxWidth: '100%' }}
      >
        {list.map(m => (
          <option key={m.market} value={m.market}>
            {m.korean_name} ({m.market})
          </option>
        ))}
      </select>
    </div>
  );
};

export default MarketSelector; 