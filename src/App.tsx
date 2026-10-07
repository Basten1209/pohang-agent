import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  TrainFront,
  Footprints,
  MapPin,
  Coffee,
  Utensils,
  Flag,
  Sparkles,
  Wind,
  BusFront,
  Heart,
  Bookmark,
  Settings2,
  RotateCcw,
  X,
  LoaderCircle,
  CheckCircle2,
  CircleHelp,
  CalendarDays,
  Navigation,
  Sun,
  Smile,
  Meh,
  Activity,
  Waves,
  SlidersHorizontal,
  Radio,
} from "lucide-react";
import { calculate } from "../shared/planner";
import {
  defaultPlan,
  defaultObservations,
  planSchema,
  observationsSchema,
  type Plan,
  type Observations,
  type Itinerary,
  type PlaceId,
  places,
  clock,
  minutes,
  duration,
  mapUrl,
} from "../shared/model";
import type { AgentResult } from "../server/agent";
import type { Evidence } from "../server/eum";
import { RouteMap } from "./RouteMap";

type Screen = "plan" | "day" | "finish" | "course" | "next";
type Saved = {
  version: 1;
  screen: Screen;
  plan: Plan;
  observations: Observations;
  phase: number;
  candidate: boolean;
  checks: boolean[];
  created: boolean;
  savedAt: number;
};
const KEY = "run2-guryongpo-v1";
const initial = (): Saved => {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "null");
    if (
      data?.version === 1 &&
      Date.now() - data.savedAt < 7 * 86400000 &&
      ["plan", "day", "finish", "course", "next"].includes(data.screen) &&
      planSchema.safeParse(data.plan).success &&
      observationsSchema.safeParse(data.observations).success &&
      Number.isInteger(data.phase) &&
      data.phase >= 0 &&
      data.phase <= 2 &&
      Array.isArray(data.checks) &&
      data.checks.length === 3 &&
      data.checks.every((v: unknown) => typeof v === "boolean")
    )
      return data;
  } catch {
    /* Unavailable/corrupt local storage does not prevent the demo. */
  }
  return {
    version: 1,
    screen: "plan",
    plan: { ...defaultPlan },
    observations: { ...defaultObservations },
    phase: 0,
    candidate: false,
    checks: [false, false, false],
    created: false,
    savedAt: Date.now(),
  };
};
const steps: { id: Screen; label: string; icon: typeof CalendarDays }[] = [
  { id: "plan", label: "내 하루 만들기", icon: CalendarDays },
  { id: "day", label: "내 하루", icon: Sun },
  { id: "finish", label: "완주 후 확인", icon: Flag },
  { id: "course", label: "구룡포 코스", icon: MapPin },
  { id: "next", label: "다음 행동", icon: Navigation },
];
const iconFor = (id: PlaceId, size = 18) =>
  id === "food" ? (
    <Utensils size={size} />
  ) : id === "street" ? (
    <Footprints size={size} />
  ) : (
    <Coffee size={size} />
  );
const imageFor = (id: PlaceId) =>
  id === "street" || id === "cafe"
    ? "/images/guryongpo-street.jpg"
    : "/images/guryongpo-harbor.jpg";

function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const el = ref.current;
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={close} aria-label="닫기">
          <X size={21} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
