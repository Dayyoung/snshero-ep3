# SNSHero 풀버전 애니메이션(EP01–EP40) 10개 공식 언어 더빙 제작 의도서

## 1. 목표 (Why & Outcome)
- 이미 제작 완료된 94.26분(5655.84초) 영문 풀버전 마스터 영상(`output/studio_anime/SNSHero_Full_Anime_EP01_EP40_EN_16x9.mp4`)의 **비디오 스트림을 무손실(`-c:v copy`)로 그대로 재사용**하고, 나머지 공식 9개 언어(`ko`, `ja`, `zh-Hans`, `zh-Hant`, `es`, `fr`, `de`, `id`, `vi`)의 **더빙 오디오와 통합 자막(`.srt`)만 새로 제작·합성**하여 **영문 포함 총 10개 공식 언어별 독립 MP4 동영상**을 완성한다.

## 2. 대상 (Who)
- SNSHero 글로벌 유튜브 및 웹 플랫폼의 10개 공식 언어권 시청자:
  - `en` (기존 완성본 유지), `ko`, `ja`, `zh-Hans`, `zh-Hant`, `es`, `fr`, `de`, `id`, `vi`

## 3. 왜 지금 (Why Now)
- 40화 전체 통합본(`SNSHero_Full_Anime_EP01_EP40_EN_16x9.mp4`)과 스토리모드 엔딩 크레딧 BGM 적용이 완료되어, 글로벌 다국어 더빙 라인업(10편)을 일괄 확보할 수 있는 기반이 준비되었다.

## 4. 완료 기준 (Success Criteria)
1. **9개 신규 언어 독립 MP4 파일 생성** (영문 마스터 포함 총 10편 완성):
   - `output/studio_anime/SNSHero_Full_Anime_EP01_EP40_{LANG}_16x9.mp4` (`KO`, `JA`, `ZH-HANS`, `ZH-HANT`, `ES`, `FR`, `DE`, `ID`, `VI` 등 일관된 파일명 규칙)
   - 기존 영문 영상과 동일한 비디오 스트림(`1280×720`, `24fps`, `h264 High`, `-c:v copy`) 유지 및 오디오(`aac 48000Hz stereo`) V/A 동기화 편차 `< 1.0초` 검증.
2. **화자 구분 다국어 Neural 성우 더빙 (`edge-tts`)**:
   - `SNSHero_Full_Anime_EP01_EP40_EN.srt`의 719개 큐와 각 에피소드 `storyboard_epXX_en.json`의 `speakerEn` / `audioMode`를 매핑해 9개 언어로 자연스럽게 번역·로컬라이즈한다 (`ko`는 기존 `SNSHero_StudioAnime_EPXX_KO.srt`도 참조 가능).
   - 각 언어의 `edge-tts` Neural 성우를 화자 유형(주인공 남성 청년/청자, 여성, 노인/장로, 나레이터 등)별로 배정하고, 타임코드 슬롯 내에 무리 없이 들어가도록 적정 배속(`rate`/간격 보정)을 적용한다.
3. **고품질 오디오 재믹싱 (`-14 LUFS`)**:
   - 인트로(`0~43.21s`)와 엔딩(마지막 `49.21s`)은 `build_full_anime_en.py`의 스토리모드 엔딩 크레딧 BGM(8마디 카논 하프·피아노 선율)을 그대로 유지한다.
   - 본편(`EP01~EP40`)은 대사/나레이션 구간에서 기존 영어 음성을 억제(덕킹 또는 본편 BGM 베드 재구성)한 뒤 번역된 더빙 음성을 타임코드에 맞춰 믹싱하고, 전체 트랙을 2-pass `loudnorm=I=-14:TP=-1.5:LRA=11`로 정규화한다.
4. **언어별 통합 자막(`.srt`) 생성 및 검증**:
   - 9개 언어별 `SNSHero_Full_Anime_EP01_EP40_{LANG}.srt` 생성.
   - 모든 산출 MP4에 대해 `ffprobe` 스트림/길이 검증 및 인트로·본편·엔딩 구간 라우드니스/클리핑 검증 통과.

## 5. 제약 조건 (Constraints)
- **무료 로컬/CLI 기반 제작**: 추가 유료 성우 API 없이 로컬 설치된 `edge-tts`(`/opt/homebrew/bin/edge-tts`)와 `ffmpeg`를 사용한다.
- **디스크 용량 관리**: 현재 여유 공간 약 `64GB`에서 9개 MP4(각 약 `4.0GB`, 총 약 `36GB`)를 안전하게 생성해야 하므로, 언어별 임시 WAV/TTS 조각 파일은 해당 언어 MP4 생성 및 검증 완료 즉시 삭제한다.
- **작업 전 동기화 & 로컬 커밋 원칙**: 구현 세션 시작 시 `git pull --rebase --autostash origin main`으로 최신 상태를 먼저 동기화하고, 작업 완료 후 스크립트 및 `WORK_LOGS.md`만 로컬 `git commit` 한다.

## 6. 하지 않을 것 (Out of Scope)
- 인트로(등장인물 이름/직함), 에피소드 전환 간지(장소명/`Moments later...`), 엔딩 몽타주 캡션 등 **화면 내 영문 영상/텍스트의 언어별 재렌더링은 하지 않는다** (`-c:v copy`로 더빙 오디오만 교체).
- 유튜브 자동 업로드 및 재생목록 반영은 이번 범위에 포함하지 않는다.
- 원격 저장소 푸시(`git push`)는 절대 자동 실행하지 않는다.
- 유료 외부 더빙/TTS API(ElevenLabs 등)는 사용하지 않는다.

## 7. 참조 파일
- 마스터 영상: `output/studio_anime/SNSHero_Full_Anime_EP01_EP40_EN_16x9.mp4`
- 마스터 영문 자막: `output/studio_anime/SNSHero_Full_Anime_EP01_EP40_EN.srt`
- 챕터 정보: `output/studio_anime/SNSHero_Full_Anime_EP01_EP40_EN_chapters.json`
- 인트로/엔딩/합성 파이프라인: `scripts/studio_anime/build_full_anime_en.py`
- 공식 10개 언어 코드 참조: `scripts/studio_anime/upload_youtube_20eps_multilang.py` (`en, ko, ja, zh-Hans, zh-Hant, es, fr, de, id, vi`)
