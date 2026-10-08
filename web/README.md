# RUN2구룡포 web — TanStack Start · shadcn · Vercel AI SDK · PWA

완주 후 구룡포에 들렀다 포항역으로 돌아오는 러너를 위한 모바일 PWA입니다. 기획·명세는 [`docs/`](../docs)를, 이전 Vite+Express 데모는 저장소 루트를 참고하세요.

## 화면 (iPhone 13 기준, 실제 모델로 진행)

앱 전체가 하나의 대화입니다. 폼이 없습니다. 열차 시각·하고 싶은 일·출발 장소·완주 후 상태를 앱이 한 번에 하나씩 묻고, 사용자는 말로 답하거나 답 버튼을 누릅니다(버튼은 그 문장을 대신 보내 줄 뿐입니다). 코스·변경 승인·다음 행동만 대화 안의 카드로 뜹니다.

| 일정 만들기 | 완주 후 | 변경 승인 | 이동 중 | 도착 |
| --- | --- | --- | --- | --- |
| ![](docs/screenshots/chat-1-일정.png) | ![](docs/screenshots/chat-2-완주후.png) | ![](docs/screenshots/chat-3-변경승인.png) | ![](docs/screenshots/chat-4-이동중.png) | ![](docs/screenshots/chat-5-도착.png) |

화면 단위 UI는 `/classic`에 남겨 두었고, 같은 서버 여정을 읽고 씁니다: [하루 만들기](docs/screenshots/1-내하루만들기.png) · [데모 시나리오](docs/screenshots/2-데모컨트롤.png) · [코스](docs/screenshots/3-구룡포코스.png) · [다음 행동](docs/screenshots/6-다음행동.png).

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
| UI | shadcn/ui **Nova 프리셋 기본값 그대로**(radix, neutral 흑백, Geist). 컴포넌트는 레지스트리 원본을 수정 없이 사용하고 화면에서는 레이아웃용 className만 씀 |
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
| `trips` | id | `state`(최신 접힌 상태 — 서버가 단일 원천), `messages`(AI SDK UIMessage 대화), `meta`(적용한 카드 id·변경 미리보기) |
| `trip_events` | trip_id, type, created_at | `payload`(이벤트 본문), `meta` — append-only, GIN 인덱스 |
| `observation_snapshots` | source_id, status, observed_at | `payload`(허용 필드만), `meta` — 실응답 스냅샷 재생용 |

## Agent 흐름

설계: [`docs/agent-ux.md`](docs/agent-ux.md). 한 턴은 `src/server/agent/harness.ts`의 `runTurn` 하나입니다.

```
클라이언트 → 마지막 메시지 1개만 전송 (사용자 문장, 또는 카드 답·승인이 담긴 assistant 메시지)
서버      → 저장된 대화에 병합 (클라이언트는 새 문장과 열린 카드의 답·승인만 바꿀 수 있음)
          → 카드 답을 이벤트로 결정적 적용 (모델이 폼 값을 옮겨 적지 않음)
          → 안전 게이트: 증상 언급 → SAFETY, 모델 호출 0
          → ToolLoopAgent (prepareStep마다)
               · 단계(stage)별 activeTools — 질문 문장이면 커밋 도구 제외
               · 강제 도구 — 일정·완주 후 자유 입력 → update_trip_details, 계획 진입 → plan_course,
                 변경 미리보기 → apply_plan_change(승인 카드)
               · 지시문 = 기본 원칙 + 단계 지시 + 여정 요약
               · toolApproval: 계획 변경은 항상 사용자 승인(HMAC 서명), "이 코스로 갈게요"는 자동 승인
          → 단계가 기다리는 카드가 없으면 하네스가 붙임 (await_progress 등)
          → data-trip(요약 바), 대화·meta 저장
```

도구는 세 종류입니다. **Ask**(`ask_quick_reply`, `await_progress`)는 `execute`가 없어 루프가 멈추고 카드가 뜹니다. **Read**(`plan_course`, `explain_plan`, `check_live_conditions`, `compare_transport`, `summarize_trip`, `show_safety_help`)는 여정을 바꾸지 않습니다. **Commit**(`update_trip_details`, `record_race_progress`, `apply_plan_change`, `start_journey`, `set_demo_observation`)만 이벤트를 남깁니다.

일정·완주 후 정보는 대화로 채웁니다([설계](docs/agent-ux.md#10-대화로-정보-받기)). 질문 순서·문구·답 버튼은 설정의 `conversation`(jsonb)에 있고, 다음 질문은 모델이 아니라 앱이 붙입니다. 답 버튼을 누르면 값이 함께 가서 모델 없이 저장되고, 자유롭게 쓴 문장은 모델이 `update_trip_details`로 읽어 저장합니다.

키가 없거나 모델 호출이 실패하면 같은 하네스에서 규칙 기반 `LanguageModelV4`(`scripted-model.ts`)가 응답합니다. 도구·승인·카드·저장이 모두 같고 모델만 바뀝니다(헤더 배지: AI / 규칙 모델 / 규칙 모델(대체)).

시연 조건은 채팅에 `/시연 혼잡만 82%로`처럼 보내거나 헤더 메뉴 → 시연 조건에서 고릅니다.

## 환경 변수와 키 보관

| 변수 | 용도 |
| --- | --- |
| `OPENAI_API_KEY` | 없으면 같은 하네스가 규칙 기반 모델로 동작 |
| `OPENAI_MODEL` | 기본은 설정의 `agent.model`(gpt-6-luna) |
| `EUM_SERVICE_KEY` | pohang-eum.kr → 마이페이지 → 나의 API의 인증키 |
| `EUM_AIR_DEVICE_ID` | INT_S01_004 대기 장비 id |
| `DATABASE_URL` | 있으면 PostgreSQL, 없으면 PGlite |
| `PGLITE_DIR` | 프로덕션에서 PGlite를 디스크에 보존(GCP: `/data/pglite`) |
| `AGENT_APPROVAL_SECRET` | 변경 승인 서명 키(선택, 없으면 `OPENAI_API_KEY`에서 유도) |

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
src/core/        순수 함수: schema · defaults(시드 설정) · planner · signals · trip(이벤트) · stage(대화 단계) · view · intents · preview · evidence · links · fp
src/server/      DB(drizzle·PGlite/pg·repo) · trips(여정 저장·commit) · config(시드⊕jsonb⊕env) · sources(E-UM)
src/server/agent harness(턴 루프) · tools(Ask/Read/Commit) · ingest(카드 답→이벤트) · prompts · scripted-model · model
src/routes/      / (채팅) · /classic (화면) · /api/chat · /api/trips/$tripId · /api/config · /api/evidence · /api/status
src/chat/        chat(useChat·헤더·입력) · cards(도구별 카드)
src/app/         classic 화면 · trip-client(여정 id·서버 호출·오프라인 캐시) · use-trip
src/components/  shadcn/ui · ai-elements (레지스트리 원본, 수정 없음)
tests/           planner(D01–D08) · trip · db(PGlite jsonb) · evidence · harness(대화 전체 e2e·도구 통제·대체 모델)
```
