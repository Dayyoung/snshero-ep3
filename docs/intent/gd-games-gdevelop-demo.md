# Intent: gd.games용 GDevelop 네이티브 프로모션 미니 데모 (`SNSHero`)

- **확정 일시:** 2026-11-24
- **상태:** 확정 완료 (Confirmed)

## 1. 목표 (Why)
`gd.games`의 HTTP CSP 정책(`frame-src https://gd.games https://liluo.io http://localhost:4000`)으로 인해 외부 도메인(`https://snshero.com/`) iframe 임베드가 차단된다.  
따라서 플랫폼 규정을 정상 통과하는 **GDevelop 엔진 네이티브 프로모션 미니 데모**를 제작하여, `gd.games` 플레이어가 핵심 재미를 직접 체험한 뒤 `https://snshero.com/game.html` 본편으로 유입되도록 경로를 확보한다.

## 2. 대상 유저 (Who / User)
- `gd.games` 웹게임 포털을 방문한 글로벌(영문 기본) 및 국내(한/영 지원) 플레이어

## 3. 결과물 (Outcome)
- `gd.games`용 GDevelop 프로젝트(`game.json` + 눈히어로 고유 에셋)
- 핵심 플레이 루프: **카드팩 1회 오픈 → `/game.html` 스타일 1~2턴 퀵 카드 듀얼 → `snshero.com/game.html` 유입 CTA**
- 화면 규격: 가로형 16:9 (`1280×720`, 반응형 스케일)
- 언어: 글로벌 영문 기본 + 한/영 전환 지원

## 4. 완료 기준 (Success)
- 로컬에 GDevelop 프로젝트 파일(`game.json` + 에셋) 생성 완료
- 현재 열려 있는 `https://editor.gdevelop.io/` 에디터에 프로젝트를 직접 로드하고, **프리뷰에서 팩 오픈 → 퀵 듀얼 → 본편 CTA까지 오류 없이 플레이되는 상태** 검증 완료

## 5. 제약 조건 (Constraint)
- 블리자드/원작 리소스 사용 일체 금지 (`public/hs-assets/` 등 눈히어로 고유 아트워크·텍스트만 사용)
- `editor.gdevelop.io`에서 바로 Export / Publish 가능한 표준 GDevelop 5 프로젝트 구조 준수

## 6. 하지 않을 것 (Out of scope)
- 전체 382장 카드·40화 스토리·110종 미니게임·LocalStorage 데이터 연동 이식
- `gd.games` 실제 공개(Publish) 버튼 클릭 및 최종 배포 실행
