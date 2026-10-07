# RUN2구룡포 web — TanStack Start · shadcn · Vercel AI SDK · PWA

완주 후 구룡포에 들렀다 포항역으로 돌아오는 러너를 위한 모바일 PWA입니다. 기획·명세는 [`docs/`](../docs)를, 이전 Vite+Express 데모는 저장소 루트를 참고하세요.

## 실행

Node.js 22.12 이상이 필요합니다.

```sh
cd web
npm install
cp .env.example .env   # 키가 없어도 시연 모드로 동작
npm run dev            # http://localhost:3000
npm run check          # 타입 검사 + 테스트(vitest)
npm run build && npm start   # 프로덕션(Nitro node 서버)
```

휴대폰으로 확인하려면 같은 네트워크에서 `http://<PC IP>:3000`을 엽니다. 홈 화면 설치·오프라인(서비스 워커)은 HTTPS 배포에서 동작합니다.

## 기술 스택

| 영역 | 선택 |
| --- | --- |
| 프레임워크 | TanStack Start (Vite, file routes, server routes·server functions) + Nitro |
| UI | Tailwind v4 + shadcn/ui (Drawer·Card·Button 등), RUN2 팔레트를 shadcn 토큰에 매핑 |
| Agent | Vercel AI SDK v7 `streamText` + 도구 4종 → `useChat` + AI Elements(Conversation·Message·PromptInput·Tool·Suggestion) |
| 모델 | `@ai-sdk/openai`, 기본 `gpt-6-luna`(설정값). `OPENAI_MODEL`로 덮어씀 |
| 저장소 | Drizzle ORM + PostgreSQL(`DATABASE_URL`) 또는 PGlite(내장 Postgres/WASM) |
| PWA | `manifest.webmanifest` + 규칙 테이블 기반 서비스 워커(`public/sw.js`) |

## 설계 원칙

**함수형 코어, 얇은 껍데기.** `src/core/`는 IO가 없는 순수 함수만 둡니다. 서버(`src/server/`)와 화면(`src/app/`)은 코어를 조합할 뿐입니다.

- **결정 엔진 = 규칙의 합성** (`core/planner.ts`). `decideWith([medicalFirst, incomplete, atStation, routeUnavailable, returnLeg], courseSearch)` — 앞의 규칙이 답하면 끝나고, 아니면 다음으로 넘깁니다(SICP의 데이터 지향 디스패치). 우선순위는 코드 순서 그 자체입니다.
- **관측 신호 = 모노이드** (`core/signals.ts`). 각 신호 종류는 해석기를 하나씩 갖고, 결과(여유 시간·야외 제한·불확실성·이유)는 `max`/`or`/`concat`으로 접힙니다. 자외선 같은 새 신호는 설정에 항목을 추가하면 됩니다(테스트: `새 관측 신호(자외선)를 설정에 추가하면 야외 장소가 빠짐`).
- **상태 = 이벤트의 왼쪽 접기** (`core/trip.ts`). `state = events.reduce(apply, initial)`. 화면은 명령(`state → events`)만 실행하고, 이벤트는 그대로 jsonb로 서버에 기록됩니다. 계획 변경만 `revision`을 올려, 늦게 도착한 Agent 미리보기는 `applyPreview`가 거절합니다.
- **도구 = 클로저** (`server/agent/tools.ts`). 요청 하나의 계획·관측·예산을 닫아 넣은 함수(`makeOps`)를 만들고, AI SDK 도구(`makeTools`)는 그 위에 스키마만 씌웁니다. 모델이 고르든 결정적 해석기가 고르든 같은 함수가 실행됩니다.

**설정은 데이터(jsonb).** 정책 수치, 코스 변형, 장소, 관측 소스 계약, Agent 한도, 시연 시나리오가 전부 `core/defaults.ts`의 시드 → DB(jsonb) 문서입니다. 코드 수정 없이 DB 수정으로 동작이 바뀝니다.

```sql
-- 역 도착 목표를 열차 20분 전으로: 다음 요청부터 반영(30초 캐시)
UPDATE app_config SET value = value || '{"stationBufferMin": 20}' WHERE key = 'policy';
-- 장소 추가/비활성화
UPDATE places SET active = false WHERE id = 'cafe';
-- 열차 시각을 바꾼 이벤트만 jsonb로 조회
SELECT payload #>> '{patch,trainTime}' FROM trip_events WHERE payload -> 'patch' ? 'trainTime';
```

설정 문서는 시드 위에 깊은 병합되고 `configSchema`로 검증됩니다. 잘못된 수정은 통째로 거부되고 시드로 대체되며, `/api/status`의 `configIssues`로 드러납니다.

