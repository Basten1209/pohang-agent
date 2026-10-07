import { z } from "zod";

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const planSchema = z.object({
  revision: z.number().int().nonnegative(),
  arrivalAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  trainTime: timeSchema,
  readyTime: timeSchema,
  condition: z.enum(["OK", "TIRED", "UNWELL", "UNANSWERED"]),
  walkingLimit: z.union([z.literal(15), z.literal(30)]),
  baggageCollected: z.boolean(),
  origin: z.enum(["RACE", "HOTEL"]),
  interests: z.array(z.enum(["FOOD", "STREET", "CAFE"])),
  excluded: z.array(z.enum(["food", "street", "cafe"])),
  restMin: z.number().int().min(0).max(180),
  stage: z.enum(["BEFORE", "OUTBOUND", "LOCAL", "RETURN", "DONE"]),
  completed: z.array(z.enum(["food", "street", "cafe"])),
  currentTime: timeSchema,
  currentPlace: z.enum(["RACE", "HOTEL", "GURYONGPO", "STATION"]),
});
export type Plan = z.infer<typeof planSchema>;
export const observationsSchema = z.object({
  congestion: z.number().min(0).max(100).nullable(),
  pm25: z.number().min(0).max(1000).nullable(),
  freshness: z.enum(["FRESH", "STALE", "UNKNOWN"]),
  routeAvailable: z.boolean(),
  provenance: z.literal("SIMULATED"),
});
export type Observations = z.infer<typeof observationsSchema>;
export const defaultPlan: Plan = {
  revision: 0,
  arrivalAt: "2026-10-12T17:00",
  trainTime: "18:30",
  readyTime: "10:40",
  condition: "UNANSWERED",
  walkingLimit: 30,
  baggageCollected: true,
  origin: "RACE",
  interests: ["FOOD", "STREET", "CAFE"],
  excluded: [],
  restMin: 0,
  stage: "BEFORE",
  completed: [],
  currentTime: "10:40",
  currentPlace: "RACE",
};
export const defaultObservations: Observations = {
  congestion: 42,
  pm25: 10,
  freshness: "FRESH",
  routeAvailable: true,
  provenance: "SIMULATED",
};
export const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const clock = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const duration = (min: number) =>
  min >= 60
    ? `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ""}`
    : `${min}분`;
export const places = {
  food: {
    title: "구룡포에서 든든한 한 끼",
    short: "항구 앞 점심",
    subtitle: "구룡포시장 · 식당 후보",
    category: "LOCAL FOOD",
    desc: "달린 뒤 찾아온 반가운 허기. 구룡포시장 근처에서 여유 있게 점심을 먹으며 여행을 시작해요.",
    detail:
      "식당은 아직 선정 전입니다. 이 데모에서는 구룡포시장 권역을 목적지로 사용해요. 1인 식사 가능 여부, 메뉴와 가격, 영업시간은 현지 확인이 필요합니다.",
    lat: 35.9868,
    lng: 129.5528,
  },
  street: {
    title: "골목을 따라, 구룡포 한 장",
    short: "일본인 가옥거리",
    subtitle: "오래된 집과 작은 골목",
    category: "SLOW WALK",
    desc: "항구 마을의 시간이 남아 있는 일본인 가옥거리. 짧게 둘러보고 오늘의 사진 한 장을 남겨요.",
    detail:
      "일본인 가옥거리의 짧은 구간을 둘러보는 시연 코스예요. 구룡포공원 계단은 코스에서 제외했습니다. 실제 보행 구간의 경사와 접근성은 확인이 필요합니다.",
    lat: 35.9902,
    lng: 129.5595,
  },
  cafe: {
    title: "서두르지 않는 커피 한 잔",
    short: "골목 카페에서 휴식",
    subtitle: "가옥거리 인근 · 카페 후보",
    category: "COFFEE BREAK",
    desc: "여행의 마지막은 느긋하게. 항구 마을의 분위기를 느끼며 앉아서 잠깐 쉬어 가요.",
    detail:
      "카페는 아직 선정 전입니다. 가옥거리 인근 후보를 가정한 체류 시간이므로 상호·영업시간·가격·출입 동선 확인 후 실제 목적지를 등록해야 합니다.",
    lat: 35.9902,
    lng: 129.5595,
  },
};
export type PlaceId = keyof typeof places;
export type Stop = { id: PlaceId; start: number; end: number; dwell: number };
export type Itinerary = {
  decision:
    | "GO"
    | "SHORTEN"
    | "INDOOR"
    | "CANCEL"
    | "MEDICAL_FIRST"
    | "NEEDS_DATA"
    | "INCOMPLETE";
  calculationStatus: "READY" | "PARTIAL" | "NOT_RUN" | "NEEDS_DATA";
  executionMode: "DEMO";
  revision: number;
  start: number;
  stops: Stop[];
  stationEta: number | null;
  planningArrival: number | null;
  stationTarget: number;
  slack: number | null;
  walking: number;
  localMin: number;
  outbound: number;
  returnMin: number;
  returnDeparture: number | null;
  trafficReserve: number;
  reasons: string[];
  excluded: { id: PlaceId; reason: string }[];
};
export function mapUrl(
  destination: "RACE" | "HOTEL" | "GURYONGPO" | "STATION" | PlaceId,
  mode: "traffic" | "walk" = "traffic",
) {
  const target =
    destination === "STATION"
      ? ["포항역", 36.0714, 129.3418]
      : destination === "RACE" || destination === "HOTEL"
        ? ["영일대해수욕장", 36.0565, 129.378]
        : destination === "GURYONGPO"
          ? ["구룡포시장", 35.9868, 129.5528]
          : [
              places[destination].short,
              places[destination].lat,
              places[destination].lng,
            ];
  const origin =
    destination === "STATION" || mode === "walk"
      ? ["구룡포시장", 35.9868, 129.5528]
      : destination === "HOTEL" || destination === "RACE"
        ? ["포항역", 36.0714, 129.3418]
        : ["영일대해수욕장", 36.0565, 129.378];
  const segment = (point: (string | number)[]) =>
    `${encodeURIComponent(String(point[0]))},${point[1]},${point[2]}`;
  return `https://map.kakao.com/link/by/${mode}/${segment(origin)}/${segment(target)}`;
}
