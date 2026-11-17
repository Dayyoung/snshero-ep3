<div align="center">
  <img width="1200" height="475" alt="SNSHero — Elwin Village 382-Card Tactical Web TCG" src="https://snshero.com/hs-assets/bg/elwin_intro_bg.webp" />
  <h1>눈히어로 (SNSHero) — Heroes of Elwin Village</h1>
  <p>
    <strong>Zero-Install 382-Card Tactical Web TCG &amp; 40-Episode Full-Voice Fantasy Saga</strong><br/>
    9 Factions · 9 Guardian Heroes · 382 Collectible Cards · 3 Free Packs on First Visit · Guaranteed 1st Legendary within 10 Packs
  </p>
  <p>
    <a href="https://snshero.com/?utm_source=github&utm_medium=readme"><strong>🎁 Official Showcase &amp; Free Pack Preview (snshero.com)</strong></a>
    &nbsp;|&nbsp;
    <a href="https://snshero.com/game?open=pack3&utm_source=github&utm_medium=readme"><strong>⚔️ Play Now &amp; Open 3 Free Packs (/game)</strong></a>
    &nbsp;|&nbsp;
    <a href="https://snshero.com/book?utm_source=github&utm_medium=readme"><strong>📖 40-EP Novel (/book)</strong></a>
    &nbsp;|&nbsp;
    <a href="https://snshero.com/webtoon?utm_source=github&utm_medium=readme"><strong>🎨 40-EP Webtoon (/webtoon)</strong></a>
  </p>
</div>

---

## ✨ Key Features (한눈에 보는 눈히어로)

- **즉시 실행 무설치 웹 TCG (Zero-Install, Zero Sign-Up)**: 설치와 회원가입 대기 없이 PC·모바일 웹 브라우저(PWA 전체화면 지원)에서 3초 만에 플레이할 수 있습니다.
- **첫 방문 3팩 무료 개봉 & 10팩 내 전설 100% 확정**: 접속 즉시 **무료 카드팩 3개 + 250골드 + 160 영웅 가루**가 지급되며, 첫 10팩 이내에 24K 황금빛 전설 카드 1장을 100% 확정으로 획득합니다 (전 등급 중복 보호 적용).
- **9대 종족 × 25장 + 중립 157장 = 총 382종 고유 카드**: 물(포세이돈), 불(이그니스), 바람(토람), 땅(오르테가), 인간(카단), 언데드(아르투스), 엘프(메릴), 드워프(발린), 동물(펜릴) 9대 종족 수호자와 382종의 고유 아트워크를 수집하고 30장 전략 덱을 구축하세요.
- **40부작 성우 풀보이스 스토리모드 & `3장 = 3배 각성`**: 200트랙 이상의 스튜디오 성우 내레이션이 수록된 《카단의 여정》 40화 스토리모드에서는 동일 카드를 3장 이상(전설 2장 이상) 보유할 경우 공격력과 생명력이 보유 장수 배수(`×3`, `×4`, `×N`)로 폭증합니다! (실시간 카단 전술 스위치 및 환생 스케일링 실리아 필살기 지원)
- **보가트의 도박장 & 온라인 도전자 랭킹대전 & 골드 명예 상점**: 카드 보유량 격차 없이 100% 랜덤 30장 덱으로 1~1,000G 판돈 2배 승부를 겨루는 『보가트의 도박장』, 30종 도전자 페르소나 및 감정표현 심리전이 살아있는 『랭킹대전』, 그리고 오직 인게임 골드로 해금하는 4대 명예 치장품(호칭·뱃지·24K 프레임·카드 뒷면)을 제공합니다.
- **로컬 퍼스트 영구 보존 (`hero_hs_*`) & 3초 QR 복원 (1,105+ Commits)**: 모든 카드·덱·재화 데이터는 `localStorage`(`hero_hs_*`)에 즉시 보존되며, 원클릭 덱 공유 URL(`?deck=...`)과 JSON 백업 및 스마트폰 QR 복원을 지원합니다.

---

## 🛠 Tech Stack & Architecture

- **Frontend**: React 19 + TypeScript 5.8 + Tailwind CSS 4.1 + Vite 6 (Multi-Page App: `/`, `/game`, `/book`, `/webtoon`, `/sns`)
- **AI / MCP Arena**: Native JSON-RPC 2.0 Model Context Protocol endpoint (`/mcp`) & 1,000-match headless `GameEngine` evaluation benchmark (`/sns`)
- **PWA & Audio**: Offline-friendly Service Worker (`sw.js`), Web Audio API + 200-track voiced narration (`audio.ts`)

---

## 🚀 Run Locally

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev
```

Build production bundle:

```bash
npm run build
```
