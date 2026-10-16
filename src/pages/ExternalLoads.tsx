"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
  RefreshCw, 
  Download, 
  Filter, 
  Calculator, 
  Loader2, 
  ChevronUp, 
  ChevronDown,
  Eye,
  Plus,
  History,
  Save,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Printer,
  Search,
  Trash2,
  FileText,
  Bookmark,
  ArrowRightLeft,
  Bell,
  BellRing,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Volume2,
  VolumeX,
  Clock,
  ArrowRight,
  Check,
  LayoutGrid,
  Table as TableIcon,
  MoreVertical,
  Smartphone,
  Image as ImageIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { ExportLoadsImageModal } from '@/components/ExportLoadsImageModal';

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
  seguradoraEnteredAt?: string;
  seguradoraAlerted2h?: boolean;
}

const getLoadKey = (l: { rota?: string; observacoes?: string; data?: string; id?: string }) => {
  const obs = (l.observacoes || '').trim().toUpperCase();
  const rota = (l.rota || '').trim().toUpperCase();
  const data = (l.data || '').trim();
  if (obs) return `${obs}__${rota}`;
  return `${data}__${rota}`;
};

const playNotificationSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.1); // A5
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([150, 80, 150]);
    }
  } catch (e) {
    console.log("Audio notification not supported:", e);
  }
};

const playWarningSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(880, now + 0.12);
    osc.frequency.setValueAtTime(440, now + 0.24);
    osc.frequency.setValueAtTime(880, now + 0.36);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([300, 100, 300, 100, 400]);
    }
  } catch (e) {
    console.log("Audio warning error:", e);
  }
};

const getStoredSeguradoraTimestamps = (): Record<string, { enteredAt: string; alerted2h?: boolean }> => {
  try {
    const data = localStorage.getItem('midas_seguradora_timestamps_v1');
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
};

const saveStoredSeguradoraTimestamps = (map: Record<string, { enteredAt: string; alerted2h?: boolean }>) => {
  try {
    localStorage.setItem('midas_seguradora_timestamps_v1', JSON.stringify(map));
  } catch (e) {
    console.error("Erro ao salvar timestamps no localStorage:", e);
  }
};

const sendDesktopNotification = (title: string, body: string) => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: "/logo.png"
      });
    } catch (e) {
      console.log("Desktop notification error:", e);
    }
  }
};

