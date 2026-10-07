export type Evidence = {
  source: string;
  status: "LIVE" | "NOT_CONFIGURED" | "ERROR";
  observedAt: string | null;
  fetchedAt: string;
  freshness: "FRESH" | "STALE" | "UNKNOWN";
  values: Record<string, number | string | null>;
  message: string;
};
export function normalizeTime(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    return null;
  return Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
}
function findRecord(
  value: unknown,
  field: string,
): Record<string, unknown> | null {
  if (value && typeof value === "object") {
    if (!Array.isArray(value) && field in value)
      return value as Record<string, unknown>;
    for (const child of Object.values(value)) {
      const match = findRecord(child, field);
      if (match) return match;
    }
  }
  return null;
}
export async function fetchEvidence(
  kind: "traffic" | "air",
): Promise<Evidence> {
  const source = kind === "traffic" ? "E-UM INT_S07_005" : "E-UM INT_S01_004";
  const fetchedAt = new Date().toISOString();
  const base = {
    source,
    fetchedAt,
    observedAt: null,
    freshness: "UNKNOWN" as const,
    values: {},
  };
  if (
    !process.env.EUM_SERVICE_KEY ||
    (kind === "air" && !process.env.EUM_AIR_DEVICE_ID)
  )
    return {
      ...base,
      status: "NOT_CONFIGURED",
      message:
        kind === "air"
          ? "서비스 키와 대기 장비 ID 설정이 필요해요."
          : "서비스 키 설정이 필요해요.",
    };
  const url = new URL(
    kind === "traffic"
      ? "https://genix.pohang-eum.kr/dpg/traffic/congestion"
      : "https://genix.pohang-eum.kr/dpg/atmosphere/device/realtime",
  );
  url.searchParams.set("serviceKey", process.env.EUM_SERVICE_KEY);
  if (kind === "air")
    url.searchParams.set("id", process.env.EUM_AIR_DEVICE_ID!);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok)
      return {
        ...base,
        status: "ERROR",
        message: `HTTP ${response.status} · 연결 확인 필요`,
      };
    const record = findRecord(
      await response.json(),
      kind === "traffic" ? "cntPerc" : "pm25",
    );
    if (!record)
      return {
        ...base,
        status: "ERROR",
        message: "기대 필드를 찾지 못했어요. 실제 응답 계약 확인이 필요해요.",
      };
    const measurement = record[kind === "traffic" ? "cntPerc" : "pm25"];
    if (
      typeof measurement !== "number" ||
      !Number.isFinite(measurement) ||
      measurement < 0 ||
      (kind === "traffic" && measurement > 100)
    ) {
      return {
        ...base,
        status: "ERROR",
        message:
          "관측값의 수치 형식·범위를 확인할 수 없어요. 공급자 응답 계약 확인이 필요해요.",
      };
    }
    const observedAt = normalizeTime(
      record[kind === "traffic" ? "hour" : "logDateTime"],
    );
    const maxAge = Number(process.env.EUM_MAX_AGE_SECONDS);
    const age = observedAt
      ? (Date.now() - Date.parse(observedAt)) / 1000
      : null;
    const freshness =
      age === null || !(maxAge > 0) || age < -60
        ? "UNKNOWN"
        : age > maxAge
          ? "STALE"
          : "FRESH";
    const fields =
      kind === "traffic"
        ? ["cntPerc", "hour"]
        : ["pm25", "pm10", "temp", "humi", "logDateTime"];
    const values = Object.fromEntries(
      fields.map((key) => [
        key,
        typeof record[key] === "number" || typeof record[key] === "string"
          ? record[key]
          : null,
      ]),
    );
    return {
      source,
      status: "LIVE",
      fetchedAt,
      observedAt,
      freshness,
      values,
      message:
        "실응답 조회 성공. 필드 단위·범위 검증 전에는 시연 계산과 분리해서 표시해요.",
    };
  } catch {
    return {
      ...base,
      status: "ERROR",
      message:
        "응답 시간 초과 또는 연결 오류. 시연값으로 실응답을 대체하지 않았어요.",
    };
  }
}
