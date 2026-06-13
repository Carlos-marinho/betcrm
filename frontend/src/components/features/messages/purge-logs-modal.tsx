"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePurgeMessageLogs } from "@/lib/hooks";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Mode = "range" | "all";

export function PurgeLogsModal({ open, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("range");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const purge = usePurgeMessageLogs();

  function handleClose() {
    setMode("range");
    setDateFrom("");
    setDateTo("");
    purge.reset();
    onClose();
  }

  // Intervalo exige ao menos uma data; "todos" sempre pode.
  const rangeInvalid = mode === "range" && !dateFrom && !dateTo;
  const datesOutOfOrder = !!dateFrom && !!dateTo && dateFrom > dateTo;
  const canSubmit = !purge.isPending && !rangeInvalid && !datesOutOfOrder;

  function handlePurge() {
    if (!canSubmit) return;
    const payload =
      mode === "all"
        ? { all: true }
        : { date_from: dateFrom || undefined, date_to: dateTo || undefined };

    purge.mutate(payload, {
      onSuccess: (data) => {
        toast.success(`${data.deleted.toLocaleString("pt-BR")} log(s) removido(s)`);
        handleClose();
      },
      onError: (err) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        toast.error(
          status === 403
            ? "Apenas administradores podem limpar os logs"
            : "Não foi possível limpar os logs",
        );
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Limpar logs de mensagens</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode("range")}
              className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                mode === "range"
                  ? "bg-gold/10 border-gold/30 text-gold"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Intervalo de datas
            </button>
            <button
              onClick={() => setMode("all")}
              className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                mode === "all"
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos os logs
            </button>
          </div>

          {mode === "range" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">De</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Até</Label>
                <Input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
              {datesOutOfOrder && (
                <p className="col-span-2 text-xs text-red-400">A data inicial não pode ser maior que a final.</p>
              )}
              {rangeInvalid && (
                <p className="col-span-2 text-xs text-muted-foreground">Informe pelo menos uma das datas.</p>
              )}
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              {mode === "all"
                ? "Isto apaga permanentemente TODOS os logs de mensagens. Ação irreversível."
                : "Os logs do intervalo selecionado serão apagados permanentemente. Ação irreversível."}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" onClick={handleClose} className="border-border">
              Cancelar
            </Button>
            <Button
              onClick={handlePurge}
              disabled={!canSubmit}
              className="bg-red-500 text-white hover:bg-red-500/90 gap-1.5"
            >
              {purge.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Limpar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
