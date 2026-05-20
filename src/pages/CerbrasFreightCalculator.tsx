"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Printer, 
  Calculator, 
  Truck, 
  User, 
  Calendar, 
  Search, 
  Copy, 
  Edit3, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Building2,
  MapPin,
  MoreVertical,
  X,
  History,
  TrendingUp,
  Percent,
  DollarSign,
  ShieldAlert,
  FileSpreadsheet,
  Settings,
  Pencil,
  Database,
  Star,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger,
  DialogDescription
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';

interface FreightItem {
  id: string;
  fabrica: string;
  cliente: string;
  cnpj: string;
  cidade: string;
  uf: string;
  tipo: string;
  peso: number;
  tonelada: number;
  valor: number;
  especial: boolean;
  nfe?: string;
  cte?: string;
}

interface SavedCalculation {
  id: string;
  driver_name: string;
  driver_plate: string;
  billing_date: string;
  factory: "CERBRAS" | "HIDRACOR" | "HIDRACOR_EXTERNA";
  items: FreightItem[];
  driver_payment: number;
  tax_percent: number;
  created_at: string;
  romaneio_data?: any;
}

interface ClientData {
  cliente: string;
  cnpj: string;
  cidade: string;
  uf: string;
  especial: boolean;
}

interface CityFreight {
  cidade: string;
  uf: string;
  valor: number;
}

interface SpecialClientFreight {
  cliente: string;
  cnpj: string;
  cidade: string;
  uf: string;
  valor: number;
}

interface DriverData {
  motorista: string;
  placa: string;
  veiculo: string;
  capacidade: string;
  antt: string;
}

