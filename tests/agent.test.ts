import { afterEach, describe, expect, it, vi } from "vitest";
import { runAgent } from "../server/agent";
import { defaultPlan, defaultObservations, type Plan } from "../shared/model";
const plan: Plan = { ...defaultPlan, condition: "TIRED" };
const args = {
  trainTime: "16:00",
  walkingLimit: null,
  extraRestMin: null,
  excludeCafe: null,
};
const toolResponse = (name = "preview_itinerary", changes: unknown = args) =>
  new Response(
    JSON.stringify({
      id: "resp_test",
      object: "response",
      output: [
        {
          type: "function_call",
          id: "fc_test",
          call_id: "call_test",
          name,
          arguments: JSON.stringify(changes),
        },
      ],
    }),
    { headers: { "Content-Type": "application/json" } },
  );
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("OpenAI 함수 호출 계약 (HTTP 모의 응답)", () => {
  it("실행 결과를 같은 call_id로 돌려주며 결과는 미리보기만 반환", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-key");
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(toolResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: "resp_done", object: "response", output: [] }),
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    const reply = await runAgent(
      "16시 기차로 바꿨어",
      plan,
      defaultObservations,
    );
    expect(reply.mode).toBe("OPENAI");
    expect(reply.changes?.trainTime).toBe("16:00");
    expect(plan.trainTime).toBe("18:30");
    expect(reply.itinerary?.stationEta).toBe(915);
    const request = fetch.mock.calls[1][0] as Request;
    const body =
      typeof request === "string"
        ? JSON.parse(String(fetch.mock.calls[1][1]?.body))
        : await request.clone().json();
    expect(body.store).toBe(false);
    expect(body.input).toContainEqual(
      expect.objectContaining({
        type: "function_call_output",
        call_id: "call_test",
      }),
    );
  });
  it("허용하지 않은 도구를 실행하지 않고 정형 응답으로 전환", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      toolResponse("arbitrary_tool", {}),
    );
    const reply = await runAgent("도움말", plan, defaultObservations);
    expect(reply.mode).toBe("FALLBACK");
    expect(reply.changes).toBeUndefined();
  });
  it("비교 질문에는 모델이 변경을 요청해도 계획을 유지", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(toolResponse());
    const reply = await runAgent(
      "역까지 택시 타면?",
      plan,
      defaultObservations,
    );
    expect(reply.compare).toBe(true);
    expect(reply.changes).toBeUndefined();
  });
  it("잘못된 시각·추가 필드는 적용하지 않음", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      toolResponse("preview_itinerary", {
        ...args,
        trainTime: "25:00",
        fare: 1,
      }),
    );
    const reply = await runAgent("25시로 변경", plan, defaultObservations);
    expect(reply.mode).toBe("FALLBACK");
    expect(reply.changes).toBeUndefined();
  });
  it("API 장애에도 버튼과 동일한 정형 계획을 반환하며 성공을 주장하지 않음", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-key");
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("timeout"));
    const reply = await runAgent(
      "16시 기차로 바꿨어",
      plan,
      defaultObservations,
    );
    expect(reply.mode).toBe("FALLBACK");
    expect(reply.itinerary?.decision).toBe("SHORTEN");
  });
});
