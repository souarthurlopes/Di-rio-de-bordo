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

const { validateDemo } = await import("../lib/demo.ts");
test("demonstração valida obrigatórios, zero e false", () => {
  const fields = [
    { id: "n", label: "Meta", type: "number", required: true },
    { id: "b", label: "Conferido", type: "boolean", required: true },
  ];
  assert.ok(validateDemo(fields, {}));
  assert.equal(validateDemo(fields, { n: 0, b: false }), "");
  assert.ok(validateDemo(fields, { n: "texto", b: true }));
});
test("demonstração rejeita seleção fora das opções", () => {
  const fields = [
    {
      id: "s",
      label: "Status",
      type: "select",
      options: ["A", "B"],
      required: true,
    },
  ];
  assert.ok(validateDemo(fields, { s: "C" }));
  assert.equal(validateDemo(fields, { s: "A" }), "");
});

const { normalizeEmail, validateClient } = await import("../lib/clients.ts");
test("cliente exige pessoa com nome e e-mail válidos", () => {
  const p = {
    id: "1",
    name: "Ana",
    email: " ANA@EXEMPLO.COM ",
    role: "leader",
    unit: "",
  };
  assert.equal(normalizeEmail(p.email), "ana@exemplo.com");
  assert.equal(validateClient("Cliente A", [p]), "");
  assert.ok(validateClient("Cliente A", []));
  assert.ok(validateClient("Cliente A", [{ ...p, email: "invalido" }]));
  assert.ok(validateClient("Cliente A", [{ ...p, name: "" }]));
});
test("cliente rejeita e-mails repetidos após normalização", () => {
  const p = {
    id: "1",
    name: "Ana",
    email: "ana@exemplo.com",
    role: "leader",
    unit: "",
  };
  assert.ok(
    validateClient("Cliente A", [
      p,
      { ...p, id: "2", email: " ANA@EXEMPLO.COM " },
    ]),
  );
  assert.equal(
    validateClient("Cliente A", [
      p,
      { ...p, id: "2", email: "outra@exemplo.com", role: "employee" },
    ]),
    "",
  );
});

const { clientDiaries } = await import("../lib/client-dashboard.ts");
const record = (id, clientId, personId, complete, updatedAt) => ({
  id,
  clientId,
  personId,
  complete,
  updatedAt,
  completedAt: complete ? updatedAt : null,
  personName: "Pessoa",
  personEmail: "pessoa@exemplo.com",
  date: "data exibida",
  model: { id: "modelo", name: "Diário", frequency: "daily" },
});
test("dashboard separa clientes por ID e ordena os mais recentes primeiro", () => {
  const rows = [
    record("a", "cliente-a", "1", true, "2026-11-04T12:00Z"),
    record("b", "cliente-b", "1", true, "2026-11-04T15:00Z"),
    record("c", "cliente-a", "2", false, "2026-11-04T14:00Z"),
  ];
  assert.deepEqual(
    clientDiaries(rows, "cliente-a").map((r) => r.id),
    ["c", "a"],
  );
  assert.deepEqual(
    clientDiaries(rows, "cliente-b").map((r) => r.id),
    ["b"],
  );
  assert.deepEqual(clientDiaries(rows, "inexistente"), []);
  assert.equal(
    clientDiaries(rows, "cliente-a", { status: "completed", person: "1" })
      .length,
    1,
  );
  assert.equal(
    clientDiaries(rows, "cliente-a", { status: "completed", person: "2" })
      .length,
    0,
  );
});
test("dashboard filtra por data no fuso de Brasília e por modelo", () => {
  const rows = [
    record("a", "cliente-a", "1", true, "2026-11-05T01:00Z"),
    record("b", "cliente-a", "1", false, "2026-11-05T04:00Z"),
  ];
  assert.deepEqual(
    clientDiaries(rows, "cliente-a", {
      from: "2026-11-04",
      to: "2026-11-04",
    }).map((r) => r.id),
    ["a"],
  );
  assert.deepEqual(clientDiaries(rows, "cliente-a", { model: "outro" }), []);
  assert.deepEqual(
    clientDiaries(rows, "cliente-a", { status: "draft" }).map((r) => r.id),
    ["b"],
  );
});
