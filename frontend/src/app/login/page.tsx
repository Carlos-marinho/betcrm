"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { setTokens } from "@/lib/auth";
import { Radio, Eye, EyeOff, Loader2 } from "lucide-react";

const schema = z.object({
  username: z.string().min(1, "Obrigatório"),
  password: z.string().min(1, "Obrigatório"),
});
type FormData = z.infer<typeof schema>;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [apiError, setApiError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setApiError("");
    try {
      const res = await axios.post(`${API_BASE}/api/token/`, data);
      setTokens(res.data.access, res.data.refresh);
      router.push("/");
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setApiError("Credenciais inválidas.");
      } else {
        setApiError("Erro ao conectar ao servidor.");
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gold/[0.03] blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative animate-fade-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-4 glow-gold">
            <Radio className="w-6 h-6 text-gold" />
          </div>
          <h1 className="font-display font-bold text-2xl">
            <span className="text-gold">Bet</span>
            <span className="text-foreground">CRM</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Painel de Controle</p>
        </div>

        {/* Card */}
        <div className="card-vault p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                Usuário
              </label>
              <input
                {...register("username")}
                autoComplete="username"
                className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40 transition-colors"
                placeholder="admin"
              />
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                Senha
              </label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  className="w-full bg-input border border-border rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {apiError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                <p className="text-xs text-destructive">{apiError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-gold text-background font-semibold text-sm py-2.5 rounded-md hover:bg-gold/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 glow-gold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-4">
          BetCRM v0.1.0 · iGaming CRM
        </p>
      </div>
    </div>
  );
}