const ExternalLoads = () => {
  const { user } = useAuth();
  const [currentLoads, setCurrentLoads] = useState<ExternalLoad[]>([]);
  const [previousLoads, setPreviousLoads] = useState<ExternalLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'current' | 'previous'>('current');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [selectedUFs, setSelectedUFs] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });
  const [freightTables, setFreightTables] = useState<{ cif: any[], fob: any[], equalization: any[], special: any[] }>({ cif: [], fob: [], equalization: [], special: [] });
  const [manualSearch, setManualSearch] = useState("");
  // Modo de exibição: Cards (perfeito para iPhone XR/Mobile) ou Tabela (Desktop)
  const [displayMode, setDisplayMode] = useState<'cards' | 'table'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return 'cards';
    return 'table';
  });
  const [selectedDetailLoad, setSelectedDetailLoad] = useState<ExternalLoad | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Desbloqueio de áudio para iPhone XR / iOS Safari no primeiro toque
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') {
            ctx.resume();
          }
        }
      } catch (e) {}
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('click', unlockAudio);
    };

    window.addEventListener('touchstart', unlockAudio, { once: true });
    window.addEventListener('click', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('click', unlockAudio);
    };
  }, []);

  // Sistema de Notificações & Monitoramento de Mudanças
  const [quickStatusFilter, setQuickStatusFilter] = useState<'ALL' | 'NEW' | 'AGENCIANDO' | 'SEGURADORA' | 'SEGURADORA_OVERDUE' | 'CONTRATADO'>('ALL');
  const [newLoadKeys, setNewLoadKeys] = useState<Set<string>>(new Set());
  const [statusChangedKeys, setStatusChangedKeys] = useState<Record<string, { oldStatus: string; newStatus: string }>>({});
  const [showChangesModal, setShowChangesModal] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(180); // 3 minutos por padrão
  const [lastCheckTime, setLastCheckTime] = useState<string>('');
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      showError("Seu navegador não suporta notificações de área de trabalho.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setHasNotificationPermission(true);
        showSuccess("Notificações no Windows/Navegador ativadas!");
        sendDesktopNotification("Midas Logística", "Notificações ativadas! Você será avisado quando houver novas cargas ou mudanças de status.");
      } else {
        showError("Permissão de notificação negada no navegador.");
      }
    } catch (e: any) {
      showError("Erro ao solicitar permissão: " + e.message);
    }
  };

  const currentLoadsRef = useRef<ExternalLoad[]>([]);
  useEffect(() => {
    currentLoadsRef.current = currentLoads;
  }, [currentLoads]);

  // Timer e monitoramento em tempo real do tempo na seguradora (Limite de 2h)
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  const getSeguradoraTimeInfo = (load: ExternalLoad) => {
    if (!load.seguradoraEnteredAt) return null;
    const entered = new Date(load.seguradoraEnteredAt);
    if (isNaN(entered.getTime())) return null;

    const diffMs = Math.max(0, currentTime - entered.getTime());
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const isOverdue = totalMinutes >= 120; // 2 horas limite

    const enteredFormatted = entered.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const timeElapsedStr = hours > 0 ? `${hours}h ${minutes.toString().padStart(2, '0')}m` : `${minutes}m`;

    return {
      enteredFormatted,
      timeElapsedStr,
      totalMinutes,
      isOverdue
    };
  };

  const handleEditSeguradoraTime = (load: ExternalLoad) => {
    const currentInfo = getSeguradoraTimeInfo(load);
    const defaultVal = currentInfo ? currentInfo.enteredFormatted : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const userTime = prompt(`Informe o horário em que a carga entrou na seguradora (HH:mm):\nExemplo: 09:30`, defaultVal);
    if (!userTime) return;

    const parts = userTime.trim().split(':');
    if (parts.length < 2 || isNaN(Number(parts[0])) || isNaN(Number(parts[1]))) {
      showError("Formato de hora inválido. Use HH:mm (ex: 10:30)");
      return;
    }

    const h = Number(parts[0]);
    const m = Number(parts[1]);
    const d = new Date();
    d.setHours(h, m, 0, 0);

    if (d.getTime() > Date.now()) {
      d.setDate(d.getDate() - 1);
    }

    const isoTime = d.toISOString();
    const key = getLoadKey(load);

    const stored = getStoredSeguradoraTimestamps();
    stored[key] = { enteredAt: isoTime, alerted2h: false };
    saveStoredSeguradoraTimestamps(stored);

    handleUpdateLoad(load.id, { seguradoraEnteredAt: isoTime, seguradoraAlerted2h: false });
    showSuccess(`Horário da seguradora ajustado para ${userTime}!`);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);

      const storedTimestamps = getStoredSeguradoraTimestamps();
      let updatedAny = false;

      currentLoadsRef.current.forEach(load => {
        const isSeguradora = normalizeText(load.status).includes('seguradora');
        if (isSeguradora && load.seguradoraEnteredAt) {
          const enteredMs = new Date(load.seguradoraEnteredAt).getTime();
          const elapsedMinutes = Math.floor((now - enteredMs) / (1000 * 60));

          if (elapsedMinutes >= 120 && !load.seguradoraAlerted2h) {
            load.seguradoraAlerted2h = true;
            updatedAny = true;

            const key = getLoadKey(load);
            if (storedTimestamps[key]) {
              storedTimestamps[key].alerted2h = true;
            }

            if (soundEnabled) {
              playWarningSound();
            }

            const alertTitle = "🚨 TEMPO LIMITE EXCEDIDO (2H) - SEGURADORA";
            const alertMsg = `Atenção: A carga "${load.rota}" está há mais de 2 horas na seguradora!`;
            sendDesktopNotification(alertTitle, alertMsg);
            showError(`🚨 LIMITE 2H EXCEDIDO: ${load.rota} está há mais de 2 horas na seguradora!`);
          }
        }
      });

      if (updatedAny) {
        saveStoredSeguradoraTimestamps(storedTimestamps);
        setCurrentLoads([...currentLoadsRef.current]);
      }
    }, 15000);

    return () => clearInterval(timer);
  }, [soundEnabled]);

  const SHEET_URL = "https://docs.google.com/spreadsheets/d/1_84-QjABx4I97rSUPIA1bNkZkZ3hVkdjM4fzc5o_Who/export?format=xlsx";
  const VIEW_SHEET_URL = "https://docs.google.com/spreadsheets/d/1_84-QjABx4I97rSUPIA1bNkZkZ3hVkdjM4fzc5o_Who/edit";
  const TAX_RATE = 0.14; // Imposto de 14%

  useEffect(() => {
    const init = async () => {
      await loadFreightTables();
      await fetchSavedLoads();
    };
    init();
  }, []);

  const normalizeText = (text: string) => {
    if (!text) return "";
    return text.toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseValue = (val: any) => {
    if (typeof val === 'number') return val;
    const str = String(val || '0').replace('R$', '').trim();
    if (str.includes(',')) {
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return parseFloat(str) || 0;
  };

  const parseWeightNumber = (weight: string | number): number => {
    if (typeof weight === 'number') return weight;
    const str = String(weight || '0').trim();
    if (str.includes(',')) {
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
  };

  const formatWeight = (weight: string | number): string => {
    const num = parseWeightNumber(weight);
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg';
  };

  const VEHICLE_OPTIONS = [
    'TRUCK',
    'BITRUCK',
    'CARRETA',
    'BITREM',
    'RODOTREM 3 TAMPAS',
    'RODOTREM 4 TAMPAS'
  ];

  const getVehicleType = (load: ExternalLoad | { peso: string | number; manualVehicleType?: string } | string | number): string => {
    if (typeof load === 'object' && load !== null) {
      if (load.manualVehicleType && load.manualVehicleType !== 'AUTO') {
        return load.manualVehicleType;
      }
      return getVehicleType(load.peso);
    }
    const num = parseWeightNumber(load);
    const ton = num / 1000;
    if (ton < 18) return 'TRUCK';
    if (ton <= 22) return 'BITRUCK';
    if (ton <= 30) return 'CARRETA';
    if (ton <= 38) return 'BITREM';
    if (ton <= 40) return 'RODOTREM 3 TAMPAS';
    return 'RODOTREM 4 TAMPAS';
  };

  const loadFreightTables = async () => {
    try {
      const response = await fetch('/TABELA_MIDAS_2025.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      
      const cifSheet = workbook.Sheets[workbook.SheetNames[0]];
      const cifData = XLSX.utils.sheet_to_json(cifSheet, { header: 'A' });
      
      const fobSheet = workbook.Sheets[workbook.SheetNames[1]];
      const fobData = XLSX.utils.sheet_to_json(fobSheet, { header: 'A' });

      const cleanCIF = cifData.filter((row: any) => {
        const city = String(row['B'] || '');
        return city && normalizeText(city) !== 'municipio' && normalizeText(city) !== 'cidade' && normalizeText(city) !== 'cod';
      });

      const cleanFOB = fobData.filter((row: any) => {
        const city = String(row['A'] || '');
        return city && normalizeText(city) !== 'municipio' && normalizeText(city) !== 'cidade' && city !== 'undefined';
      });

      const eqResponse = await fetch('/TABELA_EQUALIZACAO.xlsx');
      const eqArrayBuffer = await eqResponse.arrayBuffer();
      const eqWorkbook = XLSX.read(eqArrayBuffer, { type: 'buffer' });
      const eqSheet = eqWorkbook.Sheets[eqWorkbook.SheetNames[0]];
      const eqData = XLSX.utils.sheet_to_json(eqSheet, { header: 'A' });

      const cleanEQ = eqData.filter((row: any) => {
        const city = String(row['B'] || '');
        return city && normalizeText(city) !== 'municipio' && normalizeText(city) !== 'cidade' && normalizeText(city) !== 'cod';
      });

      // Carregar Clientes Especiais
      let cleanSpecial: any[] = [];
      try {
        const spResponse = await fetch('/Clientes Especiais Hidracor.XLSM');
        const spArrayBuffer = await spResponse.arrayBuffer();
        const spWorkbook = XLSX.read(spArrayBuffer, { type: 'buffer' });
        const spSheet = spWorkbook.Sheets[spWorkbook.SheetNames[0]];
        const spData = XLSX.utils.sheet_to_json(spSheet, { header: 'A' });
        cleanSpecial = spData.filter((row: any) => {
          const client = String(row['A'] || '');
          return client && normalizeText(client) !== 'cliente';
        });
      } catch (e) {
        console.error("Erro ao carregar clientes especiais:", e);
      }

      setFreightTables({ cif: cleanCIF, fob: cleanFOB, equalization: cleanEQ, special: cleanSpecial });
    } catch (error) {
      console.error("Erro ao carregar tabelas de frete:", error);
    }
  };

  const getAliquot = (city: string, uf: string, type: string, weight: number, useEqualization: boolean = false, totalDeliveries: number = 1) => {
    const normCity = normalizeText(city);
    const cleanUF = uf.substring(0, 2).toUpperCase();

    if (type === 'FOB') {
      const matches = freightTables.fob.filter(row => normalizeText(String(row['A'] || '')) === normCity);
      const entry = matches.length === 1 ? matches[0] : matches.find(row => String(row['B'] || '').toUpperCase().includes(cleanUF));
      
      if (!entry) return 0;

      // Valores FOB na planilha são por KG, não divide por 1000
      if (weight <= 3000) return parseValue(entry['C']);
      if (weight <= 14000) return parseValue(entry['F']);
      return parseValue(entry['I']);
    }

    if (useEqualization) {
      const matches = freightTables.equalization.filter(row => normalizeText(String(row['B'] || '')) === normCity);
      const entry = matches.length === 1 ? matches[0] : matches.find(row => String(row['E'] || '').toUpperCase().includes(cleanUF));

      if (!entry) return 0;

      let col = 'F';
      if (totalDeliveries >= 2 && totalDeliveries <= 3) col = 'G';
      else if (totalDeliveries >= 4 && totalDeliveries <= 10) col = 'H';
      else if (totalDeliveries > 10) col = 'I';

      const val = parseValue(entry[col as keyof typeof entry]);
      return val / 1000;
    }

    // CIF Cliente Comum (Busca por cidade na tabela BASE CIF)
    const matches = freightTables.cif.filter(row => normalizeText(String(row['B'] || '')) === normCity);
    const entry = matches.length === 1 ? matches[0] : matches.find(row => String(row['E'] || '').toUpperCase().includes(cleanUF));
    
    if (!entry) return 0;

    // Regra Tabela CIF Comum:
    // Até 7 ton -> Coluna I
    // Até 17 ton -> Coluna J
    // Acima de 17 ton -> Coluna K
    if (weight <= 7000) return parseValue(entry['I']) / 1000; 
    if (weight <= 17000) return parseValue(entry['J']) / 1000;
    return parseValue(entry['K']) / 1000;
  };

  const fetchSavedLoads = async () => {
    try {
      const { data, error } = await supabase
        .from('hidracor_external_loads')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const current = data?.find(d => d.version === 'current');
      const previous = data?.find(d => d.version === 'previous');

      const isDataCorrupted = current?.loads && current.loads.length > 0 && (
        current.loads.some((l: ExternalLoad) => (l.data && l.data.includes('(')) || l.peso === 'CIF' || l.peso === 'FOB' || l.peso === 'CIF/FOB')
      );

      if (isDataCorrupted || !current) {
        await updateFromGoogleSheets();
        return;
      }

      if (current) {
        const storedTimestamps = getStoredSeguradoraTimestamps();
        const mergedLoads = (current.loads || []).map((l: ExternalLoad) => {
          const isSeguradora = normalizeText(l.status).includes('seguradora');
          if (isSeguradora) {
            const key = getLoadKey(l);
            const stored = storedTimestamps[key];
            const enteredAt = l.seguradoraEnteredAt || stored?.enteredAt || new Date().toISOString();
            const alerted2h = l.seguradoraAlerted2h ?? stored?.alerted2h ?? false;
            storedTimestamps[key] = { enteredAt, alerted2h };
            return {
              ...l,
              seguradoraEnteredAt: enteredAt,
              seguradoraAlerted2h: alerted2h
            };
          }
          return l;
        });
        saveStoredSeguradoraTimestamps(storedTimestamps);
        setCurrentLoads(mergedLoads);
      }
      if (previous) setPreviousLoads(previous.loads);
    } catch (error: any) {
      console.error("Erro ao carregar dados salvos:", error);
    } finally {
      setLoading(false);
    }
  };

  const parseRota = (rotaStr: string, defaultUF: string, mainWeightStr: string, mainFreightType: string) => {
    const deliveries: any[] = [];
    
    const splitCityUF = (str: string) => {
      let raw = str.trim().replace(/^[,.\s]+|[,.\s]+$/g, '');
      
      if (raw.toUpperCase().includes("AGENDAMENTO") || raw.toUpperCase().includes("AGENDA")) {
        raw = raw.split(/[-–—(]/)[0].trim();
        raw = raw.replace(/AGENDAMENTO.*/i, '').trim();
      }
      let uf = defaultUF;
      const parts = raw.split(/[-–—/ ]+/);
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1].toUpperCase();
        if (lastPart.length === 2 && /^[A-Z]{2}$/.test(lastPart)) {
          uf = lastPart;
          raw = parts.slice(0, -1).join(' ').trim();
        }
      }
      return { city: raw, uf };
    };

    const regex = /([^\(]+)\(([^\)]+)\)/g;
    let match;

    while ((match = regex.exec(rotaStr)) !== null) {
      const rawCity = match[1].trim();
      const details = match[2].trim();
      const { city, uf } = splitCityUF(rawCity);
      
      const parts = details.split(/[\/\+]/);
      let foundWeights = false;

      parts.forEach(part => {
        const weightMatch = part.match(/([\d\.,]+)\s*(?:KG\s*)?(CIF|FOB)/i);
        if (weightMatch) {
          foundWeights = true;
          const w = parseFloat(weightMatch[1].replace(/\./g, '').replace(',', '.')) || 0;
          const t = weightMatch[2].toUpperCase();
          const aliquot = getAliquot(city, uf, t, w);
          deliveries.push({
            city,
            uf,
            type: t,
            weight: w,
            aliquot,
            freight: w * aliquot,
            tax_rate: TAX_RATE
          });
        }
      });

      if (!foundWeights) {
        const mainWeight = parseFloat(mainWeightStr.replace(/\./g, '').replace(',', '.')) || 0;
        const aliquot = getAliquot(city, uf, mainFreightType, mainWeight);
        deliveries.push({
          city,
          uf,
          type: mainFreightType,
          weight: mainWeight,
          aliquot,
          freight: mainWeight * aliquot,
          tax_rate: TAX_RATE
        });
      }
    }

    if (deliveries.length === 0) {
      const mainWeight = parseFloat(mainWeightStr.replace(/\./g, '').replace(',', '.')) || 0;
      const simpleBlocks = rotaStr.split(/[,.]/);
      simpleBlocks.forEach(b => {
        if (!b.trim()) return;
        const { city, uf } = splitCityUF(b);
        const aliquot = getAliquot(city, uf, mainFreightType, mainWeight);
        deliveries.push({
          city,
          uf,
          type: mainFreightType,
          weight: mainWeight,
          aliquot,
          freight: mainWeight * aliquot,
          tax_rate: TAX_RATE
        });
      });
    }
    
    return deliveries;
  };

  const excelSerialToFormattedDate = (serialVal: any): string => {
    if (!serialVal) return "";
    const serial = Number(serialVal);
    if (!isNaN(serial) && serial > 0) {
      const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
      const timezoneOffset = date.getTimezoneOffset() * 60 * 1000;
      const localDate = new Date(date.getTime() + timezoneOffset);
      const day = String(localDate.getDate()).padStart(2, '0');
      const month = String(localDate.getMonth() + 1).padStart(2, '0');
      const year = localDate.getFullYear();
      return `${day}/${month}/${year}`;
    }
    
    // Se já for uma data no formato YYYY-MM-DD
    const strVal = String(serialVal).trim();
    const matchISO = strVal.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (matchISO) {
      return `${matchISO[3]}/${matchISO[2]}/${matchISO[1]}`;
    }

    return strVal;
  };

  const updateFromGoogleSheets = async (isAuto: boolean = false) => {
    setUpdating(true);
    try {
      const response = await fetch(SHEET_URL);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames.find(name => name.toUpperCase() === "CARGAS") || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length < 2) throw new Error("Planilha vazia ou aba CARGAS não encontrada.");

      // Identificar cabeçalhos dinamicamente para evitar desalinhamento caso colunas sejam adicionadas/removidas
      const headers = (rows[0] || []).map((h: any) => String(h || '').trim().toUpperCase());

      let colData = headers.findIndex((h: string) => h === 'DATA' || h.includes('DATA'));
      let colUF = headers.findIndex((h: string) => h === 'UF');
      let colPeso = headers.findIndex((h: string) => h === 'PESO');
      let colFrete = headers.findIndex((h: string) => h === 'FRETE');
      let colObs = headers.findIndex((h: string) => h.startsWith('OBS'));
      let colStatus = headers.findIndex((h: string) => h === 'STATUS');

      const entregaIndices: number[] = [];
      headers.forEach((h: string, i: number) => {
        if (h === 'ENTREGAS' || h === 'ROTA' || h === 'DESTINO') {
          entregaIndices.push(i);
        }
      });

      let colRota = -1;
      let colEntregas = -1;

      if (entregaIndices.length >= 2) {
        colRota = entregaIndices[0]; // Primeira coluna é a descrição de cidades/rota
        colEntregas = entregaIndices[1]; // Segunda coluna é a quantidade de entregas
      } else if (entregaIndices.length === 1) {
        colRota = entregaIndices[0];
      }

      // Fallbacks para índices padrão da planilha atual
      if (colData === -1) colData = 0;
      if (colRota === -1) colRota = 1;
      if (colEntregas === -1) colEntregas = 2;
      if (colUF === -1) colUF = 3;
      if (colPeso === -1) colPeso = 4;
      if (colFrete === -1) colFrete = 5;
      if (colObs === -1) colObs = 6;
      if (colStatus === -1) colStatus = 11;

      const dataRows = rows.slice(1).filter(r => {
        const rotaVal = r[colRota];
        const dataVal = r[colData];
        return (rotaVal && String(rotaVal).trim() !== "") || (dataVal && String(dataVal).trim() !== "");
      });

      const previousList = currentLoadsRef.current;
      const prevMap = new Map<string, ExternalLoad>();
      if (previousList && previousList.length > 0) {
        previousList.forEach(l => {
          prevMap.set(getLoadKey(l), l);
        });
      }

      const storedTimestamps = getStoredSeguradoraTimestamps();
      const detectedNewKeys = new Set<string>();
      const detectedStatusDiffs: Record<string, { oldStatus: string; newStatus: string }> = {};
      const newSeguradoraLoads: ExternalLoad[] = [];

      const newLoads: ExternalLoad[] = dataRows.map((row, idx) => {
        const rota = String(row[colRota] || '');
        const rawUF = String(row[colUF] || '');
        const mainWeightStr = String(row[colPeso] || '0');
        const mainFreightType = String(row[colFrete] || 'CIF').toUpperCase();
        const cleanUF = rawUF.replace(/[^A-Z]/gi, '').substring(0, 2).toUpperCase();
        const parsed = parseRota(rota, cleanUF, mainWeightStr, mainFreightType);
        const totalFreight = parsed.reduce((acc, d) => acc + d.freight, 0);
        const statusStr = colStatus !== -1 ? String(row[colStatus] || '').trim() : '';

        // Obter chave da carga
        const obsVal = colObs !== -1 ? String(row[colObs] || '') : '';
        const key = getLoadKey({ rota, observacoes: obsVal, data: excelSerialToFormattedDate(row[colData]) });
        const isSeguradora = normalizeText(statusStr).includes('seguradora');
        const existing = prevMap.get(key);
        const stored = storedTimestamps[key];

        let seguradoraEnteredAt: string | undefined = undefined;
        let seguradoraAlerted2h: boolean | undefined = undefined;

        if (isSeguradora) {
          if (existing?.seguradoraEnteredAt) {
            seguradoraEnteredAt = existing.seguradoraEnteredAt;
            seguradoraAlerted2h = existing.seguradoraAlerted2h;
          } else if (stored?.enteredAt) {
            seguradoraEnteredAt = stored.enteredAt;
            seguradoraAlerted2h = stored.alerted2h;
          } else {
            // Entrou na seguradora agora!
            seguradoraEnteredAt = new Date().toISOString();
            seguradoraAlerted2h = false;
          }

          storedTimestamps[key] = {
            enteredAt: seguradoraEnteredAt,
            alerted2h: !!seguradoraAlerted2h
          };
        } else {
          if (storedTimestamps[key]) {
            delete storedTimestamps[key];
          }
        }

        const loadItem: ExternalLoad = {
          id: `load-${idx}-${Date.now()}`,
          data: excelSerialToFormattedDate(row[colData]),
          rota: rota,
          entregas: colEntregas !== -1 ? String(row[colEntregas] || '') : '',
          uf: cleanUF,
          peso: mainWeightStr,
          frete: mainFreightType,
          observacoes: obsVal,
          status: statusStr,
          parsedDeliveries: parsed,
          totalToPay: totalFreight * 0.7,
          manualDeliveryCount: parsed.length,
          useEqualizationTable: false,
          seguradoraEnteredAt,
          seguradoraAlerted2h
        };

        if (previousList && previousList.length > 0) {
          if (!existing) {
            detectedNewKeys.add(key);
            if (isSeguradora) {
              newSeguradoraLoads.push(loadItem);
            }
          } else {
            const oldStatus = (existing.status || '').trim();
            const newStatus = statusStr;
            if (oldStatus.toUpperCase() !== newStatus.toUpperCase()) {
              detectedStatusDiffs[key] = {
                oldStatus: oldStatus || '(Vazio)',
                newStatus: newStatus || '(Vazio)'
              };

              // Se acabou de mudar para SEGURADORA
              if (!normalizeText(oldStatus).includes('seguradora') && isSeguradora) {
                newSeguradoraLoads.push(loadItem);
              }
            }
          }
        }

        return loadItem;
      });

      saveStoredSeguradoraTimestamps(storedTimestamps);

      await supabase.from('hidracor_external_loads').delete().eq('version', 'previous');
      if (previousList.length > 0) {
        await supabase.from('hidracor_external_loads').update({ version: 'previous' }).eq('version', 'current');
      }

      const { error: insertError } = await supabase.from('hidracor_external_loads').insert([{
        user_id: user?.id,
        loads: newLoads,
        version: 'current',
        updated_at: new Date().toISOString()
      }]);

      if (insertError) throw insertError;

      setPreviousLoads(previousList);
      setCurrentLoads(newLoads);
      setViewMode('current');
      setLastCheckTime(new Date().toLocaleTimeString('pt-BR'));

      // Processar notificações caso haja novidades ou mudanças
      const hasNew = detectedNewKeys.size > 0;
      const hasChanged = Object.keys(detectedStatusDiffs).length > 0;

      if (hasNew || hasChanged) {
        setNewLoadKeys(prev => {
          const next = new Set(prev);
          detectedNewKeys.forEach(k => next.add(k));
          return next;
        });

        setStatusChangedKeys(prev => ({
          ...prev,
          ...detectedStatusDiffs
        }));

        if (soundEnabled) {
          playNotificationSound();
        }

        let alertMsg = "";
        if (hasNew && hasChanged) {
          alertMsg = `${detectedNewKeys.size} nova(s) carga(s) e ${Object.keys(detectedStatusDiffs).length} alteração(ões) de status detectadas!`;
        } else if (hasNew) {
          alertMsg = `${detectedNewKeys.size} nova(s) carga(s) encontrada(s) na planilha!`;
        } else {
          alertMsg = `${Object.keys(detectedStatusDiffs).length} mudança(s) de status detectada(s) na planilha!`;
        }

        sendDesktopNotification("Midas Log - Atualização de Cargas", alertMsg);
        showSuccess(`🔔 ${alertMsg}`);

        if (newSeguradoraLoads.length > 0) {
          const segAlertMsg = `⚠️ ${newSeguradoraLoads.length} carga(s) colocada(s) na seguradora! Tempo limite de 2h iniciado.`;
          sendDesktopNotification("🛡️ ENTRADA NA SEGURADORA (Limite: 2h)", segAlertMsg);
          showSuccess(segAlertMsg);
        }
      } else {
        if (!isAuto) {
          showSuccess("Planilha sincronizada! Nenhuma alteração encontrada.");
        }
      }
    } catch (error: any) {
      if (!isAuto) {
        showError("Erro ao atualizar: " + error.message);
      } else {
        console.warn("Erro na verificação automática:", error);
      }
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      updateFromGoogleSheets(true);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, soundEnabled]);

  const handleSaveLoad = async (load: ExternalLoad) => {
    const driverName = prompt("Nome do motorista que aceitou a carga:");
    if (!driverName) return;

    setSaving(true);
    try {
      const complementaryVal = load.complementaryValue || 0;
      const deliveriesToSave = (load.parsedDeliveries || []).map((d, idx) => ({
        ...d,
        complementary_value: idx === 0 ? complementaryVal : 0
      }));

      const { error } = await supabase.from('hidracor_saved_external_loads').insert([{
        user_id: user?.id,
        rota: load.rota,
        data_original: load.data,
        deliveries: deliveriesToSave,
        total_to_pay: load.totalToPay,
        driver_name: driverName.toUpperCase()
      }]);

      if (error) throw error;
      showSuccess("Carga salva com sucesso!");
    } catch (error: any) {
      showError("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={12} className="text-slate-300" />;
    if (sortConfig.direction === 'asc') return <ArrowUp size={12} className="text-amber-600" />;
    return <ArrowDown size={12} className="text-amber-600" />;
  };

  const activeData = viewMode === 'current' ? currentLoads : previousLoads;

  const activeDetailLoad = useMemo(() => {
    if (!selectedDetailLoad) return null;
    return activeData.find(l => l.id === selectedDetailLoad.id) || selectedDetailLoad;
  }, [selectedDetailLoad, activeData]);

  const sortedData = useMemo(() => {
    let sortableItems = [...activeData];
    if (sortConfig.direction !== null) {
      sortableItems.sort((a: any, b: any) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Caso especial para ordenação de data no formato DD/MM/YYYY
        if (sortConfig.key === 'data') {
          const parseDate = (dStr: string) => {
            if (!dStr) return 0;
            const parts = dStr.split('/');
            if (parts.length === 3) {
              return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
            }
            return new Date(dStr).getTime() || 0;
          };
          aValue = parseDate(String(aValue));
          bValue = parseDate(String(bValue));
        } else if (sortConfig.key === 'peso') {
          aValue = parseWeightNumber(String(aValue));
          bValue = parseWeightNumber(String(bValue));
        } else if (sortConfig.key === 'veiculo') {
          aValue = getVehicleType(a.peso);
          bValue = getVehicleType(b.peso);
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [activeData, sortConfig]);

  const counts = useMemo(() => {
    let novas = 0;
    let seguradora = 0;
    let contratado = 0;
    let agenciando = 0;

    let seguradoraOverdue = 0;

    activeData.forEach(l => {
      const key = getLoadKey(l);
      if (newLoadKeys.has(key)) novas++;
      const s = normalizeText(l.status);
      if (s.includes('seguradora')) {
        seguradora++;
        const info = getSeguradoraTimeInfo(l);
        if (info?.isOverdue) seguradoraOverdue++;
      } else if (s.includes('contratad')) contratado++;
      else if (s.includes('agenciando')) agenciando++;
    });

    return {
      total: activeData.length,
      novas,
      seguradora,
      seguradoraOverdue,
      contratado,
      agenciando
    };
  }, [activeData, newLoadKeys, currentTime]);

  const filteredData = useMemo(() => {
    return sortedData.filter(row => {
      // Filtro Rápido por Status / Novas Cargas / Seguradora Vencida
      if (quickStatusFilter === 'NEW') {
        if (!newLoadKeys.has(getLoadKey(row))) return false;
      } else if (quickStatusFilter === 'SEGURADORA') {
        if (!normalizeText(row.status).includes('seguradora')) return false;
      } else if (quickStatusFilter === 'SEGURADORA_OVERDUE') {
        if (!normalizeText(row.status).includes('seguradora')) return false;
        const info = getSeguradoraTimeInfo(row);
        if (!info?.isOverdue) return false;
      } else if (quickStatusFilter === 'CONTRATADO') {
        if (!normalizeText(row.status).includes('contratad')) return false;
      } else if (quickStatusFilter === 'AGENCIANDO') {
        if (!normalizeText(row.status).includes('agenciando')) return false;
      }

      const matchesFilters = Object.entries(columnFilters).every(([col, value]) => {
        if (!value) return true;
        if (col === 'veiculo') {
          const vehicle = getVehicleType(row.peso);
          return vehicle.toLowerCase().includes(value.toLowerCase());
        }
        if (col === 'peso') {
          const formatted = formatWeight(row.peso);
          const rawStr = row.peso?.toString() || '';
          return formatted.toLowerCase().includes(value.toLowerCase()) || rawStr.toLowerCase().includes(value.toLowerCase());
        }
        return row[col as keyof ExternalLoad]?.toString().toLowerCase().includes(value.toLowerCase());
      });
      const matchesUF = selectedUFs.length === 0 || selectedUFs.includes(row.uf.toUpperCase());
      return matchesFilters && matchesUF;
    });
  }, [sortedData, columnFilters, selectedUFs, quickStatusFilter, newLoadKeys, currentTime]);

  const renderStatusBadge = (load: ExternalLoad) => {
    const statusRaw = (load.status || '').trim();
    const statusNorm = normalizeText(statusRaw);
    const key = getLoadKey(load);
    const changed = statusChangedKeys[key];
    const segInfo = statusNorm.includes('seguradora') ? getSeguradoraTimeInfo(load) : null;

    let badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";
    let icon = null;
    let label = statusRaw || "PENDENTE";

    if (statusNorm.includes('seguradora')) {
      if (segInfo?.isOverdue) {
        badgeStyle = "bg-red-100 text-red-950 border-red-500 font-black shadow-md animate-pulse ring-2 ring-red-400";
        icon = <ShieldAlert size={13} className="text-red-700 animate-bounce" />;
        label = "SEGURADORA (+2H - URGENTE)";
      } else {
        badgeStyle = "bg-amber-100 text-amber-900 border-amber-300 font-extrabold shadow-sm";
        icon = <ShieldAlert size={12} className="text-amber-600" />;
        label = "NA SEGURADORA";
      }
    } else if (statusNorm.includes('contratado midas')) {
      badgeStyle = "bg-purple-100 text-purple-800 border-purple-300 font-bold";
      icon = <CheckCircle2 size={12} className="text-purple-600" />;
      label = "CONTRATADO MIDAS";
    } else if (statusNorm.includes('contratado transagil') || statusNorm.includes('contratado transágil')) {
      badgeStyle = "bg-blue-100 text-blue-800 border-blue-300 font-bold";
      icon = <CheckCircle2 size={12} className="text-blue-600" />;
      label = "CONTRATADO TRANSÁGIL";
    } else if (statusNorm.includes('contratad')) {
      badgeStyle = "bg-indigo-100 text-indigo-800 border-indigo-300 font-bold";
      icon = <CheckCircle2 size={12} className="text-indigo-600" />;
    } else if (statusNorm.includes('agenciando')) {
      badgeStyle = "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold";
      icon = <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block" />;
      label = "AGENCIANDO";
    } else if (statusNorm.includes('indisponivel') || statusNorm.includes('indisponível')) {
      badgeStyle = "bg-red-50 text-red-700 border-red-200 font-semibold";
      label = "INDISPONÍVEL";
    }

    return (
      <div className="flex flex-col gap-1 items-center">
        <div className={`px-2.5 py-1 rounded-full text-[10px] border flex items-center justify-center gap-1.5 whitespace-nowrap ${badgeStyle}`}>
          {icon}
          <span>{label}</span>
        </div>

        {/* Informações de Tempo na Seguradora com Ajuste Manual */}
        {segInfo && (
          <button
            type="button"
            onClick={() => handleEditSeguradoraTime(load)}
            title="Clique para ajustar o horário de entrada manualmente se necessário"
            className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border transition-all hover:scale-105 cursor-pointer shadow-xs ${
              segInfo.isOverdue 
                ? 'bg-red-100 text-red-950 border-red-400 font-black animate-pulse' 
                : 'bg-amber-50 text-amber-900 border-amber-200 font-semibold'
            }`}
          >
            <Clock size={10} className={segInfo.isOverdue ? 'text-red-600 animate-spin' : 'text-amber-600'} />
            <span>Entrou: <strong>{segInfo.enteredFormatted}</strong></span>
            <span>•</span>
            <span className={segInfo.isOverdue ? 'font-black text-red-700 underline' : 'font-bold'}>
              {segInfo.isOverdue ? `Passou ${segInfo.timeElapsedStr}` : `${segInfo.timeElapsedStr} decorridos`}
            </span>
          </button>
        )}

        {changed && (
          <span className="text-[9px] text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1 shadow-xs" title={`Status anterior: ${changed.oldStatus}`}>
            <span>De: {changed.oldStatus}</span>
            <ArrowRight size={8} />
            <span>Para: {changed.newStatus}</span>
          </span>
        )}
      </div>
    );
  };

  const allUFs = useMemo(() => {
    const ufs = new Set(activeData.map(l => l.uf.toUpperCase()));
    return Array.from(ufs).sort();
  }, [activeData]);

  const handleUpdateLoad = async (loadId: string, updates: Partial<ExternalLoad>) => {
    let updatedLoadsList: ExternalLoad[] = [];
    const updateFn = (loads: ExternalLoad[]) => {
      updatedLoadsList = loads.map(l => {
        if (l.id === loadId) {
          const updatedLoad = { ...l, ...updates };
          
          if (
            updates.useEqualizationTable !== undefined || 
            updates.manualDeliveryCount !== undefined ||
            updates.complementaryValue !== undefined
          ) {
            const newDeliveries = updatedLoad.parsedDeliveries?.map(d => {
              const newAliquot = getAliquot(
                d.city, 
                d.uf, 
                d.type, 
                d.weight, 
                updatedLoad.useEqualizationTable, 
                updatedLoad.manualDeliveryCount
              );
              return { ...d, aliquot: newAliquot, freight: d.weight * newAliquot };
            });
            updatedLoad.parsedDeliveries = newDeliveries;
            const baseFreight = newDeliveries?.reduce((acc, d) => acc + d.freight, 0) || 0;
            const totalReceived = baseFreight + (updatedLoad.complementaryValue || 0);
            updatedLoad.totalToPay = totalReceived * 0.7;
          }
          
          return updatedLoad;
        }
        return l;
      });
      return updatedLoadsList;
    };

    if (viewMode === 'current') {
      setCurrentLoads(updateFn);
    } else {
      setPreviousLoads(updateFn);
    }

    try {
      await supabase.from('hidracor_external_loads').update({
        loads: updatedLoadsList,
        updated_at: new Date().toISOString()
      }).eq('version', viewMode);
    } catch (err) {
      console.error("Erro ao salvar atualização no Supabase:", err);
    }
  };

  const handleUpdateDelivery = (loadId: string, deliveryIdx: number, updates: any) => {
    const updateFn = (loads: ExternalLoad[]) => loads.map(l => {
      if (l.id === loadId && l.parsedDeliveries) {
        const newDeliveries = [...l.parsedDeliveries];
        newDeliveries[deliveryIdx] = { ...newDeliveries[deliveryIdx], ...updates };
        if (updates.weight !== undefined || updates.aliquot !== undefined) {
          newDeliveries[deliveryIdx].freight = newDeliveries[deliveryIdx].weight * newDeliveries[deliveryIdx].aliquot;
        }
        const baseFreight = newDeliveries.reduce((acc, d) => acc + d.freight, 0);
        const totalReceived = baseFreight + (l.complementaryValue || 0);
        return { ...l, parsedDeliveries: newDeliveries, totalToPay: totalReceived * 0.7 };
      }
      return l;
    });
    if (viewMode === 'current') setCurrentLoads(updateFn);
    else setPreviousLoads(updateFn);
  };

  const handleFilterChange = (col: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [col]: value }));
  };

  const handlePrintDetailed = (load: ExternalLoad) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const logoUrl = window.location.origin + "/logo.png";
    const totalToPayFormatted = formatCurrency(load.totalToPay || 0);
    const totalWeight = load.parsedDeliveries?.reduce((acc, d) => acc + d.weight, 0) || 0;
    const totalWeightFormatted = formatCurrency(totalWeight);

    const content = `
      <html>
        <head>
          <title>Ordem de Carregamento - Midas Log</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #f59e0b; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { height: 70px; }
            .title { font-size: 28px; font-weight: bold; color: #1e293b; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; }
            .info-label { font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #1e293b; color: white; text-align: left; padding: 12px; border: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase; }
            td { padding: 12px; border: 1px solid #e2e8f0; font-size: 13px; }
            .total-row { background: #f1f5f9; font-weight: bold; font-size: 16px; }
            .note { margin-top: 40px; padding: 20px; border: 2px dashed #cbd5e1; border-radius: 8px; text-align: left; font-size: 14px; }
            .note-title { font-weight: bold; color: #b91c1c; font-size: 16px; margin-bottom: 10px; display: block; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; pt: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" class="logo" />
            <div class="title">Ordem de Carregamento</div>
          </div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Rota</div>
              <div style="font-size: 16px; font-weight: bold;">${load.rota}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Data de Emissão</div>
              <div>${new Date().toLocaleDateString('pt-BR')}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 60px">Entr.</th>
                <th>Cidade</th>
                <th style="width: 60px">UF</th>
                <th style="width: 100px">Tipo</th>
                <th style="width: 120px">Peso (KG)</th>
              </tr>
            </thead>
            <tbody>
              ${load.parsedDeliveries?.map((d, idx) => `
                <tr>
                  <td style="text-align: center">${idx + 1}</td>
                  <td style="text-transform: uppercase">${d.city}</td>
                  <td style="text-align: center; font-weight: bold;">${d.uf}</td>
                  <td style="text-align: center">${d.type}</td>
                  <td style="text-align: right">${formatCurrency(d.weight)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="4" style="text-align: right">PESO TOTAL:</td>
                <td style="text-align: right;">${totalWeightFormatted} KG</td>
              </tr>
              <tr class="total-row">
                <td colspan="4" style="text-align: right">VALOR DO FRETE:</td>
                <td style="text-align: right; color: #15803d;">R$ ${totalToPayFormatted}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="note">
            <span class="note-title">⚠️ INFORMAÇÕES IMPORTANTES:</span>
            <p>• O DESCARREGO SERÁ POR CONTA DO MOTORISTA.</p>
            <p>• QUANTIDADE DE CHAPATEX NECESSÁRIA:<br>
               &nbsp;&nbsp;- TRUCK: 16 CHAPATEX<br>
               &nbsp;&nbsp;- BITRUCK: 24 CHAPATEX<br>
               &nbsp;&nbsp;- CARRETA: 32 CHAPATEX</p>
            <p>• VESTIMENTA EXIGIDA PELA FÁBRICA: Usar calça e calçado fechado.</p>
            <p>• AO CHEGAR NA FÁBRICA: Apresentar-se na portaria e informar que está para retirar uma carga contratada com a <strong>Midas Logística</strong>.</p>
          </div>

          <div class="footer">Midas Logística - Eficiência em Movimento</div>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const logoUrl = window.location.origin + "/logo.png";

    const content = `
      <html>
        <head>
          <title>Cargas Disponíveis - Midas Log</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; margin-bottom: 20px; }
            .logo { height: 60px; }
            .title { font-size: 24px; font-weight: bold; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f8fafc; text-align: left; padding: 12px; border: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase; }
            td { padding: 12px; border: 1px solid #e2e8f0; font-size: 13px; }
            .rota-cell { max-width: 400px; word-wrap: break-word; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" class="logo" />
            <div class="title">Cargas Disponíveis</div>
            <div style="text-align: right">
              <div style="font-weight: bold">Midas Logística</div>
              <div style="font-size: 12px">${new Date().toLocaleDateString()}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Rota</th>
                <th>Entregas</th>
                <th>UF</th>
                <th>Peso Total</th>
                <th>Veículo</th>
                <th>Frete</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map(load => `
                <tr>
                  <td class="rota-cell"><strong>${load.rota}</strong></td>
                  <td style="text-align: center">${load.entregas}</td>
                  <td style="text-align: center"><strong>${load.uf}</strong></td>
                  <td style="text-align: right">${formatWeight(load.peso)}</td>
                  <td style="text-align: center"><strong>${getVehicleType(load.peso)}</strong></td>
                  <td style="text-align: center">${load.frete}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            © ${new Date().getFullYear()} Midas Logística - Eficiência em Movimento
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  return (
    <div className="min-h-[100dvh] h-[100dvh] bg-slate-50 flex flex-col overflow-hidden">
      {/* Header Responsivo */}
      <header className="max-w-full mx-auto w-full flex justify-between items-center px-3 py-2 sm:px-6 sm:py-3 bg-white border-b shadow-2xs z-50 min-h-14">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link to="/admin">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-slate-900">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <img src="/logo.png" alt="Midas Log" className="h-6 sm:h-7 w-auto shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                Cargas Externas Hidracor
              </h1>
              <p className="hidden md:block text-slate-500 text-[10px]">
                Monitoramento de cargas disponíveis no Google Sheets.
              </p>
            </div>
          </div>
        </div>
        
        {/* Desktop actions (md: e superior) */}
        <div className="hidden md:flex items-center gap-2">
          {/* Status da última verificação */}
          {lastCheckTime && (
            <span className="hidden xl:inline-block text-[11px] text-slate-400 font-medium mr-1">
              Verificado às {lastCheckTime}
            </span>
          )}

          {/* Seletor de Auto-atualização */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs">
            <Clock size={12} className="text-slate-500" />
            <span className="text-[10px] text-slate-500 font-medium">Auto-atualizar:</span>
            <Select 
              value={String(autoRefreshInterval)} 
              onValueChange={(v) => setAutoRefreshInterval(Number(v))}
            >
              <SelectTrigger className="h-6 w-24 text-[10px] bg-white border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="60" className="text-xs">1 min</SelectItem>
                <SelectItem value="180" className="text-xs">3 min</SelectItem>
                <SelectItem value="300" className="text-xs">5 min</SelectItem>
                <SelectItem value="600" className="text-xs">10 min</SelectItem>
                <SelectItem value="0" className="text-xs">Desativado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Botão de Som */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playNotificationSound();
            }} 
            title={soundEnabled ? "Notificação sonora ativada (clique para silenciar)" : "Silenciado (clique para ativar)"}
            className="h-8 w-8 text-slate-600 hover:text-amber-600 hover:bg-amber-50"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} className="text-slate-400" />}
          </Button>

          {/* Ativar Notificações do Sistema */}
          {!hasNotificationPermission && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={requestNotificationPermission} 
              className="gap-1.5 border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 h-8 text-xs font-semibold"
              title="Receba alertas no navegador quando surgirem novas cargas ou alterações"
            >
              <BellRing size={13} className="text-amber-600 animate-bounce" />
              <span>Ativar Alertas</span>
            </Button>
          )}

          {/* Botão de Alertas / Mudanças */}
          <Button 
            variant={newLoadKeys.size > 0 || Object.keys(statusChangedKeys).length > 0 ? "default" : "outline"}
            size="sm" 
            onClick={() => setShowChangesModal(true)} 
            className={`gap-1.5 h-8 text-xs relative ${
              newLoadKeys.size > 0 || Object.keys(statusChangedKeys).length > 0 
                ? "bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-sm" 
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Bell size={13} />
            <span>Alertas</span>
            {(newLoadKeys.size > 0 || Object.keys(statusChangedKeys).length > 0) && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                {newLoadKeys.size + Object.keys(statusChangedKeys).length}
              </span>
            )}
          </Button>

          <Link to="/admin/external-loads/saved" target="_blank">
            <Button variant="outline" size="sm" className="gap-2 border-slate-200 hover:bg-slate-50 h-8 text-xs">
              <Bookmark size={14} /> <span>Cargas Salvas</span>
            </Button>
          </Link>

          <a href={VIEW_SHEET_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-2 border-slate-200 hover:bg-slate-50 h-8 text-xs">
              <FileText size={14} /> <span>Ver Planilha</span>
            </Button>
          </a>

          <Button onClick={handlePrint} size="sm" className="bg-slate-900 hover:bg-slate-800 text-white gap-2 h-8 text-xs">
            <Printer size={14} /> <span>Imprimir</span>
          </Button>

          <Button 
            onClick={() => setShowExportModal(true)} 
            size="sm" 
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs font-semibold shadow-xs"
            title="Baixar imagem das cargas e copiar legenda padrão para o WhatsApp"
          >
            <ImageIcon size={14} /> <span>Baixar Imagem</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => updateFromGoogleSheets(false)} disabled={updating} className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 h-8 text-xs font-semibold">
            {updating ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
            <span>Atualizar</span>
          </Button>
        </div>

        {/* Mobile compact quick actions (iPhone XR / telas < md) */}
        <div className="flex md:hidden items-center gap-1.5">
          {/* Som */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playNotificationSound();
            }} 
            className="h-8 w-8 text-slate-600 hover:bg-slate-100"
            title={soundEnabled ? "Som ativado" : "Som desligado"}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} className="text-slate-400" />}
          </Button>

          {/* Alertas com contador */}
          <Button 
            variant={newLoadKeys.size > 0 || Object.keys(statusChangedKeys).length > 0 ? "default" : "outline"}
            size="sm" 
            onClick={() => setShowChangesModal(true)} 
            className={`h-8 px-2.5 text-xs relative ${
              newLoadKeys.size > 0 || Object.keys(statusChangedKeys).length > 0 
                ? "bg-amber-600 hover:bg-amber-700 text-white font-bold" 
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Bell size={14} />
            {(newLoadKeys.size > 0 || Object.keys(statusChangedKeys).length > 0) && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center animate-pulse ml-1">
                {newLoadKeys.size + Object.keys(statusChangedKeys).length}
              </span>
            )}
          </Button>

          {/* Baixar Imagem WhatsApp (Mobile) */}
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setShowExportModal(true)} 
            className="h-8 w-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            title="Baixar Cargas como Imagem (WhatsApp)"
          >
            <ImageIcon size={14} />
          </Button>

          {/* Atualizar */}
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => updateFromGoogleSheets(false)} 
            disabled={updating} 
            className="h-8 w-8 border-amber-200 text-amber-700 hover:bg-amber-50"
            title="Atualizar dados"
          >
            {updating ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          </Button>

          {/* Menu Mais Opções (Popover) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:bg-slate-100">
                <MoreVertical size={16} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 mr-2" align="end">
              <div className="space-y-1">
                <div className="px-2 py-1.5 border-b pb-2 mb-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Auto-atualizar</div>
                  <Select 
                    value={String(autoRefreshInterval)} 
                    onValueChange={(v) => setAutoRefreshInterval(Number(v))}
                  >
                    <SelectTrigger className="h-7 w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="60" className="text-xs">A cada 1 min</SelectItem>
                      <SelectItem value="180" className="text-xs">A cada 3 min</SelectItem>
                      <SelectItem value="300" className="text-xs">A cada 5 min</SelectItem>
                      <SelectItem value="600" className="text-xs">A cada 10 min</SelectItem>
                      <SelectItem value="0" className="text-xs">Desativado</SelectItem>
                    </SelectContent>
                  </Select>
                  {lastCheckTime && (
                    <div className="text-[9px] text-slate-400 mt-1">
                      Última checagem: {lastCheckTime}
                    </div>
                  )}
                </div>

                {!hasNotificationPermission && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={requestNotificationPermission} 
                    className="w-full justify-start text-xs h-8 text-amber-700 hover:bg-amber-50 font-semibold"
                  >
                    <BellRing size={14} className="mr-2 text-amber-600" /> Ativar Alertas
                  </Button>
                )}

                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowExportModal(true)} 
                  className="w-full justify-start text-xs h-8 text-emerald-700 hover:bg-emerald-50 font-bold"
                >
                  <ImageIcon size={14} className="mr-2 text-emerald-600" /> Baixar Imagem (WhatsApp)
                </Button>

                <Link to="/admin/external-loads/saved" className="block w-full">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-8 text-slate-700">
                    <Bookmark size={14} className="mr-2 text-slate-500" /> Cargas Salvas
                  </Button>
                </Link>

                <a href={VIEW_SHEET_URL} target="_blank" rel="noopener noreferrer" className="block w-full">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-8 text-slate-700">
                    <FileText size={14} className="mr-2 text-slate-500" /> Abrir Google Sheets
                  </Button>
                </a>

                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handlePrint} 
                  className="w-full justify-start text-xs h-8 text-slate-700"
                >
                  <Printer size={14} className="mr-2 text-slate-500" /> Imprimir Lista
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-1.5 sm:p-3 lg:p-4 gap-2 overflow-hidden">
        <Card className="border-none shadow-xs overflow-hidden flex flex-col flex-1">
          {/* CardHeader com Toggle Cards/Tabela e Filtros Rápido Deslizáveis */}
          <CardHeader className="p-2 sm:p-3 bg-slate-50/80 border-b flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              {/* Toggle de Modo: Cards ou Tabela */}
              <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                <Button
                  type="button"
                  variant={displayMode === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setDisplayMode('cards')}
                  className={`h-7 px-2.5 text-xs gap-1.5 rounded-md ${
                    displayMode === 'cards' ? 'bg-amber-600 text-white font-bold hover:bg-amber-700' : 'text-slate-600'
                  }`}
                >
                  <LayoutGrid size={13} />
                  <span>Cards</span>
                </Button>
                <Button
                  type="button"
                  variant={displayMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setDisplayMode('table')}
                  className={`h-7 px-2.5 text-xs gap-1.5 rounded-md ${
                    displayMode === 'table' ? 'bg-amber-600 text-white font-bold hover:bg-amber-700' : 'text-slate-600'
                  }`}
                >
                  <TableIcon size={13} />
                  <span>Tabela</span>
                </Button>
              </div>

              {/* Botão limpar alertas e contador total */}
              <div className="flex items-center gap-1.5">
                {(newLoadKeys.size > 0 || Object.keys(statusChangedKeys).length > 0) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNewLoadKeys(new Set());
                      setStatusChangedKeys({});
                      showSuccess("Alertas marcados como lidos.");
                    }}
                    className="text-[10px] sm:text-[11px] h-7 px-2 text-slate-500 hover:text-slate-800"
                  >
                    <Check size={12} className="mr-1" />
                    <span className="hidden sm:inline">Limpar</span> Alertas
                  </Button>
                )}
                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                  {filteredData.length} {filteredData.length === 1 ? 'carga' : 'cargas'}
                </span>
              </div>
            </div>

            {/* Pílulas de Filtro Rápido com rolagem horizontal suave no iPhone XR */}
            <div className="overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1 flex items-center gap-1.5 flex-nowrap sm:flex-wrap">
              <Button
                variant={quickStatusFilter === 'ALL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQuickStatusFilter('ALL')}
                className={`h-7 text-xs px-2.5 rounded-full shrink-0 ${
                  quickStatusFilter === 'ALL'
                    ? 'bg-slate-900 text-white font-bold'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100 bg-white'
                }`}
              >
                Todas <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-bold">{counts.total}</span>
              </Button>

              <Button
                variant={quickStatusFilter === 'NEW' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQuickStatusFilter('NEW')}
                className={`h-7 text-xs px-2.5 rounded-full gap-1 shrink-0 ${
                  quickStatusFilter === 'NEW'
                    ? 'bg-emerald-600 text-white font-bold'
                    : counts.novas > 0
                      ? 'border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold animate-pulse'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-100 bg-white'
                }`}
              >
                <Sparkles size={11} /> Novas
                <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  quickStatusFilter === 'NEW' ? 'bg-white/20' : 'bg-emerald-200 text-emerald-800'
                }`}>
                  {counts.novas}
                </span>
              </Button>

              <Button
                variant={quickStatusFilter === 'SEGURADORA' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQuickStatusFilter('SEGURADORA')}
                className={`h-7 text-xs px-2.5 rounded-full gap-1 shrink-0 ${
                  quickStatusFilter === 'SEGURADORA'
                    ? 'bg-amber-600 text-white font-bold'
                    : counts.seguradora > 0
                      ? 'border-amber-400 text-amber-900 bg-amber-50 hover:bg-amber-100 font-extrabold shadow-2xs'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-100 bg-white'
                }`}
              >
                <ShieldAlert size={11} /> Na Seguradora
                <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  quickStatusFilter === 'SEGURADORA' ? 'bg-white/20' : 'bg-amber-200 text-amber-900'
                }`}>
                  {counts.seguradora}
                </span>
              </Button>

              {counts.seguradoraOverdue > 0 && (
                <Button
                  variant={quickStatusFilter === 'SEGURADORA_OVERDUE' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setQuickStatusFilter('SEGURADORA_OVERDUE')}
                  className={`h-7 text-xs px-2.5 rounded-full gap-1 shrink-0 animate-pulse ${
                    quickStatusFilter === 'SEGURADORA_OVERDUE'
                      ? 'bg-red-700 text-white font-black ring-2 ring-red-400 shadow-md'
                      : 'border-red-400 text-red-950 bg-red-100 hover:bg-red-200 font-black shadow-2xs'
                  }`}
                >
                  <Clock size={11} className="text-red-700 animate-spin" /> +2h na Seguradora
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-red-600 text-white">
                    {counts.seguradoraOverdue} URGENTE
                  </span>
                </Button>
              )}

              <Button
                variant={quickStatusFilter === 'CONTRATADO' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQuickStatusFilter('CONTRATADO')}
                className={`h-7 text-xs px-2.5 rounded-full gap-1 shrink-0 ${
                  quickStatusFilter === 'CONTRATADO'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100 bg-white'
                }`}
              >
                <CheckCircle2 size={11} /> Contratadas
                <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  quickStatusFilter === 'CONTRATADO' ? 'bg-white/20' : 'bg-purple-100 text-purple-800'
                }`}>
                  {counts.contratado}
                </span>
              </Button>

              <Button
                variant={quickStatusFilter === 'AGENCIANDO' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQuickStatusFilter('AGENCIANDO')}
                className={`h-7 text-xs px-2.5 rounded-full gap-1 shrink-0 ${
                  quickStatusFilter === 'AGENCIANDO'
                    ? 'bg-emerald-700 text-white font-bold'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100 bg-white'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Agenciando
                <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  quickStatusFilter === 'AGENCIANDO' ? 'bg-white/20' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {counts.agenciando}
                </span>
              </Button>
            </div>
          </CardHeader>

          {/* CardContent: Renderização condicional Cards vs Tabela */}
          <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
            {displayMode === 'cards' ? (
              /* Modo Cards (Perfeito para iPhone XR e navegação móvel) */
              <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-slate-100/60">
                {filteredData.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-xl border border-dashed border-slate-300 m-2">
                    <Filter className="mx-auto text-slate-300 mb-2" size={36} />
                    <p className="text-sm text-slate-500 font-medium">Nenhuma carga encontrada com os filtros selecionados.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredData.map((load) => {
                      const isNew = newLoadKeys.has(getLoadKey(load));
                      return (
                        <div 
                          key={load.id}
                          className={`bg-white rounded-xl border transition-all duration-150 p-3.5 flex flex-col justify-between gap-3 shadow-2xs hover:shadow-md ${
                            isNew ? 'border-emerald-400 ring-2 ring-emerald-300/40' : 'border-slate-200'
                          }`}
                        >
                          {/* Topo do Card: Data, Tag Nova, UF, Frete */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isNew && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white animate-bounce shadow-2xs uppercase tracking-wider">
                                  <Sparkles size={10} /> NOVA
                                </span>
                              )}
                              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {load.data || 'Sem data'}
                              </span>
                              <span className="text-[11px] font-black text-white bg-slate-900 px-2 py-0.5 rounded shadow-2xs">
                                {load.uf}
                              </span>
                            </div>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              {load.frete || 'CIF'}
                            </span>
                          </div>

                          {/* Rota */}
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm leading-snug break-words" title={load.rota}>
                              {load.rota}
                            </h3>
                          </div>

                          {/* Status Badge + Horário na Seguradora */}
                          <div className="w-full flex justify-start">
                            {renderStatusBadge(load)}
                          </div>

                          {/* Grid de Informações: Entregas, Peso, Veículo */}
                          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200/80 grid grid-cols-3 gap-2 text-center items-center">
                            <div>
                              <span className="text-[9px] font-bold uppercase text-slate-400 block">Entregas</span>
                              <span className="text-xs font-black text-slate-800">{load.entregas}</span>
                            </div>
                            <div className="border-x border-slate-200 px-1">
                              <span className="text-[9px] font-bold uppercase text-slate-400 block">Peso</span>
                              <span className="text-xs font-black text-slate-800 truncate block">{formatWeight(load.peso)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Veículo</span>
                              <Select 
                                value={getVehicleType(load)} 
                                onValueChange={(value) => handleUpdateLoad(load.id, { manualVehicleType: value === 'AUTO' ? undefined : value })}
                              >
                                <SelectTrigger className={`h-6 text-[10px] font-bold border rounded px-1.5 w-full flex justify-between items-center ${
                                  load.manualVehicleType 
                                    ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-2xs' 
                                    : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-50'
                                }`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {VEHICLE_OPTIONS.map(option => (
                                    <SelectItem key={option} value={option} className="text-xs font-bold">
                                      {option}
                                    </SelectItem>
                                  ))}
                                  {load.manualVehicleType && (
                                    <SelectItem value="AUTO" className="text-xs text-slate-500 italic border-t mt-1 pt-1">
                                      ↺ Automático
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Botões de Ação */}
                          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => setSelectedDetailLoad(load)}
                              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold h-8 text-xs gap-1.5 shadow-2xs"
                            >
                              <Calculator size={13} />
                              <span>Calcular & Detalhar</span>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleSaveLoad(load)}
                              disabled={saving}
                              title="Salvar carga"
                              className="h-8 w-8 shrink-0 border-slate-200 text-slate-700 hover:bg-slate-100"
                            >
                              <Save size={14} />
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handlePrintDetailed(load)}
                              title="Imprimir ordem para motorista"
                              className="h-8 w-8 shrink-0 border-slate-200 text-slate-700 hover:bg-slate-100"
                            >
                              <Printer size={14} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Modo Tabela Completa (Desktop ou modo horizontal) */
              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader className="bg-white sticky top-0 z-30 shadow-xs">
                    <TableRow>
                      <TableHead className="w-[80px]"></TableHead>
                      <TableHead className="min-w-[120px] py-4 px-4 bg-white">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('data')}>
                            <span className="text-[10px] font-bold uppercase text-slate-500">Data</span>
                            {renderSortIcon('data')}
                          </div>
                          <Input placeholder="Filtrar..." className="h-7 text-[10px]" onChange={(e) => handleFilterChange('data', e.target.value)} />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[300px] py-4 px-4 bg-white">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('rota')}>
                            <span className="text-[10px] font-bold uppercase text-slate-500">Rota</span>
                            {renderSortIcon('rota')}
                          </div>
                          <Input placeholder="Filtrar..." className="h-7 text-[10px]" onChange={(e) => handleFilterChange('rota', e.target.value)} />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[80px] py-4 px-4 bg-white">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('entregas')}>
                            <span className="text-[10px] font-bold uppercase text-slate-500">Entr.</span>
                            {renderSortIcon('entregas')}
                          </div>
                          <Input placeholder="Filt." className="h-7 text-[10px]" onChange={(e) => handleFilterChange('entregas', e.target.value)} />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[110px] py-4 px-4 bg-white">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1 cursor-pointer flex-1" onClick={() => handleSort('uf')}>
                              <span className="text-[10px] font-bold uppercase text-slate-500">UF</span>
                              {renderSortIcon('uf')}
                            </div>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                                  <Filter size={12} className={selectedUFs.length > 0 ? "text-amber-600" : "text-slate-300"} />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-44 p-2">
                                <div className="space-y-3">
                                  <div className="space-y-1 border-b pb-2">
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block px-1">Ordenar</span>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className={`w-full justify-start text-xs h-7 px-1 font-semibold ${sortConfig.key === 'uf' && sortConfig.direction === 'asc' ? 'bg-amber-50 text-amber-600' : ''}`}
                                      onClick={() => setSortConfig({ key: 'uf', direction: 'asc' })}
                                    >
                                      <ArrowUp size={12} className="mr-1.5" />
                                      A-Z (Ordem Crescente)
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className={`w-full justify-start text-xs h-7 px-1 font-semibold ${sortConfig.key === 'uf' && sortConfig.direction === 'desc' ? 'bg-amber-50 text-amber-600' : ''}`}
                                      onClick={() => setSortConfig({ key: 'uf', direction: 'desc' })}
                                    >
                                      <ArrowDown size={12} className="mr-1.5" />
                                      Z-A (Ordem Decrescente)
                                    </Button>
                                    {(sortConfig.key === 'uf' && sortConfig.direction !== null) && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="w-full justify-start text-[10px] h-6 px-1 text-slate-400"
                                        onClick={() => setSortConfig({ key: '', direction: null })}
                                      >
                                        Remover Ordenação
                                      </Button>
                                    )}
                                  </div>
                                  <div className="space-y-2">
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block px-1">Filtrar por UF</span>
                                    <div className="max-h-40 overflow-y-auto space-y-1.5 px-1">
                                      {allUFs.map(uf => (
                                        <div key={uf} className="flex items-center space-x-2">
                                          <Checkbox 
                                            id={`uf-${uf}`} 
                                            checked={selectedUFs.includes(uf)}
                                            onCheckedChange={(checked) => {
                                              if (checked) setSelectedUFs([...selectedUFs, uf]);
                                              else setSelectedUFs(selectedUFs.filter(u => u !== uf));
                                            }}
                                          />
                                          <Label htmlFor={`uf-${uf}`} className="text-xs font-bold">{uf}</Label>
                                        </div>
                                      ))}
                                    </div>
                                    {selectedUFs.length > 0 && (
                                      <Button variant="ghost" size="sm" className="w-full text-[10px] h-6 mt-1" onClick={() => setSelectedUFs([])}>Limpar Filtros</Button>
                                    )}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="h-7 flex items-center px-2 bg-slate-50 rounded border text-[10px] font-bold text-slate-500">
                            {selectedUFs.length > 0 ? selectedUFs.join(', ') : 'Todos'}
                          </div>
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[130px] py-4 px-4 bg-white">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('peso')}>
                            <span className="text-[10px] font-bold uppercase text-slate-500">Peso</span>
                            {renderSortIcon('peso')}
                          </div>
                          <Input placeholder="Filtrar..." className="h-7 text-[10px]" onChange={(e) => handleFilterChange('peso', e.target.value)} />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[140px] py-4 px-4 bg-white">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('veiculo')}>
                            <span className="text-[10px] font-bold uppercase text-slate-500">Veículo</span>
                            {renderSortIcon('veiculo')}
                          </div>
                          <Input placeholder="Filtrar..." className="h-7 text-[10px]" onChange={(e) => handleFilterChange('veiculo', e.target.value)} />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[100px] py-4 px-4 bg-white">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('frete')}>
                            <span className="text-[10px] font-bold uppercase text-slate-500">Frete</span>
                            {renderSortIcon('frete')}
                          </div>
                          <Input placeholder="Filtrar..." className="h-7 text-[10px]" onChange={(e) => handleFilterChange('frete', e.target.value)} />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[150px] py-4 px-4 bg-white">
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold uppercase text-slate-500">Status</span>
                          <Input placeholder="Filtrar..." className="h-7 text-[10px]" onChange={(e) => handleFilterChange('status', e.target.value)} />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((load) => (
                      <TableRow key={load.id} className="hover:bg-slate-50/50">
                        <TableCell className="p-2 flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setSelectedDetailLoad(load)}
                            className="h-8 w-8 text-amber-600 hover:bg-amber-50"
                            title="Ver detalhes e calcular frete"
                          >
                            <Eye size={16} />
                          </Button>
                        </TableCell>
                        <TableCell className="text-[11px] font-medium whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {newLoadKeys.has(getLoadKey(load)) && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white animate-bounce shadow-xs uppercase tracking-wider">
                                <Sparkles size={10} /> NOVA
                              </span>
                            )}
                            <span>{load.data}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[11px] font-medium max-w-[300px]">
                          <div className="truncate" title={load.rota}>{load.rota}</div>
                        </TableCell>
                        <TableCell className="text-[11px] text-center">{load.entregas}</TableCell>
                        <TableCell className="text-[11px] text-center font-bold">{load.uf}</TableCell>
                        <TableCell className="text-[11px] text-right font-medium whitespace-nowrap">{formatWeight(load.peso)}</TableCell>
                        <TableCell className="text-[11px] text-center font-semibold">
                          <Select 
                            value={getVehicleType(load)} 
                            onValueChange={(value) => handleUpdateLoad(load.id, { manualVehicleType: value === 'AUTO' ? undefined : value })}
                          >
                            <SelectTrigger className={`h-7 text-[10px] font-bold border rounded px-2 w-[145px] mx-auto flex justify-between items-center ${
                              load.manualVehicleType 
                                ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-xs' 
                                : 'bg-amber-50/80 text-amber-800 border-amber-200/80 hover:bg-amber-100/60'
                            }`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VEHICLE_OPTIONS.map(option => (
                                <SelectItem key={option} value={option} className="text-xs font-bold">
                                  {option}
                                </SelectItem>
                              ))}
                              {load.manualVehicleType && (
                                <SelectItem value="AUTO" className="text-xs text-slate-500 italic border-t mt-1 pt-1">
                                  ↺ Restaurar Automático
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-[11px] text-center"><span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">{load.frete}</span></TableCell>
                        <TableCell className="text-[11px]">
                          {renderStatusBadge(load)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Modal Único e Responsivo de Detalhamento e Cálculo (Otimizado para iPhone XR e Desktop) */}
      <Dialog open={!!activeDetailLoad} onOpenChange={(open) => !open && setSelectedDetailLoad(null)}>
        {activeDetailLoad && (
          <DialogContent className="w-[96vw] max-w-5xl max-h-[92dvh] p-3 sm:p-6 overflow-y-auto rounded-xl">
            <DialogHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b">
              <div className="flex flex-col gap-1 min-w-0">
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <img src="/logo.png" className="h-5 sm:h-6 w-auto shrink-0" />
                  <span>Detalhamento da Carga</span>
                </DialogTitle>
                <DialogDescription className="font-bold text-slate-900 text-xs sm:text-sm break-words">
                  Rota: {activeDetailLoad.rota}
                </DialogDescription>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                <div className="flex items-center gap-2 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 shadow-2xs">
                  <ArrowRightLeft size={13} className="text-amber-600" />
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Nova Tabela CIF</span>
                  <Switch 
                    checked={activeDetailLoad.useEqualizationTable} 
                    onCheckedChange={(checked) => handleUpdateLoad(activeDetailLoad.id, { useEqualizationTable: checked })}
                    className="scale-90 data-[state=checked]:bg-amber-500"
                  />
                </div>
                <Button 
                  size="sm" 
                  onClick={() => handleSaveLoad(activeDetailLoad)} 
                  disabled={saving} 
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 h-8 text-xs font-bold"
                >
                  {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Salvar
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => handlePrintDetailed(activeDetailLoad)} 
                  className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5 h-8 text-xs font-bold"
                >
                  <Printer size={14} /> Imprimir Motorista
                </Button>
              </div>
            </DialogHeader>
            
            <div className="mt-3">
              <div className="overflow-x-auto -mx-1 sm:mx-0 rounded-lg border border-slate-200">
                <Table className="min-w-[650px]">
                  <TableHeader className="bg-slate-900">
                    <TableRow>
                      <TableHead className="text-white text-[10px] uppercase w-12 text-center">Entr.</TableHead>
                      <TableHead className="text-white text-[10px] uppercase">Cidade</TableHead>
                      <TableHead className="text-white text-[10px] uppercase w-12 text-center">UF</TableHead>
                      <TableHead className="text-white text-[10px] uppercase w-20 text-center">CIF/FOB</TableHead>
                      <TableHead className="text-white text-[10px] uppercase w-28 text-right">Peso (KG)</TableHead>
                      <TableHead className="text-white text-[10px] uppercase w-32">Alíquota</TableHead>
                      <TableHead className="text-white text-[10px] uppercase w-32 text-right">Frete a Receber</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeDetailLoad.parsedDeliveries?.map((delivery, dIdx) => (
                      <TableRow key={dIdx} className="hover:bg-slate-50/50">
                        <TableCell className="text-xs font-bold text-center">{dIdx + 1}</TableCell>
                        <TableCell className="text-xs uppercase font-medium">{delivery.city}</TableCell>
                        <TableCell className="text-xs font-bold text-center">{delivery.uf}</TableCell>
                        <TableCell className="text-xs text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${delivery.type === 'CIF' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                            {delivery.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          <Input 
                            type="number" 
                            className="h-7 w-24 text-xs text-right ml-auto" 
                            value={delivery.weight} 
                            onChange={(e) => handleUpdateDelivery(activeDetailLoad.id, dIdx, { weight: parseFloat(e.target.value) || 0 })} 
                          />
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <Input 
                              type="number" 
                              step="0.00000001" 
                              className={`h-7 w-24 text-xs ${delivery.aliquot === 0 ? 'border-red-500 bg-red-50' : ''}`} 
                              value={delivery.aliquot} 
                              onChange={(e) => handleUpdateDelivery(activeDetailLoad.id, dIdx, { aliquot: parseFloat(e.target.value) || 0 })} 
                            />
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-600 hover:bg-amber-50">
                                  <Search size={12} />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-2">
                                <div className="space-y-2">
                                  <Input 
                                    placeholder="Pesquisar cidade..." 
                                    className="h-8 text-xs" 
                                    value={manualSearch} 
                                    onChange={(e) => setManualSearch(e.target.value)} 
                                  />
                                  <div className="max-h-60 overflow-y-auto space-y-1">
                                    {(delivery.type === 'CIF' ? (activeDetailLoad.useEqualizationTable ? freightTables.equalization : freightTables.cif) : freightTables.fob)
                                      .filter((row: any) => {
                                        const name = (delivery.type === 'CIF' && activeDetailLoad.useEqualizationTable) ? String(row['B'] || '') : (delivery.type === 'CIF' ? String(row['B'] || '') : String(row['A'] || ''));
                                        return normalizeText(name).includes(normalizeText(manualSearch));
                                      })
                                      .slice(0, 50)
                                      .map((row: any, idx: number) => (
                                        <Button 
                                          key={idx} 
                                          variant="ghost" 
                                          className="w-full flex flex-col items-start text-[10px] h-auto py-2 px-2 border-b last:border-0" 
                                          onClick={() => {
                                            let finalVal = 0;
                                            const weight = delivery.weight;
                                            if (delivery.type === 'CIF') {
                                              if (activeDetailLoad.useEqualizationTable) {
                                                let col = 'F';
                                                const totalD = activeDetailLoad.manualDeliveryCount || 1;
                                                if (totalD >= 2 && totalD <= 3) col = 'G';
                                                else if (totalD >= 4 && totalD <= 10) col = 'H';
                                                else if (totalD > 10) col = 'I';
                                                const rawVal = row[col as keyof typeof row];
                                                finalVal = parseValue(rawVal) / 1000;
                                              } else {
                                                if (weight <= 7000) finalVal = parseFloat(String(row['I'] || 0)) / 1000;
                                                else if (weight <= 17000) finalVal = parseFloat(String(row['J'] || 0)) / 1000;
                                                else finalVal = parseFloat(String(row['K'] || 0)) / 1000;
                                              }
                                            } else {
                                              if (weight <= 3000) finalVal = parseFloat(String(row['C'] || 0)) / 1000;
                                              else if (weight <= 14000) finalVal = parseFloat(String(row['F'] || 0)) / 1000;
                                              else finalVal = parseFloat(String(row['I'] || 0)) / 1000;
                                            }
                                            handleUpdateDelivery(activeDetailLoad.id, dIdx, { aliquot: finalVal });
                                          }}
                                        >
                                          <div className="font-bold uppercase">
                                            {delivery.type === 'CIF' ? (activeDetailLoad.useEqualizationTable ? `${row['B']} (${row['E']})` : `${row['B']} (${row['E']})`) : `${row['A']} (${row['B']})`}
                                          </div>
                                        </Button>
                                      ))}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-right">R$ {formatCurrency(delivery.freight)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 font-bold border-t-2">
                      <TableCell className="text-xs" colSpan={2}>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase text-slate-500">Qtd. Entregas:</span>
                          <Input 
                            type="number" 
                            className="h-7 w-16 text-xs font-bold bg-white" 
                            value={activeDetailLoad.manualDeliveryCount} 
                            onChange={(e) => handleUpdateLoad(activeDetailLoad.id, { manualDeliveryCount: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      </TableCell>
                      <TableCell colSpan={2} className="text-right uppercase text-[10px] text-slate-500">Total:</TableCell>
                      <TableCell className="text-xs font-bold text-right">{formatWeight(activeDetailLoad.parsedDeliveries?.reduce((acc, d) => acc + d.weight, 0) || 0)}</TableCell>
                      <TableCell className="text-xs text-center">-</TableCell>
                      <TableCell className="text-xs text-amber-700 font-black text-right">R$ {formatCurrency(activeDetailLoad.parsedDeliveries?.reduce((acc, d) => acc + d.freight, 0) || 0)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {(() => {
                const baseFreightToReceive = activeDetailLoad.parsedDeliveries?.reduce((acc, d) => acc + d.freight, 0) || 0;
                const complementaryValue = activeDetailLoad.complementaryValue || 0;
                const totalReceived = baseFreightToReceive + complementaryValue;
                const totalToPay = activeDetailLoad.totalToPay || 0;
                const tax = totalReceived * TAX_RATE; // 14%
                const marginBefore = totalReceived - totalToPay;
                const marginAfter = totalReceived - totalToPay - tax;
                const marginBeforePct = totalReceived > 0 ? (marginBefore / totalReceived) * 100 : 0;
                const marginAfterPct = totalReceived > 0 ? (marginAfter / totalReceived) * 100 : 0;

                return (
                  <div className="mt-5 flex flex-col items-stretch sm:items-end gap-2.5 border-t pt-4">
                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 text-xs">
                      <span className="text-slate-500 font-bold uppercase">Frete Tabela a Receber:</span>
                      <span className="font-bold text-slate-800">R$ {formatCurrency(baseFreightToReceive)}</span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 text-xs">
                      <span className="text-amber-800 font-bold uppercase">
                        Valor Complementar (Ajuda de Custo):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-semibold">R$</span>
                        <Input 
                          type="number" 
                          step="0.01" 
                          className="h-8 w-32 text-xs font-bold border-amber-300 bg-amber-50/70 text-amber-900" 
                          value={activeDetailLoad.complementaryValue ?? ''} 
                          placeholder="0,00"
                          onChange={(e) => handleUpdateLoad(activeDetailLoad.id, { complementaryValue: parseFloat(e.target.value) || 0 })} 
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 text-xs bg-amber-100/70 px-3 py-2 rounded-lg border border-amber-300">
                      <span className="text-amber-900 font-black uppercase">Valor Total a Receber:</span>
                      <span className="font-black text-amber-950 text-sm">R$ {formatCurrency(totalReceived)}</span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 text-xs pt-1">
                      <span className="text-slate-600 font-bold uppercase">Total a Pagar (Motorista):</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-semibold">R$</span>
                        <Input 
                          type="number" 
                          step="0.01" 
                          className="h-8 w-32 text-xs font-bold" 
                          value={totalToPay} 
                          onChange={(e) => handleUpdateLoad(activeDetailLoad.id, { totalToPay: parseFloat(e.target.value) || 0 })} 
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 text-xs pt-2 border-t w-full">
                      <span className="text-slate-500 font-bold uppercase">Margem antes do Imposto:</span>
                      <span className={`font-black ${marginBefore >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        R$ {formatCurrency(marginBefore)} ({marginBeforePct.toFixed(2)}%)
                      </span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 text-xs">
                      <span className="text-slate-500 font-bold uppercase">Margem depois do Imposto (14%):</span>
                      <span className={`font-black ${marginAfter >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        R$ {formatCurrency(marginAfter)} ({marginAfterPct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Modal de Detalhes dos Alertas / Alterações */}
      <Dialog open={showChangesModal} onOpenChange={setShowChangesModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Bell className="text-amber-600" size={20} />
              Resumo de Notificações e Alterações
            </DialogTitle>
            <DialogDescription>
              Mudanças detectadas na planilha do Google Sheets desde a última checagem.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Dica para iPhone XR / iOS Safari */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2.5 text-xs">
              <Smartphone className="text-blue-600 shrink-0 mt-0.5" size={16} />
              <div>
                <div className="font-bold text-blue-900">Usando no iPhone?</div>
                <div className="text-blue-800 text-[11px] leading-relaxed mt-0.5">
                  Para uma experiência de aplicativo no iPhone, toque no botão <strong>Compartilhar</strong> do Safari ➔ <strong>"Adicionar à Tela de Início"</strong>. Você terá acesso rápido de tela cheia e alertas com som e vibração.
                </div>
              </div>
            </div>

            {/* Cargas com mais de 2h na seguradora (URGENTE) */}
            {counts.seguradoraOverdue > 0 && (
              <div className="p-3 bg-red-50 border-2 border-red-500 rounded-lg shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-wider text-red-700 flex items-center gap-1.5 mb-2">
                  <ShieldAlert size={16} className="text-red-600 animate-bounce" /> 
                  🚨 Cargas com Tempo Limite Excedido na Seguradora (+2h) ({counts.seguradoraOverdue})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {currentLoads
                    .filter(l => {
                      if (!normalizeText(l.status).includes('seguradora')) return false;
                      const info = getSeguradoraTimeInfo(l);
                      return info?.isOverdue;
                    })
                    .map(l => {
                      const info = getSeguradoraTimeInfo(l);
                      return (
                        <div key={l.id} className="p-2.5 rounded-lg border border-red-300 bg-white flex items-center justify-between text-xs shadow-2xs">
                          <div>
                            <div className="font-bold text-slate-900">{l.rota}</div>
                            <div className="text-[11px] text-slate-600">
                              Entrou: <span className="font-bold text-slate-900">{info?.enteredFormatted}</span> • UF: <span className="font-bold">{l.uf}</span> • Peso: {formatWeight(l.peso)}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="px-2.5 py-1 rounded text-[10px] font-black bg-red-600 text-white animate-pulse">
                              Passou {info?.timeElapsedStr}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Novas Cargas */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 mb-2">
                <Sparkles size={14} /> Novas Cargas Detectadas ({newLoadKeys.size})
              </h3>
              {newLoadKeys.size === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded border">Nenhuma nova carga adicionada recentemente.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {currentLoads
                    .filter(l => newLoadKeys.has(getLoadKey(l)))
                    .map(l => (
                      <div key={l.id} className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900">{l.rota}</div>
                          <div className="text-[11px] text-slate-500">
                            Data: <span className="font-semibold">{l.data || 'N/A'}</span> • UF: <span className="font-bold">{l.uf}</span> • Peso: {formatWeight(l.peso)}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800">
                            {l.status || 'NOVA'}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Alterações de Status */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5 mb-2">
                <ShieldAlert size={14} /> Alterações de Status ({Object.keys(statusChangedKeys).length})
              </h3>
              {Object.keys(statusChangedKeys).length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded border">Nenhuma alteração de status recente.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Object.entries(statusChangedKeys).map(([key, diff]) => {
                    const matched = currentLoads.find(l => getLoadKey(l) === key);
                    return (
                      <div key={key} className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900">{matched?.rota || key}</div>
                          <div className="text-[11px] text-slate-500">
                            Data: {matched?.data || 'N/A'} • UF: {matched?.uf || 'N/A'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700 line-through">
                            {diff.oldStatus}
                          </span>
                          <ArrowRight size={12} className="text-amber-600" />
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                            {diff.newStatus}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dica de Notificação do Sistema */}
            {!hasNotificationPermission && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-amber-900">Deseja ser notificado no navegador?</div>
                  <div className="text-amber-700 text-[11px]">Receba avisos instantâneos mesmo com outra aba aberta.</div>
                </div>
                <Button size="sm" onClick={requestNotificationPermission} className="bg-amber-600 hover:bg-amber-700 text-white h-7 text-xs">
                  Ativar Agora
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between items-center sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setNewLoadKeys(new Set());
                setStatusChangedKeys({});
                setShowChangesModal(false);
                showSuccess("Alertas limpos.");
              }}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              <Check size={14} className="mr-1" /> Marcar todos como lidos
            </Button>
            <Button size="sm" onClick={() => setShowChangesModal(false)} className="bg-slate-900 text-white">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exportação das Cargas em Imagem (WhatsApp) */}
      <ExportLoadsImageModal 
        open={showExportModal} 
        onOpenChange={setShowExportModal} 
        loads={activeData} 
        getVehicleType={getVehicleType} 
        formatWeight={formatWeight} 
      />
    </div>
  );
};

export default ExternalLoads;