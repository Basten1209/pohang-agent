# RUN2구룡포 서비스 기획서 — 집필 브리프 (workflow agents 공용)

이 문서는 「2026 디지털 트윈 구룡포 AI 해커톤」 참가신청서의 **붙임 2 서비스 기획서**를
개조식(箇條式)으로 다시 쓰기 위한 공용 지침이다. 모든 작성·비평·수정 에이전트는 이 브리프를 기준으로 판단한다.

## 0. 작업 산출물

- 섹션별 JSON 파일: `<build dir>/sections/sec{N}.json` (N = 1..5). build dir = `docs/submission/build`
- 작성 후 반드시 `python3 <build dir>/validate_section.py <build dir>/sections/sec{N}.json` 을 실행해 `OK`를 확인한다. ERROR가 있으면 고친다. WARN도 가능한 한 없앤다.
- 렌더러(별도 스크립트)가 JSON을 공식 양식(docx)의 「붙임 2」 표 안에 맑은 고딕 11pt로 조판한다. 그림·표 번호는 렌더러가 자동 부여한다.

## 1. 대회·평가 맥락 (반드시 반영)

- 대회: 2026 디지털 트윈 구룡포 AI 해커톤 (주최 과기정통부·NIA·경북·포항시, 주관 POSTECH 미래도시연구센터)
- 주제: 생성형 AI를 활용하여 디지털 트윈이 적용된 포항 구룡포의 환경·안전·관광 분야에서 사용자가 쉽고 유용하게 도움을 받는 AI Agent 제작
- AI Agent 개발 요건 3가지 (모두 충족했음을 본문에서 명시적으로 보여줄 것)
  1. 생성형 AI(LLM) 활용: 사용자의 자연어 입력을 이해·응답
  2. 디지털 트윈 데이터 연동: 제공 데이터/API를 최소 1개 이상 **실제 호출·활용**
  3. 문제 해결형 동작: 단순 질의응답을 넘어 판단·추천·경보·시각화 등 유용한 결과 제공
