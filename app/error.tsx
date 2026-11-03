"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="authwrap">
      <div className="card stack">
        <h1>Não foi possível abrir o sistema</h1>
        <p>Verifique a conexão e tente novamente.</p>
        <button className="btn" onClick={reset}>
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
