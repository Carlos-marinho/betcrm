"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRetryAllFailed } from "@/lib/hooks";
import { Info, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Canal selecionado no filtro da tela; vazio = todos os canais. */
  channel?: string;
}

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  whatsapp: "WhatsApp",
};

export function RetryFailedModal({ open, onClose, channel }: Props) {
  const retryAll = useRetryAllFailed();

  const scope = channel ? CHANNEL_LABEL[channel] ?? channel : "todos os canais";

  function handleClose() {
    retryAll.reset();
    onClose();
  }

  function handleRetry() {
    retryAll.mutate(channel, {
      onSuccess: (data) => {
        if (data.requeued > 0) {
          const ignored = data.skipped > 0 ? ` · ${data.skipped} ignorada(s)` : "";
          toast.success(`${data.requeued} mensagem(ns) reenfileirada(s)${ignored}`);
        } else {
          toast.info("Nenhuma mensagem para reenviar (já entregues ou sem falhas).");
        }
        handleClose();
      },
      onError: () => toast.error("Não foi possível reenviar as mensagens"),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Reenviar mensagens com falha</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <p className="text-sm text-muted-foreground">
            Reenvia todas as mensagens com status <span className="text-foreground font-medium">Falhou</span> de{" "}
            <span className="text-foreground font-medium">{scope}</span>.
          </p>

          {/* Garantia anti-duplicação */}
          <div className="flex items-start gap-2 px-3 py-2.5 bg-teal/5 border border-teal/20 rounded-lg text-xs text-teal">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Sem duplicar: <strong>1 reenvio por destinatário</strong> mesmo que o retry automático
              tenha gerado várias falhas, e as que já foram entregues são ignoradas.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" onClick={handleClose} className="border-border">
              Cancelar
            </Button>
            <Button
              onClick={handleRetry}
              disabled={retryAll.isPending}
              className="bg-gold text-background hover:bg-gold/90 gap-1.5"
            >
              {retryAll.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCw className="w-3.5 h-3.5" />
              )}
              Reenviar falhados
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
