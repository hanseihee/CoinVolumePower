# coinVolumePower

업비트에서 코인의 체결강도를 실시간으로 받아와 차트로 시각화하는 웹사이트입니다.

## 주요 기능
- 업비트 WebSocket API를 통한 실시간 체결 데이터 수신
- 체결강도(매수/매도 체결 비율) 계산 및 실시간 차트 시각화
- 코인(마켓) 선택 기능
- 반응형 UI

## 기술 스택
- Next.js (TypeScript)
- React
- Chart.js, react-chartjs-2

## 개발 및 실행
```bash
npm install
npm run dev
```

## 배포
Vercel을 통해 손쉽게 배포할 수 있습니다.

```bash
npm i -g vercel
vercel
``` 