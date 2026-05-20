"use client";

import { Plus, Trash2, RefreshCw } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export interface RuleCondition {
  field: string;
  operator: string;
  value: string | number | boolean;
}

export interface SegmentRules {
  operator: "AND" | "OR";
  conditions: RuleCondition[];
}

const FIELD_GROUPS = [
  {
    group: "Financeiro",
    items: [
      { value: "ltv", label: "LTV (R$)", type: "decimal" },
      { value: "total_deposits", label: "Total Depositado", type: "decimal" },
      { value: "total_withdrawals", label: "Total Sacado", type: "decimal" },
      { value: "deposit_count", label: "Qtd. Depósitos", type: "integer" },
      { value: "withdrawal_count", label: "Qtd. Saques", type: "integer" },
      { value: "failed_deposit_count", label: "Depósitos Falhados", type: "integer" },
    ],
  },
  {
    group: "Atividade",
    items: [
      { value: "last_deposit_at", label: "Último Depósito", type: "date" },
      { value: "last_login_at", label: "Último Login", type: "date" },
      { value: "last_event_at", label: "Último Evento", type: "date" },
      { value: "registered_at", label: "Data de Registro", type: "date" },
      { value: "ftd_at", label: "Data FTD", type: "date" },
      { value: "favorite_game", label: "Jogo Favorito", type: "string" },
    ],
  },
  {
    group: "Consentimento",
    items: [
      { value: "consent_email", label: "Aceita Email", type: "boolean" },
      { value: "consent_sms", label: "Aceita SMS", type: "boolean" },
      { value: "consent_push", label: "Aceita Push", type: "boolean" },
    ],
  },
  {
    group: "Tags & Localização",
    items: [
      { value: "tags", label: "Tag do usuário", type: "tags" },
      { value: "country", label: "País", type: "string" },
      { value: "state", label: "Estado", type: "string" },
      { value: "city", label: "Cidade", type: "string" },
    ],
  },
  {
    group: "Comunicação",
    items: [
      { value: "email_bounce_count", label: "Email Bounces", type: "integer" },
      { value: "sms_bounce_count", label: "SMS Bounces", type: "integer" },
    ],
  },
];

const ALL_FIELDS = FIELD_GROUPS.flatMap((g) => g.items);

type FieldType = "decimal" | "integer" | "date" | "string" | "boolean" | "tags";

const OPERATORS_BY_TYPE: Record<FieldType, { value: string; label: string }[]> = {
  decimal: [
    { value: "gte", label: "≥ maior ou igual" },
    { value: "gt", label: "> maior que" },
    { value: "lte", label: "≤ menor ou igual" },
    { value: "lt", label: "< menor que" },
    { value: "eq", label: "= igual a" },
    { value: "ne", label: "≠ diferente de" },
    { value: "isnull", label: "não preenchido" },
  ],
  integer: [
    { value: "gte", label: "≥ maior ou igual" },
    { value: "gt", label: "> maior que" },
    { value: "lte", label: "≤ menor ou igual" },
    { value: "lt", label: "< menor que" },
    { value: "eq", label: "= igual a" },
  ],
  date: [
    { value: "within_days", label: "nos últimos X dias" },
    { value: "older_than_days", label: "há mais de X dias" },
    { value: "isnull", label: "nunca aconteceu" },
  ],
  string: [
    { value: "eq", label: "= igual a" },
    { value: "ne", label: "≠ diferente de" },
    { value: "icontains", label: "contém" },
    { value: "isnull", label: "não preenchido" },
  ],
  boolean: [
    { value: "eq", label: "=" },
  ],
  tags: [
    { value: "contains", label: "tem a tag" },
  ],
};

interface ConditionRowProps {
  condition: RuleCondition;
  index: number;
  isLast: boolean;
  logicOp: "AND" | "OR";
  onChange: (index: number, condition: RuleCondition) => void;
  onDelete: (index: number) => void;
}