| 테이블 | 관계형 열 | jsonb |
| --- | --- | --- |
| `app_config` | key, version | `value`(policy·sources·agent·scenarios·anchors·defaults), `meta` |
| `places` | id, kind, sort, active | `attrs`(이름·설명·좌표·야외 여부·아이콘…), `meta`(출처·검증 상태) |
| `trips` | id | `state`(최신 접힌 상태), `meta` |
| `trip_events` | trip_id, type, created_at | `payload`(이벤트 본문), `meta` — append-only, GIN 인덱스 |
| `observation_snapshots` | source_id, status, observed_at | `payload`(허용 필드만), `meta` — 실응답 스냅샷 재생용 |

## Agent 흐름

```
요청 → 게이트(증상·UNWELL → 의료 우선 / 컨디션 미응답) — 모델·외부 호출 0회
     → 모델(gpt-6-luna) + 도구: get_plan_context · refresh_trip_context · compare_transport · preview_itinerary
        · 질문/비교 문장에는 preview_itinerary를 아예 제공하지 않음(activeTools)
        · 턴당 모델 4단계, 도구 3회, 20초 — config.agent
        · 모델 출력은 끝까지 버퍼링; 실패하면 버리고
     → 결정적 해석기(같은 도구 함수)로 응답, metadata.mode = FALLBACK
```

화면의 시간·코스·이유는 항상 결정 엔진의 구조화된 출력에서 그립니다. 모델 문장은 설명일 뿐이고, 변경은 미리보기 카드의 **이 변경 적용하기**로만 반영됩니다.

## 환경 변수와 키 보관

| 변수 | 용도 |
| --- | --- |
| `OPENAI_API_KEY` | 없으면 결정적 시연 모드 |
| `OPENAI_MODEL` | 기본은 설정의 `agent.model`(gpt-6-luna) |
| `EUM_SERVICE_KEY` | pohang-eum.kr → 마이페이지 → 나의 API의 인증키 |
| `EUM_AIR_DEVICE_ID` | INT_S01_004 대기 장비 id |
| `DATABASE_URL` | 있으면 PostgreSQL, 없으면 PGlite |
| `PGLITE_DIR` | 프로덕션에서 PGlite를 디스크에 보존(GCP: `/data/pglite`) |

키는 서버 코드에서만 읽습니다. `VITE_` 접두사를 붙이면 브라우저 번들에 들어가므로 절대 붙이지 마세요.

- 로컬: `web/.env`
- Vercel: Project → Settings → Environment Variables
- GCP VM: `web/.env` (서버에만, 권한 600) → `deploy/gcp/compose.yml`이 읽음

## E-UM 연동 상태

- 활용신청 완료(8종, 2026-10-07): **INT_S07_005 교통 혼잡율**, **INT_S01_004 대기 실시간(단일)**, INT_S01_012 대기 시간별 통계, INT_S07_001 교통감시 장비 목록, INT_S07_004 교통량 통계, INT_S06_005 자외선 실시간, INT_S05_006 수위 실시간, INT_S03_019 주요 기상 과거.
- 응답 시각 형식은 자료실 샘플 기준 `2026-07-07 17:00:00.0`(시간대 없음) → 소스 설정의 `timezone: Asia/Seoul`로만 해석합니다. 시간대가 설정되지 않은 소스의 이런 값은 버립니다.
- 자료실은 pm25 단위를 PPM으로 표기합니다. μg/m³인지 확인 전까지 결정에는 시연 관측만 쓰고 실응답은 근거 패널에 따로 표시합니다.
- 승인·키·장비 id 확인 후 실호출을 검증해야 합니다. 실패하면 마지막 성공 스냅샷을 `SNAPSHOT`으로 명시해 보여줍니다.

## 배포

- **Vercel**: 프로젝트 Root Directory를 `web`으로 지정합니다(빌드 `npm run build`, 리전 `icn1`). 서버리스에서는 PGlite가 인스턴스마다 메모리라 기록이 남지 않으니, 이벤트를 보존하려면 `DATABASE_URL`(Neon/Supabase)을 설정하세요.
- **GCP VM**(운영진 제공 인스턴스): `docker compose -f deploy/gcp/compose.yml up -d --build`. Caddy가 `DOMAIN`(예: `34-64-1-2.sslip.io`)으로 HTTPS 인증서를 자동 발급합니다. 80/443 개방과 고정 IP는 운영진에게 요청해야 합니다.

## 구조

```text
src/core/        순수 함수: schema · defaults(시드 설정) · planner · signals · trip(이벤트) · intents · preview · evidence · links · fp
src/server/      DB(drizzle 스키마·PGlite/pg·repo) · config(시드⊕jsonb⊕env) · agent(tools·agent·model) · sources(E-UM)
src/routes/      / (앱, client-only) · /api/chat · /api/config · /api/evidence · /api/status · /api/trips/$tripId/events
src/app/         화면: use-trip(이벤트 저장소) · screens · cards · sheets · agent-panel
src/components/  shadcn/ui · ai-elements (모바일용으로 shiki·mermaid 렌더러 제거)
tests/           planner(D01–D08) · trip · agent(Mock LanguageModelV4) · db(PGlite jsonb) · evidence
```
