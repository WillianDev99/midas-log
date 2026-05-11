"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  
  // States for data from Excel
  const [clients, setClients] = useState<ClientData[]>([]);
  const [cityFreights, setCityFreights] = useState<CityFreight[]>([]);
  const [specialFreights, setSpecialFreights] = useState<SpecialClientFreight[]>([]);
  
  // States for Hidracor data
  const [hidracorClients, setHidracorClients] = useState<ClientData[]>([]);
  const [hidracorCityFreights, setHidracorCityFreights] = useState<any[]>([]);
  const [hidracorSpecialFreights, setHidracorSpecialFreights] = useState<SpecialClientFreight[]>([]);

  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // States for current calculation
  const [driverName, setDriverName] = useState("");
  const [driverPlate, setDriverPlate] = useState("");
  const [billingDate, setBillingDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<FreightItem[]>([]);
  const [driverPayment, setDriverPayment] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(13);
  const [isSaving, setIsSaving] = useState(false);
  
  // States for saved calculations
  const [savedCalculations, setSavedCalculations] = useState<SavedCalculation[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedFactory, setSelectedFactory] = useState<"CERBRAS" | "HIDRACOR" | "HIDRACOR_EXTERNA">("CERBRAS");

  // States for autocomplete and client modal
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

  // States for driver autocomplete and modal
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

  // Romaneio States
  const [showRomaneioModal, setShowRomaneioModal] = useState(false);
  const [romaneioData, setRomaneioData] = useState({
    ciot_manifesto: "",
    contas_pagar_mot: "",
    contas_receber_fob: "",
    duplicatas_boletos: "",
    ocorrencias: "",
    adiantamento: 0,
    avaria_hidracor: 0,
    avaria_cerbras: 0,
    carga_quitada: false
  });

  // Database Management States
  const [showDatabaseModal, setShowDatabaseModal] = useState(false);
  const [dbSearchTerm, setDbSearchTerm] = useState("");
  const [activeDbTab, setActiveDbTab] = useState("clients");

  // City Freight Modal States
  const [showCityFreightModal, setShowCityFreightModal] = useState(false);
  const [isEditingCityFreight, setIsEditingCityFreight] = useState(false);
  const [editingCityFreightIndex, setEditingCityFreightIndex] = useState<number | null>(null);
  const [newCityFreight, setNewCityFreight] = useState<CityFreight>({
    cidade: "",
    uf: "CE",
    valor: 0
  });

  // Special Freight Modal States
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

  // Romaneio List Modal State
  const [showRomaneioListModal, setShowRomaneioListModal] = useState(false);

  const isRomaneio = (calc: SavedCalculation) => {
    return calc.items.some(item => (item.nfe && item.nfe.trim() !== "") || (item.cte && item.cte.trim() !== ""));
  };

  // Initialization
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
      // Choose sheet named 'Planilha' if exists, otherwise first sheet
      const citySheetName = cityWb.SheetNames.find(name => name.toLowerCase().includes('planilha')) || cityWb.SheetNames[0];
      const cityWs = cityWb.Sheets[citySheetName];
      const cityRaw: any[][] = XLSX.utils.sheet_to_json(cityWs, { header: 1 });
      const cityHeaderIdx = cityRaw.findIndex(row => row.some(cell => {
        const val = String(cell).toUpperCase();
        return val.includes('CIDADE') || val.includes('CIDADES');
      }));
      const cityDataStart = cityHeaderIdx > -1 ? cityHeaderIdx + 1 : 1;
      const cityCols = cityRaw[cityHeaderIdx] || [];
      // Map headers to indices
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
      // If freight column not identified, attempt to infer the first numeric column after city and UF
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

      // --- Hidracor Loading ---
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
        especial: false // To be refined by checking special table
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
      
      // Update especial status in clients list
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
      const hParsedCity = hCityRaw.slice(1).map(row => ({
        cidade: String(row[0] || '').trim().toUpperCase(),
        uf: String(row[1] || '').trim().toUpperCase(),
        t17: Number(row[2] || 0),
        t14: Number(row[3] || 0),
        t11: Number(row[4] || 0),
        t6: Number(row[5] || 0),
        t3: Number(row[6] || 0),
        tLess3: Number(row[7] || 0)
      })).filter(f => f.cidade);
      setHidracorCityFreights(hParsedCity);

    } catch (error) {
      console.error("Error loading Excel data:", error);
      showError("Erro ao carregar tabelas de referência.");
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase.from('cerbras_freight_calculations').select('*').order('created_at', { ascending: false });
      if (error) {
        const local = localStorage.getItem('cerbras_freight_history');
        if (local) setSavedCalculations(JSON.parse(local));
      } else { setSavedCalculations(data || []); }
    } catch (e) { console.error(e); } finally { setIsLoadingHistory(false); }
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
    if (client) newItem.tonelada = lookupTonelada(client);
    setItems([...items, newItem]);
    setSearchClient("");
  };

  const getHidracorCityFreight = (cidade: string, uf: string, currentTotalWeight: number) => {
    const city = hidracorCityFreights.find(f => f.cidade.toUpperCase() === cidade.toUpperCase() && f.uf.toUpperCase() === uf.toUpperCase());
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

  useEffect(() => {
    if (selectedFactory === 'HIDRACOR' && items.length > 0) {
      const updatedItems = items.map(item => {
        if (!item.especial) {
          const newTon = getHidracorCityFreight(item.cidade, item.uf, totalWeight);
          if (newTon !== item.tonelada && newTon > 0) {
            return { ...item, tonelada: newTon, valor: (item.peso * newTon) / 1000 };
          }
        }
        return item;
      });
      const hasChanged = updatedItems.some((item, idx) => item.tonelada !== items[idx].tonelada);
      if (hasChanged) setItems(updatedItems);
    }
  }, [totalWeight, selectedFactory, hidracorCityFreights]);

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
    setRomaneioData({ ciot_manifesto: "", contas_pagar_mot: "", contas_receber_fob: "", duplicatas_boletos: "", ocorrencias: "", adiantamento: 0, avaria_hidracor: 0, avaria_cerbras: 0, carga_quitada: false });
  };

  const handleEdit = (calc: SavedCalculation) => {
    setDriverName(calc.driver_name); setDriverPlate(calc.driver_plate || ""); setBillingDate(calc.billing_date);
    setItems(calc.items); setDriverPayment(calc.driver_payment || 0); setTaxPercent(calc.tax_percent || 13);
    setEditingId(calc.id); setSelectedFactory(calc.factory || "CERBRAS");
    if (calc.romaneio_data) setRomaneioData(calc.romaneio_data);
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
    return clients.filter(c => 
      c.cliente.toLowerCase().includes(dbSearchTerm.toLowerCase()) || 
      c.cnpj.includes(dbSearchTerm) || 
      c.cidade.toLowerCase().includes(dbSearchTerm.toLowerCase())
    );
  }, [dbSearchTerm, clients]);

  const filteredDbDrivers = useMemo(() => {
    return drivers.filter(d => 
      d.motorista.toLowerCase().includes(dbSearchTerm.toLowerCase()) || 
      d.placa.toLowerCase().includes(dbSearchTerm.toLowerCase())
    );
  }, [dbSearchTerm, drivers]);

  const filteredDbCityFreights = useMemo(() => {
    return cityFreights.filter(f => 
      f.cidade.toLowerCase().includes(dbSearchTerm.toLowerCase()) || 
      f.uf.toLowerCase().includes(dbSearchTerm.toLowerCase())
    );
  }, [dbSearchTerm, cityFreights]);

  const filteredDbSpecialFreights = useMemo(() => {
    return specialFreights.filter(f => 
      f.cliente.toLowerCase().includes(dbSearchTerm.toLowerCase()) || 
      f.cnpj.includes(dbSearchTerm) ||
      f.cidade.toLowerCase().includes(dbSearchTerm.toLowerCase())
    );
  }, [dbSearchTerm, specialFreights]);

  const totalWeight = items.reduce((acc, i) => acc + i.peso, 0);
  const totalValue = items.reduce((acc, i) => acc + i.valor, 0);
  const fretePossivel = totalValue * 0.77;
  const weightCE = items.filter(i => i.uf === 'CE').reduce((acc, i) => acc + i.peso, 0);
  const weightOthers = items.filter(i => i.uf !== 'CE').reduce((acc, i) => acc + i.peso, 0);


  const subtotalImpostoCE = weightCE * 0.02 * (taxPercent / 100);
  const subtotalImpostoOthers = weightOthers * 0.08 * (taxPercent / 100);
  const totalImposto = subtotalImpostoCE + subtotalImpostoOthers;
  const saldoMidas = totalValue - driverPayment;
  const percentagePaid = totalValue > 0 ? (driverPayment / totalValue) * 100 : 0;
  const lucroLiquido = totalValue - driverPayment - totalImposto;

  const handleSelectDriver = (d: DriverData) => { setDriverName(d.motorista); setDriverPlate(d.placa); setSearchDriver(""); };

  const handleSaveClient = () => {
    if (!newClient.cliente || !newClient.cnpj || !newClient.cidade) return showError("Campos obrigatórios.");
    const client = { ...newClient, cliente: newClient.cliente.toUpperCase() };
    if (isEditingClient) { setClients(clients.map(c => c.cnpj === client.cnpj ? client : c)); } 
    else { setClients([client, ...clients]); handleAddItem(client); }
    setShowClientModal(false);
  };

  const handleSaveDriver = () => {
    if (!newDriver.motorista || !newDriver.placa) return showError("Nome e Placa.");
    const driver = { ...newDriver, motorista: newDriver.motorista.toUpperCase(), placa: newDriver.placa.toUpperCase() };
    if (isEditingDriver) { setDrivers(drivers.map(d => d.placa === driver.placa ? driver : d)); }
    else { setDrivers([driver, ...drivers]); handleSelectDriver(driver); }
    setShowDriverModal(false);
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
    const tImp = impCE + impOthers;
    const saldoMot = dPay - (data.adiantamento || 0) - (data.avaria_hidracor || 0) - (data.avaria_cerbras || 0);

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
            
            /* Compact table for info and financial data */
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
            .clearfix::after { content: ""; clear: both; display: table; }
            
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
                <tr><td>DATA</td><td>${new Date(calc.billing_date).toLocaleDateString('pt-BR')}</td></tr>
              </table>
              <table class="info-table">
                <tr><td>CONTAS A PAGAR MOTORISTA</td><td>${data.contas_pagar_mot || ''}</td></tr>
                <tr><td>CONTAS A RECEBER FOB DIRIGIDO</td><td>${data.contas_receber_fob || ''}</td></tr>
                <tr><td>DUPLICATAS/BOLETOS GERADOS</td><td>${data.duplicatas_boletos || ''}</td></tr>
              </table>
            </div>
            <div class="right-panel">
              <div class="status-box">
                CIOT E MANIFESTO BAIXADO: [ ${data.ciot_manifesto || '   '} ]
              </div>
              <table class="summary-box">
                <tr><td>FRETE POSSÍVEL</td><td>R$ ${(tV * 0.77).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>FRETE MOTORISTA</td><td>R$ ${dPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>SALDO MIDAS</td><td>R$ ${(tV - dPay).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>% FRETE MDF CE</td><td>R$ ${(wCE * 0.02).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>% FRETE MDF PI/MA</td><td>R$ ${(wOthers * 0.08).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>% IMPOSTO (${tPct}%)</td><td>R$ ${tImp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                <tr style="background:#eee; font-size: 11px;"><td>LUCRO LÍQUIDO</td><td><strong>R$ ${(tV - dPay - tImp).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td></tr>
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
                <tr><td>ADIANTAMENTO</td><td style="text-align:right">R$ ${data.adiantamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>AVARIA HIDRACOR</td><td style="text-align:right">R$ ${data.avaria_hidracor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                <tr><td>AVARIA CERBRAS</td><td style="text-align:right">R$ ${data.avaria_cerbras.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                <tr style="font-weight:bold; background:#eee;"><td>SALDO MOTORISTA</td><td style="text-align:right">R$ ${saldoMot.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
              </table>
              <div style="text-align: right; margin-top: 5px; font-weight: bold;">
                CARGA QUITADA: [ ${data.carga_quitada ? 'SIM' : 'NÃO'} ]
              </div>
            </div>
          </div>

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 lg:px-8 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/admin"><Button variant="ghost" size="icon" className="hover:bg-amber-50"><ArrowLeft /></Button></Link>
          <div className="flex items-center gap-3">
            <div className="bg-amber-600 p-2 rounded-lg"><Calculator className="text-white" size={20} /></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Cálculo de Fretes</h1>
              <p className="text-slate-500 text-xs">Simulação e registro de custos logísticos.</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setShowRomaneioListModal(true)}><FileText size={16} /> Romaneios</Button>
          {items.length > 0 && <Button variant="outline" className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setShowRomaneioModal(true)}><FileSpreadsheet size={16} /> Novo Romaneio</Button>}
          <Button variant="outline" className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setShowDatabaseModal(true)}><Database size={16} /> Base</Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-md shadow-amber-200" onClick={() => handleSave()} disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}{editingId ? "Atualizar" : "Salvar"}</Button>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-8 space-y-8 max-w-[1600px] mx-auto w-full">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
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
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2"><Building2 className="text-amber-600" size={18} /> Clientes na Carga</h3>
                    <div className="relative w-72">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                      <Input placeholder="Pesquisar cliente..." className="pl-10 h-9 text-xs" value={searchClient} onChange={(e) => setSearchClient(e.target.value)} />
                      {filteredClients.length > 0 && !showClientModal && !showDriverModal && !showRomaneioModal && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-[60] overflow-hidden">
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
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-[60] p-3 text-center">
                          <p className="text-xs text-slate-500 mb-2">Não encontrado.</p>
                          <Button size="sm" variant="outline" className="text-[10px] h-7 w-full gap-1" onClick={() => { setIsEditingClient(false); setShowClientModal(true); setSearchClient(""); }}><Plus size={12} /> Cadastrar Novo</Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-[120px]">Cliente</TableHead>
                          <TableHead className="w-[100px]">NF-e / CT-e</TableHead>
                          <TableHead className="w-[100px] text-right">Peso (KG)</TableHead>
                          <TableHead className="w-[100px] text-right">R$/Ton</TableHead>
                          <TableHead className="w-[120px] text-right">Valor</TableHead>
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
                              <TableCell className="text-right"><div className="flex items-center justify-end gap-1"><span className="text-[10px] text-slate-400">R$</span><Input type="number" className="h-8 w-20 text-right text-xs border-slate-200 bg-slate-50" value={item.tonelada || ''} onChange={(e) => updateItem(item.id, { tonelada: Number(e.target.value) })} /></div></TableCell>
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
                  <div className="grid grid-cols-2 gap-2 mb-1">
                    <div className="p-2 rounded bg-slate-50 border border-slate-100"><p className="text-[9px] font-bold text-slate-500 uppercase">Frete MDF CE (2%)</p><p className="text-xs font-bold">R$ {(weightCE * 0.02).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                    <div className="p-2 rounded bg-slate-50 border border-slate-100"><p className="text-[9px] font-bold text-slate-500 uppercase">Frete MDF PI/MA (8%)</p><p className="text-xs font-bold">R$ {(weightOthers * 0.08).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="p-2 rounded bg-blue-50/50 border border-blue-100"><p className="text-[9px] font-bold text-blue-600 uppercase">Imposto CE (2%)</p><p className="text-xs font-bold">R$ {subtotalImpostoCE.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                    <div className="p-2 rounded bg-purple-50/50 border border-purple-100"><p className="text-[9px] font-bold text-purple-600 uppercase">Imposto PI/MA (8%)</p><p className="text-xs font-bold">R$ {subtotalImpostoOthers.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                  </div>
                  <div className="flex justify-between items-center p-2"><span className="text-xs text-slate-500 font-bold uppercase">% Alíquota</span><div className="flex items-center gap-2"><Input type="number" className="h-7 w-16 text-right text-xs" value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value))} /><span className="text-xs text-slate-400">%</span></div></div>
                  <div className="flex justify-between items-center p-3 rounded bg-green-600 text-white shadow-inner"><span className="text-sm font-bold uppercase tracking-wider">Lucro Líquido</span><span className="text-xl font-black">R$ {lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-md overflow-hidden">
              <div className="bg-amber-500 p-1 h-1.5" />
              <CardHeader className="pb-4"><CardTitle className="text-lg flex items-center gap-2"><History className="text-amber-600" size={20} /> Cálculos Recentes</CardTitle></CardHeader>
              <CardContent className="px-0">
                <div className="max-h-[600px] overflow-y-auto px-6 space-y-3">
                  {isLoadingHistory ? (
                    <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" /></div>
                  ) : savedCalculations.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs">Nenhum histórico encontrado.</div>
                  ) : (
                    savedCalculations.map(calc => (
                      <div key={calc.id} className="p-3 rounded-lg border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all group relative">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1"><Calendar size={10} /> {new Date(calc.created_at).toLocaleDateString('pt-BR')}</span>
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
                              <DropdownMenuItem onClick={() => { setEditingId(calc.id); setItems(calc.items); setDriverPayment(calc.driver_payment); setRomaneioData(calc.romaneio_data || romaneioData); setShowRomaneioModal(true); }} className="gap-2"><FileSpreadsheet size={14} /> Romaneio</DropdownMenuItem>
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
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* MODAL: CLIENT (Create/Edit) */}
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

      {/* MODAL: DRIVER (Create/Edit) */}
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

      {/* MODAL: ROMANEIO GENERATOR */}
      <Dialog open={showRomaneioModal} onOpenChange={setShowRomaneioModal}>
        <DialogContent className="max-w-[90vw] w-[1000px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="text-amber-600" /> Gerar Romaneio de Carga</DialogTitle>
            <DialogDescription>Preencha as informações complementares para o monitoramento da carga.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-lg border space-y-3">
                  <h4 className="text-xs font-bold uppercase text-slate-500 border-b pb-2">Informações de Documentação</h4>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">CIOT E MANIFESTO BAIXADO</label>
                    <Input value={romaneioData.ciot_manifesto} onChange={(e) => setRomaneioData({...romaneioData, ciot_manifesto: e.target.value})} placeholder="Status ou Número..." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">CONTAS A PAGAR MOTORISTA</label>
                    <Input value={romaneioData.contas_pagar_mot} onChange={(e) => setRomaneioData({...romaneioData, contas_pagar_mot: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">CONTAS A RECEBER FOB DIRIGIDO</label>
                    <Input value={romaneioData.contas_receber_fob} onChange={(e) => setRomaneioData({...romaneioData, contas_receber_fob: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">DUPLICATAS / BOLETOS GERADOS</label>
                    <Input value={romaneioData.duplicatas_boletos} onChange={(e) => setRomaneioData({...romaneioData, duplicatas_boletos: e.target.value})} />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border space-y-2">
                  <h4 className="text-xs font-bold uppercase text-slate-500 border-b pb-2">Ocorrências e Observações</h4>
                  <Textarea 
                    className="min-h-[100px] text-xs" 
                    value={romaneioData.ocorrencias} 
                    onChange={(e) => setRomaneioData({...romaneioData, ocorrencias: e.target.value})}
                    placeholder="Descreva aqui avarias, atrasos ou qualquer observação relevante..."
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 space-y-3">
                  <h4 className="text-xs font-bold uppercase text-amber-700 border-b border-amber-100 pb-2">Acerto do Motorista</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold">ADIANTAMENTO</label>
                      <Input type="number" className="h-8 text-sm" value={romaneioData.adiantamento || ''} onChange={(e) => setRomaneioData({...romaneioData, adiantamento: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold">AVARIA HIDRACOR</label>
                      <Input type="number" className="h-8 text-sm" value={romaneioData.avaria_hidracor || ''} onChange={(e) => setRomaneioData({...romaneioData, avaria_hidracor: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold">AVARIA CERBRAS</label>
                      <Input type="number" className="h-8 text-sm" value={romaneioData.avaria_cerbras || ''} onChange={(e) => setRomaneioData({...romaneioData, avaria_cerbras: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold">SALDO MOTORISTA</p>
                      <div className="h-8 flex items-center px-3 bg-white rounded border font-bold text-amber-700">
                        R$ {(driverPayment - romaneioData.adiantamento - romaneioData.avaria_hidracor - romaneioData.avaria_cerbras).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Checkbox id="quitada" checked={romaneioData.carga_quitada} onCheckedChange={(v) => setRomaneioData({...romaneioData, carga_quitada: !!v})} />
                    <label htmlFor="quitada" className="text-xs font-bold uppercase text-amber-900">Carga Quitada</label>
                  </div>
                </div>

                <div className="bg-slate-900 text-white p-4 rounded-lg space-y-2">
                  <h4 className="text-xs font-bold uppercase text-slate-400 border-b border-slate-800 pb-2">Resumo de Impostos (Base MDF)</h4>
                  <div className="flex justify-between text-xs"><span>CE (2%):</span><span className="font-bold">R$ {(weightCE * 0.02).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between text-xs"><span>PI/MA (8%):</span><span className="font-bold">R$ {(weightOthers * 0.08).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between">
                    <span className="text-xs font-bold">LUCRO LÍQUIDO FINAL:</span>
                    <span className="text-sm font-bold text-green-400">R$ {lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRomaneioModal(false)}>Fechar sem Salvar</Button>
            <Button className="bg-slate-800 text-white gap-2" onClick={() => handleSave(romaneioData)}><Save size={16} /> Salvar Dados do Romaneio</Button>
            <Button className="bg-amber-600 text-white gap-2" onClick={() => handlePrintRomaneio({ driver_name: driverName, driver_plate: driverPlate, billing_date: billingDate, items, driver_payment: driverPayment, tax_percent: taxPercent, romaneio_data: romaneioData })}><Printer size={16} /> Gerar e Imprimir Romaneio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* MODAL: DATABASE MANAGEMENT */}
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
              <TabsList className="grid grid-cols-4 w-full max-w-2xl bg-slate-100 p-1 rounded-lg">
                <TabsTrigger value="clients" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm font-bold uppercase text-[10px]">Clientes</TabsTrigger>
                <TabsTrigger value="drivers" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm font-bold uppercase text-[10px]">Motoristas</TabsTrigger>
                <TabsTrigger value="cities" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm font-bold uppercase text-[10px]">Frete Cidades</TabsTrigger>
                <TabsTrigger value="special" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm font-bold uppercase text-[10px]">Clientes Especiais</TabsTrigger>
              </TabsList>

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
                      <TableRow>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Cidade</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">UF</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Valor R$/Ton</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDbCityFreights.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="h-40 text-center text-slate-400">Nenhum registro encontrado.</TableCell></TableRow>
                      ) : (
                        filteredDbCityFreights.map((f, idx) => (
                          <TableRow key={idx} className="hover:bg-slate-50/50 group border-b border-slate-100 last:border-0">
                            <TableCell className="font-bold text-xs uppercase text-slate-900">{f.cidade}</TableCell>
                            <TableCell className="text-xs text-slate-600">{f.uf}</TableCell>
                            <TableCell className="text-right font-bold text-amber-700 text-xs">R$ {f.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-50" onClick={() => { setIsEditingCityFreight(true); setEditingCityFreightIndex(idx); setNewCityFreight(f); setShowCityFreightModal(true); }}><Pencil size={14} /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleCloneCityFreightDB(f)}><Copy size={14} /></Button>
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

      {/* MODAL: CITY FREIGHT (Create/Edit) */}
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

      {/* MODAL: SPECIAL FREIGHT (Create/Edit) */}
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
      {/* MODAL: ROMANEIO LIST */}
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
                        setDriverPayment(calc.driver_payment);
                        setRomaneioData(calc.romaneio_data || romaneioData);
                        setShowRomaneioModal(true);
                        setShowRomaneioListModal(false);
                      }}>
                        <TableCell className="text-xs font-medium">{new Date(calc.created_at).toLocaleDateString('pt-BR')}</TableCell>
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
    </div>
  );
};

export default CerbrasFreightCalculator;
