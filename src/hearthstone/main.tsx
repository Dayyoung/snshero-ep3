import React, { Component, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import './hearthstone.css';
import { HearthstoneApp } from './HearthstoneApp';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class GameErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: Readonly<ErrorBoundaryProps>;
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected runtime error',
    };
  }

  render() {
    if (this.state.hasError) {
      const isKo =
        typeof navigator !== 'undefined' &&
        (navigator.language || '').toLowerCase().startsWith('ko');
      return (
        <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-[#090604] p-6 text-center text-amber-100">
          <h1 className="text-xl font-extrabold text-amber-300">
            {isKo
              ? '화면 전환 중 일시적인 오류가 발생했습니다'
              : 'A temporary rendering issue occurred'}
          </h1>
          <p className="mt-2 max-w-md text-xs text-amber-100/80">
            {isKo
              ? '보유 카드·골드·진행도(로컬 데이터)는 100% 안전하게 보존되어 있습니다.'
              : 'Your cards, Gold, and progress remain 100% safely preserved.'}
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.href = '/game';
            }}
            className="mt-5 min-h-[46px] rounded-2xl border-2 border-amber-300 bg-amber-700 px-6 py-2.5 text-sm font-extrabold text-white shadow-xl"
          >
            {isKo ? '엘윈마을 로비로 복귀' : 'Return to Elwin Hub'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('hs-root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <GameErrorBoundary>
        <HearthstoneApp />
      </GameErrorBoundary>
    </React.StrictMode>,
  );
}