function ConditionRow({ condition, index, isLast, logicOp, onChange, onDelete }: ConditionRowProps) {
  const field = ALL_FIELDS.find((f) => f.value === condition.field);
  const fieldType = (field?.type as FieldType) ?? "string";
  const operators = OPERATORS_BY_TYPE[fieldType] ?? OPERATORS_BY_TYPE.string;
  const showValue = condition.operator !== "isnull";

  function handleFieldChange(newField: string) {
    const def = ALL_FIELDS.find((f) => f.value === newField);
    const newType = (def?.type as FieldType) ?? "string";
    const defaultOp = OPERATORS_BY_TYPE[newType][0].value;
    const defaultValue =
      newType === "boolean" ? true : newType === "date" ? 30 : "";
    onChange(index, { field: newField, operator: defaultOp, value: defaultValue as string | number | boolean });
  }

  function handleOperatorChange(newOp: string) {
    if (newOp === "isnull") {
      onChange(index, { ...condition, operator: newOp, value: true });
    } else {
      onChange(index, { ...condition, operator: newOp });
    }
  }

  function handleValueChange(newVal: string) {
    let parsed: string | number | boolean = newVal;
    if (fieldType === "decimal" || fieldType === "integer" || fieldType === "date") {
      parsed = newVal === "" ? 0 : Number(newVal);
    } else if (fieldType === "boolean") {
      parsed = newVal === "true";
    }
    onChange(index, { ...condition, value: parsed });
  }

  return (
    <div className="relative group">
      <div className="flex items-center gap-2 py-2">
        {/* Connector dot */}
        <div className="w-2 h-2 rounded-full bg-gold/40 shrink-0" />

        {/* Field selector */}
        <Select value={condition.field} onValueChange={handleFieldChange}>
          <SelectTrigger className="w-44 h-8 text-xs bg-white/[0.02]">
            <SelectValue placeholder="Campo..." />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {FIELD_GROUPS.map((group) => (
              <div key={group.group}>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  {group.group}
                </div>
                {group.items.map((item) => (
                  <SelectItem key={item.value} value={item.value} className="text-xs pl-4">
                    {item.label}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>

        {/* Operator selector */}
        <Select value={condition.operator} onValueChange={handleOperatorChange}>
          <SelectTrigger className="w-44 h-8 text-xs bg-white/[0.02]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op.value} value={op.value} className="text-xs">
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Value input */}
        {showValue && (
          <div className="flex items-center gap-1.5">
            {fieldType === "boolean" ? (
              <Select value={String(condition.value)} onValueChange={handleValueChange}>
                <SelectTrigger className="w-28 h-8 text-xs bg-white/[0.02]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true" className="text-xs">Sim / Verdadeiro</SelectItem>
                  <SelectItem value="false" className="text-xs">Não / Falso</SelectItem>
                </SelectContent>
              </Select>
            ) : fieldType === "date" ? (
              <>
                <Input
                  type="number"
                  value={String(condition.value)}
                  onChange={(e) => handleValueChange(e.target.value)}
                  className="w-20 h-8 text-xs font-data bg-white/[0.02]"
                  min={1}
                  placeholder="30"
                />
                <span className="text-xs text-muted-foreground shrink-0">dias</span>
              </>
            ) : (
              <>
                <Input
                  value={String(condition.value)}
                  onChange={(e) => handleValueChange(e.target.value)}
                  className="w-36 h-8 text-xs font-data bg-white/[0.02]"
                  placeholder={
                    fieldType === "decimal" || fieldType === "integer"
                      ? "1000"
                      : fieldType === "tags"
                        ? "VIP_OURO"
                        : "valor..."
                  }
                />
                {fieldType === "decimal" && (
                  <span className="text-xs text-muted-foreground shrink-0">R$</span>
                )}
              </>
            )}
          </div>
        )}

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="ml-1 p-1 rounded text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* AND / OR connector badge */}
      {!isLast && (
        <div className="ml-3 py-0.5">
          <span
            className={`text-[10px] font-data font-bold px-1.5 py-0.5 rounded border ${
              logicOp === "AND"
                ? "text-gold/70 bg-gold/5 border-gold/15"
                : "text-teal/70 bg-teal/5 border-teal/15"
            }`}
          >
            {logicOp}
          </span>
        </div>
      )}
    </div>
  );
}

interface RulesBuilderProps {
  value: SegmentRules;
  onChange: (rules: SegmentRules) => void;
  previewCount?: number | null;
  onPreviewCount?: () => void;
  isLoadingCount?: boolean;
}

export function RulesBuilder({
  value,
  onChange,
  previewCount,
  onPreviewCount,
  isLoadingCount,
}: RulesBuilderProps) {
  function addCondition() {
    onChange({
      ...value,
      conditions: [
        ...value.conditions,
        { field: "ltv", operator: "gte", value: 0 },
      ],
    });
  }

  function updateCondition(index: number, condition: RuleCondition) {
    const conditions = [...value.conditions];
    conditions[index] = condition;
    onChange({ ...value, conditions });
  }

  function deleteCondition(index: number) {
    onChange({
      ...value,
      conditions: value.conditions.filter((_, i) => i !== index),
    });
  }

  function toggleOperator() {
    onChange({ ...value, operator: value.operator === "AND" ? "OR" : "AND" });
  }

  return (
    <div className="space-y-3">
      {/* Logic operator toggle */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggleOperator}
          className={`px-3 py-1 rounded text-xs font-data font-bold border transition-all ${
            value.operator === "AND"
              ? "bg-gold/10 text-gold border-gold/30 hover:bg-gold/15"
              : "bg-teal/10 text-teal border-teal/30 hover:bg-teal/15"
          }`}
        >
          {value.operator}
        </button>
        <span className="text-xs text-muted-foreground">
          {value.operator === "AND"
            ? "Todas as condições devem ser verdadeiras"
            : "Qualquer condição deve ser verdadeira"}
        </span>
      </div>

      {/* Conditions list */}
      <div className="pl-2 border-l-2 border-border/60 min-h-[40px]">
        {value.conditions.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 py-3 pl-2 italic">
            Nenhuma condição — segmento incluirá todos os usuários
          </p>
        ) : (
          value.conditions.map((cond, i) => (
            <ConditionRow
              key={i}
              condition={cond}
              index={i}
              isLast={i === value.conditions.length - 1}
              logicOp={value.operator}
              onChange={updateCondition}
              onDelete={deleteCondition}
            />
          ))
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={addCondition}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 border border-dashed border-border/60 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar condição
        </button>

        {onPreviewCount && (
          <button
            type="button"
            onClick={onPreviewCount}
            disabled={isLoadingCount}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCount ? "animate-spin" : ""}`} />
            {previewCount !== null && previewCount !== undefined ? (
              <span>
                <span className="text-foreground font-data font-semibold">
                  {previewCount.toLocaleString("pt-BR")}
                </span>{" "}
                usuários
              </span>
            ) : (
              "Estimar audiência"
            )}
          </button>
        )}
      </div>
    </div>
  );
}
