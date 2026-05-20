"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

// ─── Types ─────────────────────────────────────────────────────────────────

type Phase = "idle" | "ready" | "uploading" | "done";

interface ImportStats {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; external_id?: string; error: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: (stats: ImportStats) => void;
}

// ─── Count-up hook ──────────────────────────────────────────────────────────

function useCountUp(target: number, active: boolean, duration = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) { setValue(0); return; }
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, active, duration]);
  return value;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ImportProfilesModal({ open, onClose, onSuccess }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const created = useCountUp(stats?.created ?? 0, phase === "done");
  const updated = useCountUp(stats?.updated ?? 0, phase === "done");
  const skipped = useCountUp(stats?.skipped ?? 0, phase === "done");

  const acceptFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setErrorMsg("Apenas arquivos .csv são suportados.");
      return;
    }
    setFile(f);
    setErrorMsg(null);
    setPhase("ready");
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImport = async () => {
    if (!file) return;
    setPhase("uploading");
    setProgress(0);

    const ticker = setInterval(() => {
      setProgress((p) => (p < 88 ? p + Math.random() * 14 : p));
    }, 160);

    try {
      const body = new FormData();
      body.append("file", file);

      const res = await api.post("/profiles/import/", body, {
        headers: { "Content-Type": "multipart/form-data" },
        validateStatus: (s) => s < 500,
      });

      clearInterval(ticker);
      setProgress(100);
      await new Promise((r) => setTimeout(r, 280));

      if (res.status >= 400) throw new Error(res.data?.error ?? "Erro no servidor");

      setStats(res.data);
      setPhase("done");
      onSuccess?.(res.data);
    } catch (err) {
      clearInterval(ticker);
      setErrorMsg(err instanceof Error ? err.message : "Erro inesperado");
      setPhase("ready");
    }
  };

  const reset = () => {
    setPhase("idle");
    setFile(null);
    setStats(null);
    setErrorMsg(null);
    setProgress(0);
    setShowErrors(false);
  };

  const handleClose = () => { reset(); onClose(); };

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes imp-enter {
          from { opacity: 0; transform: scale(0.97) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .imp-modal { animation: imp-enter 0.2s cubic-bezier(0.34, 1.4, 0.64, 1) forwards; }

        @keyframes imp-scan {
          0%   { top: 10%; opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        .imp-scanline::after {
          content: '';
          position: absolute;
          left: 12px; right: 12px; height: 1px;
          background: linear-gradient(90deg, transparent, #F0A500 50%, transparent);
          animation: imp-scan 2.8s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes imp-gold-shimmer {
          from { background-position: -200% center; }
          to   { background-position: 200% center; }
        }
        .imp-progress {
          background: linear-gradient(90deg, #F0A500 0%, #FFD060 45%, #F0A500 100%);
          background-size: 200% auto;
          animation: imp-gold-shimmer 1.1s linear infinite;
          transition: width 0.15s ease;
          border-radius: 99px;
          height: 100%;
        }

        @keyframes imp-stat-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .imp-stat-card { animation: imp-stat-in 0.35s ease forwards; opacity: 0; }
        .imp-stat-card:nth-child(1) { animation-delay: 0.04s; }
        .imp-stat-card:nth-child(2) { animation-delay: 0.12s; }
        .imp-stat-card:nth-child(3) { animation-delay: 0.20s; }

        @keyframes imp-spin {
          to { transform: rotate(360deg); }
        }
        .imp-spin { animation: imp-spin 0.75s linear infinite; }

        .imp-drop-zone {
          transition: border-color 0.18s ease, background 0.18s ease;
        }
        .imp-drop-zone:hover { border-color: rgba(240,165,0,0.4) !important; }
        .imp-drop-zone.drag-over {
          border-color: #F0A500 !important;
          background: rgba(240,165,0,0.04) !important;
        }

        .imp-btn-primary {
          background: linear-gradient(135deg, #F0A500 0%, #D48F00 100%);
          transition: opacity 0.15s ease, transform 0.1s ease;
        }
        .imp-btn-primary:hover { opacity: 0.88; }
        .imp-btn-primary:active { transform: scale(0.98); }
        .imp-btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }

        .imp-btn-ghost {
          transition: background 0.15s ease, color 0.15s ease;
        }
        .imp-btn-ghost:hover { background: rgba(255,255,255,0.05); color: hsl(240 40% 96%); }

        .imp-close-btn:hover { background: rgba(255,255,255,0.06); color: hsl(240 40% 96%); }

        .imp-error-row { transition: background 0.12s ease; border-radius: 6px; }
        .imp-error-row:hover { background: rgba(255, 64, 64, 0.07); }

        .imp-overlay-enter {
          animation: imp-overlay-fade 0.18s ease forwards;
        }
        @keyframes imp-overlay-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="imp-overlay-enter fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: "rgba(3, 3, 12, 0.82)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        {/* Modal */}
        <div
          className="imp-modal relative w-full flex flex-col"
          style={{
            maxWidth: 464,
            background: "hsl(240, 42%, 7%)",
            border: "1px solid hsl(240, 18%, 14%)",
            borderRadius: 14,
            boxShadow:
              "0 0 0 1px hsl(240 18% 10%), 0 28px 72px rgba(0,0,0,0.7), 0 0 80px rgba(240,165,0,0.03)",
            overflow: "hidden",
          }}
        >
          {/* ── Header ── */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid hsl(240 18% 11%)" }}
          >
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: 34, height: 34,
                  background: "rgba(240,165,0,0.1)",
                  border: "1px solid rgba(240,165,0,0.22)",
                  borderRadius: 9,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F0A500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14, color: "hsl(240 40% 96%)", letterSpacing: "-0.01em" }}>
                  Importar Perfis
                </p>
                <p className="font-data" style={{ fontSize: 11, color: "hsl(240 12% 42%)" }}>
                  CSV → upsert por external_id
                </p>
              </div>
            </div>

            <button
              className="imp-close-btn"
              onClick={handleClose}
              style={{
                width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent",
                border: "1px solid hsl(240 18% 13%)",
                borderRadius: 7,
                cursor: "pointer",
                color: "hsl(240 12% 40%)",
                transition: "all 0.14s ease",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* ── Body ── */}
          <div className="px-5 pt-5 pb-2">

            {/* ════ IDLE / READY ════ */}
            {(phase === "idle" || phase === "ready") && (
              <div className="space-y-4">

                {/* Drop zone */}
                <div
                  className={`imp-drop-zone imp-scanline relative ${dragging ? "drag-over" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  style={{
                    border: `1.5px dashed ${file ? "hsl(240 18% 20%)" : "hsl(240 18% 16%)"}`,
                    borderRadius: 10,
                    minHeight: 148,
                    cursor: "pointer",
                    background: file ? "hsl(240 35% 8%)" : "hsl(240 40% 6%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={(e) => e.target.files?.[0] && acceptFile(e.target.files[0])}
                  />

                  {file ? (
                    <>
                      <div style={{
                        width: 42, height: 42,
                        background: "rgba(240,165,0,0.1)",
                        border: "1px solid rgba(240,165,0,0.25)",
                        borderRadius: 10,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F0A500" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p style={{ fontWeight: 600, fontSize: 13, color: "hsl(240 40% 92%)" }}>
                          {file.name}
                        </p>
                        <p className="font-data" style={{ fontSize: 11, color: "hsl(240 12% 42%)", marginTop: 2 }}>
                          {(file.size / 1024).toFixed(1)} KB · clique para trocar
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{
                        width: 42, height: 42,
                        background: "hsl(240 35% 10%)",
                        border: "1px solid hsl(240 18% 14%)",
                        borderRadius: 10,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(240 12% 35%)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p style={{ fontSize: 13, color: "hsl(240 12% 48%)" }}>
                          Arraste o arquivo ou{" "}
                          <span style={{ color: "#F0A500", fontWeight: 500 }}>clique aqui</span>
                        </p>
                        <p style={{ fontSize: 11, color: "hsl(240 12% 30%)", marginTop: 2 }}>
                          Somente .csv
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Error banner */}
                {errorMsg && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "8px 11px",
                    background: "rgba(255,64,64,0.07)",
                    border: "1px solid rgba(255,64,64,0.18)",
                    borderRadius: 8,
                    fontSize: 12, color: "#FF6B6B",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {errorMsg}
                  </div>
                )}

                {/* Column legend */}
                <div>
                  <p className="font-data" style={{ fontSize: 10, color: "hsl(240 12% 28%)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    Colunas mapeadas
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {[
                      "ID do Usuário", "Nome Completo", "Email", "Telefone",
                      "CPF/Documento", "Status Ativo", "Verificado", "Tipo",
                      "Data de Cadastro", "Último Login", "Data de Ativação",
                    ].map((col) => (
                      <span key={col} className="font-data" style={{
                        padding: "2px 6px",
                        background: "hsl(240 35% 9%)",
                        border: "1px solid hsl(240 18% 12%)",
                        borderRadius: 4,
                        fontSize: 10,
                        color: "hsl(240 12% 36%)",
                      }}>
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ════ UPLOADING ════ */}
            {phase === "uploading" && (
              <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
                <div style={{
                  width: 52, height: 52,
                  background: "rgba(240,165,0,0.08)",
                  border: "1px solid rgba(240,165,0,0.18)",
                  borderRadius: 13,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 14px",
                }}>
                  <svg className="imp-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F0A500" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </div>

                <p style={{ fontWeight: 600, fontSize: 14, color: "hsl(240 40% 94%)", marginBottom: 3 }}>
                  Processando importação
                </p>
                <p className="font-data" style={{ fontSize: 11, color: "hsl(240 12% 38%)", marginBottom: 18 }}>
                  {file?.name}
                </p>

                <div style={{
                  background: "hsl(240 18% 11%)",
                  borderRadius: 99,
                  height: 4,
                  overflow: "hidden",
                  marginBottom: 6,
                }}>
                  <div className="imp-progress" style={{ width: `${progress}%` }} />
                </div>

                <p className="font-data" style={{ fontSize: 11, color: "hsl(240 12% 30%)", textAlign: "right" }}>
                  {Math.round(progress)}%
                </p>
              </div>
            )}

            {/* ════ DONE ════ */}
            {phase === "done" && stats && (
              <div>
                {/* Success line */}
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
                  <div style={{
                    width: 30, height: 30,
                    background: "rgba(0,201,167,0.1)",
                    border: "1px solid rgba(0,201,167,0.22)",
                    borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C9A7" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13, color: "hsl(240 40% 94%)" }}>
                      Importação concluída
                    </p>
                    <p className="font-data" style={{ fontSize: 11, color: "hsl(240 12% 38%)" }}>
                      {file?.name}
                    </p>
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: stats.errors.length > 0 ? 12 : 0 }}>
                  <StatCard label="Criados" value={created} accent="#00C9A7" accentBg="rgba(0,201,167,0.08)" accentBorder="rgba(0,201,167,0.18)" />
                  <StatCard label="Atualizados" value={updated} accent="#F0A500" accentBg="rgba(240,165,0,0.08)" accentBorder="rgba(240,165,0,0.18)" />
                  <StatCard label="Ignorados" value={skipped} accent="hsl(240 12% 42%)" accentBg="hsl(240 25% 9%)" accentBorder="hsl(240 18% 13%)" />
                </div>

                {/* Errors accordion */}
                {stats.errors.length > 0 && (
                  <div style={{
                    background: "rgba(255,64,64,0.04)",
                    border: "1px solid rgba(255,64,64,0.14)",
                    borderRadius: 9,
                    overflow: "hidden",
                  }}>
                    <button
                      onClick={() => setShowErrors((v) => !v)}
                      style={{
                        width: "100%",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "9px 13px",
                        background: "transparent", border: "none",
                        cursor: "pointer",
                        color: "#FF6B6B",
                        fontSize: 12, fontWeight: 500,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        {stats.errors.length} {stats.errors.length === 1 ? "linha com erro" : "linhas com erro"}
                      </span>
                      <svg
                        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                        style={{ transform: showErrors ? "rotate(180deg)" : "none", transition: "transform 0.18s ease" }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {showErrors && (
                      <div style={{ borderTop: "1px solid rgba(255,64,64,0.1)", maxHeight: 132, overflowY: "auto", padding: "4px 6px 6px" }}>
                        {stats.errors.map((e, i) => (
                          <div key={i} className="imp-error-row" style={{
                            display: "flex", alignItems: "flex-start", gap: 8,
                            padding: "5px 7px",
                          }}>
                            <span className="font-data" style={{ fontSize: 10, color: "hsl(240 12% 32%)", flexShrink: 0, paddingTop: 1 }}>
                              L{e.row}
                            </span>
                            <span style={{ fontSize: 11, color: "#FF7A7A" }}>{e.error}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-5 py-4 mt-1">
            {phase === "idle" && (
              <button
                disabled
                style={{
                  width: "100%", padding: "10px 0",
                  background: "hsl(240 35% 8%)",
                  border: "1px solid hsl(240 18% 12%)",
                  borderRadius: 9, fontSize: 13, fontWeight: 600,
                  color: "hsl(240 12% 28%)", cursor: "not-allowed",
                  letterSpacing: "-0.01em",
                }}
              >
                Selecione um arquivo
              </button>
            )}

            {phase === "ready" && (
              <button
                className="imp-btn-primary"
                onClick={handleImport}
                style={{
                  width: "100%", padding: "10px 0",
                  border: "none", borderRadius: 9,
                  fontSize: 13, fontWeight: 700,
                  color: "hsl(240 67% 4%)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  letterSpacing: "-0.01em",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Importar agora
              </button>
            )}

            {phase === "uploading" && (
              <button
                disabled
                style={{
                  width: "100%", padding: "10px 0",
                  background: "rgba(240,165,0,0.12)",
                  border: "1px solid rgba(240,165,0,0.2)",
                  borderRadius: 9, fontSize: 13, fontWeight: 600,
                  color: "#F0A500", cursor: "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  letterSpacing: "-0.01em",
                }}
              >
                <svg className="imp-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Processando...
              </button>
            )}

            {phase === "done" && (
              <div style={{ display: "flex", gap: 7 }}>
                <button
                  className="imp-btn-ghost"
                  onClick={reset}
                  style={{
                    flex: 1, padding: "9px 0",
                    background: "hsl(240 35% 8%)",
                    border: "1px solid hsl(240 18% 12%)",
                    borderRadius: 9, fontSize: 12, fontWeight: 600,
                    color: "hsl(240 12% 44%)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    letterSpacing: "-0.01em",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Novo import
                </button>
                <button
                  className="imp-btn-primary"
                  onClick={handleClose}
                  style={{
                    flex: 2, padding: "9px 0",
                    border: "none", borderRadius: 9,
                    fontSize: 12, fontWeight: 700,
                    color: "hsl(240 67% 4%)", cursor: "pointer",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Concluir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label, value, accent, accentBg, accentBorder,
}: {
  label: string;
  value: number;
  accent: string;
  accentBg: string;
  accentBorder: string;
}) {
  return (
    <div className="imp-stat-card" style={{
      background: accentBg,
      border: `1px solid ${accentBorder}`,
      borderRadius: 9,
      padding: "11px 12px",
    }}>
      <p className="font-data" style={{
        fontSize: 10, color: "hsl(240 12% 38%)",
        textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7,
      }}>
        {label}
      </p>
      <p className="font-data" style={{ fontSize: 30, fontWeight: 700, color: accent, lineHeight: 1 }}>
        {value}
      </p>
    </div>
  );
}
