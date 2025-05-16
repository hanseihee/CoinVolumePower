import type { AppProps } from 'next/app';
import 'chart.js/auto';
import '../styles/globals.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
} 