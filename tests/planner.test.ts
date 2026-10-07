import { describe, it, expect, vi, afterEach } from "vitest";
import { calculate } from "../shared/planner";
import {
  defaultPlan,
  defaultObservations,
  type Plan,
  clock,
  planSchema,
  mapUrl,
} from "../shared/model";
import { runAgent, demoIntent } from "../server/agent";
import { normalizeTime, fetchEvidence } from "../server/eum";
const plan: Plan = { ...defaultPlan, condition: "TIRED" };
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("명세 D01–D08", () => {
  it("D01: 18:30 열차, 16:20 도착, 100분 여유", () => {
    const r = calculate(plan, defaultObservations);
    expect(r.decision).toBe("GO");
    expect(clock(r.stationEta!)).toBe("16:20");
    expect(r.slack).toBe(100);
    expect(r.localMin).toBe(130);
    expect(r.stops).toHaveLength(3);
  });
  it("D02: 16시 열차이면 카페 제외, 구경 5분, 역 15:15", () => {
    const r = calculate({ ...plan, trainTime: "16:00" }, defaultObservations);
    expect(r.decision).toBe("SHORTEN");
    expect(clock(r.stationEta!)).toBe("15:15");
    expect(r.stops.map((x) => x.id)).toEqual(["food", "street"]);
    expect(r.slack).toBe(15);
    expect(r.walking).toBe(25);
  });
  it("D03: 혼잡만 82로 올리면 식사만 남고 교통 여유를 한 번 반영", () => {
    const r = calculate(
      { ...plan, trainTime: "16:00" },
      { ...defaultObservations, congestion: 82 },
    );
    expect(r.stops.map((x) => x.id)).toEqual(["food"]);
    expect(clock(r.stationEta!)).toBe("15:10");
    expect(clock(r.planningArrival!)).toBe("15:30");
    expect(r.slack).toBe(0);
  });
  it("D04: pm25 60이면 야외 20분 제외, 16:00 역 도착", () => {
    const r = calculate(plan, { ...defaultObservations, pm25: 60 });
    expect(r.decision).toBe("INDOOR");
    expect(clock(r.stationEta!)).toBe("16:00");
    expect(r.localMin).toBe(110);
  });
  it("D05: 준비 완료가 10분 늦어지면 최소 코스도 불가", () => {
    const r = calculate(
      { ...plan, trainTime: "16:00", readyTime: "10:50" },
      { ...defaultObservations, congestion: 82 },
    );
    expect(r.decision).toBe("CANCEL");
    expect(r.stationEta).toBeNull();
  });
  it("D06: 몸이 안 좋으면 관광과 외부 조회를 중단", async () => {
    const r = calculate({ ...plan, condition: "UNWELL" }, defaultObservations);
    expect(r.decision).toBe("MEDICAL_FIRST");
    expect(r.calculationStatus).toBe("NOT_RUN");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await runAgent(
      "16시 기차로 바꿨어",
      { ...plan, condition: "UNWELL" },
      defaultObservations,
    );
    expect(response.medical).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
  it("D07: 복귀 경로 누락 또는 시간대 이탈 시 임의 ETA 없음", () => {
    expect(
      calculate(plan, { ...defaultObservations, routeAvailable: false })
        .decision,
    ).toBe("NEEDS_DATA");
    expect(
      calculate({ ...plan, readyTime: "14:00" }, defaultObservations)
        .stationEta,
    ).toBeNull();
  });
  it("D08: 택시 비교는 계획을 바꾸지 않음", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const before = structuredClone(plan);
    const reply = await runAgent(
      "역까지 택시 타면?",
      plan,
      defaultObservations,
    );
    expect(reply.compare).toBe(true);
    expect(reply.changes).toBeUndefined();
    expect(plan).toEqual(before);
  });
});

describe("예외와 상태 변화", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  it("대기 제한보다 귀가 불가능이 우선", () =>
    expect(
      calculate(
        { ...plan, trainTime: "14:00" },
        { ...defaultObservations, pm25: 60 },
      ).decision,
    ).toBe("CANCEL"));
  it("STALE과 null을 정상 관측으로 취급하지 않음", () => {
    for (const o of [
      { ...defaultObservations, freshness: "STALE" as const },
      { ...defaultObservations, pm25: null, congestion: null },
    ]) {
      const r = calculate(plan, o);
      expect(r.calculationStatus).toBe("PARTIAL");
      expect(r.stops.some((x) => x.id === "street")).toBe(false);
      expect(r.trafficReserve).toBe(20);
    }
  });
  it("걷기 상한에 정류장 도보가 포함됨", () =>
    expect(
      calculate({ ...plan, walkingLimit: 15 }, defaultObservations).decision,
    ).toBe("CANCEL"));
  it("완료한 식사와 이미 지난 시간을 다시 더하지 않음", () => {
    const r = calculate(
      {
        ...plan,
        stage: "LOCAL",
        currentPlace: "GURYONGPO",
        currentTime: "13:15",
        completed: ["food"],
      },
      defaultObservations,
    );
    expect(r.outbound).toBe(0);
    expect(r.stops.some((x) => x.id === "food")).toBe(false);
    expect(r.stationEta).toBeLessThanOrEqual(980);
  });
  it("더 쉬면 남은 코스와 역 도착이 재계산됨", () => {
    const normal = calculate(plan, defaultObservations);
    const rest = calculate({ ...plan, restMin: 30 }, defaultObservations);
    expect(rest.stationEta! - normal.stationEta!).toBe(30);
  });
  it("설명 질문과 모호한 시각은 변경으로 해석하지 않음", () => {
    expect(demoIntent("왜 카페가 빠졌어?")).toBe("CONTEXT");
    expect(demoIntent("4시 기차로 바꿨어")).toBe("CLARIFY");
    expect(demoIntent("25시로 변경")).toBe("CLARIFY");
    expect(demoIntent("오후 4시 기차로 바꿨어")).toMatchObject({
      trainTime: "16:00",
    });
  });
  it("자연어 변경은 미리보기로만 반환", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const reply = await runAgent(
      "16시 기차로 바꿨어",
      plan,
      defaultObservations,
    );
    expect(reply.changes?.trainTime).toBe("16:00");
    expect(reply.itinerary?.stationEta).toBe(915);
    expect(plan.trainTime).toBe("18:30");
  });
  it("시각만 있는 관측에 오늘 날짜를 붙이지 않음", () => {
    expect(normalizeTime("10:00")).toBeNull();
    expect(normalizeTime("2026-10-13 10:00:00")).toBeNull();
    expect(normalizeTime("2026-10-13T10:00:00+09:00")).toBe(
      "2026-10-13T01:00:00.000Z",
    );
  });
  it("서비스 키가 없으면 호출 성공으로 보고하지 않음", async () => {
    vi.stubEnv("EUM_SERVICE_KEY", "");
    expect((await fetchEvidence("traffic")).status).toBe("NOT_CONFIGURED");
  });
  it("401과 빈 응답은 실데이터 성공과 구분", async () => {
    vi.stubEnv("EUM_SERVICE_KEY", "test-fixture");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    expect((await fetchEvidence("traffic")).status).toBe("ERROR");
    expect((await fetchEvidence("traffic")).status).toBe("ERROR");
  });
  it("입력 시각과 휴식 범위를 검증", () => {
    expect(planSchema.safeParse({ ...plan, trainTime: "26:00" }).success).toBe(
      false,
    );
    expect(planSchema.safeParse({ ...plan, restMin: -1 }).success).toBe(false);
  });
  it("역 복귀에도 정류장 접근을 한 번 포함", () => {
    const r = calculate(
      {
        ...plan,
        stage: "RETURN",
        currentPlace: "GURYONGPO",
        currentTime: "13:05",
        completed: ["food"],
        trainTime: "16:00",
      },
      { ...defaultObservations, congestion: 82 },
    );
    expect(clock(r.stationEta!)).toBe("15:10");
    expect(clock(r.planningArrival!)).toBe("15:30");
  });
  it("지도 링크에 이동수단과 양쪽 좌표를 구분해 전달", () => {
    const url = mapUrl("STATION");
    expect(url).toContain("/link/by/traffic/");
    expect(url).toContain(",35.9868,129.5528/");
    expect(url).toContain(",36.0714,129.3418");
  });
});
