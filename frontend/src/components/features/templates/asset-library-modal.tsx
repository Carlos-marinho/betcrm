"use client";

import { useCallback, useRef, useState } from "react";
import {
  useAssets,
  useAssetFolders,
  useUploadAsset,
  useDeleteAsset,
  useSetGlobalFooterAsset,
  type EmailAsset,
} from "@/lib/hooks";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ImageIcon,
  Upload,
  Trash2,
  Star,
  StarOff,
  Copy,
  Check,
  FolderOpen,
  Loader2,
  X,
  Plus,
  Image,
  Footprints,
  Tag,
  Images,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssetLibraryModalProps {
  open: boolean;
  onClose: () => void;
  /** Se passado, entra em modo de seleção — clique retorna o asset */
  onSelect?: (asset: EmailAsset) => void;
  /** Filtra por tipo ao abrir em modo de seleção */
  filterType?: EmailAsset["asset_type"];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ASSET_TYPES = [
  { value: "", label: "Todos", icon: Images },
  { value: "banner", label: "Banners", icon: Image },
  { value: "footer_logo", label: "Logo rodapé", icon: Footprints },
  { value: "logo", label: "Logos", icon: Tag },
  { value: "general", label: "Geral", icon: ImageIcon },
] as const;

const TYPE_LABELS: Record<string, string> = {
  banner: "Banner",
  footer_logo: "Logo rodapé",
  logo: "Logo",
  general: "Geral",
};

const TYPE_BADGE: Record<string, string> = {
  banner: "bg-gold/10 text-gold border border-gold/20",
  footer_logo: "bg-teal/10 text-teal border border-teal/20",
  logo: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  general: "bg-white/5 text-muted-foreground border border-border",
};

// ── Upload Zone ───────────────────────────────────────────────────────────────

interface UploadFormProps {
  folders: string[];
  onUploaded: () => void;
}

function UploadForm({ folders, onUploaded }: UploadFormProps) {
  const uploadMutation = useUploadAsset();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("general");
  const [folder, setFolder] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [altText, setAltText] = useState("");

  function selectFile(f: File) {
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) selectFile(f);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) selectFile(f);
  }

  async function handleUpload() {
    if (!file || !name.trim()) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name.trim());
    fd.append("asset_type", assetType);
    fd.append("folder", newFolder.trim() || folder);
    fd.append("alt_text", altText.trim());
    try {
      await uploadMutation.mutateAsync(fd);
      toast.success("Asset enviado com sucesso");
      setFile(null);
      setPreview(null);
      setName("");
      setAltText("");
      setNewFolder("");
      onUploaded();
    } catch {
      toast.error("Erro ao enviar asset");
    }
  }

  const effectiveFolder = newFolder.trim() || folder;

  return (
    <div className="space-y-4 p-4 rounded-xl border border-dashed border-border bg-white/[0.015]">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
        Upload
      </p>

      {/* Drop zone */}
      {!preview ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
            dragOver
              ? "border-gold/60 bg-gold/[0.05]"
              : "border-border hover:border-gold/30 hover:bg-white/[0.02]"
          }`}
        >
          <Upload className={`w-6 h-6 transition-colors ${dragOver ? "text-gold" : "text-muted-foreground/40"}`} />
          <p className="text-xs text-muted-foreground">
            Arraste uma imagem ou <span className="text-gold">clique para selecionar</span>
          </p>
          <p className="text-[10px] text-muted-foreground/40">PNG, JPG, GIF, WebP, SVG</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      ) : (
        <div className="relative">
          <div className="relative rounded-lg overflow-hidden bg-checkered border border-border aspect-video">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="w-full h-full object-contain" />
          </div>
          <button
            onClick={() => { setPreview(null); setFile(null); setName(""); }}
            className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {file && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do asset"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={assetType} onValueChange={setAssetType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="banner">Banner principal</SelectItem>
                  <SelectItem value="footer_logo">Logo do rodapé</SelectItem>
                  <SelectItem value="logo">Logo geral</SelectItem>
                  <SelectItem value="general">Imagem geral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Pasta{" "}
                <span className="text-muted-foreground/60 normal-case">(existente)</span>
              </Label>
              <Select value={folder} onValueChange={setFolder} disabled={!!newFolder.trim()}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem pasta</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Nova pasta{" "}
                <span className="text-muted-foreground/60 normal-case">(opcional)</span>
              </Label>
              <Input
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                placeholder="Ex: banners/natal"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Alt text{" "}
              <span className="text-muted-foreground/60 normal-case">(acessibilidade)</span>
            </Label>
            <Input
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Descrição da imagem"
            />
          </div>

          {effectiveFolder && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Será salvo em: <span className="text-foreground font-data">{effectiveFolder}</span></span>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!name.trim() || uploadMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 disabled:opacity-50 transition-colors"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {uploadMutation.isPending ? "Enviando..." : "Enviar asset"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Asset Card ────────────────────────────────────────────────────────────────

interface AssetCardProps {
  asset: EmailAsset;
  selectMode: boolean;
  onSelect?: (asset: EmailAsset) => void;
}

function AssetCard({ asset, selectMode, onSelect }: AssetCardProps) {
  const deleteMutation = useDeleteAsset();
  const setFooterMutation = useSetGlobalFooterAsset();
  const [copied, setCopied] = useState(false);

  async function handleDelete() {
    if (!confirm(`Deletar "${asset.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(asset.id);
      toast.success("Asset removido");
    } catch {
      toast.error("Erro ao remover asset");
    }
  }

  async function handleSetGlobalFooter() {
    try {
      await setFooterMutation.mutateAsync(asset.id);
      toast.success(`"${asset.name}" definido como logo padrão do rodapé`);
    } catch {
      toast.error("Erro ao definir footer global");
    }
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(asset.file_url || asset.file);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const url = asset.file_url || asset.file;

  return (
    <div
      onClick={selectMode ? () => onSelect?.(asset) : undefined}
      className={`group relative rounded-xl border overflow-hidden transition-all ${
        selectMode
          ? "cursor-pointer hover:border-gold/40 hover:shadow-[0_0_0_2px_rgba(212,175,55,0.15)]"
          : "border-border hover:border-white/20"
      } bg-white/[0.02]`}
    >
      {/* Thumbnail */}
      <div className="relative bg-checkered aspect-video overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={asset.alt_text || asset.name}
          className="w-full h-full object-contain transition-transform group-hover:scale-105"
        />

        {/* Global footer badge */}
        {asset.is_global_footer && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/90 text-[10px] font-medium text-black">
            <Star className="w-2.5 h-2.5" />
            Rodapé global
          </div>
        )}

        {/* Select overlay */}
        {selectMode && (
          <div className="absolute inset-0 bg-gold/0 group-hover:bg-gold/10 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 rounded-lg bg-gold text-primary-foreground text-xs font-medium">
              Selecionar
            </span>
          </div>
        )}

        {/* Action bar (non-select mode) */}
        {!selectMode && (
          <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/70 to-transparent">
            <button
              onClick={(e) => { e.stopPropagation(); handleCopyUrl(); }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
              title="Copiar URL"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copiado!" : "URL"}
            </button>

            {asset.asset_type === "footer_logo" && !asset.is_global_footer && (
              <button
                onClick={(e) => { e.stopPropagation(); handleSetGlobalFooter(); }}
                disabled={setFooterMutation.isPending}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-white/80 hover:text-gold bg-white/10 hover:bg-gold/20 transition-colors"
                title="Definir como logo padrão do rodapé"
              >
                <StarOff className="w-3 h-3" />
                Definir padrão
              </button>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              disabled={deleteMutation.isPending}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs text-white/80 hover:text-red-400 bg-white/10 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{asset.name}</p>
            {asset.folder && (
              <div className="flex items-center gap-1 mt-0.5">
                <FolderOpen className="w-2.5 h-2.5 text-muted-foreground/40 shrink-0" />
                <p className="text-[10px] font-data text-muted-foreground/60 truncate">
                  {asset.folder}
                </p>
              </div>
            )}
          </div>
          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[asset.asset_type] ?? TYPE_BADGE.general}`}>
            {TYPE_LABELS[asset.asset_type] ?? asset.asset_type}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Folder sidebar ─────────────────────────────────────────────────────────────

interface FolderSidebarProps {
  folders: string[];
  activeFolder: string;
  onSelect: (folder: string) => void;
}

function FolderSidebar({ folders, activeFolder, onSelect }: FolderSidebarProps) {
  return (
    <div className="w-40 shrink-0 border-r border-border pr-3 space-y-0.5">
      <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-2 px-2">
        Pastas
      </p>
      <button
        onClick={() => onSelect("")}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
          activeFolder === ""
            ? "bg-gold/10 text-gold"
            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
        }`}
      >
        <Images className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">Todos</span>
      </button>

      {folders.map((folder) => (
        <button
          key={folder}
          onClick={() => onSelect(folder)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
            activeFolder === folder
              ? "bg-gold/10 text-gold"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate" title={folder}>{folder}</span>
        </button>
      ))}

      {folders.length === 0 && (
        <p className="px-2 text-[10px] text-muted-foreground/40 italic">Nenhuma pasta</p>
      )}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export function AssetLibraryModal({
  open,
  onClose,
  onSelect,
  filterType,
}: AssetLibraryModalProps) {
  const selectMode = !!onSelect;

  const [typeFilter, setTypeFilter] = useState<string>(filterType ?? "");
  const [folderFilter, setFolderFilter] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  const { data, isLoading, refetch } = useAssets({
    asset_type: typeFilter || undefined,
    folder: folderFilter || undefined,
  });
  const { data: folders = [] } = useAssetFolders();

  const assets = data?.results ?? [];

  const handleClose = useCallback(() => {
    setTypeFilter(filterType ?? "");
    setFolderFilter("");
    setShowUpload(false);
    onClose();
  }, [onClose, filterType]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-gold" />
                </div>
                Biblioteca de Assets
                {selectMode && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-teal/10 text-teal border border-teal/20">
                    Selecionar
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {selectMode
                  ? "Clique em uma imagem para selecioná-la"
                  : "Gerencie imagens reutilizáveis para seus emails"}
              </DialogDescription>
            </div>
            {!selectMode && (
              <button
                onClick={() => setShowUpload((v) => !v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  showUpload
                    ? "bg-gold text-primary-foreground"
                    : "bg-white/5 text-muted-foreground hover:text-foreground border border-border hover:border-gold/30"
                }`}
              >
                {showUpload ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {showUpload ? "Fechar upload" : "Novo asset"}
              </button>
            )}
          </div>

          {/* Type filter tabs */}
          <div className="flex items-center gap-1 mt-4 bg-card border border-border rounded-lg p-1 w-fit">
            {ASSET_TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTypeFilter(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  typeFilter === value
                    ? "bg-gold/10 text-gold border border-gold/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Folder sidebar */}
          <div className="shrink-0 w-44 border-r border-border p-4 overflow-y-auto">
            <FolderSidebar
              folders={folders}
              activeFolder={folderFilter}
              onSelect={setFolderFilter}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Upload form */}
            {showUpload && !selectMode && (
              <UploadForm
                folders={folders}
                onUploaded={() => { refetch(); setShowUpload(false); }}
              />
            )}

            {/* Loading */}
            {isLoading && (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border overflow-hidden">
                    <div className="aspect-video shimmer-bg" />
                    <div className="p-3 space-y-1.5">
                      <div className="h-3 shimmer-bg rounded w-3/4" />
                      <div className="h-2.5 shimmer-bg rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!isLoading && assets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-border flex items-center justify-center mb-4">
                  <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Nenhum asset encontrado</p>
                <p className="text-xs text-muted-foreground mb-4">
                  {typeFilter || folderFilter
                    ? "Tente remover os filtros ou fazer upload de uma imagem."
                    : "Faça upload da primeira imagem para começar."}
                </p>
                {!selectMode && (
                  <button
                    onClick={() => setShowUpload(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Enviar asset
                  </button>
                )}
              </div>
            )}

            {/* Grid */}
            {!isLoading && assets.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {assets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    selectMode={selectMode}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <div className="flex items-center justify-between w-full">
            <p className="text-xs text-muted-foreground">
              {assets.length > 0 && `${data?.count ?? assets.length} asset${(data?.count ?? assets.length) !== 1 ? "s" : ""}`}
            </p>
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 border border-border transition-colors"
            >
              Fechar
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