const CerbrasFreightCalculator = () => {
  const { user } = useAuth();
  
  const [clients, setClients] = useState<ClientData[]>([]);
  const [cityFreights, setCityFreights] = useState<CityFreight[]>([]);
  const [specialFreights, setSpecialFreights] = useState<SpecialClientFreight[]>([]);
  
  const [hidracorClients, setHidracorClients] = useState<ClientData[]>([]);
  const [hidracorCityFreights, setHidracorCityFreights] = useState<any[]>([]);
  const [hidracorSpecialFreights, setHidracorSpecialFreights] = useState<SpecialClientFreight[]>([]);

  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [driverName, setDriverName] = useState("");
  const [driverPlate, setDriverPlate] = useState("");
  const [billingDate, setBillingDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<FreightItem[]>([]);
  const [driverPayment, setDriverPayment] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(13);
  const [isSaving, setIsSaving] = useState(false);
  
  const [savedCalculations, setSavedCalculations] = useState<SavedCalculation[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedFactory, setSelectedFactory] = useState<"CERBRAS" | "HIDRACOR" | "HIDRACOR_EXTERNA">("CERBRAS");

  const [hidracorExternalTables, setHidracorExternalTables] = useState<{ cif: any[], fob: any[], equalization: any[] }>({ cif: [], fob: [], equalization: [] });
  const [useEqualization, setUseEqualization] = useState(true);
  const [deliveryCount, setDeliveryCount] = useState<number>(1);
  const xmlInputRef = useRef<HTMLInputElement>(null);

  const [searchClient, setSearchClient] = useState("");
  const [showClientModal, setShowClientModal] = useState(false);
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [newClient, setNewClient] = useState<ClientData>({
    cliente: "",
    cnpj: "",
    cidade: "",
    uf: "CE",
    especial: false
  });

  const [searchDriver, setSearchDriver] = useState("");
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [isEditingDriver, setIsEditingDriver] = useState(false);
  const [newDriver, setNewDriver] = useState<DriverData>({
    motorista: "",
    placa: "",
    veiculo: "Truck",
    capacidade: "",
    antt: ""
  });


  const [romaneioData, setRomaneioData] = useState({
    ciot_number: "",
    ciot_ok: false,
    manifesto_number: "",
    manifesto_ok: false,
    contas_pagar_mot_ok: false,
    contas_receber_fob_ok: false,
    duplicatas_boletos_ok: false,
    ocorrencias: "",
    adiantamentos: [] as { amount: number; date: string; description: string }[],
    tem_avaria: false,
    avarias: [] as { fabrica: string; valor: number; cliente: string; nfe: string; observacao: string }[],
    carga_quitada: false
  });

  const [showDatabaseModal, setShowDatabaseModal] = useState(false);
  const [dbSearchTerm, setDbSearchTerm] = useState("");
  const [activeDbTab, setActiveDbTab] = useState("clients");
  const [dbFactoryFilter, setDbFactoryFilter] = useState<"CERBRAS" | "HIDRACOR">("CERBRAS");

  const [showCityFreightModal, setShowCityFreightModal] = useState(false);
  const [isEditingCityFreight, setIsEditingCityFreight] = useState(false);
  const [editingCityFreightIndex, setEditingCityFreightIndex] = useState<number | null>(null);
  const [newCityFreight, setNewCityFreight] = useState<CityFreight>({
    cidade: "",
    uf: "CE",
    valor: 0
  });

  const [showSpecialFreightModal, setShowSpecialFreightModal] = useState(false);
  const [isEditingSpecialFreight, setIsEditingSpecialFreight] = useState(false);
  const [editingSpecialFreightIndex, setEditingSpecialFreightIndex] = useState<number | null>(null);
  const [newSpecialFreight, setNewSpecialFreight] = useState<SpecialClientFreight>({
    cliente: "",
    cnpj: "",
    cidade: "",
    uf: "CE",
    valor: 0
  });

  const [showRomaneioListModal, setShowRomaneioListModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState<'summary' | 'detailed'>('summary');
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportSearch, setReportSearch] = useState("");
  const [reportFactoryFilter, setReportFactoryFilter] = useState<string>("ALL");

  const isRomaneio = (calc: SavedCalculation) => {
    return calc.items.length > 0 && calc.items.every(item => item.nfe?.trim() && item.cte?.trim());
  };

  const allDocsFilled = useMemo(() => {
    return items.length > 0 && items.every(item => item.nfe?.trim() && item.cte?.trim());
  }, [items]);

  useEffect(() => {
    loadAllData();
    fetchHistory();
  }, []);

  const loadAllData = async () => {
    setIsLoadingData(true);
    try {
      const clientsRes = await fetch('/Cadastro Clientes Cerbras.xlsx');
      const clientsBuf = await clientsRes.arrayBuffer();
      const clientsWb = XLSX.read(clientsBuf);
      const clientsWs = clientsWb.Sheets[clientsWb.SheetNames[0]];
      const clientsRaw: any[][] = XLSX.utils.sheet_to_json(clientsWs, { header: 1 });
      const clientsHeaderIdx = clientsRaw.findIndex(row => row.some(cell => String(cell).toUpperCase().includes('CLIENTE')));
      const clientsDataStart = clientsHeaderIdx > -1 ? clientsHeaderIdx + 1 : 1;
      const clientsCols = clientsRaw[clientsHeaderIdx] || [];
      const idxCli_C = clientsCols.findIndex(c => String(c).toUpperCase().includes('CLIENTE'));
      const idxCNPJ_C = clientsCols.findIndex(c => String(c).toUpperCase().includes('CNPJ') || String(c).toUpperCase().includes('CPF_CNPJ_'));
      const idxCid_C = clientsCols.findIndex(c => String(c).toUpperCase().includes('CIDADE'));
      const idxUF_C = clientsCols.findIndex(c => String(c).toUpperCase().includes('UF'));
      const idxEsp_C = clientsCols.findIndex(c => String(c).toUpperCase().includes('ESPECIAL'));
      const parsedClients: ClientData[] = clientsRaw.slice(clientsDataStart).map(row => ({
        cliente: String(row[idxCli_C] || '').trim().toUpperCase(),
        cnpj: String(row[idxCNPJ_C] || '').trim(),
        cidade: String(row[idxCid_C] || '').trim(),
        uf: String(row[idxUF_C] || '').trim().toUpperCase(),
        especial: String(row[idxEsp_C] || '').toUpperCase() === 'SIM'
      })).filter(c => c.cliente !== "");
      setClients(parsedClients);

      const cityRes = await fetch('/Fretes por Cidade Cerbras.XLSM');
      const cityBuf = await cityRes.arrayBuffer();
      const cityWb = XLSX.read(cityBuf);
      const citySheetName = cityWb.SheetNames.find(name => name.toLowerCase().includes('planilha')) || cityWb.SheetNames[0];
      const cityWs = cityWb.Sheets[citySheetName];
      const cityRaw: any[][] = XLSX.utils.sheet_to_json(cityWs, { header: 1 });
      const cityHeaderIdx = cityRaw.findIndex(row => row.some(cell => {
        const val = String(cell).toUpperCase();
        return val.includes('CIDADE') || val.includes('CIDADES');
      }));
      const cityDataStart = cityHeaderIdx > -1 ? cityHeaderIdx + 1 : 1;
      const cityCols = cityRaw[cityHeaderIdx] || [];
      const headerMap: Record<string, number> = {};
      cityCols.forEach((c, i) => {
        const header = String(c).toUpperCase();
        if (header.includes('CIDADE') || header.includes('CIDADES') || header.includes('MUNICÍPIO')) headerMap['CIDADE'] = i;
        if (header.includes('UF')) headerMap['UF'] = i;
        if (['FRETE CERBRAS ATUALIZADO', 'FRETE CERBRAS', 'FRETE', 'VALOR FRETE', 'FRETE (R$/TON)'].some(opt => header.includes(opt))) headerMap['FRETE'] = i;
      });
      const idxCid = headerMap['CIDADE'] ?? -1;
      const idxUF = headerMap['UF'] ?? -1;
      let idxFrete = headerMap['FRETE'] ?? -1;
      if (idxFrete === -1 && idxCid > -1 && idxUF > -1) {
        for (let i = Math.max(idxCid, idxUF) + 1; i < cityCols.length; i++) {
          const sample = cityRaw[cityDataStart][i];
          if (typeof sample === 'number') { idxFrete = i; break; }
        }
      }
      const parsedCityFreights: CityFreight[] = cityRaw.slice(cityDataStart).map(row => ({
        cidade: idxCid > -1 ? String(row[idxCid] || '').trim().toUpperCase() : '',
        uf: idxUF > -1 ? String(row[idxUF] || '').trim().toUpperCase() : '',
        valor: idxFrete > -1 && typeof row[idxFrete] === 'number' ? row[idxFrete] : 0,
      })).filter(f => f.cidade && f.uf);
      setCityFreights(parsedCityFreights);

      const specialRes = await fetch('/Clientes Especiais Cerbras.XLSM');
      const specialBuf = await specialRes.arrayBuffer();
      const specialWb = XLSX.read(specialBuf);
      const specialWs = specialWb.Sheets[specialWb.SheetNames[0]];
      const specialRaw: any[][] = XLSX.utils.sheet_to_json(specialWs, { header: 1 });
      const specialHeaderIdx = specialRaw.findIndex(row => row.some(cell => String(cell).toUpperCase().includes('CLIENTE')));
      const specialDataStart = specialHeaderIdx > -1 ? specialHeaderIdx + 1 : 1;
      const specialCols = specialRaw[specialHeaderIdx] || [];
      const idxCli_S = specialCols.findIndex(c => String(c).toUpperCase().includes('CLIENTE'));
      const idxCNPJ_S = specialCols.findIndex(c => String(c).toUpperCase().includes('CNPJ'));
      const idxCid_S = specialCols.findIndex(c => String(c).toUpperCase().includes('CIDADE'));
      const idxUF_S = specialCols.findIndex(c => String(c).toUpperCase().includes('UF'));
      const idxTon_S = specialCols.findIndex(c => String(c).toUpperCase().includes('TONELADA'));
      const parsedSpecialFreights: SpecialClientFreight[] = specialRaw.slice(specialDataStart).map(row => ({
        cliente: String(row[idxCli_S] || '').trim().toUpperCase(),
        cnpj: String(row[idxCNPJ_S] || '').trim(),
        cidade: String(row[idxCid_S] || '').trim(),
        uf: String(row[idxUF_S] || '').trim().toUpperCase(),
        valor: typeof row[idxTon_S] === 'number' ? row[idxTon_S] : 0
      })).filter(f => f.cliente !== "");
      setSpecialFreights(parsedSpecialFreights);

      const driversRes = await fetch('/Dados Motoristas.xlsx');
      const driversBuf = await driversRes.arrayBuffer();
      const driversWb = XLSX.read(driversBuf);
      const driversWs = driversWb.Sheets[driversWb.SheetNames[0]];
      const driversRaw: any[][] = XLSX.utils.sheet_to_json(driversWs, { header: 1 });
      const driversHeaderIdx = driversRaw.findIndex(row => row.some(cell => String(cell).toUpperCase().includes('MOTORISTA')));
      const driversDataStart = driversHeaderIdx > -1 ? driversHeaderIdx + 1 : 1;
      const driversCols = driversRaw[driversHeaderIdx] || [];
      const idxMot = driversCols.findIndex(c => String(c).toUpperCase().includes('MOTORISTA'));
      const idxPla = driversCols.findIndex(c => String(c).toUpperCase().includes('PLACA'));
      const idxVei = driversCols.findIndex(c => String(c).toUpperCase().includes('VEICULO'));
      const idxCap = driversCols.findIndex(c => String(c).toUpperCase().includes('CAPACIDADE'));
      const idxANTT = driversCols.findIndex(c => String(c).toUpperCase().includes('ANTT'));
      const parsedDrivers: DriverData[] = driversRaw.slice(driversDataStart).map(row => ({
        motorista: String(row[idxMot] || '').trim().toUpperCase(),
        placa: String(row[idxPla] || '').trim().toUpperCase(),
        veiculo: String(row[idxVei] || '').trim(),
        capacidade: String(row[idxCap] || '').trim(),
        antt: String(row[idxANTT] || '').trim()
      })).filter(d => d.motorista !== "");
      setDrivers(parsedDrivers);

      const hClientsRes = await fetch('/Cadastro Clientes Hidracor.xlsx');
      const hClientsBuf = await hClientsRes.arrayBuffer();
      const hClientsWb = XLSX.read(hClientsBuf);
      const hClientsWs = hClientsWb.Sheets[hClientsWb.SheetNames[0]];
      const hClientsRaw: any[][] = XLSX.utils.sheet_to_json(hClientsWs, { header: 1 });
      const hParsedClients: ClientData[] = hClientsRaw.slice(1).map(row => ({
        cliente: String(row[0] || '').trim().toUpperCase(),
        cnpj: String(row[1] || '').trim(),
        cidade: String(row[2] || '').trim().toUpperCase(),
        uf: String(row[3] || '').trim().toUpperCase(),
        especial: false
      })).filter(c => c.cliente !== "");
      
      const hSpecialRes = await fetch('/Clientes Especiais Hidracor.XLSM');
      const hSpecialBuf = await hSpecialRes.arrayBuffer();
      const hSpecialWb = XLSX.read(hSpecialBuf);
      const hSpecialWs = hSpecialWb.Sheets[hSpecialWb.SheetNames[0]];
      const hSpecialRaw: any[][] = XLSX.utils.sheet_to_json(hSpecialWs, { header: 1 });
      const hParsedSpecial: SpecialClientFreight[] = hSpecialRaw.slice(1).map(row => ({
        cliente: String(row[0] || '').trim().toUpperCase(),
        cnpj: String(row[1] || '').trim(),
        cidade: String(row[2] || '').trim().toUpperCase(),
        uf: String(row[3] || '').trim().toUpperCase(),
        valor: Number(row[4] || 0)
      })).filter(f => f.cliente !== "");
      
      const hFinalClients = hParsedClients.map(c => ({
        ...c,
        especial: hParsedSpecial.some(s => s.cnpj === c.cnpj)
      }));
      setHidracorClients(hFinalClients);
      setHidracorSpecialFreights(hParsedSpecial);

      const hCityRes = await fetch('/Fretes por Cidade Hidracor.xlsx');
      const hCityBuf = await hCityRes.arrayBuffer();
      const hCityWb = XLSX.read(hCityBuf);
      const hCityWs = hCityWb.Sheets[hCityWb.SheetNames[0]];
      const hCityRaw: any[][] = XLSX.utils.sheet_to_json(hCityWs, { header: 1 });
      
      const hCityHeaderIdx = hCityRaw.findIndex(row => row.some(cell => {
        const val = String(cell).toUpperCase();
        return val.includes('CIDADE') || val.includes('MUNICÍPIO');
      }));
      const hCityDataStart = hCityHeaderIdx > -1 ? hCityHeaderIdx + 1 : 1;
      const hCityCols = hCityRaw[hCityHeaderIdx] || [];
      
      const hHeaderMap: Record<string, number> = {};
      hCityCols.forEach((c, i) => {
        const header = String(c).toUpperCase();
        if (header.includes('CIDADE') || header.includes('MUNICÍPIO')) hHeaderMap['CIDADE'] = i;
        if (header.includes('UF')) hHeaderMap['UF'] = i;
        if (header.includes('17')) hHeaderMap['T17'] = i;
        if (header.includes('14')) hHeaderMap['T14'] = i;
        if (header.includes('11')) hHeaderMap['T11'] = i;
        if (header.includes('6')) hHeaderMap['T6'] = i;
        if (header.includes('3') && !header.includes('<')) hHeaderMap['T3'] = i;
        if (header.includes('<3') || header.includes('MENOR')) hHeaderMap['TLESS3'] = i;
      });

      const hParsedCity = hCityRaw.slice(hCityDataStart).map(row => {
        const parseVal = (v: any) => {
          if (typeof v === 'number') return v;
          if (!v) return 0;
          const clean = String(v).replace('R$', '').replace(/\s/g, '').replace(',', '.').trim();
          return parseFloat(clean) || 0;
        };

        // Usa o mapeamento por header, mas se falhar ou estiver em 0, tenta as colunas fixas C (2) e H (7)
        const getColVal = (key: string, fixedIdx: number) => {
          const val = hHeaderMap[key] !== undefined ? parseVal(row[hHeaderMap[key]]) : 0;
          return val > 0 ? val : parseVal(row[fixedIdx]);
        };

        return {
          cidade: hHeaderMap['CIDADE'] !== undefined ? String(row[hHeaderMap['CIDADE']] || '').trim().toUpperCase() : '',
          uf: hHeaderMap['UF'] !== undefined ? String(row[hHeaderMap['UF']] || '').trim().toUpperCase() : '',
          t17: getColVal('T17', 2),
          t14: getColVal('T14', 3),
          t11: getColVal('T11', 4),
          t6: getColVal('T6', 5),
          t3: getColVal('T3', 6),
          tLess3: getColVal('TLESS3', 7)
        };
      }).filter(f => f.cidade);
      setHidracorCityFreights(hParsedCity);

      // Carregar Tabelas Externas Hidracor
      try {
        const extRes = await fetch('/TABELA_MIDAS_2025.xlsx');
        const extBuf = await extRes.arrayBuffer();
        const extWb = XLSX.read(extBuf);
        
        const cifSheet = extWb.Sheets[extWb.SheetNames[0]];
        const cifData = XLSX.utils.sheet_to_json(cifSheet, { header: 'A' });
        
        const fobSheet = extWb.Sheets[extWb.SheetNames[1]];
        const fobData = XLSX.utils.sheet_to_json(fobSheet, { header: 'A' });

        // Carregar Tabela de Equalização
        const eqRes = await fetch('/TABELA_EQUALIZACAO.xlsx');
        const eqBuf = await eqRes.arrayBuffer();
        const eqWb = XLSX.read(eqBuf);
        const eqSheet = eqWb.Sheets[eqWb.SheetNames[0]];
        const eqData = XLSX.utils.sheet_to_json(eqSheet, { header: 'A' });

        setHidracorExternalTables({
          cif: cifData as any[],
          fob: fobData as any[],
          equalization: eqData as any[]
        });
      } catch (e) {
        console.error("Erro ao carregar tabelas externas:", e);
      }

      // Carregar do Banco de Dados (Supabase)
      try {
        const { data: dbClients, error: clientsError } = await supabase.from('midas_clients').select('*');
        if (!clientsError && dbClients) {
          const formattedDbClients: ClientData[] = dbClients.map(c => ({
            cliente: c.cliente,
            cnpj: c.cnpj,
            cidade: c.cidade,
            uf: c.uf,
            especial: c.especial
          }));
          setClients(prev => {
            const existingCnpjs = new Set(prev.map(p => p.cnpj));
            const uniqueDb = formattedDbClients.filter(c => !existingCnpjs.has(c.cnpj));
            return [...prev, ...uniqueDb];
          });
          setHidracorClients(prev => {
            const existingCnpjs = new Set(prev.map(p => p.cnpj));
            const uniqueDb = formattedDbClients.filter(c => !existingCnpjs.has(c.cnpj));
            return [...prev, ...uniqueDb];
          });
        }

        const { data: dbDrivers, error: driversError } = await supabase.from('midas_drivers').select('*');
        if (!driversError && dbDrivers) {
          const formattedDbDrivers: DriverData[] = dbDrivers.map(d => ({
            motorista: d.motorista,
            placa: d.placa,
            veiculo: d.veiculo,
            capacidade: d.capacidade,
            antt: d.antt
          }));
          setDrivers(prev => {
            const existingPlates = new Set(prev.map(p => p.placa));
            const uniqueDb = formattedDbDrivers.filter(d => !existingPlates.has(d.placa));
            return [...prev, ...uniqueDb];
          });
        }
      } catch (e) {
        console.error("Erro ao carregar dados do banco:", e);
      }

    } catch (error) {
      console.error("Error loading Excel data:", error);
      showError("Erro ao carregar tabelas de referência.");
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (selectedFactory === "HIDRACOR_EXTERNA" && items.length > 0) {
      const updatedItems = items.map(item => {
        if (item.fabrica === "HIDRACOR_EXTERNA") {
          const ton = getHidracorExternalAliquot(item.cidade, item.uf, item.tipo, item.peso);
          return {
            ...item,
            tonelada: ton,
            valor: (item.peso * ton) / 1000
          };
        }
        return item;
      });
      setItems(updatedItems);
    }
  }, [useEqualization, deliveryCount]);

  const getHidracorExternalAliquot = (city: string, uf: string, type: string, weight: number, forceEqualization?: boolean, deliveries?: number) => {
    const normalize = (str: string) => str?.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const parseValue = (val: any) => {
      if (typeof val === 'number') return val;
      const str = String(val || '0').replace('R$', '').trim();
      if (str.includes(',')) return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
      return parseFloat(str) || 0;
    };

    const normCity = normalize(city);
    const cleanUF = uf.substring(0, 2).toUpperCase();
    const isEqualized = forceEqualization !== undefined ? forceEqualization : useEqualization;
    const totalDels = deliveries !== undefined ? deliveries : deliveryCount;

    if (type === 'FOB' || type === 'FOB DIRIGIDO') {
      const matches = hidracorExternalTables.fob.filter(row => normalize(String(row['A'] || '')) === normCity);
      const entry = matches.length === 1 ? matches[0] : matches.find(row => String(row['B'] || '').toUpperCase().includes(cleanUF));
      
      if (!entry) return 0;
      if (weight <= 3000) return parseValue(entry['C']) * 1000;
      if (weight <= 14000) return parseValue(entry['F']) * 1000;
      return parseValue(entry['I']) * 1000;
    }

    // CIF - Lógica de Equalização
    if (isEqualized && hidracorExternalTables.equalization.length > 0) {
      const matches = hidracorExternalTables.equalization.filter(row => normalize(String(row['B'] || '')) === normCity);
      const entry = matches.length === 1 ? matches[0] : matches.find(row => String(row['E'] || '').toUpperCase().includes(cleanUF));

      if (entry) {
        let col = 'F'; // 1 entrega
        if (totalDels >= 2 && totalDels <= 3) col = 'G';
        else if (totalDels >= 4 && totalDels <= 10) col = 'H';
        else if (totalDels > 10) col = 'I';

        // Os valores na tabela de equalização já vêm em R$/Ton ou R$/Kg?
        // No ExternalLoads era val / 1000 para virar R$/Kg. 
        // Como aqui usamos R$/Ton, retornamos o valor direto.
        return parseValue(entry[col as keyof typeof entry]);
      }
    }

    // CIF - Lógica Base (por peso)
    const matches = hidracorExternalTables.cif.filter(row => normalize(String(row['B'] || '')) === normCity);
    const entry = matches.length === 1 ? matches[0] : matches.find(row => String(row['E'] || '').toUpperCase().includes(cleanUF));
    
    if (!entry) return 0;
    if (weight <= 7000) return parseValue(entry['I']); 
    if (weight <= 17000) return parseValue(entry['J']);
    return parseValue(entry['K']);
  };

  const handleXmlUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsLoadingData(true);
    const totalFiles = files.length;
    const currentItemsCount = items.length;
    const newTotalDeliveries = currentItemsCount + totalFiles;
    setDeliveryCount(newTotalDeliveries);

    const extractedData: any[] = [];

    const getXmlData = async (file: File) => {
      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      
      const getTagValue = (tagName: string, parent?: Element) => {
        const root = parent || xmlDoc;
        return root.getElementsByTagName(tagName)[0]?.textContent || "";
      };
      
      const destNode = xmlDoc.getElementsByTagName("dest")[0];
      const enderDestNode = xmlDoc.getElementsByTagName("enderDest")[0];
      
      const modFrete = getTagValue("modFrete");
      const tipo = modFrete === "0" ? "CIF" : "FOB";
      
      const pesos = xmlDoc.getElementsByTagName("pesoB");
      let pesoTotal = 0;
      for (let i = 0; i < pesos.length; i++) {
        pesoTotal += parseFloat(pesos[i].textContent || "0");
      }

      return {
        tipo,
        peso: pesoTotal,
        cliente: getTagValue("xNome", destNode).toUpperCase(),
        cnpj: getTagValue("CNPJ", destNode) || getTagValue("CPF", destNode),
        cidade: getTagValue("xMun", enderDestNode).toUpperCase(),
        uf: getTagValue("UF", enderDestNode).toUpperCase(),
        nfe: getTagValue("nNF")
      };
    };

    for (let i = 0; i < files.length; i++) {
      const data = await getXmlData(files[i]);
      extractedData.push(data);
    }

    const newItems: FreightItem[] = extractedData.map(data => {
      const ton = getHidracorExternalAliquot(data.cidade, data.uf, data.tipo, data.peso, useEqualization, newTotalDeliveries);
      return {
        id: Math.random().toString(36).substr(2, 9),
        fabrica: "HIDRACOR_EXTERNA",
        cliente: data.cliente,
        cnpj: data.cnpj,
        cidade: data.cidade,
        uf: data.uf,
        tipo: data.tipo,
        peso: data.peso,
        tonelada: ton,
        valor: (data.peso * ton) / 1000,
        especial: false,
        nfe: data.nfe,
        cte: ""
      };
    });

    setItems(prev => [...prev, ...newItems]);
    setIsLoadingData(false);
    showSuccess(`${newItems.length} XMLs processados com sucesso!`);
    if (xmlInputRef.current) xmlInputRef.current.value = "";
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('cerbras_freight_calculations')
        .select('*')
        .order('billing_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        const local = localStorage.getItem('cerbras_freight_history');
        if (local) {
          const parsed = JSON.parse(local);
          // Sort local data as well
          parsed.sort((a: any, b: any) => {
            const dateA = a.billing_date || a.created_at;
            const dateB = b.billing_date || b.created_at;
            return dateB.localeCompare(dateA);
          });
          setSavedCalculations(parsed);
        }
      } else { 
        setSavedCalculations(data || []); 
      }
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsLoadingHistory(false); 
    }
  };

  const handleAddItem = (client?: ClientData) => {
    const newItem: FreightItem = {
      id: Math.random().toString(36).substr(2, 9),
      fabrica: selectedFactory,
      cliente: client?.cliente || "",
      cnpj: client?.cnpj || "",
      cidade: client?.cidade || "",
      uf: client?.uf || "CE",
      tipo: "FOB",
      peso: 0,
      tonelada: 0,
      valor: 0,
      especial: client?.especial || false,
      nfe: "",
      cte: ""
    };
    if (client) {
      if (selectedFactory === 'HIDRACOR') {
        if (client.especial) {
          newItem.tonelada = lookupTonelada(client);
          newItem.valor = (newItem.peso * newItem.tonelada) / 1000;
        } else {
          // Para Hidracor comum, não carregamos o valor por tonelada inicialmente
          // Esperamos o usuário preencher o peso para calcular pela faixa
          newItem.tonelada = 0;
        }
      } else {
        newItem.tonelada = lookupTonelada(client);
      }
    }
    setItems([...items, newItem]);
    setSearchClient("");
  };

  const getHidracorCityFreight = (cidade: string, uf: string, currentTotalWeight: number) => {
    if (currentTotalWeight <= 0) return 0;
    
    const superNormalize = (str: string) => {
      if (!str) return "";
      return str.toString()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/\(.*\)/g, '') // Remove tudo entre parênteses
        .replace(/ - .*/g, '') // Remove " - " e o que vem depois (ex: UF)
        .replace(/[^A-Z0-9]/g, '') // Remove tudo que não é letra ou número
        .trim();
    };

    const targetCity = superNormalize(cidade);
    const targetUF = uf.substring(0, 2).toUpperCase();

    // 1. Tenta match exato normalizado
    let city = hidracorCityFreights.find(f => 
      superNormalize(f.cidade) === targetCity && f.uf.substring(0, 2).toUpperCase() === targetUF
    );
    
    // 2. Se não achou, tenta match parcial (uma cidade contém a outra)
    if (!city) {
      city = hidracorCityFreights.find(f => {
        const sourceCity = superNormalize(f.cidade);
        return (sourceCity.includes(targetCity) || targetCity.includes(sourceCity)) && 
               f.uf.substring(0, 2).toUpperCase() === targetUF;
      });
    }
    
    if (!city) return 0;
    
    const ton = currentTotalWeight / 1000;
    if (ton < 3) return city.tLess3;
    if (ton < 6) return city.t3;
    if (ton < 11) return city.t6;
    if (ton < 14) return city.t11;
    if (ton < 17) return city.t14;
    return city.t17;
  };

  const lookupTonelada = (client: ClientData | any) => {
    if (selectedFactory === 'HIDRACOR') {
      if (client.especial) {
        const special = hidracorSpecialFreights.find(f => f.cliente.toUpperCase() === client.cliente.toUpperCase() || f.cnpj === client.cnpj);
        if (special) return special.valor;
      }
      return getHidracorCityFreight(client.cidade, client.uf, totalWeight);
    }
    if (client.especial) {
      const special = specialFreights.find(f => f.cliente.toUpperCase() === client.cliente.toUpperCase() || f.cnpj === client.cnpj);
      if (special) return special.valor;
    }
    const normalize = (str: string) => str?.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const targetCity = normalize(client.cidade);
    const targetUF = normalize(client.uf);
    const standard = cityFreights.find(f => normalize(f.cidade) === targetCity && normalize(f.uf) === targetUF);
    return standard ? standard.valor : 0;
  };

  const totalWeight = items.reduce((acc, i) => acc + i.peso, 0);
  const totalValue = items.reduce((acc, i) => acc + i.valor, 0);
  const fretePossivel = totalValue * 0.77;
  const weightCE = items.filter(i => i.uf === 'CE').reduce((acc, i) => acc + i.peso, 0);
  const weightOthers = items.filter(i => i.uf !== 'CE').reduce((acc, i) => acc + i.peso, 0);

  useEffect(() => {
    if (selectedFactory === 'HIDRACOR' && items.length > 0) {
      let hasAnyChange = false;
      const updatedItems = items.map(item => {
        if (item.fabrica === 'HIDRACOR' && !item.especial) {
          const newTon = getHidracorCityFreight(item.cidade, item.uf, item.peso);
          // Só atualiza automaticamente se encontrarmos um valor válido (> 0)
          // Isso permite que o usuário digite manualmente se a cidade não for encontrada
          if (newTon > 0 && newTon !== item.tonelada) {
            hasAnyChange = true;
            return { ...item, tonelada: newTon, valor: (item.peso * newTon) / 1000 };
          }
        }
        return item;
      });
      
      if (hasAnyChange) {
        setItems(updatedItems);
      }
    }
  }, [totalWeight, selectedFactory, hidracorCityFreights, items]);

  const updateItem = (id: string, updates: Partial<FreightItem>) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...updates };
        if ('peso' in updates || 'tonelada' in updates) updated.valor = (updated.peso * updated.tonelada) / 1000;
        return updated;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => { setItems(items.filter(i => i.id !== id)); };

  const handleSave = async (extraData?: any) => {
    if (!driverName) return showError("Informe o nome do motorista.");
    if (items.length === 0) return showError("Adicione clientes.");

    setIsSaving(true);
    const payload = {
      driver_name: driverName.toUpperCase(),
      driver_plate: driverPlate.toUpperCase(),
      billing_date: billingDate,
      factory: selectedFactory,
      items: items,
      driver_payment: driverPayment,
      tax_percent: taxPercent,
      user_id: user?.id,
      created_at: new Date().toISOString(),
      romaneio_data: extraData || romaneioData
    };

    try {
      let error;
      if (editingId) {
        const { error: err } = await supabase.from('cerbras_freight_calculations').update(payload).eq('id', editingId);
        error = err;
      } else {
        const { error: err } = await supabase.from('cerbras_freight_calculations').insert([payload]);
        error = err;
      }
      if (error) {
        const history = [...savedCalculations];
        if (editingId) {
          const idx = history.findIndex(h => h.id === editingId);
          history[idx] = { ...payload, id: editingId } as any;
        } else {
          history.unshift({ ...payload, id: Math.random().toString() } as any);
        }
        localStorage.setItem('cerbras_freight_history', JSON.stringify(history));
        setSavedCalculations(history);
      }
      showSuccess("Cálculo salvo!");
      resetForm();
      fetchHistory();
    } catch (e) { showError("Erro ao salvar."); } finally { setIsSaving(false); }
  };

  const resetForm = () => {
    setDriverName(""); setDriverPlate(""); setBillingDate(new Date().toISOString().split('T')[0]);
    setItems([]); setDriverPayment(0); setTaxPercent(13); setEditingId(null); setSelectedFactory("CERBRAS");
    setRomaneioData({ 
      ciot_number: "", 
      ciot_ok: false, 
      manifesto_number: "", 
      manifesto_ok: false, 
      contas_pagar_mot_ok: false, 
      contas_receber_fob_ok: false, 
      duplicatas_boletos_ok: false, 
      ocorrencias: "", 
      adiantamentos: [],
      tem_avaria: false,
      avarias: [],
      carga_quitada: false 
    });
  };

  const handleEdit = (calc: SavedCalculation) => {
    setDriverName(calc.driver_name); setDriverPlate(calc.driver_plate || ""); setBillingDate(calc.billing_date);
    setItems(calc.items); setDriverPayment(calc.driver_payment || 0); setTaxPercent(calc.tax_percent || 13);
    setEditingId(calc.id); setSelectedFactory(calc.factory || "CERBRAS");
    if (calc.romaneio_data) setRomaneioData(prev => ({ ...prev, ...calc.romaneio_data }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClone = (calc: SavedCalculation) => {
    setDriverName(calc.driver_name); setDriverPlate(calc.driver_plate || ""); setBillingDate(new Date().toISOString().split('T')[0]);
    setItems(calc.items.map(i => ({ ...i, id: Math.random().toString(36).substr(2, 9) })));
    setDriverPayment(calc.driver_payment || 0); setTaxPercent(calc.tax_percent || 13); setEditingId(null);
    setSelectedFactory(calc.factory || "CERBRAS");
    showSuccess("Cálculo clonado!");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir?")) return;
    try {
      const { error } = await supabase.from('cerbras_freight_calculations').delete().eq('id', id);
      if (error) {
        const history = savedCalculations.filter(c => c.id !== id);
        localStorage.setItem('cerbras_freight_history', JSON.stringify(history));
        setSavedCalculations(history);
      } else { setSavedCalculations(savedCalculations.filter(c => c.id !== id)); }
      showSuccess("Excluído.");
    } catch (e) { showError("Erro ao excluir."); }
  };

  const filteredClients = useMemo(() => {
    if (searchClient.length < 2) return [];
    const source = selectedFactory === 'HIDRACOR' ? hidracorClients : clients;
    return source.filter(c => c.cliente.toLowerCase().includes(searchClient.toLowerCase()) || c.cnpj.includes(searchClient)).slice(0, 10);
  }, [searchClient, clients, hidracorClients, selectedFactory]);

  const filteredDrivers = useMemo(() => {
    if (searchDriver.length < 2) return [];
    return drivers.filter(d => d.motorista.toLowerCase().includes(searchDriver.toLowerCase()) || d.placa.toLowerCase().includes(searchDriver.toLowerCase())).slice(0, 10);
  }, [searchDriver, drivers]);

  const filteredDbClients = useMemo(() => {
    const source = dbFactoryFilter === 'CERBRAS' ? clients : hidracorClients;
    return source.filter(c => 
      c.cliente.toLowerCase().includes(dbSearchTerm.toLowerCase()) || 
      c.cnpj.includes(dbSearchTerm) || 
      c.cidade.toLowerCase().includes(dbSearchTerm.toLowerCase())
    );
  }, [dbSearchTerm, clients, hidracorClients, dbFactoryFilter]);

  const filteredDbDrivers = useMemo(() => {
    return drivers.filter(d => 
      d.motorista.toLowerCase().includes(dbSearchTerm.toLowerCase()) || 
      d.placa.toLowerCase().includes(dbSearchTerm.toLowerCase())
    );
  }, [dbSearchTerm, drivers]);

  const filteredDbCityFreights = useMemo(() => {
    const source = dbFactoryFilter === 'CERBRAS' ? cityFreights : hidracorCityFreights;
    return source.filter(f => 
      f.cidade.toLowerCase().includes(dbSearchTerm.toLowerCase()) || 
      f.uf.toLowerCase().includes(dbSearchTerm.toLowerCase())
    );
  }, [dbSearchTerm, cityFreights, hidracorCityFreights, dbFactoryFilter]);

  const filteredDbSpecialFreights = useMemo(() => {
    const source = dbFactoryFilter === 'CERBRAS' ? specialFreights : hidracorSpecialFreights;
    return source.filter(f => 
      f.cliente.toLowerCase().includes(dbSearchTerm.toLowerCase()) || 
      f.cnpj.includes(dbSearchTerm) ||
      f.cidade.toLowerCase().includes(dbSearchTerm.toLowerCase())
    );
  }, [dbSearchTerm, specialFreights, hidracorSpecialFreights, dbFactoryFilter]);

  const subtotalImpostoCE = weightCE * 0.02 * (taxPercent / 100);
  const subtotalImpostoOthers = weightOthers * 0.08 * (taxPercent / 100);
  
  const totalImposto = selectedFactory === "HIDRACOR_EXTERNA"
    ? (totalValue * (taxPercent / 100))
    : (subtotalImpostoCE + subtotalImpostoOthers);

  const saldoMidas = totalValue - driverPayment;
  const percentagePaid = totalValue > 0 ? (driverPayment / totalValue) * 100 : 0;
  
  const totalAdiantamento = useMemo(() => {
    return (romaneioData.adiantamentos || []).reduce((acc, a) => acc + (a.amount || 0), 0);
  }, [romaneioData.adiantamentos]);

  const totalAvariasVal = useMemo(() => {
    return (romaneioData.avarias || []).reduce((acc, a) => acc + (a.valor || 0), 0);
  }, [romaneioData.avarias]);

  const lucroLiquido = totalValue - driverPayment - totalImposto - totalAvariasVal;
  const saldoFinalMotorista = driverPayment - totalAdiantamento - totalAvariasVal;

  const handleAddAdiantamento = () => {
    setRomaneioData({
      ...romaneioData,
      adiantamentos: [...(romaneioData.adiantamentos || []), { amount: 0, date: new Date().toISOString().split('T')[0], description: "" }]
    });
  };

  const handleRemoveAdiantamento = (index: number) => {
    setRomaneioData({
      ...romaneioData,
      adiantamentos: romaneioData.adiantamentos.filter((_, i) => i !== index)
    });
  };

  const handleAddAvaria = () => {
    setRomaneioData({
      ...romaneioData,
      avarias: [...(romaneioData.avarias || []), { fabrica: "CERBRAS", valor: 0, cliente: "", nfe: "", observacao: "" }]
    });
  };

  const handleRemoveAvaria = (index: number) => {
    setRomaneioData({
      ...romaneioData,
      avarias: romaneioData.avarias.filter((_, i) => i !== index)
    });
  };

  const handleSelectDriver = (d: DriverData) => { setDriverName(d.motorista); setDriverPlate(d.placa); setSearchDriver(""); };

  const handleSaveClient = async () => {
    if (!newClient.cliente || !newClient.cnpj || !newClient.cidade) return showError("Campos obrigatórios.");
    const client = { ...newClient, cliente: newClient.cliente.toUpperCase() };
    
    try {
      const { error } = await supabase.from('midas_clients').upsert([{
        cliente: client.cliente,
        cnpj: client.cnpj,
        cidade: client.cidade,
        uf: client.uf,
        especial: client.especial,
        user_id: user?.id
      }], { onConflict: 'cnpj' });

      if (error) throw error;
      
      if (isEditingClient) { setClients(clients.map(c => c.cnpj === client.cnpj ? client : c)); } 
      else { setClients([client, ...clients]); handleAddItem(client); }
      
      showSuccess("Cliente salvo no banco de dados!");
      setShowClientModal(false);
    } catch (error: any) {
      showError("Erro ao salvar cliente: " + error.message);
    }
  };

  const handleSaveDriver = async () => {
    if (!newDriver.motorista || !newDriver.placa) return showError("Nome e Placa.");
    const driver = { ...newDriver, motorista: newDriver.motorista.toUpperCase(), placa: newDriver.placa.toUpperCase() };
    
    try {
      const { error } = await supabase.from('midas_drivers').upsert([{
        motorista: driver.motorista,
        placa: driver.placa,
        veiculo: driver.veiculo,
        capacidade: driver.capacidade,
        antt: driver.antt,
        user_id: user?.id
      }], { onConflict: 'placa' });

      if (error) throw error;

      if (isEditingDriver) { setDrivers(drivers.map(d => d.placa === driver.placa ? driver : d)); }
      else { setDrivers([driver, ...drivers]); handleSelectDriver(driver); }
      
      showSuccess("Motorista salvo no banco de dados!");
      setShowDriverModal(false);
    } catch (error: any) {
      showError("Erro ao salvar motorista: " + error.message);
    }
  };

  const handleSaveCityFreight = () => {
    if (!newCityFreight.cidade || !newCityFreight.valor) return showError("Cidade e Valor.");
    const cf = { ...newCityFreight, cidade: newCityFreight.cidade.toUpperCase() };
    if (isEditingCityFreight && editingCityFreightIndex !== null) {
      const updated = [...cityFreights];
      updated[editingCityFreightIndex] = cf;
      setCityFreights(updated);
    } else {
      setCityFreights([cf, ...cityFreights]);
    }
    setShowCityFreightModal(false);
    showSuccess("Frete por cidade salvo!");
  };

  const handleSaveSpecialFreight = () => {
    if (!newSpecialFreight.cliente || !newSpecialFreight.valor) return showError("Cliente e Valor.");
    const sf = { ...newSpecialFreight, cliente: newSpecialFreight.cliente.toUpperCase() };
    if (isEditingSpecialFreight && editingSpecialFreightIndex !== null) {
      const updated = [...specialFreights];
      updated[editingSpecialFreightIndex] = sf;
      setSpecialFreights(updated);
    } else {
      setSpecialFreights([sf, ...specialFreights]);
    }
    setShowSpecialFreightModal(false);
    showSuccess("Frete especial salvo!");
  };

  const handleDeleteClientDB = (cnpj: string) => {
    if (confirm("Excluir cliente?")) {
      setClients(clients.filter(c => c.cnpj !== cnpj));
      showSuccess("Cliente removido.");
    }
  };

  const handleCloneClientDB = (client: ClientData) => {
    const clone = { ...client, cliente: `${client.cliente} (CLONE)`, cnpj: `${client.cnpj}_CLONE` };
    setClients([clone, ...clients]);
    showSuccess("Cliente clonado.");
  };

  const handleDeleteDriverDB = (placa: string) => {
    if (confirm("Excluir motorista?")) {
      setDrivers(drivers.filter(d => d.placa !== placa));
      showSuccess("Motorista removido.");
    }
  };

  const handleCloneDriverDB = (driver: DriverData) => {
    const clone = { ...driver, motorista: `${driver.motorista} (CLONE)`, placa: `${driver.placa}_CLONE` };
    setDrivers([clone, ...drivers]);
    showSuccess("Motorista clonado.");
  };

  const handleDeleteCityFreightDB = (index: number) => {
    if (confirm("Excluir frete por cidade?")) {
      setCityFreights(cityFreights.filter((_, i) => i !== index));
      showSuccess("Removido.");
    }
  };

  const handleCloneCityFreightDB = (cf: CityFreight) => {
    const clone = { ...cf, cidade: `${cf.cidade} (CLONE)` };
    setCityFreights([clone, ...cityFreights]);
    showSuccess("Clonado.");
  };

  const handleDeleteSpecialFreightDB = (index: number) => {
    if (confirm("Excluir frete especial?")) {
      setSpecialFreights(specialFreights.filter((_, i) => i !== index));
      showSuccess("Removido.");
    }
  };

  const handleCloneSpecialFreightDB = (sf: SpecialClientFreight) => {
    const clone = { ...sf, cliente: `${sf.cliente} (CLONE)`, cnpj: `${sf.cnpj}_CLONE` };
    setSpecialFreights([clone, ...specialFreights]);
    showSuccess("Clonado.");
  };

  const handlePrintRomaneio = (calc: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const logoUrl = window.location.origin + "/logo.png";
    const data = calc.romaneio_data || romaneioData;
    const itemsList = calc.items || items;
    const tW = itemsList.reduce((acc: number, i: any) => acc + i.peso, 0);
    const tV = itemsList.reduce((acc: number, i: any) => acc + i.valor, 0);
    const dPay = calc.driver_payment || driverPayment;
    const tPct = calc.tax_percent || taxPercent;
    const wCE = itemsList.filter((i: any) => i.uf === 'CE').reduce((acc: number, i: any) => acc + i.peso, 0);
    const wOthers = itemsList.filter((i: any) => i.uf !== 'CE').reduce((acc: number, i: any) => acc + i.peso, 0);
    
    const impCE = wCE * 0.02 * (tPct / 100);
    const impOthers = wOthers * 0.08 * (tPct / 100);
    
    const tImp = calc.factory === "HIDRACOR_EXTERNA" || selectedFactory === "HIDRACOR_EXTERNA"
      ? (tV * (tPct / 100))
      : (impCE + impOthers);
      
    const tAdiant = (data.adiantamentos || []).reduce((acc: number, a: any) => acc + (a.amount || 0), 0);
    const tAvar = (data.avarias || []).reduce((acc: number, a: any) => acc + (a.valor || 0), 0);
    const saldoMot = dPay - tAdiant - tAvar;

    const content = `
      <html>
        <head>
          <title>Romaneio de Carga - Cerbras</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #000; font-size: 10px; }
            .header { display: flex; align-items: center; justify-content: space-between; border: 1px solid #000; padding: 5px; margin-bottom: 10px; }
            .logo { height: 30px; }
            .title { font-weight: bold; font-size: 14px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th, td { border: 1px solid #000; padding: 4px; text-align: left; }
            th { background: #f3f4f6; font-size: 9px; }
            .info-table { width: 420px; margin-bottom: 5px; }
            .info-table td:first-child { width: 1%; white-space: nowrap; font-weight: bold; background: #f9fafb; padding-right: 15px; }
            .grid-2 { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
            .left-panel { width: 420px; }
            .right-panel { width: 300px; }
            .summary-box { width: 100%; border: 1px solid #000; border-radius: 0; }
            .summary-box td { text-align: right; border-bottom: 1px solid #eee; padding: 4px; }
            .summary-box td:first-child { text-align: left; font-weight: bold; background: #f9fafb; white-space: nowrap; }
            .summary-box tr:last-child td { border-bottom: none; }
            .occurrences { height: 120px; border: 1px solid #000; padding: 5px; margin-top: 10px; flex: 1; }
            .occurrences-title { text-align: center; font-weight: bold; border-bottom: 1px solid #000; margin-bottom: 5px; padding-bottom: 2px; }
            .status-box { border: 1px solid #000; padding: 5px; margin-bottom: 10px; font-weight: bold; }
            .acerto-table { width: 100%; margin-top: 5px; }
            .acerto-table td { padding: 3px 5px; }
            .acerto-table td:first-child { font-weight: bold; width: 120px; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" class="logo" />
            <div class="title">RESUMO DE CARGA</div>
            <div style="font-size: 8px">ID: ${calc.id || 'N/A'}</div>
          </div>
          <table>
            <thead><tr><th>FÁBRICA</th><th>CLIENTE</th><th>CNPJ</th><th>CIDADE</th><th>UF</th><th>NF-e</th><th>TIPO</th><th>CT-e</th><th style="text-align:right">PESO</th><th style="text-align:right">TON</th><th style="text-align:right">VALOR</th><th>ESP</th></tr></thead>
            <tbody>
              ${itemsList.map((i: any) => `<tr><td>${i.fabrica}</td><td>${i.cliente}</td><td>${i.cnpj}</td><td>${i.cidade}</td><td>${i.uf}</td><td>${i.nfe || ''}</td><td>${i.tipo}</td><td>${i.cte || ''}</td><td style="text-align:right">${i.peso.toLocaleString('pt-BR')}</td><td style="text-align:right">${i.tonelada.toLocaleString('pt-BR')}</td><td style="text-align:right">${i.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td><td>${i.especial ? 'S' : 'N'}</td></tr>`).join('')}
              <tr style="font-weight:bold"><td colspan="8" style="text-align:right">TOTAL</td><td style="text-align:right">${tW.toLocaleString('pt-BR')}</td><td></td><td style="text-align:right">R$ ${tV.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td><td></td></tr>
            </tbody>
          </table>

          <div class="grid-2">
            <div class="left-panel">
              <table class="info-table">
                <tr><td>MOTORISTA</td><td>${calc.driver_name}</td></tr>
                <tr><td>PLACA</td><td>${calc.driver_plate}</td></tr>
                <tr><td>DATA</td><td>${calc.billing_date.split('-').reverse().join('/')}</td></tr>
              </table>
              <table class="info-table">
                <tr><td>CONTAS A PAGAR MOTORISTA</td><td>${data.contas_pagar_mot_ok ? 'OK' : 'PENDENTE'}</td></tr>
                <tr><td>CONTAS A RECEBER FOB DIRIGIDO</td><td>${data.contas_receber_fob_ok ? 'OK' : 'PENDENTE'}</td></tr>
                <tr><td>DUPLICATAS/BOLETOS GERADOS</td><td>${data.duplicatas_boletos_ok ? 'OK' : 'PENDENTE'}</td></tr>
              </table>
            </div>
            <div class="right-panel">
              <div class="status-box">
                CIOT: ${data.ciot_number || '---'} [ ${data.ciot_ok ? 'OK' : 'PENDENTE'} ]<br/>
                MANIFESTO: ${data.manifesto_number || '---'} [ ${data.manifesto_ok ? 'OK' : 'PENDENTE'} ]
              </div>
              <table class="summary-box">
                <tr><td>FRETE POSSÍVEL</td><td>R$ ${(tV * 0.77).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>FRETE MOTORISTA</td><td>R$ ${dPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>SALDO MIDAS</td><td>R$ ${(tV - dPay).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                ${(calc.factory === "HIDRACOR_EXTERNA" || selectedFactory === "HIDRACOR_EXTERNA") ? `
                  <tr style="background:#f9fafb"><td>IMPOSTO (${tPct}%)</td><td>R$ ${tImp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                ` : `
                  <tr><td>% FRETE MDF CE</td><td>R$ ${(wCE * 0.02).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                  <tr><td>% FRETE MDF PI/MA</td><td>R$ ${(wOthers * 0.08).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                  <tr><td>% IMPOSTO (${tPct}%)</td><td>R$ ${tImp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                `}
                <tr style="background:#eee; font-size: 11px;"><td>LUCRO LÍQUIDO</td><td><strong>R$ ${(tV - dPay - tImp - tAvar).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td></tr>
              </table>
            </div>
          </div>

          <div class="grid-2" style="margin-top: 5px">
            <div class="occurrences">
              <div class="occurrences-title">OCORRÊNCIAS E OBSERVAÇÕES</div>
              <div style="font-size: 9px;">${data.ocorrencias || ''}</div>
            </div>
            <div class="right-panel">
              <table class="acerto-table" style="border: 1px solid #000;">
                <tr><td>TOTAL ADIANTAMENTOS</td><td style="text-align:right">R$ ${tAdiant.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>TOTAL AVARIAS</td><td style="text-align:right">R$ ${tAvar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                <tr style="font-weight:bold; background:#eee;"><td>SALDO MOTORISTA</td><td style="text-align:right">R$ ${saldoMot.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
              </table>
              <div style="text-align: right; margin-top: 5px; font-weight: bold;">
                CARGA QUITADA: [ ${data.carga_quitada ? 'SIM' : 'NÃO'} ]
              </div>
            </div>
          </div>

          ${(data.avarias || []).length > 0 ? `
            <div style="margin-top: 10px;">
              <div style="font-weight: bold; border-bottom: 1px solid #000; margin-bottom: 5px; font-size: 9px;">DETALHAMENTO DE AVARIAS</div>
              <table style="font-size: 8px;">
                <thead><tr><th>FÁBRICA</th><th>VALOR</th><th>CLIENTE</th><th>NF</th><th>OBSERVAÇÕES</th></tr></thead>
                <tbody>
                  ${data.avarias.map((av: any) => `<tr><td>${av.fabrica}</td><td>R$ ${av.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td><td>${av.cliente}</td><td>${av.nfe}</td><td>${av.observacao}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <div style="margin-top: 30px; text-align: center; border-top: 1px solid #000; width: 200px; margin-left: auto; margin-right: auto; padding-top: 5px; font-size: 9px;">
            Assinatura Responsável
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const exportReportToExcel = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
    showSuccess("Relatório exportado com sucesso!");
  };

  const handlePrintReport = (title: string, columns: string[], rows: any[][]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const content = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; font-size: 10px; }
            h2 { text-align: center; color: #333; text-transform: uppercase; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
            th { background: #f3f4f6; font-weight: bold; }
            .footer { margin-top: 20px; text-align: right; font-size: 8px; color: #666; }
          </style>
        </head>
        <body>
          <h2>${title}</h2>
          <p>Período: ${reportMonth}/${reportYear} | Filtro: ${reportFactoryFilter === 'ALL' ? 'Todas' : reportFactoryFilter}</p>
          <table>
            <thead><tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(r => `<tr>${r.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
          <div class="footer">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const filteredReportData = useMemo(() => {
    return savedCalculations
      .filter(calc => {
        const date = new Date(calc.billing_date);
        const monthMatch = (date.getMonth() + 1) === reportMonth;
        const yearMatch = date.getFullYear() === reportYear;
        const factoryMatch = reportFactoryFilter === 'ALL' || calc.factory === reportFactoryFilter;
        const searchLower = reportSearch.toLowerCase();
        const searchMatch = !reportSearch || 
          calc.driver_name.toLowerCase().includes(searchLower) || 
          calc.items.some(i => i.cidade.toLowerCase().includes(searchLower));
        return monthMatch && yearMatch && factoryMatch && searchMatch;
      })
      .map(calc => {
        const totalValue = calc.items.reduce((acc, i) => acc + i.valor, 0);
        const paid = calc.driver_payment;
        const commission = totalValue - paid;
        
        const cityCounts: Record<string, number> = {};
        calc.items.forEach(i => { cityCounts[i.cidade] = (cityCounts[i.cidade] || 0) + 1; });
        const route = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

        return {
          factory: calc.factory || 'CERBRAS',
          date: calc.billing_date.split('-').reverse().join('/'),
          route,
          driver: calc.driver_name,
          value: totalValue,
          paid,
          commission,
          percent: totalValue > 0 ? (commission / totalValue) * 100 : 0
        };
      });
  }, [savedCalculations, reportMonth, reportYear, reportFactoryFilter, reportSearch]);

  const filteredDetailedData = useMemo(() => {
    const data: any[] = [];
    savedCalculations.forEach(calc => {
      const date = new Date(calc.billing_date);
      const monthMatch = (date.getMonth() + 1) === reportMonth;
      const yearMatch = date.getFullYear() === reportYear;
      const factoryMatch = reportFactoryFilter === 'ALL' || calc.factory === reportFactoryFilter;
      
      if (monthMatch && yearMatch && factoryMatch) {
        calc.items.forEach(item => {
          const searchLower = reportSearch.toLowerCase();
          const searchMatch = !reportSearch || 
            calc.driver_name.toLowerCase().includes(searchLower) || 
            item.cliente.toLowerCase().includes(searchLower) ||
            item.cidade.toLowerCase().includes(searchLower);

          if (searchMatch) {
            data.push({
              factory: calc.factory || 'CERBRAS',
              date: calc.billing_date.split('-').reverse().join('/'),
              driver: calc.driver_name,
              client: item.cliente,
              city: item.cidade,
              uf: item.uf,
              type: item.tipo,
              weight: item.peso,
              ton: item.tonelada,
              total: item.valor
            });
          }
        });
      }
    });
    return data;
  }, [savedCalculations, reportMonth, reportYear, reportFactoryFilter, reportSearch]);

  return (
    <>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b p-4 lg:px-8 flex justify-between items-center sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-4">
            <Link to="/admin"><Button variant="ghost" size="icon" className="hover:bg-amber-50"><ArrowLeft /></Button></Link>
            <div className="flex items-center gap-3">
              <div className="bg-amber-600 p-2 rounded-lg"><Calculator className="text-white" size={20} /></div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Calculo de Fretes</h1>
                <p className="text-slate-500 text-xs">Simulacao e registro de custos logisticos.</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setShowRomaneioListModal(true)}><FileText size={16} /> Romaneios</Button>
            <Button variant="outline" className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setShowReportModal(true)}><TrendingUp size={16} /> Relatórios</Button>
            <Button variant="outline" className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setShowDatabaseModal(true)}><Database size={16} /> Base</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-md shadow-amber-200" onClick={() => handleSave()} disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}{editingId ? "Atualizar" : "Salvar"}</Button>
          </div>
        </header>

      <main className="flex-1 p-4 lg:p-8 space-y-8 max-w-[1600px] mx-auto w-full relative">
        <div className="w-full">
          <div className="space-y-6">
            <Card className="border-none shadow-md overflow-hidden">
              <div className="bg-slate-900 p-1 h-1.5" />
              <CardHeader className="pb-4"><CardTitle className="text-lg flex items-center gap-2"><Truck className="text-amber-600" size={20} /> Informações da Carga</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Fábrica</label>
                  <Select value={selectedFactory} onValueChange={(v: any) => setSelectedFactory(v)}>
                    <SelectTrigger className="bg-white border-slate-200">
                      <SelectValue placeholder="Selecione a fábrica" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CERBRAS">Cerbras</SelectItem>
                      <SelectItem value="HIDRACOR">Hidracor</SelectItem>
                      <SelectItem value="HIDRACOR_EXTERNA">Hidracor Externa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Motorista / Placa</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
                      <Input 
                        placeholder="Pesquisar motorista ou placa..." 
                        className="pl-10 border-slate-200 focus:border-amber-400 focus:ring-amber-400"
                        value={searchDriver || (driverName ? `${driverName} (${driverPlate})` : "")}
                        onChange={(e) => {
                          setSearchDriver(e.target.value);
                          if (driverName) { setDriverName(""); setDriverPlate(""); }
                        }}
                      />
                      {filteredDrivers.length > 0 && !showDriverModal && !showClientModal && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-[60] overflow-hidden">
                          {filteredDrivers.map(d => (
                            <div key={d.placa} className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b last:border-0" onClick={() => handleSelectDriver(d)}>
                              <div><p className="text-xs font-bold">{d.motorista}</p><p className="text-[10px] text-slate-500">PLACA: {d.placa} | {d.veiculo}</p></div>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:bg-amber-50" onClick={(e) => { e.stopPropagation(); setIsEditingDriver(true); setNewDriver(d); setShowDriverModal(true); }}><Pencil size={14} /></Button>
                                <Badge variant="outline" className="text-[9px]">{d.antt}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchDriver.length >= 2 && filteredDrivers.length === 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-[60] p-3 text-center">
                          <p className="text-xs text-slate-500 mb-2">Não encontrado.</p>
                          <Button size="sm" variant="outline" className="text-[10px] h-7 w-full gap-1" onClick={() => { setIsEditingDriver(false); setShowDriverModal(true); setSearchDriver(""); }}><Plus size={12} /> Cadastrar Novo</Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Data de Faturamento</label>
                    <div className="relative"><Calendar className="absolute left-3 top-2.5 text-slate-400" size={18} /><Input type="date" className="pl-10 border-slate-200" value={billingDate} onChange={(e) => setBillingDate(e.target.value)} /></div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">


                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-[120px]">Cliente</TableHead>
                          <TableHead className="w-[100px]">NF-e / CT-e</TableHead>
                          <TableHead className="w-[100px] text-right">Peso (KG)</TableHead>
                          <TableHead className="w-[150px] text-right">R$/Ton</TableHead>
                          <TableHead className="w-[150px] text-right">Valor</TableHead>
                          <TableHead className="w-[80px]">TIPO</TableHead>
                          <TableHead className="w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="h-32 text-center text-slate-400">Nenhum cliente adicionado.</TableCell></TableRow>
                        ) : (
                          items.map((item) => (
                            <TableRow key={item.id} className="group hover:bg-slate-50/50">
                              <TableCell>
                                <div>
                                  <p className="text-xs font-bold uppercase truncate max-w-[200px]">{item.cliente}</p>
                                  <p className="text-[10px] text-slate-400">{item.cidade} - {item.uf}</p>
                                </div>
                                {item.especial && <Badge className="bg-amber-100 text-amber-700 text-[9px] h-4 mt-0.5">ESPECIAL</Badge>}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <Input placeholder="NF-e" className="h-6 text-[10px] px-1" value={item.nfe} onChange={(e) => updateItem(item.id, { nfe: e.target.value })} />
                                  <Input placeholder="CT-e" className="h-6 text-[10px] px-1" value={item.cte} onChange={(e) => updateItem(item.id, { cte: e.target.value })} />
                                </div>
                              </TableCell>
                              <TableCell className="text-right"><Input type="number" className="h-8 text-right text-xs font-bold border-slate-200" value={item.peso || ''} onChange={(e) => updateItem(item.id, { peso: Number(e.target.value) })} /></TableCell>
                              <TableCell className="text-right"><div className="flex items-center justify-end gap-1"><span className="text-[10px] text-slate-400">R$</span><Input type="number" className="h-8 w-32 text-right text-xs font-bold border-slate-200 bg-slate-50" value={item.tonelada || ''} onChange={(e) => updateItem(item.id, { tonelada: Number(e.target.value) })} /></div></TableCell>
                              <TableCell className="text-right"><span className="text-xs font-bold text-amber-700">R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></TableCell>
                              <TableCell>
                                <Select value={item.tipo} onValueChange={(v) => updateItem(item.id, { tipo: v })}>
                                  <SelectTrigger className="h-8 text-[10px] w-20 bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="FOB">FOB</SelectItem>
                                    <SelectItem value="CIF">CIF</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100" onClick={() => removeItem(item.id)}><Trash2 size={14} /></Button></TableCell>
                            </TableRow>
                          ))
                        )}
                        {items.length > 0 && <TableRow className="bg-slate-50 font-bold"><TableCell colSpan={2} className="text-right text-slate-600">TOTAIS</TableCell><TableCell className="text-right">{totalWeight.toLocaleString('pt-BR')} KG</TableCell><TableCell></TableCell><TableCell className="text-right text-amber-600">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell><TableCell colSpan={2}></TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col md:flex-row justify-between items-center mt-4 gap-4 p-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2"><Building2 className="text-amber-600" size={18} /> Clientes na Carga</h3>
                    <div className="relative w-full sm:w-auto flex flex-col sm:flex-row gap-2 flex-1 max-w-2xl">
                      {selectedFactory === "HIDRACOR_EXTERNA" && (
                        <div className="flex items-center gap-2 bg-white border rounded-md px-3 h-9">
                          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="w-3 h-3 accent-amber-600"
                              checked={useEqualization}
                              onChange={(e) => setUseEqualization(e.target.checked)}
                            />
                            Tabela Equalizada
                          </label>
                          <div className="h-4 w-[1px] bg-slate-200 mx-1" />
                          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                            Entregas:
                            <input 
                              type="number" 
                              className="w-10 h-6 border rounded text-center text-xs font-bold bg-white"
                              value={deliveryCount}
                              onChange={(e) => setDeliveryCount(Number(e.target.value))}
                            />
                          </label>
                        </div>
                      )}
                      {selectedFactory === "HIDRACOR_EXTERNA" && (
                        <>
                          <input 
                            type="file" 
                            multiple 
                            accept=".xml" 
                            className="hidden" 
                            ref={xmlInputRef}
                            onChange={handleXmlUpload}
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2 border-amber-600 text-amber-600 bg-white hover:bg-amber-50 h-9"
                            onClick={() => xmlInputRef.current?.click()}
                          >
                            <FileSpreadsheet size={16} /> Importar XMLs
                          </Button>
                        </>
                      )}
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <Input placeholder="Pesquisar cliente para adicionar..." className="pl-10 h-9 text-xs bg-white" value={searchClient} onChange={(e) => setSearchClient(e.target.value)} />
                        {filteredClients.length > 0 && !showClientModal && !showDriverModal && (
                          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border rounded-md shadow-lg z-[60] overflow-hidden">
                            {filteredClients.map(c => (
                              <div key={c.cnpj} className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b last:border-0" onClick={() => handleAddItem(c)}>
                                <div><p className="text-xs font-bold">{c.cliente}</p><p className="text-[10px] text-slate-500">{c.cidade} - {c.uf}</p></div>
                                <div className="flex items-center gap-2">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:bg-amber-50" onClick={(e) => { e.stopPropagation(); setIsEditingClient(true); setNewClient(c); setShowClientModal(true); }}><Pencil size={14} /></Button>
                                  {c.especial && <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[9px]">ESP</Badge>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {searchClient.length >= 2 && filteredClients.length === 0 && (
                          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border rounded-md shadow-lg z-[60] p-3 text-center">
                            <p className="text-xs text-slate-500 mb-2">Não encontrado.</p>
                            <Button size="sm" variant="outline" className="text-[10px] h-7 w-full gap-1" onClick={() => { setIsEditingClient(false); setShowClientModal(true); setSearchClient(""); }}><Plus size={12} /> Cadastrar Novo</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

            </CardContent>
          </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-none shadow-md overflow-hidden bg-white">
                <div className="bg-amber-600 p-1 h-1.5" />
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp size={16} className="text-amber-600" /> Resumo Financeiro</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center p-2 rounded bg-slate-50"><span className="text-xs font-medium text-slate-500">FRETE POSSÍVEL (77%)</span><span className="text-sm font-bold">R$ {fretePossivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between items-center p-2 rounded border border-amber-200 bg-amber-50/30"><span className="text-xs font-bold text-amber-700">FRETE MOTORISTA (PAGO)</span><div className="flex items-center gap-2"><span className="text-[10px] text-amber-600">R$</span><Input type="number" className="h-8 w-32 text-right text-sm font-bold border-amber-200 focus:ring-amber-500" value={driverPayment || ''} onChange={(e) => setDriverPayment(Number(e.target.value))} /></div></div>
                  <div className="flex justify-between items-center p-2 rounded bg-slate-900 text-white"><div className="flex flex-col"><span className="text-[10px] text-slate-400 font-bold uppercase">Saldo Midas</span><span className="text-xs text-slate-300">Margem: {percentagePaid.toFixed(2)}%</span></div><span className="text-lg font-bold text-amber-500">R$ {saldoMidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-md overflow-hidden bg-white">
                <div className="bg-slate-700 p-1 h-1.5" />
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldAlert size={16} className="text-slate-600" /> Impostos e Lucro Líquido</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {selectedFactory === "HIDRACOR_EXTERNA" ? (
                    <div className="p-3 rounded bg-amber-50 border border-amber-100">
                      <p className="text-[10px] font-bold text-amber-700 uppercase">Imposto Simplificado ({taxPercent}%)</p>
                      <p className="text-lg font-bold">R$ {totalImposto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      <p className="text-[9px] text-amber-600 mt-1">* Calculado sobre o valor total da carga</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2 mb-1">
                        <div className="p-2 rounded bg-slate-50 border border-slate-100"><p className="text-[9px] font-bold text-slate-500 uppercase">Frete MDF CE (2%)</p><p className="text-xs font-bold">R$ {(weightCE * 0.02).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                        <div className="p-2 rounded bg-slate-50 border border-slate-100"><p className="text-[9px] font-bold text-slate-500 uppercase">Frete MDF PI/MA (8%)</p><p className="text-xs font-bold">R$ {(weightOthers * 0.08).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="p-2 rounded bg-blue-50/50 border border-blue-100"><p className="text-[9px] font-bold text-blue-600 uppercase">Imposto CE (2%)</p><p className="text-xs font-bold">R$ {subtotalImpostoCE.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                        <div className="p-2 rounded bg-purple-50/50 border border-purple-100"><p className="text-[9px] font-bold text-purple-600 uppercase">Imposto PI/MA (8%)</p><p className="text-xs font-bold">R$ {subtotalImpostoOthers.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center p-2"><span className="text-xs text-slate-500 font-bold uppercase">% Alíquota</span><div className="flex items-center gap-2"><Input type="number" className="h-7 w-16 text-right text-xs" value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value))} /><span className="text-xs text-slate-400">%</span></div></div>
                  <div className="flex justify-between items-center p-3 rounded bg-green-600 text-white shadow-inner"><span className="text-sm font-bold uppercase tracking-wider">Lucro Líquido</span><span className="text-xl font-black">R$ {lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                </CardContent>
              </Card>
            </div>
            </div>

            {/* Seção de Romaneio - Ativada apenas após NF e CTE preenchidos */}
            <Card id="romaneio-section" className={`border-none shadow-lg overflow-hidden transition-all duration-500 ${allDocsFilled ? 'opacity-100 translate-y-0' : 'opacity-40 grayscale pointer-events-none'}`}>
              <div className="bg-amber-500 p-1 h-1.5" />
              <CardHeader className="pb-4 border-b bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileSpreadsheet className="text-amber-600" size={24} /> 
                    Gerar Romaneio de Carga
                  </CardTitle>
                  {!allDocsFilled && (
                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-400 border-slate-300">
                      Aguardando NF-e / CT-e
                    </Badge>
                  )}
                  {allDocsFilled && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => handlePrintRomaneio({ driver_name: driverName, driver_plate: driverPlate, billing_date: billingDate, items, driver_payment: driverPayment, tax_percent: taxPercent, romaneio_data: romaneioData })}>
                        <Printer size={14} /> Imprimir Romaneio
                      </Button>
                      <Button className="h-8 bg-slate-900 hover:bg-black text-white gap-2 shadow-md" onClick={() => handleSave(romaneioData)}>
                        <Save size={14} /> Salvar Tudo
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Documentação</h4>
                    <div className="space-y-3">
                      {/* CIOT */}
                      <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:border-amber-200">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">CIOT</label>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase ${romaneioData.ciot_ok ? 'text-green-600' : 'text-slate-400'}`}>
                              {romaneioData.ciot_ok ? 'OK' : 'PENDENTE'}
                            </span>
                            <Switch 
                              checked={romaneioData.ciot_ok} 
                              onCheckedChange={(v) => setRomaneioData({...romaneioData, ciot_ok: v})} 
                            />
                          </div>
                        </div>
                        <Input 
                          value={romaneioData.ciot_number} 
                          onChange={(e) => setRomaneioData({...romaneioData, ciot_number: e.target.value})} 
                          placeholder="Digite o número do CIOT..." 
                          className="h-8 text-[10px] border-slate-200 focus:border-amber-400 focus:ring-amber-400" 
                        />
                      </div>

                      {/* Manifesto */}
                      <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:border-amber-200">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">MANIFESTO</label>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase ${romaneioData.manifesto_ok ? 'text-green-600' : 'text-slate-400'}`}>
                              {romaneioData.manifesto_ok ? 'OK' : 'PENDENTE'}
                            </span>
                            <Switch 
                              checked={romaneioData.manifesto_ok} 
                              onCheckedChange={(v) => setRomaneioData({...romaneioData, manifesto_ok: v})} 
                            />
                          </div>
                        </div>
                        <Input 
                          value={romaneioData.manifesto_number} 
                          onChange={(e) => setRomaneioData({...romaneioData, manifesto_number: e.target.value})} 
                          placeholder="Digite o número do Manifesto..." 
                          className="h-8 text-[10px] border-slate-200 focus:border-amber-400 focus:ring-amber-400" 
                        />
                      </div>

                      {/* Outros Status */}
                      {[
                        { label: 'CONTAS A PAGAR MOTORISTA', key: 'contas_pagar_mot_ok' as const },
                        { label: 'CONTAS A RECEBER FOB DIRIGIDO', key: 'contas_receber_fob_ok' as const },
                        { label: 'DUPLICATAS / BOLETOS GERADOS', key: 'duplicatas_boletos_ok' as const }
                      ].map(item => (
                        <div key={item.key} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:border-amber-200">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{item.label}</label>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase ${romaneioData[item.key] ? 'text-green-600' : 'text-slate-400'}`}>
                              {romaneioData[item.key] ? 'OK' : 'PENDENTE'}
                            </span>
                            <Switch 
                              checked={romaneioData[item.key]} 
                              onCheckedChange={(v) => setRomaneioData({...romaneioData, [item.key]: v})} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Acerto do Motorista</h4>
                    <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-amber-800 uppercase">Adiantamentos</label>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-6 px-2 text-[9px] font-bold bg-white text-amber-600 border-amber-200 hover:bg-amber-50 gap-1"
                            onClick={handleAddAdiantamento}
                          >
                            <Plus size={10} /> Adicionar Pagamento
                          </Button>
                        </div>
                        
                        {(romaneioData.adiantamentos || []).length === 0 ? (
                          <div className="text-[10px] text-amber-600/50 italic py-2 text-center border border-dashed border-amber-200 rounded-lg bg-white/50">Nenhum adiantamento registrado.</div>
                        ) : (
                          <div className="space-y-2">
                            {romaneioData.adiantamentos.map((adv, idx) => (
                              <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-amber-100 shadow-sm">
                                <div className="relative flex-1">
                                  <span className="absolute left-2 top-2 text-[10px] text-amber-600 font-bold">R$</span>
                                  <Input 
                                    type="number" 
                                    className="h-8 pl-7 text-[11px] font-bold border-amber-100 focus:ring-amber-500" 
                                    value={adv.amount || ''} 
                                    onChange={(e) => {
                                      const newAdv = [...romaneioData.adiantamentos];
                                      newAdv[idx].amount = Number(e.target.value);
                                      setRomaneioData({...romaneioData, adiantamentos: newAdv});
                                    }} 
                                  />
                                </div>
                                <Input 
                                  type="date" 
                                  className="h-8 w-28 text-[10px] border-amber-100" 
                                  value={adv.date} 
                                  onChange={(e) => {
                                    const newAdv = [...romaneioData.adiantamentos];
                                    newAdv[idx].date = e.target.value;
                                    setRomaneioData({...romaneioData, adiantamentos: newAdv});
                                  }} 
                                />
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => handleRemoveAdiantamento(idx)}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-amber-100 flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-amber-800 uppercase">Total Adiantamentos</span>
                        </div>
                        <span className="text-sm font-bold text-amber-700">
                          R$ {totalAdiantamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-amber-100 flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-amber-800 uppercase">Saldo Final Mot.</span>
                          <span className="text-[9px] text-amber-600">Considerando deduções</span>
                        </div>
                        <span className="text-xl font-black text-amber-700">
                          R$ {saldoFinalMotorista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-amber-100">
                        <Checkbox id="main-quitada" checked={romaneioData.carga_quitada} onCheckedChange={(v) => setRomaneioData({...romaneioData, carga_quitada: !!v})} />
                        <label htmlFor="main-quitada" className="text-[10px] font-black uppercase text-amber-900 cursor-pointer">Marcar Carga como Quitada</label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ocorrências</h4>
                      <div className="flex items-center gap-2">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Teve Avaria?</label>
                        <Switch 
                          checked={romaneioData.tem_avaria} 
                          onCheckedChange={(v) => setRomaneioData({...romaneioData, tem_avaria: v})} 
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      {romaneioData.tem_avaria && (
                        <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-red-800 uppercase">Detalhamento de Avarias</label>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-6 px-2 text-[9px] font-bold bg-white text-red-600 border-red-200 hover:bg-red-50 gap-1"
                              onClick={handleAddAvaria}
                            >
                              <Plus size={10} /> Adicionar Avaria
                            </Button>
                          </div>

                          {(romaneioData.avarias || []).length === 0 ? (
                            <div className="text-[10px] text-red-600/50 italic py-2 text-center border border-dashed border-red-200 rounded-lg bg-white/50">Nenhuma avaria registrada.</div>
                          ) : (
                            <div className="space-y-3">
                              {romaneioData.avarias.map((av, idx) => (
                                <div key={idx} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm space-y-3 relative">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <div className="space-y-1">
                                      <label className="text-[8px] font-bold text-slate-500 uppercase">Fábrica</label>
                                      <Select value={av.fabrica} onValueChange={(v) => {
                                        const newAv = [...romaneioData.avarias];
                                        newAv[idx].fabrica = v;
                                        setRomaneioData({...romaneioData, avarias: newAv});
                                      }}>
                                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="CERBRAS">CERBRAS</SelectItem>
                                          <SelectItem value="HIDRACOR">HIDRACOR</SelectItem>
                                          <SelectItem value="OUTRA">OUTRA</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[8px] font-bold text-slate-500 uppercase">Valor</label>
                                      <div className="relative">
                                        <span className="absolute left-2 top-1.5 text-[10px] text-slate-400">R$</span>
                                        <Input 
                                          type="number" 
                                          className="h-7 pl-6 text-[10px] font-bold" 
                                          value={av.valor || ''} 
                                          onChange={(e) => {
                                            const newAv = [...romaneioData.avarias];
                                            newAv[idx].valor = Number(e.target.value);
                                            setRomaneioData({...romaneioData, avarias: newAv});
                                          }} 
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[8px] font-bold text-slate-500 uppercase">Cliente</label>
                                      <Select value={av.cliente} onValueChange={(v) => {
                                        const newAv = [...romaneioData.avarias];
                                        newAv[idx].cliente = v;
                                        setRomaneioData({...romaneioData, avarias: newAv});
                                      }}>
                                        <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                        <SelectContent>
                                          {items.map(i => (
                                            <SelectItem key={i.id} value={i.cliente}>{i.cliente}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[8px] font-bold text-slate-500 uppercase">NF</label>
                                      <Input 
                                        className="h-7 text-[10px]" 
                                        value={av.nfe} 
                                        onChange={(e) => {
                                          const newAv = [...romaneioData.avarias];
                                          newAv[idx].nfe = e.target.value;
                                          setRomaneioData({...romaneioData, avarias: newAv});
                                        }} 
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-slate-500 uppercase">Observações</label>
                                    <Textarea 
                                      className="min-h-[40px] text-[10px] p-2" 
                                      value={av.observacao} 
                                      onChange={(e) => {
                                        const newAv = [...romaneioData.avarias];
                                        newAv[idx].observacao = e.target.value;
                                        setRomaneioData({...romaneioData, avarias: newAv});
                                      }}
                                      placeholder="Descreva a avaria..."
                                    />
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-red-300 hover:text-red-600 absolute top-0 right-0"
                                    onClick={() => handleRemoveAvaria(idx)}
                                  >
                                    <X size={12} />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="pt-2 border-t border-red-100 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-red-800 uppercase">Total Avarias</span>
                            <span className="text-sm font-bold text-red-700">
                              R$ {totalAvariasVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Observações Gerais</label>
                        <Textarea 
                          className="min-h-[80px] text-xs border-slate-200 focus:ring-amber-500" 
                          value={romaneioData.ocorrencias} 
                          onChange={(e) => setRomaneioData({...romaneioData, ocorrencias: e.target.value})}
                          placeholder="Relate aqui qualquer imprevisto ou observação especial sobre esta carga..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
                </CardContent>
              </Card>

        {/* Botão Flutuante do Histórico */}
        <Sheet>
          <SheetTrigger asChild>
            <Button 
              className="fixed right-0 top-1/2 -translate-y-1/2 rounded-l-full h-16 w-10 bg-amber-600 hover:bg-amber-700 text-white shadow-xl flex flex-col items-center justify-center gap-1 z-40 transition-all hover:w-12"
              title="Ver Cálculos Recentes"
            >
              <History size={20} />
              <span className="[writing-mode:vertical-lr] text-[8px] font-bold uppercase tracking-tighter">Histórico</span>
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-md p-0 overflow-hidden flex flex-col">
            <SheetHeader className="p-6 bg-slate-50 border-b">
              <SheetTitle className="flex items-center gap-2"><History className="text-amber-600" size={20} /> Cálculos Recentes</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingHistory ? (
                <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" /></div>
              ) : savedCalculations.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">Nenhum histórico encontrado.</div>
              ) : (
                (() => {
                  const grouped: Record<string, SavedCalculation[]> = {};
                  savedCalculations.forEach(calc => {
                    const date = calc.billing_date || new Date(calc.created_at).toISOString().split('T')[0];
                    if (!grouped[date]) grouped[date] = [];
                    grouped[date].push(calc);
                  });

                  return Object.entries(grouped).map(([date, calcs]) => (
                    <div key={date} className="space-y-3">
                      <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm py-1 border-b border-slate-200 mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          {date.split('-').reverse().join('/')}
                        </span>
                      </div>
                      {calcs.map(calc => (
                        <div key={calc.id} className="p-3 rounded-lg border border-slate-100 bg-white shadow-sm hover:border-amber-200 hover:shadow-md hover:bg-amber-50/30 transition-all group relative">
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1">
                                <Calendar size={10} /> 
                                {calc.billing_date ? calc.billing_date.split('-').reverse().join('/') : new Date(calc.created_at).toLocaleDateString('pt-BR')}
                              </span>
                              {isRomaneio(calc) ? (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 text-[9px] h-4 w-fit px-1">ROMANEIO</Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-400 border-slate-200 text-[9px] h-4 w-fit px-1">COTAÇÃO</Badge>
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}><MoreVertical size={14} /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(calc)} className="gap-2"><Edit3 size={14} /> Editar</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { 
                                    setEditingId(calc.id); 
                                    setItems(calc.items); 
                                    setDriverName(calc.driver_name);
                                    setDriverPlate(calc.driver_plate);
                                    setBillingDate(calc.billing_date);
                                    setSelectedFactory(calc.factory || 'CERBRAS');
                                    setDriverPayment(calc.driver_payment); 
                                    setRomaneioData(prev => ({ ...prev, ...(calc.romaneio_data || {}) })); 
                                    showSuccess("Dados carregados. Verifique a seção de Romaneio abaixo.");
                                    setTimeout(() => {
                                      const el = document.getElementById('romaneio-section');
                                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                                    }, 100);
                                  }} className="gap-2"><FileSpreadsheet size={14} /> Carregar Romaneio</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleClone(calc)} className="gap-2"><Copy size={14} /> Clonar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(calc.id)} className="gap-2 text-red-600"><Trash2 size={14} /> Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex justify-between items-center pr-6">
                            <h4 className="text-xs font-bold text-slate-900 uppercase truncate">{calc.driver_name}</h4>
                            <Badge variant="outline" className="text-[8px] h-3 px-1 border-slate-300 text-slate-500">{calc.factory || 'CERBRAS'}</Badge>
                          </div>
                          <p className="text-[10px] text-slate-400 -mt-1 font-medium">{calc.driver_plate}</p>
                          <div className="flex justify-between items-end mt-2">
                            <div className="text-[10px] text-slate-500"><p>{calc.items.length} clientes</p><p>{calc.items.reduce((acc, i) => acc + i.peso, 0).toLocaleString('pt-BR')} KG</p></div>
                            <p className="text-xs font-bold text-amber-700">R$ {calc.items.reduce((acc, i) => acc + i.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ));
                })()
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      </main>

      <Dialog open={showClientModal} onOpenChange={setShowClientModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="text-amber-600" /> {isEditingClient ? "Editar Cliente" : "Cadastrar Novo Cliente"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Nome do Cliente</label><Input value={newClient.cliente} onChange={(e) => setNewClient({...newClient, cliente: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">CNPJ</label><Input value={newClient.cnpj} onChange={(e) => setNewClient({...newClient, cnpj: e.target.value})} disabled={isEditingClient} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Cidade</label><Input value={newClient.cidade} onChange={(e) => setNewClient({...newClient, cidade: e.target.value})} /></div>
              <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">UF</label><Select value={newClient.uf} onValueChange={(v) => setNewClient({...newClient, uf: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['CE', 'PI', 'MA', 'RN', 'PB', 'PE'].map(uf => (<SelectItem key={uf} value={uf}>{uf}</SelectItem>))}</SelectContent></Select></div>
            </div>
            <div className="flex items-center gap-2 pt-2"><Checkbox id="isEspCli" checked={newClient.especial} onCheckedChange={(c) => setNewClient({...newClient, especial: !!c})} /><label htmlFor="isEspCli" className="text-xs font-bold uppercase">Cliente Especial</label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowClientModal(false)}>Cancelar</Button><Button className="bg-amber-600 text-white" onClick={handleSaveClient}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDriverModal} onOpenChange={setShowDriverModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="text-amber-600" /> {isEditingDriver ? "Editar Motorista" : "Cadastrar Novo Motorista"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Nome do Motorista</label><Input value={newDriver.motorista} onChange={(e) => setNewDriver({...newDriver, motorista: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Placa</label><Input value={newDriver.placa} onChange={(e) => setNewDriver({...newDriver, placa: e.target.value})} disabled={isEditingDriver} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Veículo</label><Select value={newDriver.veiculo} onValueChange={(v) => setNewDriver({...newDriver, veiculo: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Truck', 'Bitruck', 'Carreta', 'Bitrem', 'Rodotrem'].map(v => (<SelectItem key={v} value={v}>{v}</SelectItem>))}</SelectContent></Select></div>
              <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">ANTT</label><Input value={newDriver.antt} onChange={(e) => setNewDriver({...newDriver, antt: e.target.value})} /></div>
            </div>
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Capacidade</label><Input value={newDriver.capacidade} onChange={(e) => setNewDriver({...newDriver, capacidade: e.target.value})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowDriverModal(false)}>Cancelar</Button><Button className="bg-amber-600 text-white" onClick={handleSaveDriver}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>



      <Dialog open={showDatabaseModal} onOpenChange={setShowDatabaseModal}>
        <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
                  <Database className="text-amber-600" size={28} /> Gestão da Base de Dados
                </DialogTitle>
                <DialogDescription>
                  Consulte, edite, inclua ou exclua registros das tabelas de referência.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <Input 
                  placeholder="Pesquisar em toda a base..." 
                  className="pl-10" 
                  value={dbSearchTerm} 
                  onChange={(e) => setDbSearchTerm(e.target.value)} 
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    if (activeDbTab === "clients") { setIsEditingClient(false); setNewClient({ cliente: "", cnpj: "", cidade: "", uf: "CE", especial: false }); setShowClientModal(true); }
                    else if (activeDbTab === "drivers") { setIsEditingDriver(false); setNewDriver({ motorista: "", placa: "", veiculo: "Truck", capacidade: "", antt: "" }); setShowDriverModal(true); }
                    else if (activeDbTab === "cities") { setIsEditingCityFreight(false); setNewCityFreight({ cidade: "", uf: "CE", valor: 0 }); setShowCityFreightModal(true); }
                    else if (activeDbTab === "special") { setIsEditingSpecialFreight(false); setNewSpecialFreight({ cliente: "", cnpj: "", cidade: "", uf: "CE", valor: 0 }); setShowSpecialFreightModal(true); }
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-md"
                >
                  <Plus size={16} /> Novo Registro
                </Button>
              </div>
            </div>

            <Tabs value={activeDbTab} onValueChange={setActiveDbTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <TabsList className="grid grid-cols-4 w-full max-w-2xl bg-slate-100 p-1 rounded-lg">
                  <TabsTrigger value="clients" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm font-bold uppercase text-[10px]">Clientes</TabsTrigger>
                  <TabsTrigger value="drivers" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm font-bold uppercase text-[10px]">Motoristas</TabsTrigger>
                  <TabsTrigger value="cities" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm font-bold uppercase text-[10px]">Frete Cidades</TabsTrigger>
                  <TabsTrigger value="special" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm font-bold uppercase text-[10px]">Clientes Especiais</TabsTrigger>
                </TabsList>

                {(activeDbTab === "cities" || activeDbTab === "special" || activeDbTab === "clients") && (
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <Button 
                      variant={dbFactoryFilter === "CERBRAS" ? "default" : "ghost"} 
                      size="sm" 
                      className={`h-7 px-3 text-[10px] font-bold ${dbFactoryFilter === "CERBRAS" ? "bg-white text-slate-900 shadow-sm hover:bg-white" : "text-slate-500"}`}
                      onClick={() => setDbFactoryFilter("CERBRAS")}
                    >
                      CERBRAS
                    </Button>
                    <Button 
                      variant={dbFactoryFilter === "HIDRACOR" ? "default" : "ghost"} 
                      size="sm" 
                      className={`h-7 px-3 text-[10px] font-bold ${dbFactoryFilter === "HIDRACOR" ? "bg-white text-slate-900 shadow-sm hover:bg-white" : "text-slate-500"}`}
                      onClick={() => setDbFactoryFilter("HIDRACOR")}
                    >
                      HIDRACOR
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-auto mt-4 border border-slate-200 rounded-lg bg-white shadow-inner">
                <TabsContent value="clients" className="m-0">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Cliente</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">CNPJ/CPF</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Cidade/UF</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-center">Tipo</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDbClients.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="h-40 text-center text-slate-400">Nenhum registro encontrado.</TableCell></TableRow>
                      ) : (
                        filteredDbClients.map((c) => (
                          <TableRow key={c.cnpj} className="hover:bg-slate-50/50 group border-b border-slate-100 last:border-0">
                            <TableCell className="font-bold text-xs uppercase text-slate-900">{c.cliente}</TableCell>
                            <TableCell className="text-xs text-slate-500 font-mono">{c.cnpj}</TableCell>
                            <TableCell className="text-xs text-slate-600">{c.cidade} - {c.uf}</TableCell>
                            <TableCell className="text-center">
                              {c.especial ? <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] h-5">ESPECIAL</Badge> : <Badge variant="outline" className="text-[9px] h-5 text-slate-400">NORMAL</Badge>}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-50" title="Editar" onClick={() => { setIsEditingClient(true); setNewClient(c); setShowClientModal(true); }}><Pencil size={14} /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" title="Clonar" onClick={() => handleCloneClientDB(c)}><Copy size={14} /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" title="Excluir" onClick={() => handleDeleteClientDB(c.cnpj)}><Trash2 size={14} /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="drivers" className="m-0">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Motorista</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Placa</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Veículo</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Capacidade</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDbDrivers.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="h-40 text-center text-slate-400">Nenhum registro encontrado.</TableCell></TableRow>
                      ) : (
                        filteredDbDrivers.map((d) => (
                          <TableRow key={d.placa} className="hover:bg-slate-50/50 group border-b border-slate-100 last:border-0">
                            <TableCell className="font-bold text-xs uppercase text-slate-900">{d.motorista}</TableCell>
                            <TableCell className="text-xs font-mono font-bold text-slate-700">{d.placa}</TableCell>
                            <TableCell className="text-xs text-slate-600">{d.veiculo}</TableCell>
                            <TableCell className="text-xs text-slate-500 italic">{d.capacidade}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-50" onClick={() => { setIsEditingDriver(true); setNewDriver(d); setShowDriverModal(true); }}><Pencil size={14} /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleCloneDriverDB(d)}><Copy size={14} /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleDeleteDriverDB(d.placa)}><Trash2 size={14} /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="cities" className="m-0">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      {dbFactoryFilter === 'CERBRAS' ? (
                        <TableRow>
                          <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Cidade</TableHead>
                          <TableHead className="text-[10px] font-bold text-slate-500 uppercase">UF</TableHead>
                          <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Valor R$/Ton</TableHead>
                          <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Ações</TableHead>
                        </TableRow>
                      ) : (
                        <TableRow>
                          <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Cidade</TableHead>
                          <TableHead className="text-[10px] font-bold text-slate-500 uppercase">UF</TableHead>
                          <TableHead className="text-[9px] font-bold text-slate-500 uppercase text-right">T17</TableHead>
                          <TableHead className="text-[9px] font-bold text-slate-500 uppercase text-right">T14</TableHead>
                          <TableHead className="text-[9px] font-bold text-slate-500 uppercase text-right">T11</TableHead>
                          <TableHead className="text-[9px] font-bold text-slate-500 uppercase text-right">T6</TableHead>
                          <TableHead className="text-[9px] font-bold text-slate-500 uppercase text-right">T3</TableHead>
                          <TableHead className="text-[9px] font-bold text-slate-500 uppercase text-right">{"<3"}</TableHead>
                          <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Ações</TableHead>
                        </TableRow>
                      )}
                    </TableHeader>
                    <TableBody>
                      {filteredDbCityFreights.length === 0 ? (
                        <TableRow><TableCell colSpan={dbFactoryFilter === 'CERBRAS' ? 4 : 9} className="h-40 text-center text-slate-400">Nenhum registro encontrado.</TableCell></TableRow>
                      ) : (
                        filteredDbCityFreights.map((f, idx) => (
                          <TableRow key={idx} className="hover:bg-slate-50/50 group border-b border-slate-100 last:border-0">
                            <TableCell className="font-bold text-xs uppercase text-slate-900">{f.cidade}</TableCell>
                            <TableCell className="text-xs text-slate-600">{f.uf}</TableCell>
                            {dbFactoryFilter === 'CERBRAS' ? (
                              <TableCell className="text-right font-bold text-amber-700 text-xs">R$ {f.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            ) : (
                              <>
                                <TableCell className="text-right text-[10px] font-medium text-slate-600">{f.t17?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right text-[10px] font-medium text-slate-600">{f.t14?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right text-[10px] font-medium text-slate-600">{f.t11?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right text-[10px] font-medium text-slate-600">{f.t6?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right text-[10px] font-medium text-slate-600">{f.t3?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right text-[10px] font-medium text-slate-600">{f.tLess3?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                              </>
                            )}
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-50" onClick={() => { setIsEditingCityFreight(true); setEditingCityFreightIndex(idx); setNewCityFreight(f as any); setShowCityFreightModal(true); }}><Pencil size={14} /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleCloneCityFreightDB(f as any)}><Copy size={14} /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleDeleteCityFreightDB(idx)}><Trash2 size={14} /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="special" className="m-0">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Cliente</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Cidade/UF</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Valor Especial</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDbSpecialFreights.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="h-40 text-center text-slate-400">Nenhum registro encontrado.</TableCell></TableRow>
                      ) : (
                        filteredDbSpecialFreights.map((f, idx) => (
                          <TableRow key={idx} className="hover:bg-slate-50/50 group border-b border-slate-100 last:border-0">
                            <TableCell className="font-bold text-xs uppercase text-slate-900">{f.cliente}</TableCell>
                            <TableCell className="text-xs text-slate-600">{f.cidade} - {f.uf}</TableCell>
                            <TableCell className="text-right font-bold text-amber-700 text-xs">R$ {f.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-50" onClick={() => { setIsEditingSpecialFreight(true); setEditingSpecialFreightIndex(idx); setNewSpecialFreight(f); setShowSpecialFreightModal(true); }}><Pencil size={14} /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleCloneSpecialFreightDB(f)}><Copy size={14} /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleDeleteSpecialFreightDB(idx)}><Trash2 size={14} /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              </div>
            </Tabs>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t flex justify-end">
            <Button variant="outline" onClick={() => setShowDatabaseModal(false)}>Fechar Base de Dados</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCityFreightModal} onOpenChange={setShowCityFreightModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><MapPin className="text-amber-600" /> {isEditingCityFreight ? "Editar Frete por Cidade" : "Novo Frete por Cidade"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Cidade</label><Input value={newCityFreight.cidade} onChange={(e) => setNewCityFreight({...newCityFreight, cidade: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">UF</label><Select value={newCityFreight.uf} onValueChange={(v) => setNewCityFreight({...newCityFreight, uf: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['CE', 'PI', 'MA', 'RN', 'PB', 'PE', 'RN', 'SE', 'AL', 'BA'].map(uf => (<SelectItem key={uf} value={uf}>{uf}</SelectItem>))}</SelectContent></Select></div>
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Valor (R$/Ton)</label><Input type="number" value={newCityFreight.valor || ''} onChange={(e) => setNewCityFreight({...newCityFreight, valor: Number(e.target.value)})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCityFreightModal(false)}>Cancelar</Button><Button className="bg-amber-600 text-white" onClick={handleSaveCityFreight}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSpecialFreightModal} onOpenChange={setShowSpecialFreightModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Star className="text-amber-600" /> {isEditingSpecialFreight ? "Editar Frete Especial" : "Novo Frete Especial"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Cliente</label><Input value={newSpecialFreight.cliente} onChange={(e) => setNewSpecialFreight({...newSpecialFreight, cliente: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">CNPJ (opcional)</label><Input value={newSpecialFreight.cnpj} onChange={(e) => setNewSpecialFreight({...newSpecialFreight, cnpj: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Cidade</label><Input value={newSpecialFreight.cidade} onChange={(e) => setNewSpecialFreight({...newSpecialFreight, cidade: e.target.value})} /></div>
              <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">UF</label><Select value={newSpecialFreight.uf} onValueChange={(v) => setNewSpecialFreight({...newSpecialFreight, uf: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['CE', 'PI', 'MA', 'RN', 'PB', 'PE', 'RN', 'SE', 'AL', 'BA'].map(uf => (<SelectItem key={uf} value={uf}>{uf}</SelectItem>))}</SelectContent></Select></div>
            </div>
            <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Valor Especial (R$/Ton)</label><Input type="number" value={newSpecialFreight.valor || ''} onChange={(e) => setNewSpecialFreight({...newSpecialFreight, valor: Number(e.target.value)})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowSpecialFreightModal(false)}>Cancelar</Button><Button className="bg-amber-600 text-white" onClick={handleSaveSpecialFreight}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRomaneioListModal} onOpenChange={setShowRomaneioListModal}>
        <DialogContent className="max-w-[90vw] w-[1000px] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
                  <FileText className="text-amber-600" size={28} /> Romaneios Gerados
                </DialogTitle>
                <DialogDescription>
                  Lista de todos os cálculos que possuem NF-e ou CT-e registrados.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto px-6 pb-6">
            <div className="border rounded-lg bg-white shadow-inner">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Data</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Motorista / Placa</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Peso Total</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Valor Total</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-center">Status</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedCalculations.filter(isRomaneio).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-40 text-center text-slate-400">Nenhum romaneio encontrado.</TableCell></TableRow>
                  ) : (
                    savedCalculations.filter(isRomaneio).map((calc) => (
                      <TableRow key={calc.id} className="hover:bg-slate-50/50 group border-b border-slate-100 last:border-0 cursor-pointer" onClick={() => {
                        setEditingId(calc.id);
                        setItems(calc.items);
                        setDriverName(calc.driver_name);
                        setDriverPlate(calc.driver_plate);
                        setBillingDate(calc.billing_date);
                        setSelectedFactory(calc.factory || 'CERBRAS');
                        setDriverPayment(calc.driver_payment);
                        setRomaneioData(prev => ({ ...prev, ...(calc.romaneio_data || {}) }));
                        setShowRomaneioListModal(false);
                        setTimeout(() => {
                          const el = document.getElementById('romaneio-section');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}>
                        <TableCell className="text-xs font-medium">{calc.billing_date ? calc.billing_date.split('-').reverse().join('/') : new Date(calc.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <p className="font-bold text-xs uppercase text-slate-900">{calc.driver_name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{calc.driver_plate}</p>
                        </TableCell>
                        <TableCell className="text-right text-xs">{calc.items.reduce((acc, i) => acc + i.peso, 0).toLocaleString('pt-BR')} KG</TableCell>
                        <TableCell className="text-right font-bold text-amber-700 text-xs">R$ {calc.items.reduce((acc, i) => acc + i.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-[9px] h-5">FINALIZADO</Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-50" title="Imprimir" onClick={() => handlePrintRomaneio(calc)}><Printer size={14} /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" title="Excluir" onClick={() => handleDelete(calc.id)}><Trash2 size={14} /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t flex justify-end">
            <Button variant="outline" onClick={() => setShowRomaneioListModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="max-w-[95vw] w-[1200px] max-h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 bg-slate-50 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
                  <TrendingUp className="text-amber-600" size={28} /> Relatórios Financeiros
                </DialogTitle>
                <DialogDescription>Analise o desempenho mensal e exporte dados para gestão.</DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="gap-2" onClick={() => {
                  if (reportType === 'summary') {
                    const columns = ["Fábrica", "Data", "Rota", "Motorista", "Vlr. Frete", "Vlr. Pago", "Comissão", "%"];
                    const rows = filteredReportData.map(r => [r.factory, r.date, r.route, r.driver, r.value, r.paid, r.commission, r.percent.toFixed(1) + '%']);
                    handlePrintReport("Relatório Resumido", columns, rows);
                  } else {
                    const columns = ["Fábrica", "Data", "Motorista", "Cliente", "Cidade", "UF", "Tipo", "Peso", "Aliq.", "Total"];
                    const rows = filteredDetailedData.map(r => [r.factory, r.date, r.driver, r.client, r.city, r.uf, r.type, r.weight, r.ton, r.total]);
                    handlePrintReport("Relatório Detalhado", columns, rows);
                  }
                }}><Printer size={16} /> Imprimir</Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white gap-2" onClick={() => {
                  const data = reportType === 'summary' ? filteredReportData : filteredDetailedData;
                  exportReportToExcel(data, `Relatorio_Midas_${reportMonth}_${reportYear}`);
                }}><Download size={16} /> Exportar Excel</Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 bg-white border-b grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Mês</label>
                <Select value={reportMonth.toString()} onValueChange={(v) => setReportMonth(Number(v))}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({length: 12}, (_, i) => (<SelectItem key={i+1} value={(i+1).toString()}>{new Date(2000, i).toLocaleString('pt-BR', {month: 'long'}).toUpperCase()}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Ano</label>
                <Select value={reportYear.toString()} onValueChange={(v) => setReportYear(Number(v))}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map(y => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Fábrica</label>
                <Select value={reportFactoryFilter} onValueChange={setReportFactoryFilter}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">TODAS</SelectItem>
                    <SelectItem value="CERBRAS">CERBRAS</SelectItem>
                    <SelectItem value="HIDRACOR">HIDRACOR</SelectItem>
                    <SelectItem value="HIDRACOR_EXTERNA">HIDRACOR EXTERNA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Pesquisar</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2 text-slate-400" size={14} />
                  <Input className="h-8 pl-8 text-xs" placeholder="Motorista, cidade..." value={reportSearch} onChange={(e) => setReportSearch(e.target.value)} />
                </div>
              </div>
              <div className="flex items-end">
                <Tabs value={reportType} onValueChange={(v: any) => setReportType(v)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="summary" className="text-[10px] font-bold uppercase">Resumido</TabsTrigger>
                    <TabsTrigger value="detailed" className="text-[10px] font-bold uppercase">Detalhado</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-50">
              <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                {reportType === 'summary' ? (
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Fábrica</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Data</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Rota</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Motorista</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Vlr. Frete</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Vlr. Pago</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Comissão</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReportData.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="h-40 text-center text-slate-400">Nenhum dado encontrado.</TableCell></TableRow>
                      ) : (
                        filteredReportData.map((row, i) => (
                          <TableRow key={i} className="hover:bg-slate-50/50">
                            <TableCell className="text-xs font-bold uppercase">{row.factory}</TableCell>
                            <TableCell className="text-xs">{row.date}</TableCell>
                            <TableCell className="text-xs uppercase text-slate-500">{row.route}</TableCell>
                            <TableCell className="text-xs font-medium uppercase">{row.driver}</TableCell>
                            <TableCell className="text-xs text-right font-bold text-slate-900">R$ {row.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-xs text-right text-slate-600">R$ {row.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-xs text-right font-bold text-amber-700">R$ {row.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-xs text-right font-bold text-green-600">{row.percent.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                    {filteredReportData.length > 0 && (
                      <TableFooter className="bg-slate-900 text-white font-bold">
                        <TableRow>
                          <TableCell colSpan={4} className="text-right uppercase">Totais do Período</TableCell>
                          <TableCell className="text-right">R$ {filteredReportData.reduce((acc, r) => acc + r.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">R$ {filteredReportData.reduce((acc, r) => acc + r.paid, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right text-amber-400">R$ {filteredReportData.reduce((acc, r) => acc + r.commission, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right text-green-400">
                            {(filteredReportData.reduce((acc, r) => acc + r.commission, 0) / filteredReportData.reduce((acc, r) => acc + r.value, 0) * 100 || 0).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Fábrica</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Data</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Motorista</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Cliente</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Cidade</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">UF</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Tipo</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Peso</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Tonelada</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDetailedData.length === 0 ? (
                        <TableRow><TableCell colSpan={10} className="h-40 text-center text-slate-400">Nenhum dado encontrado.</TableCell></TableRow>
                      ) : (
                        filteredDetailedData.map((row, i) => (
                          <TableRow key={i} className="hover:bg-slate-50/50">
                            <TableCell className="text-[10px] font-bold uppercase">{row.factory}</TableCell>
                            <TableCell className="text-[10px]">{row.date}</TableCell>
                            <TableCell className="text-[10px] font-medium uppercase">{row.driver}</TableCell>
                            <TableCell className="text-[10px] font-bold truncate max-w-[150px] uppercase">{row.client}</TableCell>
                            <TableCell className="text-[10px] uppercase">{row.city}</TableCell>
                            <TableCell className="text-[10px]">{row.uf}</TableCell>
                            <TableCell className="text-[10px] font-bold">{row.type}</TableCell>
                            <TableCell className="text-[10px] text-right">{row.weight.toLocaleString('pt-BR')} KG</TableCell>
                            <TableCell className="text-[10px] text-right text-slate-500">R$ {row.ton.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-[10px] text-right font-bold text-amber-700">R$ {row.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                    {filteredDetailedData.length > 0 && (
                      <TableFooter className="bg-slate-900 text-white font-bold">
                        <TableRow>
                          <TableCell colSpan={7} className="text-right uppercase">Total Acumulado</TableCell>
                          <TableCell className="text-right">{filteredDetailedData.reduce((acc, r) => acc + r.weight, 0).toLocaleString('pt-BR')} KG</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right text-amber-400">R$ {filteredDetailedData.reduce((acc, r) => acc + r.total, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t">
            <Button variant="outline" onClick={() => setShowReportModal(false)}>Fechar Relatórios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
};

export default CerbrasFreightCalculator;