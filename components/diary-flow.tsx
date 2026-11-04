"use client";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Save,
  CalendarDays,
  CalendarRange,
  BookOpen,
} from "lucide-react";
import { answered, type Field } from "../lib/domain";
type Model = { id: string; name: string; frequency: string; fields: Field[] };
type Props = {
  models: Model[];
  model: Model;
  values: Record<string, unknown>;
  locked: boolean;
  existing: boolean;
  onChoose: (id: string) => void;
  onChange: (id: string, value: unknown) => void;
  onSave: (complete: boolean) => string | void;
  onNew: () => void;
};
const cadence: Record<string, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  custom: "Personalizado",
};
function answerText(value: unknown) {
  return value === true
    ? "Sim"
    : value === false
      ? "Não"
      : Array.isArray(value)
        ? value.join(", ")
        : String(value ?? "") || "Sem resposta";
}
export function DiaryFlow({
  models,
  model,
  values,
  locked,
  existing,
  onChoose,
  onChange,
  onSave,
  onNew,
}: Props) {
  const [step, setStep] = useState(
    existing
      ? locked
        ? new Set(model.fields.map((f) => f.category || "Observações")).size
        : 0
      : -1,
  );
  const groups = [
    ...new Set(model.fields.map((f) => f.category || "Observações")),
  ];
  const category = groups[step],
    fields = model.fields.filter(
      (f) => (f.category || "Observações") === category,
    );
  const completed = model.fields.filter((f) => answered(values[f.id])).length;
  const [error, setError] = useState("");
  function next() {
    const missing = fields.find((f) => f.required && !answered(values[f.id]));
    if (missing) {
      setError("Responda à pergunta obrigatória: " + missing.label);
      return;
    }
    setError("");
    setStep((s) => s + 1);
  }
  if (step === -1)
    return (
      <div className="flow-select">
        <div className="flow-intro">
          <span className="section-kicker">UM PASSO DE CADA VEZ</span>
          <h2>Qual diário vamos preencher?</h2>
          <p>
            Escolha a frequência. Depois, percorra as categorias no seu ritmo.
          </p>
        </div>
        <div className="model-choices">
          {models.map((m) => {
            const Icon =
              m.frequency === "daily"
                ? Clock3
                : m.frequency === "weekly"
                  ? CalendarDays
                  : CalendarRange;
            return (
              <button
                className="model-choice"
                key={m.id}
                onClick={() => {
                  onChoose(m.id);
                  setStep(0);
                }}
              >
                <span className="model-choice-icon">
                  <Icon size={24} />
                </span>
                <span className="section-kicker">
                  {cadence[m.frequency] || "Personalizado"}
                </span>
                <strong>{m.name}</strong>
                <p>
                  {new Set(m.fields.map((f) => f.category)).size} categorias ·{" "}
                  {m.fields.length} perguntas
                </p>
                <span className="model-choice-action">
                  Começar preenchimento <ArrowRight size={16} />
                </span>
              </button>
            );
          })}
        </div>
        <div className="flow-note">
          <BookOpen size={17} />
          <span>
            Escolha o diário adequado à sua rotina. Seus preenchimentos ficam
            disponíveis somente nesta sessão.
          </span>
        </div>
      </div>
    );
  return (
    <div className="flow-shell">
      <aside className="flow-outline">
        <span className="section-kicker">{cadence[model.frequency]}</span>
        <h2>{model.name}</h2>
        <p>
          {completed} de {model.fields.length} respostas
        </p>
        <div className="flow-progress">
          <span
            style={{
              width:
                (model.fields.length
                  ? (completed / model.fields.length) * 100
                  : 0) + "%",
            }}
          />
        </div>
        <nav aria-label="Etapas do diário">
          {groups.map((g, i) => {
            const filled = model.fields
              .filter((f) => (f.category || "Observações") === g)
              .every((f) => answered(values[f.id]));
            return (
              <button
                key={g}
                aria-current={step === i ? "step" : undefined}
                className={step === i ? "current" : ""}
                onClick={() => {
                  setStep(i);
                  setError("");
                }}
              >
                <span className={"step-number " + (filled ? "filled" : "")}>
                  {filled ? (
                    <Check size={13} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <span>{g}</span>
              </button>
            );
          })}
          <button
            className={step >= groups.length ? "current" : ""}
            onClick={() => {
              setStep(groups.length);
              setError("");
            }}
          >
            <span className="step-number">
              <CheckCircle2 size={14} />
            </span>
            <span>Revisão e conclusão</span>
          </button>
        </nav>
        <button className="flow-reset" onClick={onNew}>
          <ArrowLeft size={14} /> Escolher outro modelo
        </button>
      </aside>
      <section className="flow-paper">
        {step < groups.length ? (
          <>
            <div className="flow-paper-heading">
              <span className="section-kicker">
                ETAPA {String(step + 1).padStart(2, "0")} DE{" "}
                {String(groups.length).padStart(2, "0")}
              </span>
              <h2>{category}</h2>
              <p>
                Registre o que aconteceu. Você pode voltar às outras etapas
                quando precisar.
              </p>
            </div>
            <fieldset disabled={locked} className="flow-questions">
              {fields.map((f, i) => (
                <div className="flow-question" key={f.id}>
                  <label
                    id={"label-" + f.id}
                    htmlFor={
                      f.type === "boolean" || f.type === "checklist"
                        ? undefined
                        : "field-" + f.id
                    }
                  >
                    <span className="question-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      {f.label}
                      {f.required && <small>Obrigatória</small>}
                    </span>
                  </label>
                  {f.type === "boolean" ? (
                    <div
                      className="answer-choices"
                      role="group"
                      aria-labelledby={"label-" + f.id}
                    >
                      {[true, false].map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          aria-pressed={values[f.id] === v}
                          className={values[f.id] === v ? "selected" : ""}
                          onClick={() => onChange(f.id, v)}
                        >
                          {values[f.id] === v && <Check size={14} />}{" "}
                          {v ? "Sim" : "Não"}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="clear-answer"
                        disabled={!answered(values[f.id])}
                        onClick={() => onChange(f.id, null)}
                      >
                        Limpar
                      </button>
                    </div>
                  ) : f.type === "text" ? (
                    <textarea
                      id={"field-" + f.id}
                      rows={3}
                      placeholder="Escreva aqui…"
                      value={String(values[f.id] ?? "")}
                      onChange={(e) => onChange(f.id, e.target.value)}
                    />
                  ) : f.type === "select" ? (
                    <select
                      id={"field-" + f.id}
                      value={String(values[f.id] ?? "")}
                      onChange={(e) => onChange(f.id, e.target.value)}
                    >
                      <option value="">Escolha uma opção</option>
                      {f.options?.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : f.type === "checklist" ? (
                    <div
                      className="check-options"
                      role="group"
                      aria-labelledby={"label-" + f.id}
                    >
                      {f.options?.map((o) => (
                        <label key={o}>
                          <input
                            type="checkbox"
                            checked={
                              Array.isArray(values[f.id]) &&
                              (values[f.id] as string[]).includes(o)
                            }
                            onChange={(e) =>
                              onChange(
                                f.id,
                                e.target.checked
                                  ? [
                                      ...(Array.isArray(values[f.id])
                                        ? (values[f.id] as string[])
                                        : []),
                                      o,
                                    ]
                                  : (values[f.id] as string[]).filter(
                                      (x) => x !== o,
                                    ),
                              )
                            }
                          />
                          {o}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      id={"field-" + f.id}
                      type={f.type}
                      step={f.type === "number" ? "any" : undefined}
                      value={String(values[f.id] ?? "")}
                      onChange={(e) =>
                        onChange(
                          f.id,
                          e.target.value === ""
                            ? null
                            : f.type === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                        )
                      }
                    />
                  )}
                </div>
              ))}
            </fieldset>
          </>
        ) : (
          <>
            <div className="flow-paper-heading">
              <span className="section-kicker">REVISÃO E CONCLUSÃO</span>
              <h2>
                {locked ? "Diário concluído" : "Tudo pronto para concluir?"}
              </h2>
              <p>
                {locked
                  ? "Confira o registro desta sessão. As respostas estão protegidas contra edição."
                  : "Confira suas respostas. Você pode editar qualquer categoria antes de finalizar."}
              </p>
            </div>
            {groups.map((g, i) => (
              <div className="review-group" key={g}>
                <div className="review-heading">
                  <h3>{g}</h3>
                  <button onClick={() => setStep(i)}>
                    {locked ? "Consultar" : "Editar"} <ArrowRight size={13} />
                  </button>
                </div>
                {model.fields
                  .filter((f) => (f.category || "Observações") === g)
                  .map((f) => (
                    <div className="review-answer" key={f.id}>
                      <span>{f.label}</span>
                      <strong
                        className={!answered(values[f.id]) ? "unanswered" : ""}
                      >
                        {answerText(values[f.id])}
                      </strong>
                    </div>
                  ))}
              </div>
            ))}
          </>
        )}
        {error && (
          <div className="flow-error" role="alert">
            {error}
          </div>
        )}
        <footer className="flow-actions">
          <button
            className="btn secondary"
            disabled={step === 0}
            onClick={() => {
              setStep((s) => Math.max(0, s - 1));
              setError("");
            }}
          >
            <ArrowLeft size={15} /> Voltar
          </button>
          <div className="row">
            {!locked && (
              <button className="btn secondary" onClick={() => onSave(false)}>
                <Save size={15} /> Salvar rascunho
              </button>
            )}
            {step < groups.length ? (
              <button className="btn" onClick={next}>
                {step === groups.length - 1
                  ? "Revisar diário"
                  : "Próxima etapa"}
                <ArrowRight size={15} />
              </button>
            ) : !locked ? (
              <button
                className="btn"
                onClick={() => {
                  const problem = onSave(true);
                  if (problem) setError(problem);
                }}
              >
                <CheckCircle2 size={15} /> Finalizar diário
              </button>
            ) : (
              <button className="btn" onClick={onNew}>
                <ClipboardList size={15} /> Novo diário
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
