"use client";
import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
type Point = {
  id: string;
  unit_id: string;
  name: string;
  value: number;
  measured_at: string;
};
export function IndicatorChart({
  points,
  units,
}: {
  points: Point[];
  units: { id: string; name: string }[];
}) {
  const [name, setName] = useState(""),
    [unit, setUnit] = useState("");
  const metric = name || points[0]?.name || "";
  const selectedUnit = unit || units[0]?.id || "";
  const data = points
    .filter((p) => p.name === metric && p.unit_id === selectedUnit)
    .map((p) => ({ date: p.measured_at, value: Number(p.value) }));
  if (!points.length) return null;
  return (
    <div className="stack">
      <div className="fields">
        <label className="field">
          Indicador
          <select
            className="input"
            value={metric}
            onChange={(e) => setName(e.target.value)}
          >
            {[...new Set(points.map((p) => p.name))].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Unidade
          <select
            className="input"
            value={selectedUnit}
            onChange={(e) => setUnit(e.target.value)}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {data.length ? (
        <div
          style={{ height: 250, minWidth: 0 }}
          role="img"
          aria-label={"Evolução de " + metric}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#507c79"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p>Nenhum valor nessa unidade.</p>
      )}
    </div>
  );
}
