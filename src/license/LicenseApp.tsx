import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Briefcase,
  Mail,
  Lock,
  Copy,
  Check,
  ArrowLeft,
  Scale,
  FileText,
} from 'lucide-react';
import { useHeroLanguage } from '../i18n/heroLang';

const CONTACT_EMAIL = 'dryudryu@gmail.com';
const EFFECTIVE_DATE = '2026-11-23';

export const LicenseApp: React.FC = () => {
  const { lang, isKo, setLang } = useHeroLanguage();
  const [copied, setCopied] = useState(false);

  const l = (ko: string, en: string) => (isKo ? ko : en);
  const langQuery = isKo ? '' : `?lang=${encodeURIComponent(lang)}`;
  const logoSrc = isKo ? '/hs-assets/brand/logo-ko.webp' : '/hs-assets/brand/logo-en.webp';

  useEffect(() => {
    document.title = isKo
      ? '눈히어로 라이선스 · 저작권 · IP 양도 및 개인정보처리방침 (/license) | SNSHero'
      : 'SNSHero License, Copyright, IP Transfer & Privacy Policy (/license)';
  }, [isKo, lang]);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = CONTACT_EMAIL;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  const mailSubject = encodeURIComponent(
    isKo
      ? '[SNSHero] 유료 라이선스 구매 / 전체 저작권(IP) 양도 문의'
      : '[SNSHero] Paid License Purchase / Full Copyright (IP) Transfer Inquiry',
  );
  const mailHref = `mailto:${CONTACT_EMAIL}?subject=${mailSubject}`;

  return (
    <div className="min-h-dvh flex flex-col bg-[#090d16] text-[#fdfcfc] font-mono">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 border-b border-white/15 bg-[#090d16]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <a
              href={`/${langQuery}`}
              className="inline-flex min-h-[44px] items-center gap-2.5 text-[#fdfcfc] no-underline hover:opacity-90"
            >
              <img
                src={logoSrc}
                alt={l('눈히어로', 'SNSHero')}
                className="h-9 w-auto object-contain"
              />
            </a>
            <span className="hidden border border-white/20 bg-[#111726] px-2 py-0.5 text-[11px] font-bold tracking-wider text-amber-300 rounded-sm sm:inline-block">
              /license
            </span>
          </div>

          <nav
            aria-label={l('상단 바로가기', 'Top Navigation')}
            className="flex flex-wrap items-center gap-2"
          >
            <a
              href={`/${langQuery}`}
              className="license-btn-ghost text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{l('홈', 'Home')}</span>
            </a>
            <a
              href={`/game${langQuery}`}
              className="license-btn-ghost hidden text-xs sm:inline-flex"
            >
              {l('게임', 'Game')}
            </a>
            <a
              href={`/book${langQuery}`}
              className="license-btn-ghost hidden text-xs sm:inline-flex"
            >
              {l('웹소설', 'Novel')}
            </a>
            <a
              href={`/webtoon${langQuery}`}
              className="license-btn-ghost hidden text-xs sm:inline-flex"
            >
              {l('웹툰', 'Webtoon')}
            </a>

            <div
              role="group"
              aria-label={l('언어 선택', 'Language Switcher')}
              className="inline-flex border border-white/20 bg-[#111726] p-0.5 rounded-sm"
            >
              <button
                type="button"
                data-testid="license-lang-ko"
                onClick={() => setLang('ko')}
                aria-pressed={isKo}
                className={`min-h-[44px] cursor-pointer px-3 text-xs font-bold rounded-sm transition ${
                  isKo
                    ? 'bg-[#fdfcfc] text-[#090d16]'
                    : 'text-stone-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                KO
              </button>
              <button
                type="button"
                data-testid="license-lang-en"
                onClick={() => setLang('en')}
                aria-pressed={!isKo}
                className={`min-h-[44px] cursor-pointer px-3 text-xs font-bold rounded-sm transition ${
                  !isKo
                    ? 'bg-[#fdfcfc] text-[#090d16]'
                    : 'text-stone-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {/* Hero & Quick Jump */}
        <section className="border border-white/15 bg-[#101624] p-5 sm:p-8 rounded-none">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-amber-300">
            <Scale className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{l('공식 지적재산권 · 라이선스 · 개인정보 안내', 'OFFICIAL IP · LICENSE · PRIVACY POLICY')}</span>
          </div>

          <h1 className="mt-3 text-xl font-extrabold leading-snug text-[#fdfcfc] sm:text-3xl">
            {l(
              '눈히어로(SNSHero) 저작권 · 라이선스 및 개인정보처리방침',
              'SNSHero Copyright, Licensing & Privacy Policy',
            )}
          </h1>

          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-stone-300 sm:text-sm">
            {l(
              '본 페이지는 『눈히어로: 엘윈마을과 카단의 여정』(웹 카드 배틀 게임, 40화 웹소설, 보이스 웹툰 및 관련 원천 IP 일체)에 적용되는 저작권·라이선스 기준, 유료 재사용 계약 안내, 전체 저작권(IP) 권리 양도 문의 창구 및 일반 개인정보처리방침을 명시합니다.',
              'This page sets forth the copyright and licensing terms for SNSHero: Heroes of Elwin Village & Kadan’s Journey (web card battle game, 40-episode web novel, voice webtoon, and all proprietary IP), paid reuse permissions, full copyright transfer inquiries, and our Privacy Policy.',
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-stone-400">
            <span className="border border-white/15 bg-[#090d16] px-2.5 py-1 rounded-sm">
              {l(`시행일: ${EFFECTIVE_DATE}`, `Effective Date: ${EFFECTIVE_DATE}`)}
            </span>
            <span className="border border-white/15 bg-[#090d16] px-2.5 py-1 rounded-sm">
              {l('공식 문의: dryudryu@gmail.com', 'Official Contact: dryudryu@gmail.com')}
            </span>
          </div>

          {/* 4-Section Quick Jump TOC */}
          <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href="#copyright"
              className="license-btn-ghost justify-start text-left text-xs"
            >
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
              <span>{l('1. 일반 저작권·라이선스', '1. Copyright & License')}</span>
            </a>
            <a
              href="#paid-license"
              className="license-btn-ghost justify-start text-left text-xs"
            >
              <Briefcase className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
              <span>{l('2. 유료 라이선스 재사용', '2. Paid License Reuse')}</span>
            </a>
            <a
              href="#ip-transfer"
              className="license-btn-ghost justify-start text-left text-xs"
            >
              <Mail className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
              <span>{l('3. 전체 권리 양도 문의', '3. Full IP Transfer')}</span>
            </a>
            <a
              href="#privacy"
              className="license-btn-ghost justify-start text-left text-xs"
            >
              <Lock className="h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
              <span>{l('4. 개인정보처리방침', '4. Privacy Policy')}</span>
            </a>
          </div>
        </section>

        {/* Sections Stack */}
        <div className="mt-6 space-y-6">
          {/* 1. General Copyright & License Notice */}
          <section
            id="copyright"
            data-testid="section-copyright"
            className="scroll-mt-24 border border-white/15 bg-[#101624] p-5 sm:p-7 rounded-none"
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
              <h2 className="text-base font-extrabold text-[#fdfcfc] sm:text-xl">
                {l(
                  '1. 일반 저작권 및 라이선스 고지',
                  '1. General Copyright & License Notice',
                )}
              </h2>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-stone-300 sm:text-sm">
              <p>
                {l(
                  '『눈히어로 (SNSHero: 엘윈마을과 카단의 여정)』 서비스 내에 포함된 모든 웹 카드 배틀 게임 소스코드, 전투·밸런스 규칙, 382종 독자 카드 데이터 및 일러스트, 9대 영웅 캐릭터, 세계관 설정, 40화 웹소설, 보이스 웹툰, 성우 음성·효과음·BGM 및 UI/UX 디자인은 저작권법 및 관련 지식재산권 법령의 보호를 받는 눈히어로 독자 저작물입니다.',
                  'All game source code, battle mechanics, 382 original cards and artwork, 9 guardian heroes, world lore, the 40-episode web novel, voice webtoon, voice acting, audio/BGM, and UI/UX assets within SNSHero (Heroes of Elwin Village & Kadan’s Journey) are proprietary works protected by copyright and intellectual property laws.',
                )}
              </p>
              <ul className="list-disc space-y-2 pl-5 text-stone-300">
                <li>
                  {l(
                    '사전 서면 라이선스 계약 없이 본 저작물의 전부 또는 일부를 무단 복제, 재배포, 미러링, 크롤링(AI 학습 데이터 수집 포함), 영리적 활용, 수정 또는 2차적 저작물로 제작·공개하는 행위를 엄격히 금지합니다.',
                    'Unauthorized reproduction, redistribution, mirroring, automated scraping (including AI training dataset harvesting), commercial exploitation, modification, or creation of derivative works without prior written license is strictly prohibited.',
                  )}
                </li>
                <li>
                  {l(
                    '무료 웹 이용자는 공식 웹사이트(snshero.com) 및 허가된 배포 채널 내에서 개인적·비영리적 감상 및 플레이 목적으로만 서비스를 이용할 수 있습니다.',
                    'Free web visitors are granted a limited, revocable, non-transferable permission solely for personal, non-commercial gameplay and reading on official SNSHero channels.',
                  )}
                </li>
                <li>
                  {l(
                    '별도 고지된 오리지널 클래식 재현 아카이브(/stone.html)는 본 눈히어로 독자 IP 라이선스 판매 및 재사용 대상에서 제외됩니다.',
                    'The separate non-commercial classic tribute archive (/stone.html) is excluded from SNSHero proprietary IP licensing and commercial transfer.',
                  )}
                </li>
              </ul>
            </div>
          </section>

          {/* 2. Paid License Purchase & Authorized Reuse */}
          <section
            id="paid-license"
            data-testid="section-paid-license"
            className="scroll-mt-24 border border-white/15 bg-[#101624] p-5 sm:p-7 rounded-none"
          >
            <div className="flex items-center gap-2.5">
              <Briefcase className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
              <h2 className="text-base font-extrabold text-[#fdfcfc] sm:text-xl">
                {l(
                  '2. 유료 라이선스 구매 후 재사용 가능 안내',
                  '2. Paid License Purchase & Authorized Reuse',
                )}
              </h2>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-stone-300 sm:text-sm">
              <p>
                {l(
                  '유료 라이선스를 정식으로 구매한 개인, 스튜디오, 퍼블리셔 및 기업 사용자는 체결된 라이선스 계약서에서 명시한 허가 범위(기간, 지역, 매체, 수정 및 상업적 활용 권한) 내에서 눈히어로 게임·웹소설·웹툰 리소스 및 시스템을 적법하게 재사용할 수 있습니다.',
                  'Individuals, studios, publishers, and enterprise partners who purchase an official paid license may lawfully reuse SNSHero game, web novel, and webtoon assets or software modules within the scope, territory, duration, and commercial rights defined in their written license agreement.',
                )}
              </p>

              <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                <div className="border border-white/15 bg-[#090d16] p-4 rounded-none">
                  <div className="text-xs font-bold text-emerald-300">
                    {l('상업적 퍼블리싱 · 리스킨 라이선스', 'Commercial Publishing & Reskin License')}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-stone-400">
                    {l(
                      '게임 엔진, 카드 배틀 시스템, UI 프레임워크 또는 포팅 빌드(웹/모바일/포털)의 상업적 서비스 및 커스터마이징 재사용.',
                      'Licensed commercial deployment and customization of the card battle engine, UI framework, or portal builds across web and mobile.',
                    )}
                  </p>
                </div>

                <div className="border border-white/15 bg-[#090d16] p-4 rounded-none">
                  <div className="text-xs font-bold text-emerald-300">
                    {l('콘텐츠 · 아트워크 · 2차 저작 라이선스', 'Content, Art & Derivative Media License')}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-stone-400">
                    {l(
                      '40화 웹소설, 웹툰 컷신, 카드 일러스트 및 캐릭터 IP를 활용한 번역·영상화·콜라보레이션·굿즈 제작 등 허가 범위 내 재사용.',
                      'Authorized reuse of the 40-episode novel, webtoon assets, card artwork, and character IP for localization, video adaptation, collaborations, or merchandise.',
                    )}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-stone-400 sm:text-xs">
                {l(
                  '※ 사이트 내 자동 결제 시스템은 제공되지 않으며, 모든 유료 라이선스 범위·이용료·조건은 공식 이메일 협의를 통해 서면 계약으로 확정됩니다.',
                  '※ No automated online checkout is provided on this site. All paid license scopes, fees, and terms are finalized via direct email consultation and written agreement.',
                )}
              </p>
            </div>
          </section>

          {/* 3. Full Copyright Transfer & Licensing Inquiry */}
          <section
            id="ip-transfer"
            data-testid="section-ip-transfer"
            className="scroll-mt-24 border border-amber-400/40 bg-[#131a2b] p-5 sm:p-7 rounded-none"
          >
            <div className="flex items-center gap-2.5">
              <Mail className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
              <h2 className="text-base font-extrabold text-[#fdfcfc] sm:text-xl">
                {l(
                  '3. 전체 카피라이트(IP) 권리 양도 및 라이선스 구매 문의',
                  '3. Full Copyright (IP) Transfer & License Acquisition Inquiry',
                )}
              </h2>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-stone-200 sm:text-sm">
              {l(
                '유료 라이선스 구매뿐만 아니라 눈히어로(SNSHero) 게임·웹소설·웹툰·캐릭터·도메인 및 원천 지식재산권 전체 카피라이트 권리 양도(인수/독점 계약)에 관한 협의는 아래 공식 이메일로 직접 문의해 주시기 바랍니다.',
                'For both paid license purchases and inquiries regarding full copyright transfer or acquisition (exclusive buyout of the SNSHero game, web novel, webtoon, characters, and underlying IP), please contact us directly at the official email below.',
              )}
            </p>

            <div className="mt-5 border border-white/20 bg-[#090d16] p-4 sm:p-5 rounded-none">
              <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                {l('공식 라이선스 · 전체 권리 양도 협의 연락처', 'OFFICIAL LICENSING & IP TRANSFER CONTACT')}
              </div>
              <div className="mt-1.5 text-lg font-extrabold text-amber-300 break-all sm:text-xl">
                {CONTACT_EMAIL}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={mailHref}
                  data-testid="license-mailto-cta"
                  className="license-btn-primary min-h-[48px] text-xs sm:text-sm"
                >
                  <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{l('이메일로 라이선스 · IP 양도 문의하기', 'Inquire via Email (dryudryu@gmail.com)')}</span>
                </a>

                <button
                  type="button"
                  data-testid="license-copy-email-btn"
                  onClick={handleCopyEmail}
                  className="license-btn-ghost min-h-[44px] text-xs sm:text-sm"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                      <span className="text-emerald-300">{l('이메일 복사됨', 'Email Copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{l('이메일 주소 복사', 'Copy Email Address')}</span>
                    </>
                  )}
                </button>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
                {l(
                  '문의 시 ① 성함/소속(개인 또는 기업), ② 희망 유형(부분 유료 라이선스 / 전체 카피라이트 양도), ③ 활용 목적 및 출시 예정 채널을 함께 기재해 주시면 신속히 회신드립니다.',
                  'Please include: (1) Your name / organization, (2) Inquiry type (Paid Reuse License or Full Copyright/IP Transfer), and (3) Intended scope & target platforms.',
                )}
              </p>
            </div>
          </section>

          {/* 4. General Privacy Policy */}
          <section
            id="privacy"
            data-testid="section-privacy"
            className="scroll-mt-24 border border-white/15 bg-[#101624] p-5 sm:p-7 rounded-none"
          >
            <div className="flex items-center gap-2.5">
              <Lock className="h-5 w-5 shrink-0 text-violet-300" aria-hidden="true" />
              <h2 className="text-base font-extrabold text-[#fdfcfc] sm:text-xl">
                {l(
                  '4. 일반 개인정보처리방침 (Privacy Policy)',
                  '4. Privacy Policy',
                )}
              </h2>
            </div>

            <div className="mt-4 space-y-4 text-xs leading-relaxed text-stone-300 sm:text-sm">
              <div>
                <h3 className="font-bold text-[#fdfcfc]">
                  {l('① 게스트 플레이 및 LocalStorage 기반 로컬 저장 원칙', '1) Guest Play & LocalStorage Data Storage')}
                </h3>
                <p className="mt-1 text-stone-300">
                  {l(
                    '눈히어로는 회원가입을 강제하지 않는 웹 기반 서비스이며, 카드 인벤토리·덱 구성·게임 재화·전적·스토리 진행도 및 언어 설정(hero_hs_*, hero_language 등)은 사용자의 브라우저 내 로컬스토리지(LocalStorage)에 직접 저장·유지됩니다. 서비스 운영자는 별도의 중앙 서버 DB에 사용자의 개인 식별 게임 프로필을 상시 수집·보관하지 않습니다.',
                    'SNSHero operates without mandatory account registration. Your card inventory, decks, in-game currencies, match history, story progress, and language preference (such as hero_hs_* and hero_language) are stored directly in your browser’s LocalStorage. We do not maintain centralized user profile databases of your local gameplay data.',
                  )}
                </p>
              </div>

              <div>
                <h3 className="font-bold text-[#fdfcfc]">
                  {l('② 웹 분석 및 광고 서비스(쿠키·자동 수집 정보)', '2) Analytics, Advertising & Cookies')}
                </h3>
                <p className="mt-1 text-stone-300">
                  {l(
                    '서비스 품질 개선, 방문 통계 파악 및 무료 서비스 운영을 위해 Google Analytics 4(GA4), Google Ads 및 Google AdSense가 일부 페이지에서 사용될 수 있습니다. 이 과정에서 브라우저 쿠키, 기기 유형, 화면 해상도, 접속 경로, 페이지 조회 및 익명화된 이용 통계가 Google 정책에 따라 처리될 수 있습니다. 사용자는 브라우저 쿠키 차단 설정 또는 Google 광고 설정을 통해 맞춤형 광고 및 분석 수집을 제한할 수 있습니다.',
                    'To measure traffic, improve stability, and sustain free access, certain pages may use Google Analytics 4 (GA4), Google Ads, and Google AdSense. These third-party services may process cookies, device/browser metadata, referral URLs, and aggregated usage events under Google’s privacy policies. You can restrict cookies or opt out of personalized advertising through your browser settings or Google Ads Settings.',
                  )}
                </p>
              </div>

              <div>
                <h3 className="font-bold text-[#fdfcfc]">
                  {l('③ 이메일 문의 시 수집·이용 정보', '3) Email Inquiry Information')}
                </h3>
                <p className="mt-1 text-stone-300">
                  {l(
                    `사용자가 라이선스 구매, 전체 IP 양도 또는 개인정보 관련 문의를 위해 ${CONTACT_EMAIL} 로 이메일을 발송하는 경우, 발신자의 이메일 주소 및 문의 내용은 오직 문의 확인과 회신·계약 협의 목적으로만 이용되며, 법령상 의무가 없는 한 제3자에게 판매하거나 임의 제공하지 않습니다.`,
                    `If you contact ${CONTACT_EMAIL} regarding paid licensing, full IP transfer, or privacy inquiries, your email address and message content are used solely to review and respond to your inquiry and conduct requested negotiations. We never sell your contact information to third parties.`,
                  )}
                </p>
              </div>

              <div>
                <h3 className="font-bold text-[#fdfcfc]">
                  {l('④ 이용자의 권리 및 로컬 데이터 삭제 방법', '4) User Rights & Deleting Local Data')}
                </h3>
                <p className="mt-1 text-stone-300">
                  {l(
                    `이용자는 언제든지 웹 브라우저 설정의 '사이트 데이터 및 로컬스토리지 삭제' 기능을 통해 기기에 저장된 모든 게임 데이터를 즉시 영구 삭제할 수 있습니다. 개인정보 열람·정정·삭제 또는 관련 문의는 ${CONTACT_EMAIL} 로 요청해 주시기 바랍니다.`,
                    `You may permanently erase all locally stored game data at any time by clearing site data / LocalStorage in your browser settings. For privacy requests, data access, or deletion inquiries, please email ${CONTACT_EMAIL}.`,
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 border-t border-white/10 pt-3 text-[11px] text-stone-400">
                <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {l(
                    `본 방침은 ${EFFECTIVE_DATE}부터 적용되며, 중요 변경 시 본 /license 페이지를 통해 고지합니다.`,
                    `This policy is effective as of ${EFFECTIVE_DATE}. Material updates will be posted on this /license page.`,
                  )}
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-10 border-t border-white/15 bg-[#070a12] px-4 py-8 text-center text-xs text-stone-400">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-4 font-bold text-stone-300">
            <a href={`/${langQuery}`} className="inline-flex min-h-[44px] items-center hover:text-amber-300">
              {l('홈 (/)', 'Home (/)')}
            </a>
            <a href={`/game${langQuery}`} className="inline-flex min-h-[44px] items-center hover:text-amber-300">
              {l('게임 (/game)', 'Game (/game)')}
            </a>
            <a href={`/book${langQuery}`} className="inline-flex min-h-[44px] items-center hover:text-amber-300">
              {l('웹소설 (/book)', 'Novel (/book)')}
            </a>
            <a href={`/webtoon${langQuery}`} className="inline-flex min-h-[44px] items-center hover:text-amber-300">
              {l('웹툰 (/webtoon)', 'Webtoon (/webtoon)')}
            </a>
            <a href={`/sns${langQuery}`} className="inline-flex min-h-[44px] items-center hover:text-amber-300">
              {l('AI 벤치마크 (/sns)', 'AI Benchmark (/sns)')}
            </a>
          </div>
          <p className="text-[11px] text-stone-400">
            {l(
              '본 게임·웹소설·웹툰은 저작권 및 라이선스가 적용된 눈히어로 독자 저작물입니다.',
              'This game, web novel, and webtoon are original works protected by SNSHero copyright & license.',
            )}
          </p>
          <p className="text-[11px] text-stone-500">
            © 2026 SNSHero (SNSHero.com) · {CONTACT_EMAIL}
          </p>
        </div>
      </footer>
    </div>
  );
};
