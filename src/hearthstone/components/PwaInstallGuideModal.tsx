import React, { useState } from 'react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { getDevicePlatform } from '../pwaFullscreen';
import { useModalDismiss } from '../useModalDismiss';

interface PwaInstallGuideModalProps {
  onClose: () => void;
}

export const PwaInstallGuideModal: React.FC<PwaInstallGuideModalProps> = ({ onClose }) => {
  useHeroLanguage();
  const detected = getDevicePlatform();
  const [tab, setTab] = useState<'ios' | 'android'>(detected === 'android' ? 'android' : 'ios');

  useModalDismiss(true, onClose);

  const iosSteps = [
    {
      step: '1',
      title: tr('Safari 브라우저에서 열기', 'Open in Safari Browser'),
      desc: tr(
        '카카오톡·인스타그램 등 인앱 브라우저라면 먼저 우측 메뉴에서 [Safari로 열기]를 눌러주세요.',
        'If you are in an in-app browser, tap the menu and choose "Open in Safari" first.',
      ),
    },
    {
      step: '2',
      title: tr('공유 버튼 (□↑) 누르기', 'Tap the Share Button (□↑)'),
      desc: tr(
        '화면 하단(또는 상단 주소창 옆)의 네모 위 화살표 모양 공유 아이콘을 누르세요.',
        'Tap the Share icon (square with an upward arrow) at the bottom or top bar.',
      ),
    },
    {
      step: '3',
      title: tr('「홈 화면에 추가」 → 「추가」 선택', 'Tap "Add to Home Screen" → "Add"'),
      desc: tr(
        '목록을 아래로 내려 「홈 화면에 추가」를 누른 뒤 오른쪽 위 「추가」를 누르면 앱으로 설치됩니다.',
        'Scroll down, tap "Add to Home Screen", then tap "Add" in the top-right corner.',
      ),
    },
  ];

  const androidSteps = [
    {
      step: '1',
      title: tr('Chrome 또는 삼성 인터넷 메뉴 열기', 'Open Browser Menu (⋮ or ≡)'),
      desc: tr(
        '브라우저 오른쪽 위 점 3개(⋮) 또는 하단 줄 3개(≡) 메뉴 버튼을 누르세요.',
        'Tap the 3-dot (⋮) menu in Chrome or the 3-line (≡) menu in Samsung Internet.',
      ),
    },
    {
      step: '2',
      title: tr('「앱 설치」 또는 「홈 화면에 추가」 선택', 'Select "Install App" or "Add to Home screen"'),
      desc: tr(
        '메뉴에서 「앱 설치」 또는 「홈 화면에 추가」 항목을 찾아 눌러주세요.',
        'Tap "Install app" or "Add to Home screen" from the menu.',
      ),
    },
    {
      step: '3',
      title: tr('「설치」 확인 후 홈 화면 아이콘 실행', 'Confirm "Install" & Launch from Home Screen'),
      desc: tr(
        '설치 팝업에서 「설치」를 누르면 홈 화면에 앱 아이콘이 생성되며 주소창 없는 전체화면으로 실행됩니다.',
        'Tap "Install" to add the icon. Launching it opens the game in true fullscreen!',
      ),
    },
  ];

  const steps = tab === 'ios' ? iosSteps : androidSteps;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
    >
      <div
        className="hs-panel-gold relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl p-4 text-amber-100 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-amber-400/25 pb-3">
          <div>
            <div className="text-[11px] font-extrabold tracking-wider text-sky-300 uppercase">
              {tr('모바일 전체화면 앱 설치 안내', 'PWA Fullscreen App Install Guide')}
            </div>
            <h3 className="hs-title mt-0.5 text-lg font-black text-amber-100 sm:text-xl">
              📲 {tr('눈히어로 게임 설치 방법', 'How to Install SNSHero')}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('ui_click', 0.6);
              onClose();
            }}
            className="hs-brass-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black text-amber-200"
            aria-label={tr('닫기', 'Close')}
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-amber-100/85 sm:text-sm">
          {tr(
            '홈 화면에 앱으로 추가하면 브라우저 주소창 없이 진짜 전체화면 앱처럼 쾌적하게 플레이할 수 있습니다.',
            'Add SNSHero to your home screen to play in true fullscreen without browser bars.',
          )}
        </p>

        {/* OS Tab Selector */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-amber-500/25 bg-black/40 p-1">
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('ui_click', 0.6);
              setTab('ios');
            }}
            className={`rounded-lg py-2 text-xs font-extrabold transition sm:text-sm ${
              tab === 'ios'
                ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-[#1c1008] shadow'
                : 'text-amber-200/80 hover:bg-white/5'
            }`}
          >
            🍎 iPhone · iPad (Safari)
          </button>
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('ui_click', 0.6);
              setTab('android');
            }}
            className={`rounded-lg py-2 text-xs font-extrabold transition sm:text-sm ${
              tab === 'android'
                ? 'bg-gradient-to-b from-emerald-300 to-emerald-500 text-[#072414] shadow'
                : 'text-amber-200/80 hover:bg-white/5'
            }`}
          >
            🤖 Android (Chrome)
          </button>
        </div>

        {/* Step-by-step instructions */}
        <div className="mt-4 space-y-2.5">
          {steps.map((s) => (
            <div
              key={s.step}
              className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-black/45 p-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-300/60 bg-amber-900/80 text-xs font-black text-amber-100">
                {s.step}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-amber-200 sm:text-sm">{s.title}</div>
                <div className="mt-0.5 text-[11.5px] leading-relaxed text-amber-100/80 sm:text-xs">
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('ui_click', 0.7);
              onClose();
            }}
            className="hs-blue-btn min-h-[42px] w-full rounded-xl px-5 py-2 text-sm font-black text-white sm:w-auto"
          >
            {tr('확인', 'Got It')}
          </button>
        </div>
      </div>
    </div>
  );
};
