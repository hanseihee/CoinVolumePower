import React, { useEffect, useRef, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface TradeTick {
  ask_bid: 'ASK' | 'BID';
  trade_volume: number;
  trade_time: string;
  trade_timestamp: number;
  trade_price: number;
  code: string;
}

interface TickerInfo {
  trade_price: number;
  signed_change_rate: number;
}

interface ChartProps {
  market: string;
  intervalMinutes: number;
  tradeBuffer: TradeTick[];
  ticker?: TickerInfo;
}

const AGGREGATE_INTERVAL = 1000; // 1초 단위 집계

const Chart: React.FC<ChartProps> = ({ market, intervalMinutes, tradeBuffer, ticker }) => {
  const [buySum, setBuySum] = useState(0);
  const [sellSum, setSellSum] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [strength, setStrength] = useState(100);
  const buySumRef = useRef(0);
  const sellSumRef = useRef(0);
  const amountSumRef = useRef(0);
  const [lastReset, setLastReset] = useState(Date.now());
  const lastTimestamp = useRef(Date.now());

  // intervalMinutes, market, tradeBuffer가 바뀌면 누적 구간(초) 재설정
  useEffect(() => {
    setBuySum(0);
    setSellSum(0);
    setTotalAmount(0);
    setStrength(100);
    buySumRef.current = 0;
    sellSumRef.current = 0;
    amountSumRef.current = 0;
    setLastReset(Date.now());
    lastTimestamp.current = Date.now();
  }, [intervalMinutes, market]);

  // 1초마다 누적 매수/매도/거래대금 집계, intervalMinutes마다 초기화
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    let resetTimer: ReturnType<typeof setTimeout>;
    const RESET_INTERVAL = intervalMinutes * 60 * 1000;

    function aggregateAndPush() {
      const now = Date.now();
      const from = now - RESET_INTERVAL;
      // tradeBuffer에서 intervalMinutes 구간 내 데이터만 집계
      const trades = tradeBuffer.filter(t => t.trade_timestamp >= from);
      const buy = trades.filter(t => t.ask_bid === 'BID').reduce((sum, t) => sum + t.trade_volume, 0);
      const sell = trades.filter(t => t.ask_bid === 'ASK').reduce((sum, t) => sum + t.trade_volume, 0);
      const amount = trades.reduce((sum, t) => sum + t.trade_price * t.trade_volume, 0);
      buySumRef.current = buy;
      sellSumRef.current = sell;
      amountSumRef.current = amount;
      setBuySum(buy);
      setSellSum(sell);
      setTotalAmount(amount);
      // 체결강도 계산
      let s = 100;
      if (sell === 0 && buy > 0) s = 300;
      else if (buy === 0 && sell > 0) s = 0;
      else if (buy > 0 && sell > 0) s = Math.min((buy / sell) * 100, 300);
      setStrength(Math.round(s * 10) / 10);
    }

    function resetAll() {
      buySumRef.current = 0;
      sellSumRef.current = 0;
      amountSumRef.current = 0;
      setBuySum(0);
      setSellSum(0);
      setTotalAmount(0);
      setStrength(100);
      setLastReset(Date.now());
      lastTimestamp.current = Date.now();
    }

    timer = setInterval(aggregateAndPush, AGGREGATE_INTERVAL);
    // intervalMinutes마다 초기화 타이머
    function scheduleReset() {
      const now = Date.now();
      const msToNext = RESET_INTERVAL - ((now - lastReset) % RESET_INTERVAL);
      resetTimer = setTimeout(() => {
        resetAll();
        scheduleReset();
      }, msToNext);
    }
    scheduleReset();

    return () => {
      clearInterval(timer);
      clearTimeout(resetTimer);
    };
  }, [intervalMinutes, lastReset, tradeBuffer]);

  const total = buySum + sellSum;
  const buyRatio = total > 0 ? (buySum / total) * 100 : 50;
  const sellRatio = total > 0 ? (sellSum / total) * 100 : 50;

  const data: ChartData<'bar'> = {
    labels: ['매수', '매도'],
    datasets: [
      {
        label: '비율(%)',
        data: [buyRatio, sellRatio],
        backgroundColor: [
          'rgba(211, 47, 47, 0.7)',  // 매수: 빨강
          'rgba(25, 118, 210, 0.7)', // 매도: 파랑
        ],
        borderColor: [
          '#d32f2f',
          '#1976d2',
        ],
        borderWidth: 2,
        borderRadius: 8,
        barPercentage: 0.7,
        categoryPercentage: 0.7,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y', // 수평 바 차트
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        min: 0,
        max: 100,
        title: { display: true, text: '비율(%)', font: { size: 12 } },
        ticks: { font: { size: 11 } },
        grid: { color: '#eee' },
      },
      y: {
        title: { display: false },
        ticks: { font: { size: 12 } },
        grid: { display: false },
      },
    },
    animation: {
      duration: 800,
      easing: 'easeOutQuart',
    },
  };

  // 거래대금 포맷팅 함수
  function formatAmount(amount: number) {
    return amount.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) + '원';
  }

  // 현재가/상승률 포맷팅
  const price = ticker?.trade_price;
  const changeRate = ticker?.signed_change_rate;
  const changeRateStr = changeRate !== undefined ? (changeRate * 100).toFixed(2) + '%' : '-';
  const changeColor = changeRate === undefined ? '#888' : changeRate > 0 ? '#d32f2f' : changeRate < 0 ? '#1976d2' : '#222';

  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #eee', padding: 8, textAlign: 'center', width: 180, height: 180, margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <Bar data={data} options={options} />
      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>
        <span style={{ color: '#d32f2f' }}>매수 {buyRatio.toFixed(1)}%</span>
        {' / '}
        <span style={{ color: '#1976d2' }}>매도 {sellRatio.toFixed(1)}%</span>
      </div>
      <div style={{ marginTop: 2, color: '#888', fontSize: 11 }}>
        {intervalMinutes}분 누적 실시간 비율
      </div>
      <div style={{ marginTop: 2, color: '#444', fontSize: 12, fontWeight: 500 }}>
        누적 거래대금: {formatAmount(totalAmount)}
      </div>
      <div style={{ marginTop: 2, color: '#222', fontSize: 12, fontWeight: 700 }}>
        체결강도: {strength}%
      </div>
      <div style={{ marginTop: 2, fontSize: 12, fontWeight: 600 }}>
        <span>현재가: {price !== undefined ? price.toLocaleString('ko-KR') + '원' : '-'}</span>
        <span style={{ marginLeft: 6, color: changeColor }}>({changeRateStr})</span>
      </div>
    </div>
  );
};

export default Chart; 