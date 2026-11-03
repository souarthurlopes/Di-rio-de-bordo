import { test } from "node:test";
import assert from "node:assert/strict";
import { state, answered, nextPeriod } from "../lib/domain.ts";
test("concluído permanece concluído depois do vencimento", () =>
  assert.equal(
    state({ status: "submitted", due_at: "2020-01-01", responses: {} }),
    "Concluído",
  ));
test("prazo exato e prazo ultrapassado", () => {
  const now = Date.parse("2026-11-03T12:00Z");
  assert.equal(
    state({ status: "draft", due_at: "2026-11-03T12:00Z", responses: {} }, now),
    "Pendente",
  );
  assert.equal(
    state({ status: "draft", due_at: "2026-11-03T11:59Z", responses: {} }, now),
    "Atrasado",
  );
});
test("histórico sem prazo não fica atrasado", () =>
  assert.equal(
    state({ status: "draft", due_at: null, responses: {} }),
    "Pendente",
  ));
test("zero e não são respostas válidas", () => {
  assert.ok(answered(0));
  assert.ok(answered(false));
  assert.ok(!answered([]));
  assert.ok(!answered(""));
});
test("períodos semanais começam na segunda-feira", () =>
  assert.equal(nextPeriod("weekly", "2026-11-08"), "2026-11-02"));
test("período mensal começa no dia 1", () =>
  assert.equal(nextPeriod("monthly", "2026-11-30"), "2026-11-01"));