- 일정: 서면평가 9.14~9.18 → 본선 진출 5팀 발표 9.18 → 서비스 디벨롭·온라인 멘토링 9.21~10.12 (약 3주) → 본선 오프라인 10.13
- E-UM 디지털트윈 포항(https://pohang-eum.kr)에 없는 데이터는 공공데이터포털 활용 가능
- **서면평가 심사 기준 (100점)** — 문서 전체가 이 4가지를 정면으로 겨냥해야 한다
  | 항목 | 내용 | 배점 |
  |---|---|---|
  | 구체성 및 논리성 | 기획서가 충실하고 구체적·논리적인가 (기술적 구현 방법, 서비스 흐름 등) | 30 |
  | 주제 적합성 | 대회 주제에 부합하는가 | 25 |
  | 실현 가능성 | 현실적으로 실행 가능한가 | 25 |
  | 지역 사회 기여도 | 지역 사회에 긍정적 영향을 줄 수 있는가 | 20 |
- 양식 지시: 항목 자유 구성, 기본 폰트 맑은 고딕 11pt, **AI Agent 제작을 위한 기술적 구현 계획을 포함하여 구체적으로 기술**

## 2. 원본 자료 (반드시 읽고, 여기 있는 사실만 사용)

- 제출 초안(현재 2쪽, 서술형) 텍스트: `<build dir>/draft_text.txt` — **이 초안의 모든 내용·수치·표현 의도는 보존**하고, 개조식으로 바꾸며 상세화한다
- 상세 기획서(마스터, 약 30KB, 가장 풍부한 근거): `/home/user/pohang-agent/docs/run2-guryongpo-master-draft.md`
- 2쪽 압축 초안(md): `/home/user/pohang-agent/docs/run2-guryongpo-application-draft.md`
- 초기 아이디에이션(확장 방향 참고, Apple Watch 등은 MVP 제외): `/home/user/pohang-agent/ideation/runflow-health-twin.md`
- 대회 안내문 텍스트: `<build dir>/notice.txt`
- 사용 가능한 그림 4장 (렌더러가 삽입; JSON에서는 id로만 지정)
  | id | 내용 | 들어갈 섹션 |
  |---|---|---|
  | `journey` | 사용자 여정 3단계(대회 전 계획 저장 → 완주 직후 기록·상태 확인 → 이동 전 일정 재계산)와 "단축 방문 / 14:00까지 복귀 / 기존 250분 → 단축 205분 / 길찾기" 결과 카드 | 2 |
  | `architecture` | 상단 데이터원(E-UM 교통·대기, TourAPI 관광정보, Kakao 차량 ETA) → 모바일웹(입력 확인·재계산) → 데이터 통합(시각·단위·유효성) → 결정 규칙(시간·증상·허용 장소) → LLM 설명(확정 결정 유지) → 일정 결과(방문·축소·취소), 하단 "재계산 요청 시 최신 데이터 조회" 루프 | 2 |
  | `sysarch` | 4계층 시스템 아키텍처: PWA 사용자 경험(대회 전/대회 중/완주 후) → Application API(POST /api/race-plans, /api/post-race/decision, /api/itineraries/replan) → AI Orchestration(API Adapter & Normalizer → Cache/Static Fallback → Rule Engine → LLM Explanation & Itinerary; "안전 판단은 규칙, 설명은 LLM") → External Data(E-UM 교통 INT_S07_005, E-UM 대기 INT_S01_004, 기상청 단기예보, TourAPI, Kakao Mobility, 포항 버스/TAGO). 하단 문구 "PWA MVP · 개인정보 최소수집 · Apple Watch는 확장 단계" | 3 |
  | `dataflow` | 7단계 API 데이터 흐름: ① 사용자·대회 데이터(거리·목표기록·귀가시각·컨디션) → ② 병렬 API 호출(E-UM 교통 GET /dpg/traffic/congestion, E-UM 대기 GET /dpg/atmosphere/device/realtime, 기상청 getVilageFcst, TourAPI locationBasedList2, Kakao GET /v1/directions) → ③ Adapter 표준화(좌표·시각·단위·freshness) → ④ Fallback(Cache·정적 관광후보·Maps URL) → ⑤ Rule Engine(GO/DELAY/SHORTEN/INDOOR/CANCEL/MEDICAL_FIRST) → ⑥ LLM(판단 근거 설명·일정 구성) → ⑦ PWA 결과(페이스 카드·관광 일정·주의 알림·길찾기). 하단: "401·timeout·stale·empty → 최근 데이터 또는 정적 대체 → 갱신시각·한계 표시" | 3 |
- 본문 내용은 그림과 **모순되면 안 된다** (예: 결정 상태 6종, 내부 API 3종, 외부 데이터 6종은 그림에 있으므로 본문에서도 같은 이름으로 설명).

## 3. 정직성·범위 제약 (위반 시 비평가가 반드시 지적)

- 현재 상태: **외부 API 실호출은 미검증**. "1주차에 실호출 검증"으로 계획을 쓰되, 이미 연동 완료된 것처럼 쓰지 않는다. 단, E-UM 명세(엔드포인트·필드명)는 자료실 명세 기준으로 확인된 사실이므로 구체적으로 써도 된다.
- 이동시간·완주시각 등 시연 수치는 **"시연 가정값"** 임을 표시. 실측값·보장값처럼 쓰지 않는다.
- 없는 것: 할인·쿠폰·제휴·전용 셔틀·좌석 예약·공식 기록 자동 연동·웨어러블(Apple Watch) 실시간 연동·대중교통 실시간 도착(TAGO는 검증 후 조건부) → 모두 "MVP 제외/확장 단계"로만 언급.
- 의료·안전: 서비스는 의료 진단·안전 보장을 하지 않는다. 위험 증상(통증·어지럼·메스꺼움) 입력 시 관광 생성을 중단하고 현장 의료지원(의료부스·119)을 안내. "탈수 진단", "심장 이상 감지", "안전 보장" 같은 표현 금지. 권장 표현: "운동부하가 높게 관찰됨", "휴식 또는 의료부스 방문 권고", "현재 조건에서 관광을 추천하지 않음".
- 지역경제 효과(매출·숙박 증가)는 **검증할 가설**로만 쓴다. 근거 없는 통계·퍼센트를 만들지 않는다. 허용된 인용: [1] 포항시의회 제332회 회의록(2026.7.22) — 스포츠대회·관광 연계 추진과 소비·체류 효과 측정 필요성 논의. 그 외 수치 출처를 지어내지 않는다.
- E-UM 교통 `cntPerc`는 구룡포 전체 장비의 **통합 혼잡률**이며 특정 도로의 ETA로 환산하지 않는다(교통 여유시간의 보조 신호). 차량 ETA는 Kakao Mobility가 계산.
- E-UM 대기 `INT_S01_004`는 장비 `id` 지정 조회, `logDateTime`·측정값을 관측시각과 함께 표시하되 의료적 기준으로 해석하지 않음.
- 팀명·개인정보·팀원 실명은 쓰지 않는다 (역할 구분만: 기획/개발/디자인 등).
- 특정 LLM 벤더를 단정하지 말고 "JSON 스키마 기반 구조화 출력을 지원하는 상용 LLM API(본선 지원 AI 구독 활용)" 수준으로 쓴다. 기술 스택은 "예정"으로 제안 가능 (예: PWA — React+Vite+Workbox, 백엔드 — Python FastAPI + httpx 비동기 병렬 호출 + Pydantic 스키마 검증, 저장소 — PostgreSQL(또는 SQLite) + 캐시, 배포 — 클라우드 컨테이너). 이 정도의 구체성은 실현 가능성 점수에 도움이 되므로 권장.

## 4. 핵심 사실 요약 (여러 섹션에서 일관되게 사용)

- 서비스명: **RUN2구룡포**. 한 줄 정의: 완주 시각·자가 컨디션·복귀 마감과 구룡포 디지털 트윈 데이터를 결합해 관광 일정을 다시 계산하는 AI 에이전트 (러닝 계획을 피니시라인 이후의 실행 가능한 관광 일정으로 이어 주는 스포츠 관광 AI Agent).
- 핵심 사용자(1차): 타지역에서 온 **자가용·당일 귀가형 10km 러너**. 확장: 가족 동반 하프, 크루 1박형.
- 3단계 흐름: ① 대회 전 계획 저장(QR로 PWA 접속, 자연어 입력 "14시까지 대회장 주차장에 돌아와야 하고 오래 걷고 싶지 않아요" → LLM이 복귀 지점·도착 마감·보행 선호 추출 → 사용자 확인 → 목표 완주 시각과 함께 예비 일정 저장) ② 완주 직후 결정 갱신(실제 완주 시각·자가 컨디션 입력 → 증상 확인 → 회복·차량 이동·체류·여유시간 합산 → 부족하면 장소·체류 축소, 최소 코스 불가 시 취소) ③ 이유 확인 후 길찾기(방문 결정·복귀 예상 시각·변경 이유·데이터 기준시각 확인 → 길찾기 실행; 관광 중에도 재계산 버튼).
- 자가 컨디션 선택지: 양호 / 많이 지침 / 통증 있음 / 어지럽거나 메스꺼움.
- 시간 예산 모델: `가용시간 = 복귀 마감 − 현재 시각`, `필요시간 = 회복 버퍼 + 출발 ETA + 체류 + 복귀 ETA + 안전 여유`, `slack = 가용 − 필요`. slack<0 → 장소·체류 축소(SHORTEN) 재계산, 최단 코스도 불가 → CANCEL. 임계값은 운영 설정.
- 시연 예시(가정값): 10:20 완주, 14:00 복귀 마감 → 가용 220분. 기존 계획 = 회복 30 + 이동 합계 100 + 관광 90 + 여유 30 = 250분 → 불가. 관광 45분으로 축소 → 총 205분, 여유 포함 계산상 복귀 예상 13:45 → "단축 방문" 제안. 이동시간은 실측값 아님.
- 결정 상태 6종: `GO`(지금 출발·권장 일정) / `DELAY`(회복 후 권장 출발 시각) / `SHORTEN`(장소·보행량 축소) / `INDOOR`(강수·환경·피로로 실내·식사 중심) / `CANCEL`(최소 일정 불가 → 관광 보류·귀가 안내) / `MEDICAL_FIRST`(위험 증상 → 관광 생성 중단·현장 의료지원 안내). LLM은 상태를 바꿀 수 없음.
- 역할 분리: Rule Engine(위험 증상 중단, 시간 예산, 활동 강도 상한, 실내외 가능성, 상태 코드 확정) / LLM(자연어 제약 추출, 확정 상태·허용 장소 안에서 일정 구성·근거 설명·질의응답; MEDICAL_FIRST 해제·데이터 누락 은폐·의료 진단 금지) / API Adapter(형식·시각·좌표·단위·신선도 표준화).
- LLM 입력(파생 상태만): decision, reasonCodes(LOW_TIME_SLACK, HIGH_SELF_REPORTED_FATIGUE 등), allowedPlaceIds, maxWalkingMinutes, returnDeadline, dataFreshness. LLM 출력(JSON 검증 후 화면 문구화): headline, explanation[], stopOrder[], limitations[]. 스키마 불일치·오류 시 결정 상태 유지 + 템플릿 설명 반환.
- 외부 데이터 (우선순위·엔드포인트·필드·용도)
  - 필수·실호출: E-UM 교통 `INT_S07_005` — `GET https://genix.pohang-eum.kr/dpg/traffic/congestion?serviceKey={KEY}` → `hour`, `cntPerc`(통합 혼잡률) — 교통 여유시간 보조 신호·출발시각 조정
  - 필수·실호출: E-UM 대기환경 `INT_S01_004` — `GET https://genix.pohang-eum.kr/dpg/atmosphere/device/realtime?serviceKey={KEY}&id={deviceId}` → `logDateTime`, `pm10`, `pm25`, `temp`, `humi`, `winsp`, `windir` — 환경정보 표시·실내외 판단 보조
  - 핵심: 기상청 단기예보(`getVilageFcst`, `getUltraSrtFcst`, `getUltraSrtNcst` → `TMP/T1H`, `REH`, `WSD`, `RN1`, `PTY`, `SKY`) — 대회·관광 시간대 기상
  - 핵심: 한국관광공사 TourAPI(`locationBasedList2`, `detailCommon2`, `detailIntro2`, `detailImage2`, `searchKeyword2`, `searchFestival2`) — 구룡포·호미곶 후보, 운영정보, 행사
  - 핵심: Kakao Mobility 길찾기(`GET /v1/directions`, `GET /v1/future/directions` → 거리·소요시간) — 자가용 현재·예정 출발 ETA
  - 보조(무키): Google Maps URL — 경로 API 실패 시 길찾기 실행
  - 보조: 포항시 시내버스 노선정보(정적) / 검증 후: TAGO 버스도착정보 / 확장·조건부: E-UM 자외선 `INT_S06_005`(`/dpg/sensor/latest/uvIndex`), 수위 `INT_S05_006`(`/dpg/sensor/latest/sensorLevel`), 방파제 AI CCTV `INT_S06_006`(`/dpg/aicctv/avghour/datas`, 관광객 혼잡도로 해석 금지)
- 공통 외부 데이터 형식: `{source, observedAt, fetchedAt, freshness(FRESH|STALE), fallbackUsed, values{...}}`
- 장애·대체 정책: 키 누락·401 → Adapter 비활성·허용 캐시 → "교통 데이터 연결 대기"+갱신시각 / timeout·5xx → 짧은 재시도 후 최근 캐시 → "최근 확인 데이터 사용" / 빈 관광 결과 → 검증된 정적 후보 5~10개 → "운영시간은 방문 전 확인" / 오래된 관측 → STALE 표시·가중치 축소 / Kakao 실패 → 정적 이동 버퍼 + Google Maps URL / TAGO 미지원 → 실시간 숨김 / LLM 오류 → 결정 유지·템플릿 설명.
- 내부 API 3종: `POST /api/race-plans`(raceId, distanceKm, targetDurationMinutes, startAt, returnDeadline, transportMode, postRaceIntent → targetPaceSecPerKm, 체크포인트 targetElapsedSec, 예상 완주시각, 날씨 요약, 예비 관광 가능성) / `POST /api/post-race/decision`(racePlanId, finishDurationMinutes, selfReportedState, dangerSymptoms[], returnDeadline → decision, reasonCodes, recommendedDepartureAt, returnStartBy, dataFreshness, itinerary; dangerSymptoms 비어있지 않으면 MEDICAL_FIRST+고정 안전문구만) / `POST /api/itineraries/replan`(itineraryId, currentAt, currentPlaceId, returnDeadline, changeReason → 유지 또는 SHORTEN/INDOOR/CANCEL 전환된 새 순서·복귀 마감).
- 데이터 모델: `RacePlan`(종목·목표기록·출발시각·귀가마감·이동수단; 행사 후 삭제 가능) / `FinishCheck`(실제기록·자가 피로도·위험증상 여부; 상태 코드 중심 저장) / `EnvironmentSnapshot`(출처·관측시각·값·freshness·fallback; 단기 캐시) / `Itinerary`(결정상태·장소순서·ETA·복귀마감·설명; 사용자 요청 삭제) / `ConversionEvent`(계획열람·길찾기실행·도착확인; 비식별 집계).
- 3주 개발 계획: 1주차 — PWA 핵심 화면, RacePlan 스키마·페이스 계산, E-UM 교통·대기 2종 실호출 및 장비 id·단위·차량 경로 검증, 나머지 Adapter mock / 2주차 — Recovery Gate·시간 예산 Rule Engine, 관광 후보 필터·정적 대체, LLM 구조화 출력·금지 규칙·템플릿 fallback, 판단 화면·지도 URL / 3주차 — replan API·재계산, 오류·빈 응답·stale·401·timeout 테스트, 3개 시나리오 데모, 러너 5명 사용성 검증(입력 이해도·결과 이해도·과업 완료), 출처·갱신시각·비의료 문구·접근성 점검.
- 검증 시나리오 7종: 정상·시간 충분 → GO / 피로 높음·시간 충분 → DELAY 또는 SHORTEN / 야외 불리·실내 후보 → INDOOR / 귀가 여유 부족 → CANCEL / 위험 증상 → 항상 MEDICAL_FIRST / 외부 데이터 일부 장애 → 캐시·정적 대체·한계 표시 / 웨어러블 없이 전체 여정 완료.
- KPI: 대회 전 계획 생성률(획득) / 구룡포 관광 사전 저장률(의향) / 완주 후 재계산 완료율(판단) / 길찾기 실행률(행동; 이동 의향 행동이며 실제 방문과 구분) / 동의 기반 구룡포 도착 확인율(방문) / 평균 방문 장소 수·체류시간(체류) / 상태별 취소·축소·실내 전환율(운영).
- 지역 활용: 익명 집계(시간대별 이동 시도, 자가용·대중교통 비율, 취소 이유)를 행사 운영자·포항시의 관광 안내 시점·코스·교통 운영 조정 근거로 제공. 시의회에서 논의된 스포츠대회–관광 연계 효과 측정에 기여. 수상작은 사례집·현장 연계 기회 → 실제 포항 러닝 행사에 적용 가능.
- 확장: 걷기대회·트레일러닝·자전거대회, 영일대 대형 행사(불꽃축제) 방문객, 가족·크루 다인 일정, 대중교통 실시간(TAGO 검증 후), 웨어러블(HealthKit/WorkoutKit) 연동, E-UM 추가 데이터(자외선·수위·방파제), 타 지역 스포츠 관광 모델로 이전.
- 개인정보·보안: 위치·컨디션은 기능 수행 중에만 사용, 원본 위치 이력 미저장, 상태 코드 중심 저장, KPI는 격자·시간대 단위 익명 이벤트, API 키는 서버 환경변수/Secret Manager(번들·로그·Git 미포함), E-UM 이용신청은 활용분야 관광·목적 학술/연구.

## 5. 개조식 문체·가독성 규칙

- 종결: 명사형·개조식 (…함 / …임 / …필요 / …제공 / …계산 / 명사구). **"~다.", "~요."로 끝나는 서술형 문장 금지.**
- 한 블록 = 한 생각. level 1은 60자 이내(핵심 요지, 굵게 렌더링), level 2~3은 110자 이내 권장(최대 150자). 길면 쪼갠다.
- 계층: level 1(□ 핵심 요지) → level 2(○ 구체 항목) → level 3(- 세부·근거·예시) → level 4(· 보조, 꼭 필요할 때만). 한 level 1 아래에 level 2를 2~5개, 그 아래 level 3을 0~4개.
- 추상어 대신 수치·이름·조건: "빠르게" ✗ → "3초 이내" / "여러 API" ✗ → "E-UM 교통·대기 2종 + 기상청·TourAPI·Kakao".
- 강조는 `**굵게**` (문장당 1회 이하, 핵심 명사에만). API명·필드·상태코드·엔드포인트는 백틱 `` `code` ``로.
- 표는 "비교·목록·매핑"이 있을 때만. 열 2~5개, 셀은 짧게(키워드·구), 표마다 caption(번호 없이). 표 앞에 표를 소개하는 level 2/3 문장 1개.
- ※ note는 한계·전제·주의 표시용. 각 섹션 0~3개.
- code 블록은 수식·JSON 예시용(3~14줄, 한 줄 78자 이내). 섹션 3에서만 2~3개.
- box는 섹션 첫머리의 "한 줄 요약" 등 강조용(섹션당 최대 1개, 80자 이내).
- 용어 통일: RUN2구룡포 / E-UM 디지털트윈 포항(첫 등장 이후 "E-UM") / 결정 규칙(Rule Engine) / LLM / PWA(모바일 웹) / 시간 예산 / 복귀 마감 / 자가 컨디션 / 위험 증상 / 정적 대체(fallback) / 관측 시각(데이터 기준시각).
- 독자는 심사위원. 전문용어는 첫 등장 시 짧게 풀이. 영문 약어 남발 금지.
- 서로 다른 섹션에서 같은 표를 반복하지 않는다 (섹션별 역할 분담은 §6 참조).

## 6. 섹션별 개요 (반드시 이 뼈대를 따르되, 세부는 풍부하게)

목표 분량(validator가 출력하는 body chars 기준, 표 셀 제외): 1절 900~1,200자 / 2절 1,800~2,300자 / 3절 3,200~4,000자 / 4절 1,200~1,500자 / 5절 1,000~1,300자. 표 셀 글자(table chars)는 별도이며 섹션당 표 셀 합계 1,200자 이내 권장. 전체 문서는 A4 8~9쪽을 목표로 함 — 길이보다 밀도·가독성이 우선.

### 1. 아이디어 발상 동기 (심사 관점: 주제 적합성·지역 기여·논리성)
- box: 한 줄 문제 정의 ("관광지 정보 부족이 아니라 완주 후 남은 시간·몸 상태를 반영한 이동 결정의 부재")
- □ 배경: 포항 스포츠 행사와 구룡포·호미곶 관광권의 공간적·인지적 단절 (시의회 논의 [1], 대회장 밖 별도 이동, 완주 직후 피로·귀가 마감)
- □ 기존 도구의 한계: 러닝 앱은 완주와 함께 종료 / 관광 앱은 피로도·귀가 마감·잔여 시간을 모름 / 정적 안내는 관측 시각이 없음
- □ 완주자가 스스로 풀어야 하는 질문 (5개: 지금 얼마나 걸리나 / 귀가에 맞나 / 실외 적절한가 / 어디까지 줄여야 하나 / 어떤 순서로)
- □ 디지털 트윈 활용 필요성: E-UM 교통 혼잡률·대기환경 관측을 "지금 출발 가능한가" 판단 입력으로; 관측 시각 기준 재계산이 핵심 가치; 환경·안전·관광 3분야 중 관광을 축으로 환경·안전 데이터를 결합
- □ 타깃 사용자와 제품 가설 (1차 타깃, 확장 타깃, 가설: 사전 계획 저장 + 완주 후 재계산 → 단순 추천보다 구룡포 이동 시작률 상승; 검증 퍼널 6단계)

### 2. 서비스(아이디어) 내용 및 주요 특징 (심사 관점: 구체성·논리성, 주제 적합성)
- box: 한 줄 정의
- □ 서비스 흐름 3단계 (①②③ 각각 level 2로, 그 아래 입력·AI 처리·출력을 level 3으로 구체화) → figure `journey`
- □ 대회 요건 충족 방식 (LLM 활용 / 디지털 트윈 데이터 실호출 / 문제 해결형 동작 — 표 1개: 요건 | RUN2구룡포의 구현 | 확인 방법)
- □ 판단 방식: 시간 예산 모델(수식은 문장으로, code 블록은 3절에서), 결정 상태 6종 (표: 상태 | 발생 조건 | 사용자에게 보이는 결과) → figure `architecture`
- □ 시연 예시 (가정값 수치 계산을 level 3으로 단계별 서술; ※ 실측 아님)
- □ 차별성 (표: 비교 항목 | 기존 러닝 앱·관광 앱·고정형 런트립 | RUN2구룡포) + 창의성·실용성 포인트 3~4개

### 3. 서비스(아이디어) 목표 및 구현 방법 (심사 관점: 구체성·논리성 30점 + 실현 가능성 25점의 핵심)
- box: 본선 시연 목표 한 줄
- □ 구현 목표와 범위: 본선 MVP 정의(계획 저장→완주 입력→E-UM 실제 조회→결정→설명·길찾기→재계산), 대표 데모 시나리오 3종(정상/시간 부족/위험 증상), MVP 포함·제외 범위 (표 또는 level 3 목록)
- □ 시스템 아키텍처 → figure `sysarch`; 구성요소 7개 (PWA Client / Application API / API Orchestration·Adapter / Rule Engine / LLM Layer / Data Store / External Data) 각각 역할 1줄
- □ 디지털 트윈·외부 데이터 연동 계획 (표: 데이터 | 호출·주요 필드 | 용도 | 검증 계획) — E-UM 2종 필수·실호출 강조, 기상청·TourAPI·Kakao·Google Maps URL, 확장 후보; ※ cntPerc 해석 한계
- □ 데이터 처리 파이프라인 7단계 → figure `dataflow`; 공통 외부 데이터 형식 code 블록(JSON 6~9줄)
- □ AI 의사결정 설계: 역할 분리 표(구성요소 | 담당 | 하지 않는 일), 시간 예산 code 블록(수식 5~6줄), Recovery Gate, LLM 입출력 경계(파생 상태만 입력, JSON 스키마 검증 출력, 실패 시 템플릿)
- □ 생성형 AI 활용 방식: 자연어 제약 추출(예문 → 구조화 필드), 설명 생성, 질의응답, 프롬프트 가드레일(상태 변경 금지·데이터 시각 포함·비의료 문구), 구조화 출력 검증
- □ 내부 API·데이터 모델 (표: API | 요청 핵심 필드 | 응답 핵심 필드 — 3종; 데이터 모델은 level 3 목록 또는 표 1개)
- □ 장애·대체 정책 (표: 상황 | 서버 동작 | 사용자 표시)
- □ 기술 스택(예정)과 개발 일정 (표: 주차 | 기간 | 산출물 | 완료 기준 — 9.21~10.12 기준 3주) + 팀 역할 구분(기획/프런트/백엔드·AI/디자인·검증 등, 실명 없이)
- □ 검증 계획·완료 기준: API 계약 테스트, 결정 테스트 7종, 사용성 검증(러너 5명), 데모 완료 기준

### 4. 기대효과 및 활용방안 (심사 관점: 지역 사회 기여도 20점)
- □ 사용자(러너·동반자) 관점 효과
- □ 지역사회·구룡포 관점 효과 (완주자 → 남부 관광권 체류·소비 연결, 시간대 분산, 안전한 방문)
- □ 성과지표 (표: 단계 | KPI | 의미 — 7개) ※ 길찾기 클릭은 이동 의향, 방문은 동의 기반 도착 확인으로 구분; 매출 증가는 가설
- □ 포항시 정책·행정 수요 연계 (익명 집계 → 관광 안내 시점·코스·교통 운영 근거, 시의회 논의 효과 측정 기여, 사례집·현장 연계 기회 시 실제 행사 적용 계획)
- □ 향후 발전 가능성 (행사 유형 확장, 다인 일정, 대중교통 실시간, 웨어러블, E-UM 추가 데이터, 타 지역 이전)

### 5. 기타 사항 (심사 관점: 실현 가능성·신뢰성)
- □ 안전·윤리 원칙 (비의료 고지, MEDICAL_FIRST, 금지 표현·권장 표현)
- □ 개인정보 보호·API 키 관리
- □ 리스크와 대응 (표: 리스크 | 영향 | 대응 — 5~6개: API 키 발급 지연, E-UM 응답 불일치·장비 미확인, 행사 코스 데이터 부재, LLM 출력 오류, 관광 운영정보 부정확, 일정 지연)
- □ 현재 준비 상태와 정직한 한계 (상세 기획서·아키텍처·API 명세 초안 완료, 실호출 미검증, MVP 제외 항목)
- □ 참고자료 (level 3 목록: [1] 포항시의회 제332회 회의록 2026.7.22, [2] E-UM 교통 명세 INT_S07_005, [3] E-UM 대기 명세 INT_S01_004, [4] Kakao Mobility 길찾기 API, [5] 한국관광공사 TourAPI, [6] 기상청 단기예보 조회서비스, [7] 대회 안내문)

## 7. JSON 블록 형식 (렌더러 계약)

```json
{
  "number": 3,
  "title": "서비스(아이디어) 목표 및 구현 방법",
  "blocks": [
    {"t": "box",  "text": "본선에서 계획 저장 → 완주 입력 → E-UM 실제 조회 → 결정 → 설명·길찾기 → 재계산을 하나의 PWA로 시연"},
    {"t": "p", "level": 1, "text": "구현 목표: 실제 데이터로 결정이 달라지는 것을 보여주는 MVP"},
    {"t": "p", "level": 2, "text": "본선 시연 범위: **자연어 계획 입력 → 완주 결과 입력 → E-UM 실호출 → 규칙 결정 → LLM 설명 → 재계산**의 단일 흐름"},
    {"t": "p", "level": 3, "text": "대표 데모: 10km 당일 귀가 사용자 1명의 정상·시간 부족·위험 증상 시나리오 3종"},
    {"t": "note", "text": "시연 수치는 가정값이며 이동시간은 실측값이 아님"},
    {"t": "figure", "id": "sysarch", "caption": "RUN2구룡포 시스템 아키텍처 (PWA → Application API → AI Orchestration → External Data)"},
    {"t": "table", "caption": "디지털 트윈·외부 데이터 연동 계획", "widths": [22, 34, 22, 22], "align": ["l","l","l","l"],
     "header": ["데이터", "호출·주요 필드", "용도", "검증 계획"],
     "rows": [["**E-UM 교통** `INT_S07_005`", "`GET /dpg/traffic/congestion` → `hour`, `cntPerc`", "교통 여유시간 보조 신호", "1주차 서비스 키 실응답 확인"]]},
    {"t": "code", "title": "시간 예산 모델", "lines": ["availableWindow = returnDeadline - currentTime", "requiredWindow  = recoveryBuffer + outboundETA + visitDuration + returnETA + safetyBuffer", "slack = availableWindow - requiredWindow"]}
  ]
}
```

- `t` 종류: `p`(level 1~4 개조식 항목), `note`(※), `box`(강조 한 줄), `table`, `figure`, `code`.
- `p.text`에 □ ○ - · ※ 같은 마커를 직접 쓰지 않는다 (렌더러가 붙임). ①②③ 같은 원문자는 흐름 단계 이름 안에서는 허용하되 text 맨 앞에는 쓰지 않는다 → "1단계(대회 전) 계획 저장: ..." 처럼 쓴다.
- 인라인 마크업: `**굵게**`, `` `코드` `` 만 지원. 줄바꿈(\n) 금지.
- table: `header` 2~5열, `rows` 1~12행, `widths` 백분율 합 100, `align` 열별 "l"/"c"(선택), caption 필수(번호 없이).
- figure: `id` ∈ {journey, architecture, sysarch, dataflow}, caption 필수(번호 없이). journey·architecture는 2절, sysarch·dataflow는 3절에만.
- code: `lines` 3~16줄, 각 78자 이내, `title` 선택.
