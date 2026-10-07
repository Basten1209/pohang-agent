import {
  type Plan,
  type Observations,
  type Itinerary,
  type PlaceId,
  minutes,
} from "./model";

/** Fixed, explicitly simulated route snapshots. No actual bus timetable is implied. */
export function calculate(plan: Plan, observation: Observations): Itinerary {
  const start =
    Math.max(minutes(plan.readyTime), minutes(plan.currentTime)) + plan.restMin;
  const target = minutes(plan.trainTime) - 30;
  const base: Itinerary = {
    decision: "INCOMPLETE",
    calculationStatus: "NOT_RUN",
    executionMode: "DEMO",
    revision: plan.revision,
    start,
    stops: [],
    stationEta: null,
    planningArrival: null,
    stationTarget: target,
    slack: null,
    walking: 0,
    localMin: 0,
    outbound: plan.currentPlace === "GURYONGPO" ? 0 : 90,
    returnMin: 120,
    returnDeparture: null,
    trafficReserve: 0,
    reasons: [],
    excluded: [],
  };
  if (plan.condition === "UNWELL")
    return {
      ...base,
      decision: "MEDICAL_FIRST",
      reasons: [
        "관광 계획을 멈추고 현장 의료부스 또는 운영요원에게 도움을 요청해 주세요.",
      ],
    };
  if (plan.condition === "UNANSWERED" || !plan.baggageCollected)
    return {
      ...base,
      reasons: ["컨디션과 짐 회수 여부를 먼저 확인해 주세요."],
    };
  if (plan.currentPlace === "STATION")
    return {
      ...base,
      decision: "GO",
      calculationStatus: "READY",
      stationEta: minutes(plan.currentTime),
      planningArrival: minutes(plan.currentTime),
      slack: target - minutes(plan.currentTime),
      outbound: 0,
      returnMin: 0,
      reasons: ["포항역 도착을 직접 확인했어요."],
    };
  if (
    !observation.routeAvailable ||
    (base.outbound > 0 && (start < 600 || start > 720))
  ) {
    return {
      ...base,
      decision: "NEEDS_DATA",
      calculationStatus: "NEEDS_DATA",
      reasons: [
        "이 출발 시각에 맞는 왕복 경로가 없어요. 지도에서 경로를 확인해 주세요.",
      ],
    };
  }
  const uncertain =
    observation.freshness !== "FRESH" ||
    observation.congestion === null ||
    observation.pm25 === null;
  const reserve =
    observation.freshness !== "FRESH" || observation.congestion === null
      ? 20
      : observation.congestion >= 75
        ? 20
        : observation.congestion >= 50
          ? 10
          : 0;
  const indoor =
    observation.freshness !== "FRESH" ||
    observation.pm25 === null ||
    observation.pm25 >= 50;
  base.trafficReserve = reserve;
  base.calculationStatus = uncertain ? "PARTIAL" : "READY";
  const reason: string[] = [];
  if (reserve)
    reason.push(
      uncertain
        ? "최신 관측을 확인할 수 없어 시연 정책의 교통 여유 20분을 반영했어요."
        : `구룡포 통합 혼잡 신호에 따라 교통 여유 ${reserve}분을 한 번 더했어요.`,
    );
  if (indoor)
    reason.push(
      uncertain
        ? "대기 조건을 확인할 수 없어 선택적 야외 구경을 제외했어요."
        : "시연 대기 정책에 따라 야외 골목 구경을 제외했어요.",
    );
  if (plan.stage === "RETURN") {
    if (start < 720 || start > 1080)
      return {
        ...base,
        decision: "NEEDS_DATA",
        calculationStatus: "NEEDS_DATA",
        outbound: 0,
        reasons: [
          "현재 시각에 맞는 복귀 경로가 없어요. 외부 지도에서 확인해 주세요.",
        ],
      };
    const eta = start + 5 + 120;
    return {
      ...base,
      decision: eta + reserve <= target ? "GO" : "CANCEL",
      outbound: 0,
      returnMin: 125,
      stationEta: eta,
      planningArrival: eta + reserve,
      returnDeparture: start + 5,
      slack: target - eta - reserve,
      reasons: [
        ...reason,
        "정류장 접근 5분과 시연 버스 120분을 반영해 포항역으로 이동해요.",
      ],
    };
  }
  const allowed = (id: PlaceId) =>
    !plan.excluded.includes(id) &&
    !plan.completed.includes(id) &&
    (id !== "street" || !indoor);
  const variants: Array<Array<[PlaceId, number]>> = [
    [
      ["food", 60],
      ["street", 20],
      ["cafe", 40],
    ],
    [
      ["food", 50],
      ["street", 5],
    ],
    [["food", 50]],
  ];
  let routeWindowMissing = false;
  for (let index = 0; index < variants.length; index++) {
    const selected = variants[index].filter(([id]) => allowed(id));
    if (!selected.length && !plan.completed.length) continue;
    // Five minutes to the first stop, five minutes from the last stop.
    // Once a stop is completed, the first approach is already behind us.
    const localWalk = plan.completed.length > 0 ? 5 : selected.length ? 10 : 0;
    const localMin = selected.reduce(
      (sum, [, dwell]) => sum + dwell,
      localWalk,
    );
    const walking =
      (base.outbound ? 10 : 0) +
      10 +
      (selected.some(([id]) => id === "street") ? (index === 0 ? 10 : 5) : 0);
    const returnDeparture = start + base.outbound + localMin;
    if (returnDeparture < 720 || returnDeparture > 1080) {
      routeWindowMissing = true;
      continue;
    }
    const eta = returnDeparture + base.returnMin;
    if (eta + reserve > target || walking > plan.walkingLimit) continue;
    let cursor =
      start +
      base.outbound +
      (selected.length && !plan.completed.length ? 5 : 0);
    const stops = selected.map(([id, dwell]) => {
      const stop = { id, start: cursor, end: cursor + dwell, dwell };
      cursor += dwell;
      return stop;
    });
    const excluded = (["food", "street", "cafe"] as PlaceId[])
      .filter(
        (id) =>
          !selected.some(([key]) => key === id) && !plan.completed.includes(id),
      )
      .map((id) => ({
        id,
        reason: plan.excluded.includes(id)
          ? "직접 제외한 장소"
          : id === "street" && indoor
            ? "야외 체류 제한"
            : "귀가 시간과 걷기 조건 반영",
      }));
    if (index > 0)
      reason.push(
        index === 1
          ? "열차 시간에 맞춰 카페를 빼고 골목 구경을 5분으로 줄였어요."
          : "점심만 남겨 귀가 시간을 확보했어요.",
      );
    if (index === 0 && !reason.length)
      reason.push(
        `선택한 ${selected.length}곳을 둘러보고 열차 출발 30분 전에 역에 도착하는 계획이에요.`,
      );
    return {
      ...base,
      decision: index > 0 ? "SHORTEN" : indoor ? "INDOOR" : "GO",
      stops,
      stationEta: eta,
      planningArrival: eta + reserve,
      slack: target - eta - reserve,
      walking,
      localMin,
      returnDeparture,
      reasons: reason,
      excluded,
    };
  }
  return {
    ...base,
    decision: routeWindowMissing ? "NEEDS_DATA" : "CANCEL",
    calculationStatus: routeWindowMissing
      ? "NEEDS_DATA"
      : base.calculationStatus,
    reasons: [
      ...reason,
      routeWindowMissing
        ? "변경된 복귀 시각은 등록된 경로의 범위 밖이에요."
        : "최소 식사 코스도 귀가 시간 또는 걷기 조건을 맞추기 어려워요. 관광 대신 귀가 경로를 확인해 주세요.",
    ],
  };
}
