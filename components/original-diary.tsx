"use client";
import { useState } from "react";
import { BookOpen, Printer, RotateCcw } from "lucide-react";
import models from "../lib/diary-models.json";
const frequencies = [
  { id: "daily", label: "Diário" },
  { id: "weekly", label: "Semanal" },
  { id: "monthly", label: "Mensal" },
];
export default function OriginalDiary() {
  const [frequency, setFrequency] = useState("daily");
  const [responses, setResponses] = useState<
    Record<string, Record<string, string | boolean>>
  >({});
  const [leader, setLeader] = useState(""),
    [unit, setUnit] = useState(""),
    [date, setDate] = useState("");
  const model = models.find((m) => m.frequency === frequency)!;
  const values = responses[frequency] ?? {};
  const categories = [...new Set(model.fields.map((f) => f.category))];
  function answer(id: string, value: string | boolean) {
    setResponses((a) => ({
      ...a,
      [frequency]: { ...a[frequency], [id]: value },
    }));
  }
  return (
    <main className="original-diary">
      <header className="original-header">
        <div className="original-title">
          <BookOpen size={25} strokeWidth={1.5} />
          <div>
            <h1>Diário de Bordo</h1>
            <p>Acompanhamento do líder</p>
          </div>
        </div>
        <button className="original-print" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir
        </button>
      </header>
      <nav className="original-tabs" aria-label="Frequência do diário">
        {frequencies.map((f) => (
          <button
            key={f.id}
            aria-pressed={frequency === f.id}
            className={frequency === f.id ? "active" : ""}
            onClick={() => setFrequency(f.id)}
          >
            {f.label}
          </button>
        ))}
      </nav>
      <article className="original-paper">
        <div className="original-period">
          <span>DIÁRIO DE BORDO</span>
          <h2>{frequencies.find((f) => f.id === frequency)?.label}</h2>
        </div>
        <div className="original-identification">
          <label>
            Nome do líder
            <input value={leader} onChange={(e) => setLeader(e.target.value)} />
          </label>
          <label>
            Unidade
            <input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
          <label>
            Data de referência
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        {categories.map((category, i) => (
          <section className="original-section" key={category}>
            <h3>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {category}
            </h3>
            <div>
              {model.fields
                .filter((f) => f.category === category)
                .map((f) =>
                  f.type === "boolean" ? (
                    <label key={f.id} className="original-check">
                      <input
                        type="checkbox"
                        checked={Boolean(values[f.id])}
                        onChange={(e) => answer(f.id, e.target.checked)}
                      />
                      <span>{f.label}</span>
                    </label>
                  ) : (
                    <label key={f.id} className="original-field">
                      {f.label}
                      {f.type === "number" ? (
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={String(values[f.id] ?? "")}
                          onChange={(e) => answer(f.id, e.target.value)}
                        />
                      ) : (
                        <textarea
                          rows={3}
                          value={String(values[f.id] ?? "")}
                          onChange={(e) => answer(f.id, e.target.value)}
                        />
                      )}
                    </label>
                  ),
                )}
            </div>
          </section>
        ))}
      </article>
      <footer className="original-footer">
        <p>
          O preenchimento fica apenas nesta aba. Para guardar uma cópia, use
          Imprimir e escolha Salvar como PDF.
        </p>
        <button
          onClick={() => {
            if (window.confirm("Limpar as respostas deste formulário?"))
              setResponses((a) => ({ ...a, [frequency]: {} }));
          }}
        >
          <RotateCcw size={14} /> Limpar este formulário
        </button>
      </footer>
    </main>
  );
}
