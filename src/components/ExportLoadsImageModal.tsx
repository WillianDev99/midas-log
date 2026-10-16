import React, { useState, useRef, useEffect, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  Download, 
  Copy, 
  Check, 
  Share2, 
  Sparkles, 
  Image as ImageIcon, 
  Loader2, 
  Layers, 
  FileDown,
  CheckCircle2
} from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

export const BRAZIL_STATES: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins'
};

interface ExternalLoad {
  id: string;
  data: string;
  rota: string;
  entregas: string;
  uf: string;
  peso: string;
  frete: string;
  observacoes: string;
  status: string;
  parsedDeliveries?: any[];
  totalToPay?: number;
  manualDeliveryCount?: number;
  useEqualizationTable?: boolean;
  manualVehicleType?: string;
  complementaryValue?: number;
}

interface ExportLoadsImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loads: ExternalLoad[];
  getVehicleType: (load: ExternalLoad) => string;
  formatWeight: (peso: string | number) => string;
}

export const ExportLoadsImageModal: React.FC<ExportLoadsImageModalProps> = ({
  open,
  onOpenChange,
  loads,
  getVehicleType,
  formatWeight
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'state' | 'all'>('presets');
  const [selectedPreset, setSelectedPreset] = useState<'MA' | 'CE_PI' | 'OUTROS'>('MA');
  const [selectedState, setSelectedState] = useState<string>('MA');
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string>('/logo.png');

  const renderSheetRef = useRef<HTMLDivElement>(null);

  // Precarrega o logotipo como base64 para evitar quaisquer falhas de CORS no html2canvas
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const res = await fetch('/logo.png');
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setLogoBase64(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.warn('Não foi possível converter logo para base64, usando URL direta:', err);
      }
    };
    fetchLogo();
  }, []);

  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR');
  }, []);

  const todaySlug = useMemo(() => {
    return todayStr.replace(/\//g, '-');
  }, [todayStr]);

  // Lista de UFs disponíveis nas cargas
  const availableUFs = useMemo(() => {
    const ufs = new Set<string>();
    loads.forEach(l => {
      if (l.uf) ufs.add(l.uf.trim().toUpperCase());
    });
    return Array.from(ufs).sort();
  }, [loads]);

  useEffect(() => {
    if (availableUFs.length > 0 && !availableUFs.includes(selectedState)) {
      setSelectedState(availableUFs[0]);
    }
  }, [availableUFs, selectedState]);

  // Definições dos 3 Padrões Fixos
  const presetDefinitions = useMemo(() => [
    {
      id: 'MA' as const,
      name: 'Maranhão',
      shortLabel: 'MA',
      caption: `Cargas Hidracor ${todayStr}, Maranhão`,
      filename: `cargas-hidracor-maranhao-${todaySlug}.png`,
      filterFn: (l: ExternalLoad) => (l.uf || '').trim().toUpperCase() === 'MA'
    },
    {
      id: 'CE_PI' as const,
      name: 'Ceará e Piauí',
      shortLabel: 'CE e PI',
      caption: `Cargas Hidracor ${todayStr}, Ceará e Piauí`,
      filename: `cargas-hidracor-ceara-piaui-${todaySlug}.png`,
      filterFn: (l: ExternalLoad) => ['CE', 'PI'].includes((l.uf || '').trim().toUpperCase())
    },
    {
      id: 'OUTROS' as const,
      name: 'Outros Estados',
      shortLabel: 'Exceto CE, PI, MA, AL',
      caption: `Cargas Hidracor ${todayStr}, Outros Estados`,
      filename: `cargas-hidracor-outros-estados-${todaySlug}.png`,
      // Todas as UFs com exceção do CE, PI, MA e AL conforme solicitado pelo usuário
      filterFn: (l: ExternalLoad) => !['CE', 'PI', 'MA', 'AL'].includes((l.uf || '').trim().toUpperCase())
    }
  ], [todayStr, todaySlug]);

  // Cargas do grupo atualmente selecionado para renderização
  const currentExportData = useMemo(() => {
    if (activeTab === 'presets') {
      const p = presetDefinitions.find(x => x.id === selectedPreset);
      const items = loads.filter(p ? p.filterFn : () => true);
      return {
        title: p?.name || 'Padrão',
        caption: p?.caption || `Cargas Hidracor ${todayStr}`,
        filename: p?.filename || `cargas-hidracor-${todaySlug}.png`,
        items
      };
    }

    if (activeTab === 'state') {
      const stateName = BRAZIL_STATES[selectedState] || selectedState;
      const items = loads.filter(l => (l.uf || '').trim().toUpperCase() === selectedState);
      return {
        title: stateName,
        caption: `Cargas Hidracor ${todayStr}, ${stateName}`,
        filename: `cargas-hidracor-${selectedState.toLowerCase()}-${todaySlug}.png`,
        items
      };
    }

    // activeTab === 'all' (Todas as cargas exibidas)
    return {
      title: 'Todas as Cargas',
      caption: `Cargas Hidracor ${todayStr}`,
      filename: `cargas-hidracor-todas-${todaySlug}.png`,
      items: loads
    };
  }, [activeTab, selectedPreset, selectedState, presetDefinitions, loads, todayStr, todaySlug]);

  // Função para gerar o Canvas através do elemento escondido
  const generateCanvas = async (targetElement: HTMLElement): Promise<HTMLCanvasElement> => {
    return await html2canvas(targetElement, {
      scale: 2, // 2x para garantir nitidez ultra cristalina em telas retina e no WhatsApp
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: true
    });
  };

  // 1. Baixar a Imagem PNG
  const handleDownloadImage = async () => {
    if (!renderSheetRef.current) return;
    setGenerating(true);
    try {
      const canvas = await generateCanvas(renderSheetRef.current);
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = currentExportData.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showSuccess(`Imagem "${currentExportData.filename}" baixada com sucesso!`);
    } catch (err: any) {
      showError("Erro ao gerar imagem: " + (err.message || err));
    } finally {
      setGenerating(false);
    }
  };

  // 2. Copiar a Imagem para o Clipboard (Ctrl+V direto no WhatsApp Web)
  const handleCopyImage = async () => {
    if (!renderSheetRef.current) return;
    setGenerating(true);
    try {
      const canvas = await generateCanvas(renderSheetRef.current);
      canvas.toBlob(async (blob) => {
        if (!blob) {
          showError("Falha ao gerar arquivo de imagem.");
          setGenerating(false);
          return;
        }

        if (navigator.clipboard && window.ClipboardItem) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setCopiedImage(true);
            setTimeout(() => setCopiedImage(false), 2500);
            showSuccess("Imagem copiada! Basta dar Ctrl+V na conversa do WhatsApp.");
          } catch (clipErr) {
            // Em caso de bloqueio pelo navegador, faz o download automático como fallback
            handleDownloadImage();
          }
        } else {
          handleDownloadImage();
        }
        setGenerating(false);
      }, 'image/png');
    } catch (err: any) {
      showError("Erro ao copiar imagem: " + (err.message || err));
      setGenerating(false);
    }
  };

  // 3. Copiar a Legenda Padrão (ex: "Cargas Hidracor 16/10/2026, Maranhão")
  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(currentExportData.caption);
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2500);
      showSuccess(`Texto copiado: "${currentExportData.caption}"`);
    } catch (err) {
      showError("Erro ao copiar texto.");
    }
  };

  // 4. Baixar Imagem + Copiar Texto Simultaneamente (1 Clique!)
  const handleDownloadAndCopyText = async () => {
    await handleCopyCaption();
    await handleDownloadImage();
  };

  // 5. Compartilhar Direto (Nativo do Celular / WhatsApp)
  const handleShareNative = async () => {
    if (!renderSheetRef.current) return;
    setGenerating(true);
    try {
      const canvas = await generateCanvas(renderSheetRef.current);
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], currentExportData.filename, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                title: currentExportData.caption,
                text: currentExportData.caption,
                files: [file]
              });
              setGenerating(false);
              return;
            } catch (shareErr) {
              // Usuário cancelou ou fechou a gaveta de compartilhamento
            }
          }
        }

        // Fallback: copia o texto e abre WhatsApp
        await navigator.clipboard.writeText(currentExportData.caption);
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(currentExportData.caption)}`, '_blank');
        setGenerating(false);
      }, 'image/png');
    } catch (err) {
      setGenerating(false);
    }
  };

  // 6. Baixar Todos os 3 Padrões Salvos de uma vez só!
  const handleDownloadAllPresets = async () => {
    setBatchGenerating(true);
    try {
      for (const preset of presetDefinitions) {
        // Renderiza temporariamente cada grupo
        setSelectedPreset(preset.id);
        setActiveTab('presets');
        // Pequena pausa para garantir a montagem do DOM
        await new Promise(r => setTimeout(r, 200));

        if (renderSheetRef.current) {
          const canvas = await generateCanvas(renderSheetRef.current);
          const dataUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = preset.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      }
      showSuccess("As 3 imagens padrão foram geradas e baixadas com sucesso!");
    } catch (err: any) {
      showError("Erro ao baixar os 3 padrões: " + (err.message || err));
    } finally {
      setBatchGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-4xl max-h-[92dvh] p-3 sm:p-6 overflow-y-auto rounded-xl">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <ImageIcon size={20} />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                Exportar Cargas como Imagem
                <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-emerald-50 text-[10px] font-bold">
                  WhatsApp
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Baixe as imagens formatadas no padrão Midas Log e copie a legenda com data e estado para envio.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Abas de Modo: Padrões Salvos (MA, CE/PI, Outros) vs. Estado Específico */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full mt-2">
          <TabsList className="grid grid-cols-3 w-full h-9 bg-slate-100 p-0.5">
            <TabsTrigger value="presets" className="text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700">
              <Sparkles size={13} className="text-amber-500" />
              <span>Padrões Salvos</span>
            </TabsTrigger>
            <TabsTrigger value="state" className="text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700">
              <Layers size={13} />
              <span>Por Estado (UF)</span>
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700">
              <span>Todas as Cargas</span>
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: PADRÕES SALVOS */}
          <TabsContent value="presets" className="space-y-3 mt-3">
            {/* Seletor dos 3 Padrões Salvos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {presetDefinitions.map((preset) => {
                const count = loads.filter(preset.filterFn).length;
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer relative ${
                      isSelected 
                        ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-400/40 shadow-xs' 
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900">{preset.name}</span>
                      <Badge variant="outline" className={`text-[10px] font-black ${isSelected ? 'border-emerald-400 text-emerald-800 bg-white' : 'border-slate-200 text-slate-600'}`}>
                        {count} {count === 1 ? 'carga' : 'cargas'}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{preset.shortLabel}</div>
                    {isSelected && (
                      <CheckCircle2 size={14} className="text-emerald-600 absolute right-2 bottom-2" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Ação em lote: Baixar os 3 Padrões de uma vez */}
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="text-xs text-slate-600">
                <span className="font-bold text-slate-900">Quer agilidade? </span>
                Baixe as 3 imagens padrão (Maranhão, Ceará/Piauí e Outros) em sequência:
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadAllPresets}
                disabled={batchGenerating}
                className="h-7 text-xs gap-1.5 border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-bold shrink-0"
              >
                {batchGenerating ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
                Baixar Todos os 3 Padrões
              </Button>
            </div>
          </TabsContent>

          {/* ABA 2: POR ESTADO ESPECÍFICO */}
          <TabsContent value="state" className="space-y-3 mt-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-xs font-bold text-slate-700 whitespace-nowrap">
                Selecione o Estado:
              </div>
              <div className="w-full sm:w-72">
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger className="h-8 text-xs bg-white font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUFs.map(uf => {
                      const count = loads.filter(l => (l.uf || '').trim().toUpperCase() === uf).length;
                      const name = BRAZIL_STATES[uf] || uf;
                      return (
                        <SelectItem key={uf} value={uf} className="text-xs font-semibold">
                          {uf} - {name} ({count} {count === 1 ? 'carga' : 'cargas'})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs text-slate-500">
                Total de <strong>{currentExportData.items.length}</strong> cargas em {BRAZIL_STATES[selectedState] || selectedState}.
              </span>
            </div>
          </TabsContent>

          {/* ABA 3: TODAS AS CARGAS */}
          <TabsContent value="all" className="mt-3">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
              Exportando a totalidade de <strong>{loads.length} cargas</strong> atualmente carregadas no sistema.
            </div>
          </TabsContent>
        </Tabs>

        {/* Bloco de Legenda Padrão para o WhatsApp */}
        <div className="mt-3 p-3 bg-emerald-50/80 rounded-lg border border-emerald-200">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[10px] font-black uppercase text-emerald-900 tracking-wider flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-700" />
              Texto Padrão para envio no WhatsApp:
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopyCaption}
              className="h-6 px-2 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
            >
              {copiedCaption ? <Check size={12} className="mr-1 text-emerald-600" /> : <Copy size={12} className="mr-1" />}
              {copiedCaption ? "Copiado!" : "Copiar Texto"}
            </Button>
          </div>
          <div className="bg-white px-3 py-2 rounded-md border border-emerald-300 font-mono text-xs sm:text-sm font-bold text-slate-900 flex items-center justify-between select-all">
            <span>{currentExportData.caption}</span>
          </div>
        </div>

        {/* Botões de Ação Principais */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {/* Botão Principal: Baixar Imagem + Copiar Legenda */}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleDownloadAndCopyText}
            disabled={generating || currentExportData.items.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 text-xs gap-1.5 shadow-xs flex-1 sm:flex-initial"
            title="Faz o download do PNG e copia a legenda para a área de transferência"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            <span>Baixar Imagem + Copiar Legenda</span>
          </Button>

          {/* Copiar Imagem (Ctrl+V direto no WhatsApp Web) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyImage}
            disabled={generating || currentExportData.items.length === 0}
            className="h-9 text-xs gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold flex-1 sm:flex-initial"
            title="Copia a imagem para o clipboard para colar direto no WhatsApp Web (Ctrl+V)"
          >
            {copiedImage ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            <span>{copiedImage ? "Imagem Copiada!" : "Copiar Imagem"}</span>
          </Button>

          {/* Baixar apenas Imagem */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadImage}
            disabled={generating || currentExportData.items.length === 0}
            className="h-9 text-xs gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
          >
            <Download size={14} />
            <span>Apenas Imagem</span>
          </Button>

          {/* Compartilhar (Nativo Mobile) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShareNative}
            disabled={generating || currentExportData.items.length === 0}
            className="h-9 text-xs gap-1.5 border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 font-semibold"
          >
            <Share2 size={14} />
            <span>Compartilhar</span>
          </Button>
        </div>

        {/* Pré-visualização da Folha / Imagem a ser gerada */}
        <div className="mt-3">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Pré-visualização da Imagem ({currentExportData.items.length} {currentExportData.items.length === 1 ? 'carga' : 'cargas'}):</span>
            <span className="text-[10px] text-slate-400 font-normal">Resolução de alta fidelidade (2x)</span>
          </div>

          {currentExportData.items.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500">
              Nenhuma carga encontrada para este filtro no momento.
            </div>
          ) : (
            <div className="border border-slate-300 rounded-lg overflow-x-auto bg-slate-200/50 p-2 sm:p-4 max-h-[48vh] overflow-y-auto">
              {/* O Container Real que será capturado pelo html2canvas com largura fixa para manter o design exato */}
              <div 
                ref={renderSheetRef}
                className="bg-white mx-auto shadow-md"
                style={{
                  width: '860px',
                  backgroundColor: '#ffffff',
                  padding: '28px 32px',
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#1e293b',
                  boxSizing: 'border-box'
                }}
              >
                {/* Cabeçalho */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px' }}>
                  <img 
                    src={logoBase64} 
                    alt="Midas Log" 
                    crossOrigin="anonymous"
                    style={{ height: '56px', width: 'auto', objectFit: 'contain' }} 
                  />
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
                    Cargas Disponíveis
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '13px' }}>Midas Logística</div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>{todayStr}</div>
                  </div>
                </div>

                {/* Linha Dourada divisória */}
                <div style={{ width: '100%', height: '3px', backgroundColor: '#f59e0b', marginBottom: '16px', borderRadius: '2px' }} />

                {/* Tabela de Cargas idêntica ao modelo de impressão/imagem */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <th style={{ width: '48%', padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', border: '1px solid #e2e8f0' }}>ROTA</th>
                      <th style={{ width: '9%', padding: '10px 6px', textAlign: 'center', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', border: '1px solid #e2e8f0' }}>ENTREGAS</th>
                      <th style={{ width: '7%', padding: '10px 6px', textAlign: 'center', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', border: '1px solid #e2e8f0' }}>UF</th>
                      <th style={{ width: '14%', padding: '10px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', border: '1px solid #e2e8f0' }}>PESO TOTAL</th>
                      <th style={{ width: '12%', padding: '10px 6px', textAlign: 'center', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', border: '1px solid #e2e8f0' }}>VEÍCULO</th>
                      <th style={{ width: '10%', padding: '10px 6px', textAlign: 'center', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', border: '1px solid #e2e8f0' }}>FRETE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentExportData.items.map((load, idx) => (
                      <tr key={load.id || idx} style={{ backgroundColor: '#ffffff' }}>
                        <td style={{ padding: '9px 12px', fontSize: '11px', fontWeight: '700', color: '#0f172a', lineHeight: '1.4', border: '1px solid #e2e8f0' }}>
                          {load.rota}
                        </td>
                        <td style={{ padding: '9px 6px', fontSize: '12px', fontWeight: '600', color: '#334155', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                          {load.entregas}
                        </td>
                        <td style={{ padding: '9px 6px', fontSize: '12px', fontWeight: '800', color: '#0f172a', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                          {load.uf}
                        </td>
                        <td style={{ padding: '9px 10px', fontSize: '12px', fontWeight: '600', color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap', border: '1px solid #e2e8f0' }}>
                          {formatWeight(load.peso)}
                        </td>
                        <td style={{ padding: '9px 6px', fontSize: '11px', fontWeight: '800', color: '#0f172a', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                          {getVehicleType(load)}
                        </td>
                        <td style={{ padding: '9px 6px', fontSize: '11px', fontWeight: '700', color: '#334155', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                          {load.frete}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Rodapé */}
                <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                  © {new Date().getFullYear()} Midas Logística - Eficiência em Movimento
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t mt-3 flex justify-end">
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            onClick={() => onOpenChange(false)} 
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