function App() {
  const [state, setState] = useState<Saved>(initial);
  const latest = useRef(state);
  latest.current = state;
  const [storageError, setStorageError] = useState(false);
  const [modal, setModal] = useState<
    "demo" | "evidence" | "taxi" | "train" | "why" | PlaceId | null
  >(null);
  const [trainDraft, setTrainDraft] = useState(state.plan.trainTime);
  const [notice, setNotice] = useState("");
  const [chat, setChat] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<AgentResult | null>(null);
  const [previewRevision, setPreviewRevision] = useState<number | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [apiStatus, setApiStatus] = useState<{ agent: string; eum: boolean }>({
    agent: "DEMO",
    eum: false,
  });
  const requestId = useRef(0);
  const { plan, observations, screen } = state;
  const itinerary = calculate(plan, observations);
  const canTravel = ["GO", "SHORTEN", "INDOOR"].includes(itinerary.decision);
  const currentStep = steps.findIndex((step) => step.id === screen);
  useEffect(() => {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ ...state, savedAt: Date.now() }),
      );
    } catch {
      setStorageError(true);
    }
  }, [state]);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setApiStatus)
      .catch(() => {});
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [screen]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === "d" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !(
          event.target instanceof HTMLElement &&
          (event.target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))
        )
      )
        setModal("demo");
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const mutate = (change: Partial<Saved>, patch: Partial<Plan> = {}) => {
    setState((old) => ({
      ...old,
      ...change,
      plan: { ...old.plan, ...patch, revision: old.plan.revision + 1 },
    }));
    setReply(null);
    setPreviewRevision(null);
  };
  const navigate = (target: Screen) => {
    if (target !== "plan" && !state.created)
      return setNotice("먼저 내 하루를 만들어 주세요.");
    if (
      (target === "course" || target === "next") &&
      plan.condition === "UNANSWERED"
    )
      return mutate({ screen: "finish" });
    if (target === "next" && plan.stage === "BEFORE")
      return setNotice("구룡포 코스를 먼저 선택해 주세요.");
    mutate({ screen: target });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const replan = (
    patch: Partial<Plan>,
    message = "조건에 맞춰 코스를 다시 계산했어요.",
  ) => {
    mutate({}, patch);
    setNotice(message);
  };
  const openTrain = () => {
    setTrainDraft(plan.trainTime);
    setModal("train");
  };
  const fetchLive = async () => {
    setEvidenceBusy(true);
    try {
      const response = await fetch("/api/evidence");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setEvidence(data.evidence);
    } catch {
      setNotice("연결 상태를 불러오지 못했어요. 다시 시도해 주세요.");
    } finally {
      setEvidenceBusy(false);
    }
  };
  const ask = async (message: string) => {
    if (!message.trim() || busy) return;
    const source = latest.current;
    const id = ++requestId.current;
    setBusy(true);
    setChat("");
    setReply(null);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          plan: source.plan,
          observations: source.observations,
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) throw new Error();
      const data: AgentResult = await response.json();
      if (
        id !== requestId.current ||
        latest.current.plan.revision !== source.plan.revision
      ) {
        setNotice("조건이 바뀌어 이전 응답을 적용하지 않았어요.");
        return;
      }
      if (data.medical) {
        mutate({ screen: "finish" }, { condition: "UNWELL" });
        return;
      }
      setReply(data);
      setPreviewRevision(source.plan.revision);
      if (data.compare) setModal("taxi");
    } catch {
      if (latest.current.plan.revision === source.plan.revision)
        setReply({
          mode: "FALLBACK",
          message:
            "응답을 받지 못했어요. 아래 조건 변경 버튼으로 계속할 수 있어요.",
          trace: [],
        });
    } finally {
      setBusy(false);
    }
  };
  const applyPreview = () => {
    if (!reply?.changes || plan.revision !== previewRevision)
      return setNotice("조건이 바뀌었어요. 다시 요청해 주세요.");
    replan(reply.changes, "요청한 변경을 일정에 반영했어요.");
  };
  const accept = () => {
    if (!canTravel) return;
    mutate(
      { screen: "next" },
      { stage: plan.stage === "BEFORE" ? "OUTBOUND" : plan.stage },
    );
    window.scrollTo(0, 0);
  };
  const advance = () => {
    if (plan.stage === "OUTBOUND")
      mutate(
        {},
        {
          stage: "LOCAL",
          currentPlace: "GURYONGPO",
          currentTime: clock(itinerary.start + 90),
          restMin: 0,
        },
      );
    else if (plan.stage === "LOCAL" && itinerary.stops.length) {
      const stop = itinerary.stops[0];
      mutate(
        {},
        {
          completed: [...new Set([...plan.completed, stop.id])],
          currentTime: clock(stop.end),
          restMin: 0,
        },
      );
    } else if (plan.stage === "RETURN")
      mutate(
        {},
        {
          stage: "DONE",
          currentPlace: "STATION",
          currentTime: clock(itinerary.stationEta || minutes(plan.currentTime)),
          restMin: 0,
        },
      );
  };
  const startReturn = () => {
    if (plan.currentPlace !== "GURYONGPO") {
      window.open(mapUrl("STATION"), "_blank", "noopener,noreferrer");
      return;
    }
    mutate({ screen: "next" }, { stage: "RETURN", restMin: 0 });
  };
  const demoScenario = (id: string) => {
    const base = { ...defaultPlan, condition: "TIRED" as const };
    if (id === "base")
      mutate(
        {
          created: true,
          screen: "course",
          observations: { ...defaultObservations },
        },
        base,
      );
    if (id === "early")
      mutate(
        {
          created: true,
          screen: "course",
          observations: { ...defaultObservations },
        },
        { ...base, trainTime: "16:00" },
      );
    if (id === "traffic")
      mutate({
        observations: { ...observations, congestion: 82, freshness: "FRESH" },
      });
    if (id === "air")
      mutate({
        observations: { ...observations, pm25: 60, freshness: "FRESH" },
      });
    if (id === "stale")
      mutate({ observations: { ...observations, freshness: "STALE" } });
    if (id === "missing")
      mutate({ observations: { ...observations, routeAvailable: false } });
    if (id === "cancel")
      mutate(
        {
          created: true,
          screen: "course",
          observations: { ...defaultObservations, congestion: 82 },
        },
        { ...base, trainTime: "16:00", readyTime: "10:50" },
      );
    if (id === "reset") {
      setState({
        ...initialEmpty(),
        plan: { ...defaultPlan, revision: plan.revision + 1 },
      });
      setReply(null);
    }
    setModal(null);
    setNotice("시연 조건을 적용했어요.");
  };
  function initialEmpty(): Saved {
    return {
      version: 1,
      screen: "plan",
      plan: { ...defaultPlan },
      observations: { ...defaultObservations },
      phase: 0,
      candidate: false,
      checks: [false, false, false],
      created: false,
      savedAt: Date.now(),
    };
  }

  const TicketCard = () => (
    <section className="ticket-card">
      <div className="eyebrow">
        <TrainFront size={16} /> 돌아오는 길도, 여유 있게
      </div>
      <div className="ticket-route">
        <strong>포항</strong>
        <span>
          ──────── <ArrowRight size={16} />
        </span>
        <strong>서울</strong>
      </div>
      <div className="train-row">
        <span>포항역 출발</span>
        <button onClick={openTrain} className="time-edit">
          {plan.trainTime}
          <Settings2 size={15} />
        </button>
      </div>
      <div className="ticket-perforation" />
      <div className="ticket-grid">
        <div>
          <span>역 도착 목표</span>
          <strong>{clock(itinerary.stationTarget)}</strong>
        </div>
        <div>
          <span>계획상 역 도착</span>
          <strong className="teal">
            {itinerary.planningArrival !== null
              ? clock(itinerary.planningArrival)
              : "확인 필요"}
          </strong>
        </div>
      </div>
      {itinerary.slack !== null && (
        <div className={`slack ${itinerary.slack < 0 ? "warning" : ""}`}>
          <CheckCircle2 size={15} />
          {itinerary.slack >= 0
            ? `역 도착 목표까지 ${duration(itinerary.slack)} 여유`
            : `역 도착 목표보다 ${Math.abs(itinerary.slack)}분 늦어요`}
        </div>
      )}
      <p className="fine">
        열차 출발 30분 전 도착을 목표로 계산해요.
        <br />
        열차 예약은 변경되지 않아요.
      </p>
    </section>
  );
  const AgentCard = () => (
    <section className="agent-card">
      <div className="agent-title">
        <span className="spark-icon">
          <Sparkles size={18} />
        </span>
        <div>
          <strong>여행도, 내 페이스대로</strong>
          <span>
            {apiStatus.agent === "DEMO"
              ? "시연 도우미 · 정해진 요청 지원"
              : "OpenAI 여행 도우미"}
          </span>
        </div>
      </div>
      <p>
        기차 시간이 바뀌었나요?
        <br />
        지금 계획에서 바로 조정해 드릴게요.
      </p>
      <div className="prompt-chips">
        <button disabled={busy} onClick={() => ask("16시 기차로 바꿨어")}>
          16시 기차로 바꿨어
        </button>
        <button disabled={busy} onClick={() => ask("왜 이 코스야?")}>
          왜 이 코스야?
        </button>
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          ask(chat);
        }}
      >
        <input
          aria-label="여행 도우미에게 요청"
          value={chat}
          onChange={(e) => setChat(e.target.value)}
          maxLength={1000}
          placeholder="이 여행에 대해 물어보세요"
          disabled={busy}
        />
        <button
          className="send-button"
          aria-label="요청 보내기"
          disabled={busy || !chat.trim()}
        >
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <ArrowRight size={18} />
          )}
        </button>
      </form>
      {busy && (
        <p className="agent-reply" role="status">
          현재 조건을 확인하고 있어요…
        </p>
      )}
      {reply && (
        <div className="agent-reply" role="status">
          <span className="reply-label">
            {reply.mode === "OPENAI"
              ? "OpenAI · 도구 실행 완료"
              : reply.mode === "DEMO"
                ? "시연 응답"
                : "AI 연결 실패 · 정형 응답"}
          </span>
          <p>{reply.message}</p>
          {reply.changes && (
            <>
              <div className="preview-label">변경 미리보기 · 아직 적용 전</div>
              <button className="button primary small" onClick={applyPreview}>
                이 변경 적용하기 <Check size={15} />
              </button>
            </>
          )}
          <details>
            <summary>처리 근거</summary>
            {reply.trace.length ? (
              reply.trace.map((t, i) => (
                <p key={i}>
                  <code>{t.tool}</code>
                  <br />
                  {t.result}
                </p>
              ))
            ) : (
              <p>외부 도구를 실행하지 않았어요.</p>
            )}
          </details>
        </div>
      )}
    </section>
  );
  const DataStrip = () => (
    <section className="data-strip">
      <div className="data-intro">
        <Radio size={19} />
        <div>
          <strong>구룡포의 지금을 반영해요</strong>
          <span>디지털 트윈 · 시연용 관측</span>
        </div>
      </div>
      <div className="data-value">
        <BusFront size={18} />
        <span>
          통합 혼잡
          <strong>
            {observations.freshness === "FRESH"
              ? `${observations.congestion ?? "—"}%`
              : "확인 불가"}
          </strong>
        </span>
      </div>
      <div className="data-value">
        <Wind size={18} />
        <span>
          초미세먼지
          <strong>
            {observations.freshness === "FRESH"
              ? `${observations.pm25 ?? "—"}`
              : "확인 불가"}
            <small>{observations.freshness === "FRESH" && " μg/m³"}</small>
          </strong>
        </span>
      </div>
      <button
        onClick={() => {
          setModal("evidence");
          fetchLive();
        }}
        className="icon-button"
        aria-label="데이터 근거와 실제 연결 확인"
      >
        <ArrowUpRight size={19} />
      </button>
    </section>
  );
  const ItineraryList = () => (
    <section className="schedule">
      <div className="section-title">
        <h2>오늘은 이렇게, 천천히</h2>
        <span>{itinerary.stops.length}곳 · 구룡포 중심부</span>
      </div>
      {itinerary.outbound > 0 && (
        <div className="transit-row">
          <span className="timeline-dot">
            <BusFront size={16} />
          </span>
          <div>
            <strong>{clock(itinerary.start)} 영일대에서 출발</strong>
            <span>버스로 구룡포까지 · 도보·대기 포함 90분 (시연)</span>
          </div>
          <button className="text-button" onClick={() => setModal("taxi")}>
            이동 정보 <ChevronRight size={14} />
          </button>
        </div>
      )}
      {itinerary.stops.map((stop, index) => (
        <button
          className="stop-card"
          key={stop.id}
          onClick={() => setModal(stop.id)}
        >
          <span className="stop-index">0{index + 1}</span>
          <img src={imageFor(stop.id)} alt="" />
          <span className="stop-info">
            <span className="stop-time">
              {clock(stop.start)} — {clock(stop.end)}{" "}
              <span>· {stop.dwell}분</span>
            </span>
            <strong>{places[stop.id].short}</strong>
            <span>{places[stop.id].subtitle}</span>
          </span>
          <span className={`place-icon ${stop.id}`}>{iconFor(stop.id)}</span>
          <ChevronRight className="stop-chevron" size={17} />
        </button>
      ))}
      {itinerary.excluded.length > 0 && (
        <div className="excluded-list">
          {itinerary.excluded.map((x) => (
            <span key={x.id}>
              <X size={13} />
              <s>{places[x.id].short}</s>
              <small>{x.reason}</small>
            </span>
          ))}
        </div>
      )}
      {itinerary.returnDeparture !== null && (
        <div className="transit-row return-row">
          <span className="timeline-dot">
            <TrainFront size={16} />
          </span>
          <div>
            <strong>
              {clock(itinerary.returnDeparture)} 구룡포에서 포항역으로
            </strong>
            <span>
              버스 120분 · 비용 확인 필요
              {itinerary.trafficReserve > 0 &&
                ` · 교통 여유 +${itinerary.trafficReserve}분`}
            </span>
          </div>
          <button className="text-button" onClick={() => setModal("taxi")}>
            택시 비교 <ChevronRight size={14} />
          </button>
        </div>
      )}
    </section>
  );

  return (
    <div className={`app-shell ${screen === "course" ? "course-screen" : ""}`}>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate(state.created ? "day" : "plan");
          }}
        >
          <span className="brand-symbol">
            R<span>↗</span>
          </span>
          <span>
            RUN2<small>구룡포</small>
          </span>
        </a>
        <div className="sidebar-caption">RUN A LITTLE. TRAVEL A LITTLE.</div>
        <div className="nav-label">나의 런트립</div>
        <nav aria-label="주요 화면">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => navigate(step.id)}
              className={`nav-item ${screen === step.id ? "active" : ""}`}
              aria-current={screen === step.id ? "page" : undefined}
            >
              <step.icon size={19} />
              <span>{step.label}</span>
              <span className="nav-index">0{index + 1}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="small-wave">
            <Waves size={25} />
          </span>
          <p>
            기록 너머,
            <br />
            기억에 남을 하루.
          </p>
          <span>완주 다음의 여행을 함께해요.</span>
          <div className="tiny-route">
            <i />
            <span />
            <i />
            <span />
            <i />
          </div>
        </div>
        <div className="sidebar-bottom">
          <button className="demo-launch" onClick={() => setModal("demo")}>
            <SlidersHorizontal size={17} />
            <span>데모 컨트롤</span>
            <span className="keycap">D</span>
          </button>
          <div className="profile">
            <span className="avatar">민</span>
            <div>
              <strong>김민준 님</strong>
              <small>서울에서 온 10km 러너</small>
            </div>
            <span className="profile-dot" />
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            나의 런트립 <ChevronRight size={14} />
            <strong>{steps[currentStep].label}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-badge">
              <span /> INTERACTIVE DEMO
            </span>
            <button
              className="icon-button mobile-demo"
              onClick={() => setModal("demo")}
              aria-label="데모 컨트롤"
            >
              <SlidersHorizontal size={19} />
            </button>
            <button
              className="help-button"
              onClick={() => setModal("evidence")}
              aria-label="데모 안내"
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </header>
        <main>
          <div className="journey-steps">
            {steps.map((step, index) => (
              <button
                onClick={() => navigate(step.id)}
                className={
                  index === currentStep
                    ? "current"
                    : index < currentStep
                      ? "past"
                      : ""
                }
                key={step.id}
              >
                <span>
                  {index < currentStep ? <Check size={12} /> : index + 1}
                </span>
                {step.label}
                {index < 4 && <ChevronRight size={12} />}
              </button>
            ))}
          </div>

          {screen === "plan" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR RUN, YOUR LITTLE TRIP</div>
                  <h1>
                    완주 다음엔,
                    <br />
                    구룡포 어때요<span className="orange">?</span>
                  </h1>
                  <p>
                    잘 달린 하루에 작은 여행을 더해요.
                    <br />
                    돌아갈 기차 시간까지, 우리가 함께 계산할게요.
                  </p>
                </div>
                <span className="round-stamp">
                  10K RUN
                  <br />
                  <span>＋</span>
                  <br />
                  LOCAL TRIP
                </span>
              </div>
              <div className="start-grid">
                <div className="intro-photo">
                  <img
                    src="/images/guryongpo-harbor.jpg"
                    alt="바다와 어선이 있는 구룡포항 전경"
                  />
                  <span className="photo-location">
                    <MapPin size={14} /> POHANG, GURYONGPO
                  </span>
                  <div className="intro-copy">
                    <span>달리기만 하고 돌아가기엔 아쉬우니까.</span>
                    <h2>
                      항구 앞 한 끼,
                      <br />
                      골목에서 만나는 포항.
                    </h2>
                    <div className="photo-tags">
                      <span>
                        <Utensils size={14} /> 로컬 점심
                      </span>
                      <span>
                        <Footprints size={14} /> 짧은 골목 구경
                      </span>
                      <span>
                        <Coffee size={14} /> 느긋한 휴식
                      </span>
                    </div>
                  </div>
                </div>
                <form
                  className="plan-form card"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    if (
                      Date.parse(plan.arrivalAt + ":00+09:00") >=
                      Date.parse("2026-10-13T09:00:00+09:00")
                    )
                      return setNotice(
                        "포항 도착은 대회 출발 전으로 입력해 주세요.",
                      );
                    mutate(
                      { created: true, screen: "day" },
                      {
                        excluded: (
                          ["food", "street", "cafe"] as PlaceId[]
                        ).filter(
                          (id) =>
                            !plan.interests.includes(
                              id.toUpperCase() as "FOOD" | "STREET" | "CAFE",
                            ),
                        ),
                      },
                    );
                  }}
                >
                  <div className="form-heading">
                    <span className="eyebrow">LET’S MAKE A DAY</span>
                    <h2>민준님의 하루를 준비해요</h2>
                    <p>예약한 열차 시각만 알려주세요.</p>
                  </div>
                  <div className="race-chip">
                    <Flag size={20} />
                    <div>
                      <strong>포항 해안 러닝 · 10km</strong>
                      <span>10월 13일 09:00 · 영일대 인근 · 가상 행사</span>
                    </div>
                  </div>
                  <label>
                    포항에 도착하는 시간
                    <input
                      type="datetime-local"
                      required
                      value={plan.arrivalAt}
                      max="2026-10-13T08:59"
                      onChange={(e) =>
                        mutate({}, { arrivalAt: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    서울행 열차 출발{" "}
                    <span className="label-note">
                      10월 13일 · 출발역: 포항역
                    </span>
                    <input
                      type="time"
                      required
                      value={plan.trainTime}
                      onChange={(e) =>
                        mutate({}, { trainTime: e.target.value })
                      }
                    />
                  </label>
                  <fieldset>
                    <legend>완주 후, 하고 싶은 일</legend>
                    <div className="interest-options">
                      {(["FOOD", "STREET", "CAFE"] as const).map(
                        (interest, i) => (
                          <button
                            type="button"
                            aria-pressed={plan.interests.includes(interest)}
                            className={
                              plan.interests.includes(interest)
                                ? "selected"
                                : ""
                            }
                            key={interest}
                            onClick={() =>
                              mutate(
                                {},
                                {
                                  interests: plan.interests.includes(interest)
                                    ? plan.interests.filter(
                                        (x) => x !== interest,
                                      )
                                    : [...plan.interests, interest],
                                },
                              )
                            }
                          >
                            {iconFor(
                              (["food", "street", "cafe"] as const)[i],
                              15,
                            )}
                            {["맛있는 점심", "짧은 구경", "카페 휴식"][i]}
                          </button>
                        ),
                      )}
                    </div>
                  </fieldset>
                  <details className="optional-details">
                    <summary>
                      숙소·짐 회수 계획 <span>선택사항</span>
                    </summary>
                    <label>
                      관광 출발 장소
                      <select
                        value={plan.origin}
                        onChange={(e) =>
                          mutate(
                            {},
                            {
                              origin: e.target.value as Plan["origin"],
                              currentPlace: e.target.value as Plan["origin"],
                            },
                          )
                        }
                      >
                        <option value="RACE">
                          영일대 대회장 · 짐을 가지고 이동
                        </option>
                        <option value="HOTEL">
                          영일대 인근 숙소 · 짐 회수 후 출발
                        </option>
                      </select>
                    </label>
                    <p className="fine">
                      숙소는 영일대 권역으로 가정해요. 실제 숙소 주소·행사
                      집결지는 확인이 필요해요.
                    </p>
                  </details>
                  <button className="button primary wide" type="submit">
                    내 하루 만들기 <ArrowRight size={18} />
                  </button>
                  <p className="form-foot">
                    <BusFront size={14} /> 현지 이동은 버스를 기본으로 준비해요.
                  </p>
                </form>
              </div>
            </>
          )}

          {screen === "day" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">A GOOD DAY TO RUN & WANDER</div>
                  <h1>
                    민준님, 포항에서의
                    <br />
                    하루가 기다려요<span className="orange">.</span>
                  </h1>
                  <p>달리기부터 여행까지, 한 번에 한 걸음씩.</p>
                </div>
                <span className="date-pill">
                  <CalendarDays size={16} /> 2026. 10. 12 — 13
                </span>
              </div>
              <div className="content-grid">
                <div>
                  <section className="now-card">
                    <span className="eyebrow">지금 할 일</span>
                    <h2>
                      {
                        [
                          "포항에 도착하면 알려주세요",
                          "가볍게 준비하고, 출발해 볼까요?",
                          "지금은 달리기에 집중해요",
                        ][state.phase]
                      }
                    </h2>
                    <p>
                      {
                        [
                          "내일의 달리기를 위해 오늘은 영일대 근처에서 쉬어가요.",
                          "09:00 출발 · 영일대 인근 집결지 (가상 행사)",
                          "도착하면 다시 만나요. 오늘의 작은 여행이 기다리고 있어요.",
                        ][state.phase]
                      }
                    </p>
                    {state.phase === 0 ? (
                      <button
                        className="button lime"
                        onClick={() => mutate({ phase: 1 })}
                      >
                        포항에 도착했어요 <Check size={17} />
                      </button>
                    ) : state.phase === 1 ? (
                      <>
                        <div className="checklist">
                          {[
                            "배번호와 러닝화",
                            "마실 물과 작은 간식",
                            "완주 후 짐 회수 계획",
                          ].map((text, i) => (
                            <label key={text}>
                              <input
                                type="checkbox"
                                checked={state.checks[i]}
                                onChange={() =>
                                  mutate({
                                    checks: state.checks.map((c, j) =>
                                      i === j ? !c : c,
                                    ),
                                  })
                                }
                              />
                              {text}
                            </label>
                          ))}
                        </div>
                        <div className="button-row">
                          <button
                            className="button lime"
                            onClick={() => mutate({ phase: 2 })}
                          >
                            출발해요 <ArrowRight size={17} />
                          </button>
                          <a
                            className="light-link"
                            href={mapUrl("RACE")}
                            target="_blank"
                            rel="noreferrer"
                          >
                            집결지 권역 보기 <ArrowUpRight size={15} />
                          </a>
                        </div>
                      </>
                    ) : (
                      <button
                        className="button lime"
                        onClick={() => mutate({ screen: "finish" })}
                      >
                        완주했어요! <Flag size={18} />
                      </button>
                    )}
                  </section>
                  <section className="day-timeline card">
                    <div className="section-title">
                      <h2>나의 하루</h2>
                      <span>버스와 기차로 잇는 여행</span>
                    </div>
                    {[
                      [
                        "전날 " + plan.arrivalAt.slice(11),
                        "포항역 도착",
                        "영일대 근처 숙소에서 하룻밤",
                        TrainFront,
                      ],
                      [
                        "09:00",
                        "영일대, 10km 달리기",
                        "내 페이스대로 끝까지",
                        Flag,
                      ],
                      [
                        "완주 후",
                        "구룡포에서 작은 여행",
                        "컨디션을 확인한 뒤 코스를 정해요",
                        MapPin,
                      ],
                      [
                        plan.trainTime,
                        "포항역에서 서울로",
                        "출발 30분 전 역 도착 목표",
                        TrainFront,
                      ],
                    ].map(([time, title, desc, Icon], i) => {
                      const I = Icon as typeof TrainFront;
                      return (
                        <div className="day-row" key={i}>
                          <span className="day-time">{time as string}</span>
                          <span className="day-icon">
                            <I size={17} />
                          </span>
                          <div>
                            <strong>{title as string}</strong>
                            <p>{desc as string}</p>
                          </div>
                        </div>
                      );
                    })}
                    <a
                      className="text-button"
                      href={mapUrl("HOTEL")}
                      target="_blank"
                      rel="noreferrer"
                    >
                      영일대 숙소 권역 보기 <ArrowUpRight size={14} />
                    </a>
                  </section>
                </div>
                <aside className="right-rail">
                  <section className="candidate-card">
                    <div className="candidate-image">
                      <img
                        src="/images/guryongpo-street.jpg"
                        alt="구룡포 일본인 가옥거리"
                      />
                      <span>AFTER THE FINISH LINE</span>
                    </div>
                    <div>
                      <div className="eyebrow">완주 후 여행 후보</div>
                      <h2>
                        기념 메달 옆에,
                        <br />
                        구룡포의 추억 하나.
                      </h2>
                      <p>
                        점심 한 끼, 짧은 골목 구경, 그리고 커피.
                        <br />
                        완주 후 몸 상태에 맞춰 다시 살펴봐요.
                      </p>
                      <button
                        className={`button wide ${state.candidate ? "soft" : "primary"}`}
                        onClick={() => {
                          mutate({ candidate: !state.candidate });
                          setNotice(
                            state.candidate
                              ? "후보에서 뺐어요."
                              : "완주 후 다시 확인할 코스로 담았어요.",
                          );
                        }}
                      >
                        {state.candidate ? (
                          <Check size={17} />
                        ) : (
                          <Bookmark size={17} />
                        )}{" "}
                        {state.candidate
                          ? "완주 후 후보로 담았어요"
                          : "완주 후 후보로 담기"}
                      </button>
                    </div>
                  </section>
                  <div className="small-info">
                    <Heart size={18} />
                    <p>
                      지금 방문을 결정하지 않아도 괜찮아요.
                      <br />
                      완주 후의 컨디션이 먼저니까요.
                    </p>
                  </div>
                  <button
                    className="text-button skip-demo"
                    onClick={() => mutate({ screen: "finish" })}
                  >
                    시연: 완주 직후로 이동 <ArrowRight size={15} />
                  </button>
                </aside>
              </div>
            </>
          )}

          {screen === "finish" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOU DID IT, FINISHER!</div>
                  <h1>
                    10km, 잘 달렸어요<span className="orange">!</span>
                  </h1>
                  <p>
                    다음 여행은 지금의 컨디션에 맞출게요.
                    <br />
                    잠깐 숨을 고르고, 세 가지만 알려주세요.
                  </p>
                </div>
                <span className="finish-medal">
                  <Flag size={34} />
                  <b>10K</b>
                  <small>FINISHER</small>
                </span>
              </div>
              <div className="content-grid">
                <section className="finish-form card">
                  <fieldset>
                    <legend>
                      <span className="question-num">01</span>지금 상태는
                      어떤가요?
                    </legend>
                    <div className="condition-options">
                      {(
                        [
                          ["OK", "괜찮아요", Smile],
                          ["TIRED", "조금 지쳤어요", Meh],
                          ["UNWELL", "몸이 안 좋아요", Activity],
                        ] as const
                      ).map(([value, label, Icon]) => (
                        <button
                          key={value}
                          className={plan.condition === value ? "selected" : ""}
                          aria-pressed={plan.condition === value}
                          onClick={() => mutate({}, { condition: value })}
                        >
                          <Icon size={26} />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  {plan.condition === "UNWELL" ? (
                    <div className="medical-alert" role="alert">
                      <Activity size={25} />
                      <h2>지금은 몸을 먼저 살펴주세요.</h2>
                      <p>
                        관광 계획을 잠시 멈췄어요. 현장 의료부스나 운영요원에게
                        도움을 요청해 주세요.
                      </p>
                      <a className="button primary" href="tel:119">
                        긴급한 도움이 필요하면 119
                      </a>
                    </div>
                  ) : (
                    <>
                      <fieldset>
                        <legend>
                          <span className="question-num">02</span>얼마나 걷고
                          싶나요?
                        </legend>
                        <div className="walking-options">
                          {([15, 30] as const).map((value) => (
                            <button
                              className={
                                plan.walkingLimit === value ? "selected" : ""
                              }
                              onClick={() =>
                                mutate({}, { walkingLimit: value })
                              }
                              aria-pressed={plan.walkingLimit === value}
                              key={value}
                            >
                              <Footprints size={18} />
                              {value}분 이내
                              <span>
                                {value === 15
                                  ? "걷기는 최소한으로"
                                  : "짧은 구경은 좋아요"}
                              </span>
                              {plan.walkingLimit === value && (
                                <Check size={16} />
                              )}
                            </button>
                          ))}
                        </div>
                        <p className="fine">
                          정류장과 장소 사이를 걷는 시간도 포함해요.
                        </p>
                      </fieldset>
                      <fieldset>
                        <legend>
                          <span className="question-num">03</span>언제 출발할 수
                          있나요?
                        </legend>
                        <div className="ready-row">
                          <label>
                            출발 준비 완료 시각
                            <input
                              type="time"
                              required
                              value={plan.readyTime}
                              onChange={(e) =>
                                mutate(
                                  {},
                                  {
                                    readyTime: e.target.value,
                                    currentTime: e.target.value,
                                  },
                                )
                              }
                            />
                          </label>
                          <button
                            className="button soft"
                            onClick={() =>
                              mutate(
                                {},
                                {
                                  readyTime: clock(
                                    minutes(plan.readyTime) + 30,
                                  ),
                                  currentTime: clock(
                                    minutes(plan.readyTime) + 30,
                                  ),
                                },
                              )
                            }
                          >
                            30분 더 준비할게요
                          </button>
                        </div>
                        <label className="baggage-check">
                          <input
                            type="checkbox"
                            checked={plan.baggageCollected}
                            onChange={(e) =>
                              mutate({}, { baggageCollected: e.target.checked })
                            }
                          />
                          출발 전에 짐을 모두 챙길 수 있어요
                        </label>
                        <p className="fine">
                          {plan.origin === "HOTEL"
                            ? "숙소에서 짐을 찾고 영일대 권역에서 출발하는 시각이에요."
                            : "휴식과 짐 회수를 모두 마친 뒤의 시각이에요."}
                        </p>
                      </fieldset>
                      <button
                        className="button primary wide"
                        disabled={
                          plan.condition === "UNANSWERED" ||
                          !plan.baggageCollected ||
                          !plan.readyTime
                        }
                        onClick={() => {
                          mutate({ screen: "course" });
                          fetchLive();
                        }}
                      >
                        지금 가능한 코스 보기 <ArrowRight size={18} />
                      </button>
                    </>
                  )}
                </section>
                <aside className="right-rail">
                  {TicketCard()}
                  <div className="reassurance">
                    <Heart size={21} />
                    <h3>오늘은 충분히 달렸으니까.</h3>
                    <p>
                      많이 걷는 여행 대신,
                      <br />
                      앉아서 즐기는 시간을 넉넉히 둘게요.
                    </p>
                    <img
                      src="/images/guryongpo-street.jpg"
                      alt="잠깐 머물고 싶은 구룡포 골목"
                    />
                  </div>
                </aside>
              </div>
            </>
          )}

          {screen === "course" && (
            <>
              <div className="page-heading course-heading">
                <div>
                  <div className="eyebrow">THE FINISH LINE IS A NEW START</div>
                  <h1>
                    잘 달렸어요. 이제, 구룡포<span className="orange">.</span>
                  </h1>
                  <p>
                    맛있는 한 끼와 짧은 구경. 민준님의 페이스에 맞춘 여행이에요.
                  </p>
                </div>
                <span className="personalized">
                  <Sparkles size={15} /> 나에게 맞춘 코스
                </span>
              </div>
              <div className="content-grid">
                <div className="course-main">
                  {canTravel ? (
                    <>
                      <section className="course-hero">
                        <img
                          src="/images/guryongpo-harbor.jpg"
                          alt="구룡포항의 바다와 항구 마을"
                        />
                        <div className="hero-top">
                          <span>
                            <MapPin size={14} /> 구룡포, 포항
                          </span>
                          <button
                            onClick={() => {
                              mutate({ candidate: !state.candidate });
                              setNotice(
                                !state.candidate
                                  ? "코스를 후보로 저장했어요."
                                  : "저장한 후보를 해제했어요.",
                              );
                            }}
                            aria-label={
                              state.candidate
                                ? "후보 저장 해제"
                                : "코스 후보 저장"
                            }
                          >
                            <Bookmark
                              size={18}
                              fill={state.candidate ? "currentColor" : "none"}
                            />
                          </button>
                        </div>
                        <div className="course-hero-copy">
                          <span className="course-label">
                            {itinerary.decision === "GO"
                              ? "오늘의 추천 코스"
                              : itinerary.decision === "INDOOR"
                                ? "앉아서 즐기는 코스"
                                : "시간에 맞춘 짧은 코스"}
                          </span>
                          <h2>
                            {itinerary.stops.length === 1 ? (
                              <>
                                점심 한 끼에도,
                                <br />
                                구룡포는 남으니까.
                              </>
                            ) : (
                              <>
                                바다 마을에서 보내는
                                <br />
                                느긋한 완주 후 한때.
                              </>
                            )}
                          </h2>
                          <p>
                            {itinerary.stops
                              .map((stop) => places[stop.id].short)
                              .join("  →  ")}
                          </p>
                        </div>
                        <span className="photo-credit">
                          사진 · 한국관광공사
                        </span>
                      </section>
                      <section className="trip-stats">
                        <div>
                          <Footprints size={20} />
                          <span>
                            예상 걷기
                            <strong>
                              {itinerary.walking}
                              <small>분</small>
                            </strong>
                          </span>
                        </div>
                        <div>
                          <Coffee size={20} />
                          <span>
                            구룡포 체류
                            <strong>{duration(itinerary.localMin)}</strong>
                          </span>
                        </div>
                        <div>
                          <BusFront size={20} />
                          <span>
                            왕복 이동
                            <strong>
                              {duration(
                                itinerary.outbound + itinerary.returnMin,
                              )}
                            </strong>
                          </span>
                        </div>
                      </section>
                      <div
                        className={`reason-note ${itinerary.decision !== "GO" ? "changed" : ""}`}
                      >
                        <Sparkles size={18} />
                        <p>{itinerary.reasons.join(" ")}</p>
                        <button
                          aria-label="코스 추천 이유 자세히"
                          onClick={() => setModal("why")}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                      {ItineraryList()}
                      <RouteMap />
                    </>
                  ) : (
                    <section className="empty-plan card">
                      <span className="empty-icon">
                        {itinerary.decision === "MEDICAL_FIRST" ? (
                          <Heart size={32} />
                        ) : (
                          <Clock3 size={32} />
                        )}
                      </span>
                      <div className="eyebrow">TAKE IT AT YOUR OWN PACE</div>
                      <h2>
                        {itinerary.decision === "MEDICAL_FIRST"
                          ? "오늘은 몸이 먼저예요."
                          : itinerary.decision === "NEEDS_DATA"
                            ? "이동 경로 확인이 필요해요."
                            : itinerary.decision === "INCOMPLETE"
                              ? "출발 조건을 먼저 확인해요."
                              : "오늘은 귀가를 먼저 챙겨요."}
                      </h2>
                      <p>{itinerary.reasons.join(" ")}</p>
                      <div className="button-row">
                        <button
                          className="button primary"
                          onClick={() => navigate("finish")}
                        >
                          내 조건 다시 확인
                        </button>
                        <a
                          className="button soft"
                          href={mapUrl("STATION")}
                          target="_blank"
                          rel="noreferrer"
                        >
                          포항역 길찾기 <ArrowUpRight size={16} />
                        </a>
                      </div>
                    </section>
                  )}
                  {DataStrip()}
                  <p className="simulation-note">
                    시연 코스 · 이동시간과 관측값은 가정값이에요. 실제
                    버스편·상점 영업·보행 경로는 확인이 필요해요.
                  </p>
                </div>
                <aside className="right-rail">
                  {TicketCard()}
                  <section className="adjust-card">
                    <div className="section-title">
                      <h3>내 여행에 맞게 조정</h3>
                      <Settings2 size={17} />
                    </div>
                    <button
                      onClick={() =>
                        replan({
                          walkingLimit: plan.walkingLimit === 30 ? 15 : 30,
                        })
                      }
                    >
                      <Footprints size={17} />
                      <span>
                        {plan.walkingLimit === 30
                          ? "15분 이내로 덜 걷기"
                          : "30분까지 걷기"}
                      </span>
                      <ChevronRight size={15} />
                    </button>
                    <button
                      onClick={() =>
                        replan({
                          excluded: plan.excluded.includes("cafe")
                            ? plan.excluded.filter((x) => x !== "cafe")
                            : [...plan.excluded, "cafe"],
                        })
                      }
                    >
                      <Coffee size={17} />
                      <span>
                        {plan.excluded.includes("cafe")
                          ? "카페 다시 넣기"
                          : "카페 빼기"}
                      </span>
                      <ChevronRight size={15} />
                    </button>
                    <button onClick={openTrain}>
                      <TrainFront size={17} />
                      <span>귀가 시각 변경</span>
                      <ChevronRight size={15} />
                    </button>
                  </section>
                  {AgentCard()}
                  <button
                    className="button primary wide accept-button"
                    disabled={!canTravel}
                    onClick={accept}
                  >
                    이 코스로 갈게요 <ArrowRight size={18} />
                  </button>
                  <p className="form-foot">
                    마음이 바뀌면 언제든 조정할 수 있어요.
                  </p>
                </aside>
              </div>
            </>
          )}

          {screen === "next" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">ONE LITTLE STEP AT A TIME</div>
                  <h1>
                    {plan.stage === "DONE"
                      ? "달리고, 머물고, 기억한 하루."
                      : plan.stage === "RETURN"
                        ? "좋은 기억을 안고, 포항역으로."
                        : "다음 한 걸음만 생각해요."}
                  </h1>
                  <p>
                    {plan.stage === "DONE"
                      ? "민준님의 작은 구룡포 여행을 마쳤어요."
                      : "남은 일정과 돌아갈 시간은 계속 함께 살펴볼게요."}
                  </p>
                </div>
                <span className="date-pill">
                  <Clock3 size={16} /> 시연 시각 {plan.currentTime}
                </span>
              </div>
              <div className="content-grid">
                <div>
                  {plan.stage === "DONE" ? (
                    <section className="complete-card">
                      <span className="finish-medal">
                        <Check size={36} />
                        <b>FINISH</b>
                      </span>
                      <div className="eyebrow">A RUN TO REMEMBER</div>
                      <h2>
                        완주 너머의 추억도,
                        <br />잘 챙겼어요.
                      </h2>
                      <p>
                        직접 도착을 확인한 여행이에요.
                        <br />
                        오늘 다녀온 장소들을 오래 기억해 주세요.
                      </p>
                      <div className="visited-tags">
                        {plan.completed.map((id) => (
                          <span key={id}>
                            {iconFor(id, 15)} {places[id].short}
                          </span>
                        ))}
                      </div>
                      <div className="completion-train">
                        <TrainFront size={21} />
                        포항역 도착 {plan.currentTime} · 서울행 {plan.trainTime}
                      </div>
                      <button
                        className="button primary"
                        onClick={() => setModal("demo")}
                      >
                        다른 시나리오 둘러보기 <ArrowRight size={16} />
                      </button>
                    </section>
                  ) : (
                    <>
                      <section className="next-action">
                        <div className="next-top">
                          <span className="eyebrow">
                            {plan.stage === "OUTBOUND"
                              ? "구룡포로 이동 중"
                              : plan.stage === "RETURN"
                                ? "포항역으로 귀가 중"
                                : "구룡포에 머무는 중"}
                          </span>
                          <span className="live-dot" />
                        </div>
                        <span className="next-symbol">
                          {plan.stage === "OUTBOUND" ? (
                            <BusFront size={32} />
                          ) : plan.stage === "RETURN" ? (
                            <TrainFront size={32} />
                          ) : itinerary.stops[0] ? (
                            iconFor(itinerary.stops[0].id, 32)
                          ) : (
                            <CheckCircle2 size={32} />
                          )}
                        </span>
                        <h2>
                          {plan.stage === "OUTBOUND"
                            ? "첫 목적지, 구룡포시장"
                            : plan.stage === "RETURN"
                              ? "이제 포항역으로 가요"
                              : !canTravel || !itinerary.stops.length
                                ? "포항역으로 돌아갈 시간이에요"
                                : places[itinerary.stops[0].id].short}
                        </h2>
                        <p>
                          {plan.stage === "OUTBOUND"
                            ? "버스 경로와 승차 정류장은 외부 지도에서 확인해 주세요."
                            : plan.stage === "RETURN"
                              ? "열차 탑승 전까지 여유 있게 이동해요."
                              : itinerary.stops[0]
                                ? places[itinerary.stops[0].id].desc
                                : "남은 관광 대신 귀가 동선을 먼저 확인해요."}
                        </p>
                        {(plan.stage === "OUTBOUND" ||
                          plan.stage === "RETURN" ||
                          itinerary.stops.length > 0) && (
                          <>
                            <a
                              className="button lime wide"
                              href={mapUrl(
                                plan.stage === "OUTBOUND"
                                  ? "GURYONGPO"
                                  : plan.stage === "RETURN"
                                    ? "STATION"
                                    : itinerary.stops[0].id,
                                plan.stage === "LOCAL" ? "walk" : "traffic",
                              )}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {plan.stage === "LOCAL"
                                ? "다음 장소 길찾기"
                                : "대중교통 경로 열기"}
                              <ArrowUpRight size={17} />
                            </a>
                            <button
                              className="arrival-button"
                              onClick={advance}
                            >
                              {plan.stage === "OUTBOUND"
                                ? "구룡포에 도착했어요"
                                : plan.stage === "RETURN"
                                  ? "역에 도착했어요"
                                  : `${itinerary.stops[0]?.id === "food" ? "식사" : itinerary.stops[0]?.id === "cafe" ? "휴식" : "구경"} 마쳤어요`}
                              <Check size={17} />
                            </button>
                          </>
                        )}
                        <small>
                          시연 시각으로 직접 도착·완료를 확인해요. 위치를
                          추적하지 않아요.
                        </small>
                      </section>
                      {plan.stage === "LOCAL" && itinerary.stops.length > 0 && (
                        <div className="journey-actions">
                          <button
                            onClick={() =>
                              replan(
                                {
                                  excluded: [
                                    ...new Set([
                                      ...plan.excluded,
                                      itinerary.stops[0].id,
                                    ]),
                                  ],
                                },
                                "이 장소를 빼고 남은 일정을 다시 계산했어요.",
                              )
                            }
                          >
                            <ArrowRight size={16} />이 장소 건너뛰기
                          </button>
                          <button
                            onClick={() =>
                              replan({
                                restMin: Math.min(180, plan.restMin + 30),
                              })
                            }
                          >
                            <Coffee size={16} />
                            30분 더 쉬기
                          </button>
                        </div>
                      )}
                      {plan.stage !== "RETURN" && ItineraryList()}
                      <RouteMap />
                    </>
                  )}
                </div>
                <aside className="right-rail">
                  {TicketCard()}
                  {plan.stage !== "DONE" && (
                    <>
                      {AgentCard()}
                      <button
                        className="button outline wide"
                        onClick={startReturn}
                      >
                        <TrainFront size={18} /> 포항역으로 돌아가기
                      </button>
                    </>
                  )}
                  {DataStrip()}
                </aside>
              </div>
            </>
          )}

          <footer>
            <span className="footer-brand">RUN2구룡포</span>
            <span>완주 다음의 여행, 내 페이스대로.</span>
            <button onClick={() => setModal("evidence")}>
              시연 데이터 안내 <ArrowUpRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      {screen === "course" && canTravel && (
        <div className="mobile-course-bar">
          <div>
            <small>포항역 도착 · 시연</small>
            <strong>
              {clock(itinerary.planningArrival!)}
              <span> / {plan.trainTime} 열차</span>
            </strong>
          </div>
          <button className="button primary" onClick={accept}>
            코스 선택 <ArrowRight size={17} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}
      {storageError && (
        <div className="storage-warning" role="alert">
          브라우저 저장을 사용할 수 없어 새로고침하면 일정이 사라질 수 있어요.
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal === "demo"
              ? "데모 컨트롤"
              : modal === "evidence"
                ? "데이터와 연결 상태"
                : modal === "train"
                  ? "귀가 열차 시각 변경"
                  : modal === "taxi"
                    ? "포항역 복귀 · 이동수단 비교"
                    : modal === "why"
                      ? "이 코스를 제안한 이유"
                      : places[modal].short
          }
          close={() => setModal(null)}
        >
          {modal === "demo" && (
            <>
              <p className="modal-intro">
                민준님의 하루를 빠르게 시연해 보세요.
                <br />
                모든 시각·교통·대기값은 고정된 시연 데이터입니다.
              </p>
              <div className="scenario-grid">
                {[
                  [
                    "base",
                    "01",
                    "기본 코스",
                    "18:30 열차 · 점심 + 골목 + 카페",
                  ],
                  ["early", "02", "16:00 귀가", "카페 제외 · 골목 구경 단축"],
                  [
                    "traffic",
                    "03",
                    "혼잡만 82%로",
                    "현재 사용자 조건 유지 · 교통 여유 +20분",
                  ],
                  [
                    "air",
                    "04",
                    "대기만 60으로",
                    "현재 사용자 조건 유지 · 야외 구경 제외",
                  ],
                  [
                    "cancel",
                    "05",
                    "출발 준비 지연",
                    "10:50 출발 · 16:00 귀가 · 혼잡 82%",
                  ],
                  [
                    "missing",
                    "06",
                    "복귀 경로 누락",
                    "이동 가능 확정 없이 확인 안내",
                  ],
                  [
                    "stale",
                    "07",
                    "오래된 관측",
                    "신선하지 않은 관측을 판단에서 제외",
                  ],
                ].map(([id, num, title, desc]) => (
                  <button key={id} onClick={() => demoScenario(id)}>
                    <span>{num}</span>
                    <div>
                      <strong>{title}</strong>
                      <small>{desc}</small>
                    </div>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
              <button
                className="button soft wide"
                onClick={() => demoScenario("reset")}
              >
                <RotateCcw size={16} />내 하루 만들기부터 다시 시작
              </button>
            </>
          )}
          {modal === "train" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                replan({ trainTime: trainDraft });
                setModal(null);
              }}
            >
              <p className="modal-intro">
                10월 13일, 포항역에서 출발하는 시각이에요.
                <br />
                실제 열차 예약은 바뀌지 않아요.
              </p>
              <label>
                서울행 열차 출발
                <input
                  type="time"
                  required
                  value={trainDraft}
                  onChange={(e) => setTrainDraft(e.target.value)}
                />
              </label>
              <div className="time-presets">
                {["16:00", "17:00", "18:30"].map((time) => (
                  <button
                    type="button"
                    key={time}
                    className={trainDraft === time ? "selected" : ""}
                    onClick={() => setTrainDraft(time)}
                  >
                    {time}
                  </button>
                ))}
              </div>
              <button className="button primary wide" type="submit">
                이 시각에 맞춰 다시 계산 <ArrowRight size={16} />
              </button>
            </form>
          )}
          {modal === "taxi" && (
            <>
              <p className="modal-intro">
                구룡포 → 포항역 구간만 비교해요.
                <br />
                비교를 열어도 이동수단은 바뀌지 않아요.
              </p>
              <div className="transport-option chosen">
                <BusFront size={26} />
                <div>
                  <strong>
                    버스 <span className="tag">기본 선택</span>
                  </strong>
                  <p>120분 · 도보·대기·승차 포함 (시연)</p>
                  <small>요금 확인 필요 · 실제 운행편 확인 필요</small>
                </div>
                <CheckCircle2 size={20} />
              </div>
              <div className="transport-option">
                <Navigation size={25} />
                <div>
                  <strong>택시</strong>
                  <p>예상시간·요금 확인 필요</p>
                  <small>자동차 경로 API 미연결 · 배차 대기 별도</small>
                </div>
              </div>
              <button className="button soft wide" disabled>
                요금 확인 후 선택할 수 있어요
              </button>
              <a
                href={mapUrl("STATION")}
                className="button primary wide"
                target="_blank"
                rel="noreferrer"
              >
                카카오맵에서 경로 확인 <ArrowUpRight size={16} />
              </a>
            </>
          )}
          {modal === "why" && (
            <>
              <p className="modal-intro">
                입력한 조건과 결정 엔진의 계산 근거예요.
              </p>
              <div className="evidence-equation">
                <span>{plan.readyTime} 출발</span>
                <b>＋</b>
                <span>{itinerary.outbound}분 이동</span>
                <b>＋</b>
                <span>{itinerary.localMin}분 체류</span>
                <b>＋</b>
                <span>{itinerary.returnMin}분 복귀</span>
                <b>＋</b>
                <span>{itinerary.trafficReserve}분 여유</span>
                <b>＝</b>
                <strong>
                  {itinerary.planningArrival !== null
                    ? clock(itinerary.planningArrival)
                    : "계산 중단"}
                </strong>
              </div>
              <ul className="reason-list">
                {itinerary.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p className="fine">
                역 도착 예상{" "}
                {itinerary.stationEta !== null
                  ? clock(itinerary.stationEta)
                  : "—"}
                와 교통 여유를 반영한 계획상 도착을 구분해요. 관측 임계값은 시연
                정책이며 공인 기준이 아닙니다.
              </p>
            </>
          )}
          {modal === "evidence" && (
            <>
              <div className="evidence-banner">
                <Radio size={22} />
                <div>
                  <strong>시연과 실제 연결을 구분해요</strong>
                  <p>
                    코스 계산에는 고정 시연값만 사용합니다. 실응답은
                    단위·범위·관측 시각 검증을 위해 별도로 표시해요.
                  </p>
                </div>
              </div>
              <div className="evidence-details">
                <div>
                  <span>일정·이동 경로</span>
                  <b>SIMULATED</b>
                </div>
                <div>
                  <span>관측 평가 시각</span>
                  <b>2026.10.13 10:40 KST</b>
                </div>
                <div>
                  <span>시연 관측 시각</span>
                  <b>
                    {observations.freshness === "STALE"
                      ? "2026.10.12 10:00"
                      : "2026.10.13 10:30"}
                  </b>
                </div>
                <div>
                  <span>신선도</span>
                  <b>{observations.freshness}</b>
                </div>
                <div>
                  <span>혼잡 / 초미세먼지</span>
                  <b>
                    {observations.congestion}% / {observations.pm25} μg/m³
                  </b>
                </div>
                <div>
                  <span>OpenAI</span>
                  <b>
                    {apiStatus.agent === "DEMO"
                      ? "미설정 · 시연 응답 사용"
                      : "키 설정됨 · 호출 결과로 검증"}
                  </b>
                </div>
              </div>
              <button
                className="button primary wide"
                onClick={fetchLive}
                disabled={evidenceBusy}
              >
                {evidenceBusy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Radio size={16} />
                )}{" "}
                E-UM 실제 연결 확인
              </button>
              {evidence.map((item) => (
                <div className="evidence-item" key={item.source}>
                  <div>
                    <strong>{item.source}</strong>
                    <span className="tag">{item.status}</span>
                  </div>
                  <p>{item.message}</p>
                  <small>
                    조회{" "}
                    {new Date(item.fetchedAt).toLocaleString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}
                    <br />
                    관측 {item.observedAt || "확인 불가"} · {item.freshness}
                  </small>
                  {Object.keys(item.values).length > 0 && (
                    <pre>{JSON.stringify(item.values, null, 2)}</pre>
                  )}
                </div>
              ))}
              <details className="data-disclosure">
                <summary>시연 데이터·사진 출처와 보관</summary>
                <p>
                  현재 식당·카페는 상호 미정 후보입니다. 버스편, 운영시간,
                  경사·계단, 요금은 검증되지 않았어요. 택시 선택은 실데이터 연동
                  전까지 비활성화돼요.
                </p>
                <p>
                  일정은 이 브라우저에만 저장하며 7일 후 다음 접속 시
                  초기화해요. 채팅 원문은 저장하지 않고, 분석 이벤트는 수집하지
                  않아요.
                </p>
                <p>
                  사진:{" "}
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href="https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=945b0346-06ca-4783-a8f2-1cdc911ecd3f"
                  >
                    한국관광공사 구룡포항
                  </a>{" "}
                  ·{" "}
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href="https://badaon.or.kr/seantour_map/travel/destination/detail.do?destId=DEST000662"
                  >
                    바다온 일본인 가옥거리
                  </a>
                </p>
              </details>
            </>
          )}
          {(modal === "food" || modal === "street" || modal === "cafe") && (
            <>
              <img
                className="place-modal-image"
                src={imageFor(modal)}
                alt={
                  modal === "food" ? "구룡포항 전경" : "구룡포 일본인 가옥거리"
                }
              />
              <div className="eyebrow">{places[modal].category}</div>
              <h3 className="place-title">{places[modal].title}</h3>
              <p className="modal-intro">{places[modal].desc}</p>
              <p>{places[modal].detail}</p>
              <div className="place-facts">
                <span>
                  <Clock3 size={16} />
                  예상 체류{" "}
                  {itinerary.stops.find((s) => s.id === modal)?.dwell ||
                    (modal === "food" ? 60 : modal === "street" ? 20 : 40)}
                  분
                </span>
                <span>
                  <CircleHelp size={16} />
                  영업·접근 정보 확인 필요
                </span>
              </div>
              <a
                className="button primary wide"
                href={mapUrl(modal, "walk")}
                target="_blank"
                rel="noreferrer"
              >
                {modal === "street"
                  ? "가옥거리 위치 보기"
                  : "후보 권역 위치 보기"}
                <ArrowUpRight size={16} />
              </a>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
export default App;
