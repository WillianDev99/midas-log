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
  ArrowRightLeft
} from 'lucide-react';
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
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';

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
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc' | null;
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
  const [freightTables, setFreightTables] = useState<{ cif: any[], fob: any[], equalization: any[] }>({ cif: [], fob: [], equalization: [] });
  const [manualSearch, setManualSearch] = useState("");

  const SHEET_URL = "https://docs.google.com/spreadsheets/d/1_84-QjABx4I97rSUPIA1bNkZkZ3hVkdjM4fzc5o_Who/export?format=xlsx";
  const VIEW_SHEET_URL = "https://docs.google.com/spreadsheets/d/1_84-QjABx4I97rSUPIA1bNkZkZ3hVkdjM4fzc5o_Who/edit";
  const TAX_RATE = 0.13; // Alterado de 0.0998 para 0.13

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

  const loadFreightTables = async () => {
    try {
      // Tabela Antiga
      const response = await fetch('/TABELA_MIDAS_2025.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      
      const cifSheet = workbook.Sheets[workbook.SheetNames[0]];
      const cifData = XLSX.utils.sheet_to_json(cifSheet, { header: 'A' });
      
      const fobSheet = workbook.Sheets[workbook.SheetNames[1]];
      const fobData = XLSX.utils.sheet_to_json(fobSheet, { header: 'A' });

      const cleanCIF = cifData.filter((row: any) => {
        const city = String(row['B'] || '');
        return city && normalizeText(city) !== 'municipio' && normalizeText(city) !== 'cidade';
      });

      const cleanFOB = fobData.filter((row: any) => {
        const city = String(row['A'] || '');
        return city && normalizeText(city) !== 'municipio' && normalizeText(city) !== 'cidade' && city !== 'undefined';
      });

      // Nova Tabela de Equalização
      const eqResponse = await fetch('/TABELA_EQUALIZACAO.xlsx');
      const eqArrayBuffer = await eqResponse.arrayBuffer();
      const eqWorkbook = XLSX.read(eqArrayBuffer, { type: 'buffer' });
      const eqSheet = eqWorkbook.Sheets[eqWorkbook.SheetNames[0]];
      const eqData = XLSX.utils.sheet_to_json(eqSheet, { header: 'A' });

      const cleanEQ = eqData.filter((row: any) => {
        const city = String(row['B'] || '');
        return city && normalizeText(city) !== 'municipio' && normalizeText(city) !== 'cidade' && normalizeText(city) !== 'cod';
      });

      setFreightTables({ cif: cleanCIF, fob: cleanFOB, equalization: cleanEQ });
    } catch (error) {
      console.error("Erro ao carregar tabelas de frete:", error);
    }
  };

  const getAliquot = (city: string, uf: string, type: string, weight: number, useEqualization: boolean = false, totalDeliveries: number = 1) => {
    const normCity = normalizeText(city);
    const cleanUF = uf.substring(0, 2).toUpperCase();

    // Se for FOB, sempre usa a tabela antiga (apenas CE, PI, MA)
    if (type === 'FOB') {
      const matches = freightTables.fob.filter(row => normalizeText(String(row['A'] || '')) === normCity);
      const entry = matches.length === 1 ? matches[0] : matches.find(row => String(row['B'] || '').toUpperCase().includes(cleanUF));
      
      if (!entry) return 0;

      if (weight <= 3000) return parseFloat(String(entry['C'] || 0));
      if (weight <= 14000) return parseFloat(String(entry['F'] || 0));
      return parseFloat(String(entry['I'] || 0));
    }

    // Se for CIF e estiver usando a nova tabela de equalização
    if (useEqualization) {
      const matches = freightTables.equalization.filter(row => normalizeText(String(row['B'] || '')) === normCity);
      const entry = matches.length === 1 ? matches[0] : matches.find(row => String(row['E'] || '').toUpperCase().includes(cleanUF));

      if (!entry) return 0;

      let col = 'F'; // 1 entrega
      if (totalDeliveries >= 2 && totalDeliveries <= 3) col = 'G';
      else if (totalDeliveries >= 4 && totalDeliveries <= 10) col = 'H';
      else if (totalDeliveries > 10) col = 'I';

      const valStr = String(entry[col as keyof typeof entry] || '0');
      const val = parseFloat(valStr.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
      
      return val / 1000; // Converte de tonelada para kg
    }

    // CIF Tabela Antiga
    const matches = freightTables.cif.filter(row => normalizeText(String(row['B'] || '')) === normCity);
    const entry = matches.length === 1 ? matches[0] : matches.find(row => String(row['E'] || '').toUpperCase().includes(cleanUF));
    
    if (!entry) return 0;
    
    let val = 0;
    if (weight <= 7000) val = parseFloat(String(entry['I'] || 0));
    else if (weight <= 17000) val = parseFloat(String(entry['J'] || 0));
    else val = parseFloat(String(entry['K'] || 0));
    
    return val / 1000;
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

      if (current) setCurrentLoads(current.loads);
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
            freight: w * aliquot
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
          freight: mainWeight * aliquot
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
          freight: mainWeight * aliquot
        });
      });
    }
    
    return deliveries;
  };

  const updateFromGoogleSheets = async () => {
    setUpdating(true);
    try {
      const response = await fetch(SHEET_URL);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames.find(name => name.toUpperCase() === "CARGAS") || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length < 2) throw new Error("Planilha vazia ou aba CARGAS não encontrada.");

      const dataRows = rows.slice(1).filter(r => r[1] && String(r[1]).trim() !== "");

      const newLoads: ExternalLoad[] = dataRows.map((row, idx) => {
        const rota = String(row[1] || '');
        const rawUF = String(row[3] || '');
        const mainWeightStr = String(row[4] || '0');
        const mainFreightType = String(row[5] || 'CIF').toUpperCase();
        const cleanUF = rawUF.replace(/[^A-Z]/gi, '').substring(0, 2).toUpperCase();
        const parsed = parseRota(rota, cleanUF, mainWeightStr, mainFreightType);
        const totalFreight = parsed.reduce((acc, d) => acc + d.freight, 0);
        
        return {
          id: `load-${idx}-${Date.now()}`,
          data: String(row[0] || ''),
          rota: rota,
          entregas: String(row[2] || ''),
          uf: cleanUF,
          peso: mainWeightStr,
          frete: mainFreightType,
          observacoes: String(row[6] || ''),
          status: String(row[8] || ''),
          parsedDeliveries: parsed,
          totalToPay: totalFreight * 0.7,
          manualDeliveryCount: parsed.length,
          useEqualizationTable: false
        };
      });

      await supabase.from('hidracor_external_loads').delete().eq('version', 'previous');
      if (currentLoads.length > 0) {
        await supabase.from('hidracor_external_loads').update({ version: 'previous' }).eq('version', 'current');
      }

      const { error: insertError } = await supabase.from('hidracor_external_loads').insert([{
        user_id: user?.id,
        loads: newLoads,
        version: 'current',
        updated_at: new Date().toISOString()
      }]);

      if (insertError) throw insertError;

      setPreviousLoads(currentLoads);
      setCurrentLoads(newLoads);
      setViewMode('current');
      showSuccess(`Dados atualizados!`);
    } catch (error: any) {
      showError("Erro ao atualizar: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveLoad = async (load: ExternalLoad) => {
    const driverName = prompt("Nome do motorista que aceitou a carga:");
    if (!driverName) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('hidracor_saved_external_loads').insert([{
        user_id: user?.id,
        rota: load.rota,
        data_original: load.data,
        deliveries: load.parsedDeliveries,
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

  const activeData = viewMode === 'current' ? currentLoads : previousLoads;

  const sortedData = useMemo(() => {
    let sortableItems = [...activeData];
    if (sortConfig.direction !== null) {
      sortableItems.sort((a: any, b: any) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [activeData, sortConfig]);

  const filteredData = useMemo(() => {
    return sortedData.filter(row => {
      const matchesFilters = Object.entries(columnFilters).every(([col, value]) => {
        if (!value) return true;
        return row[col as keyof ExternalLoad]?.toString().toLowerCase().includes(value.toLowerCase());
      });
      const matchesUF = selectedUFs.length === 0 || selectedUFs.includes(row.uf.toUpperCase());
      return matchesFilters && matchesUF;
    });
  }, [sortedData, columnFilters, selectedUFs]);

  const allUFs = useMemo(() => {
    const ufs = new Set(activeData.map(l => l.uf.toUpperCase()));
    return Array.from(ufs).sort();
  }, [activeData]);

  const handleUpdateLoad = (loadId: string, updates: Partial<ExternalLoad>) => {
    const updateFn = (loads: ExternalLoad[]) => loads.map(l => {
      if (l.id === loadId) {
        const updatedLoad = { ...l, ...updates };
        
        // Se mudou o Switch ou o contador de entregas, recalcula todas as alíquotas CIF
        if (updates.useEqualizationTable !== undefined || updates.manualDeliveryCount !== undefined) {
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
          const totalReceived = newDeliveries?.reduce((acc, d) => acc + d.freight, 0) || 0;
          updatedLoad.totalToPay = totalReceived * 0.7;
        }
        
        return updatedLoad;
      }
      return l;
    });
    if (viewMode === 'current') setCurrentLoads(updateFn);
    else setPreviousLoads(updateFn);
  };

  const handleUpdateDelivery = (loadId: string, deliveryIdx: number, updates: any) => {
    const updateFn = (loads: ExternalLoad[]) => loads.map(l => {
      if (l.id === loadId && l.parsedDeliveries) {
        const newDeliveries = [...l.parsedDeliveries];
        newDeliveries[deliveryIdx] = { ...newDeliveries[deliveryIdx], ...updates };
        if (updates.weight !== undefined || updates.aliquot !== undefined) {
          newDeliveries[deliveryIdx].freight = newDeliveries[deliveryIdx].weight * newDeliveries[deliveryIdx].aliquot;
        }
        const totalReceived = newDeliveries.reduce((acc, d) => acc + d.freight, 0);
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
                <th>Frete</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map(load => `
                <tr>
                  <td class="rota-cell"><strong>${load.rota}</strong></td>
                  <td style="text-align: center">${load.entregas}</td>
                  <td style="text-align: center"><strong>${load.uf}</strong></td>
                  <td style="text-align: right">${load.peso}</td>
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
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <header className="max-w-full mx-auto w-full flex justify-between items-center p-4 lg:px-8 bg-white border-b shadow-sm z-50 h-16">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft /></Button>
          </Link>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Midas Log" className="h-7 w-auto" />
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-slate-900">Cargas Externas Hidracor</h1>
              <p className="text-slate-500 text-[10px]">Monitoramento de cargas disponíveis no Google Sheets.</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Link to="/admin/external-loads/saved" target="_blank">
            <Button variant="outline" size="sm" className="gap-2 border-slate-200 hover:bg-slate-50 h-8 text-xs">
              <Bookmark size={14} /> <span className="hidden sm:inline">Cargas Salvas</span>
            </Button>
          </Link>

          <a href={VIEW_SHEET_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-2 border-slate-200 hover:bg-slate-50 h-8 text-xs">
              <FileText size={14} /> <span className="hidden sm:inline">Ver Planilha</span>
            </Button>
          </a>

          <Button onClick={handlePrint} size="sm" className="bg-slate-900 hover:bg-slate-800 text-white gap-2 h-8 text-xs">
            <Printer size={14} /> <span className="hidden sm:inline">Imprimir</span>
          </Button>

          <Button variant="outline" size="sm" onClick={updateFromGoogleSheets} disabled={updating} className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 h-8 text-xs">
            {updating ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-2 lg:p-4 gap-2 overflow-hidden">
        <Card className="border-none shadow-sm overflow-hidden flex flex-col flex-1">
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-50/50 border-b gap-2 py-1.5 px-4">
            <div className="flex items-center gap-4">
              <CardTitle className="text-md flex items-center gap-2">
                <Filter size={16} className="text-amber-600" /> 
                {viewMode === 'current' ? 'Cargas Atuais' : 'Versão Anterior'}
              </CardTitle>
              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                {filteredData.length} cargas
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader className="bg-white sticky top-0 z-30 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[80px]"></TableHead>
                    <TableHead className="min-w-[120px] py-4 px-4 bg-white">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('data')}>
                          <span className="text-[10px] font-bold uppercase text-slate-500">Data</span>
                          <ArrowUpDown size={12} className="text-slate-300" />
                        </div>
                        <Input placeholder="Filtrar..." className="h-7 text-[10px]" onChange={(e) => handleFilterChange('data', e.target.value)} />
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[300px] py-4 px-4 bg-white">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('rota')}>
                          <span className="text-[10px] font-bold uppercase text-slate-500">Rota</span>
                          <ArrowUpDown size={12} className="text-slate-300" />
                        </div>
                        <Input placeholder="Filtrar..." className="h-7 text-[10px]" onChange={(e) => handleFilterChange('rota', e.target.value)} />
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[80px] py-4 px-4 bg-white">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('entregas')}>
                          <span className="text-[10px] font-bold uppercase text-slate-500">Entr.</span>
                          <ArrowUpDown size={12} className="text-slate-300" />
                        </div>
                        <Input placeholder="Filt." className="h-7 text-[10px]" onChange={(e) => handleFilterChange('entregas', e.target.value)} />
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[100px] py-4 px-4 bg-white">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-slate-500">UF</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                                <Filter size={12} className={selectedUFs.length > 0 ? "text-amber-600" : "text-slate-300"} />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-40 p-2">
                              <div className="space-y-2">
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
                                {selectedUFs.length > 0 && (
                                  <Button variant="ghost" size="sm" className="w-full text-[10px] h-6 mt-2" onClick={() => setSelectedUFs([])}>Limpar</Button>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="h-7 flex items-center px-2 bg-slate-50 rounded border text-[10px] font-bold text-slate-500">
                          {selectedUFs.length > 0 ? selectedUFs.join(', ') : 'Todos'}
                        </div>
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[120px] py-4 px-4 bg-white">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('peso')}>
                          <span className="text-[10px] font-bold uppercase text-slate-500">Peso</span>
                          <ArrowUpDown size={12} className="text-slate-300" />
                        </div>
                        <Input placeholder="Filtrar..." className="h-7 text-[10px]" onChange={(e) => handleFilterChange('peso', e.target.value)} />
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[100px] py-4 px-4 bg-white">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('frete')}>
                          <span className="text-[10px] font-bold uppercase text-slate-500">Frete</span>
                          <ArrowUpDown size={12} className="text-slate-300" />
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
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-50">
                              <Eye size={16} />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader className="flex flex-row items-center justify-between pr-8">
                              <div className="flex flex-col gap-1">
                                <DialogTitle className="flex items-center gap-3">
                                  <img src="/logo.png" className="h-6 w-auto" />
                                  Detalhamento da Carga
                                </DialogTitle>
                                <DialogDescription className="font-bold text-slate-900">
                                  Rota: {load.rota}
                                </DialogDescription>
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={() => handleSaveLoad(load)} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
                                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar Carga
                                </Button>
                                <Button onClick={() => handlePrintDetailed(load)} className="bg-slate-900 hover:bg-slate-800 text-white gap-2">
                                  <Printer size={16} /> Imprimir para Motorista
                                </Button>
                              </div>
                            </DialogHeader>
                            
                            <div className="mt-4">
                              <Table>
                                <TableHeader className="bg-slate-900">
                                  <TableRow>
                                    <TableHead className="text-white text-[10px] uppercase">
                                      <div className="flex items-center gap-2">
                                        Entregas
                                        <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded border border-white/20">
                                          <ArrowRightLeft size={12} className="text-amber-400" />
                                          <span className="text-[9px] text-white/70">Nova Tabela CIF</span>
                                          <Switch 
                                            checked={load.useEqualizationTable} 
                                            onCheckedChange={(checked) => handleUpdateLoad(load.id, { useEqualizationTable: checked })}
                                            className="scale-75 data-[state=checked]:bg-amber-500"
                                          />
                                        </div>
                                      </div>
                                    </TableHead>
                                    <TableHead className="text-white text-[10px] uppercase">Cidade</TableHead>
                                    <TableHead className="text-white text-[10px] uppercase">UF</TableHead>
                                    <TableHead className="text-white text-[10px] uppercase">CIF/FOB</TableHead>
                                    <TableHead className="text-white text-[10px] uppercase">Peso</TableHead>
                                    <TableHead className="text-white text-[10px] uppercase">Alíquota</TableHead>
                                    <TableHead className="text-white text-[10px] uppercase">Frete a Receber</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {load.parsedDeliveries?.map((delivery, dIdx) => (
                                    <TableRow key={dIdx}>
                                      <TableCell className="text-xs font-bold">{dIdx + 1}</TableCell>
                                      <TableCell className="text-xs uppercase">{delivery.city}</TableCell>
                                      <TableCell className="text-xs font-bold">{delivery.uf}</TableCell>
                                      <TableCell className="text-xs">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${delivery.type === 'CIF' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                          {delivery.type}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        <Input type="number" className="h-7 w-24 text-xs" value={delivery.weight} onChange={(e) => handleUpdateDelivery(load.id, dIdx, { weight: parseFloat(e.target.value) || 0 })} />
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        <div className="flex items-center gap-2">
                                          <Input type="number" step="0.00000001" className={`h-7 w-24 text-xs ${delivery.aliquot === 0 ? 'border-red-500 bg-red-50' : ''}`} value={delivery.aliquot} onChange={(e) => handleUpdateDelivery(load.id, dIdx, { aliquot: parseFloat(e.target.value) || 0 })} />
                                          <Popover>
                                            <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-amber-600"><Search size={12} /></Button></PopoverTrigger>
                                            <PopoverContent className="w-80 p-2">
                                              <div className="space-y-2">
                                                <Input placeholder="Pesquisar cidade..." className="h-8 text-xs" value={manualSearch} onChange={(e) => setManualSearch(e.target.value)} />
                                                <div className="max-h-60 overflow-y-auto space-y-1">
                                                  {(delivery.type === 'CIF' ? (load.useEqualizationTable ? freightTables.equalization : freightTables.cif) : freightTables.fob)
                                                    .filter((row: any) => {
                                                      const name = (delivery.type === 'CIF' && load.useEqualizationTable) ? String(row['B'] || '') : (delivery.type === 'CIF' ? String(row['B'] || '') : String(row['A'] || ''));
                                                      return normalizeText(name).includes(normalizeText(manualSearch));
                                                    })
                                                    .slice(0, 50)
                                                    .map((row: any, idx: number) => (
                                                      <Button key={idx} variant="ghost" className="w-full flex flex-col items-start text-[10px] h-auto py-2 px-2 border-b last:border-0" onClick={() => {
                                                        let finalVal = 0;
                                                        const weight = delivery.weight;
                                                        if (delivery.type === 'CIF') {
                                                          if (load.useEqualizationTable) {
                                                            let col = 'F';
                                                            const totalD = load.manualDeliveryCount || 1;
                                                            if (totalD >= 2 && totalD <= 3) col = 'G';
                                                            else if (totalD >= 4 && totalD <= 10) col = 'H';
                                                            else if (totalD > 10) col = 'I';
                                                            const valStr = String(row[col as keyof typeof row] || '0');
                                                            finalVal = (parseFloat(valStr.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0) / 1000;
                                                          } else {
                                                            if (weight <= 7000) finalVal = parseFloat(String(row['I'] || 0)) / 1000;
                                                            else if (weight <= 17000) finalVal = parseFloat(String(row['J'] || 0)) / 1000;
                                                            else finalVal = parseFloat(String(row['K'] || 0)) / 1000;
                                                          }
                                                        } else {
                                                          if (weight <= 3000) finalVal = parseFloat(String(row['C'] || 0));
                                                          else if (weight <= 14000) finalVal = parseFloat(String(row['F'] || 0));
                                                          else finalVal = parseFloat(String(row['I'] || 0));
                                                        }
                                                        handleUpdateDelivery(load.id, dIdx, { aliquot: finalVal });
                                                      }}>
                                                        <div className="font-bold uppercase">
                                                          {delivery.type === 'CIF' ? (load.useEqualizationTable ? `${row['B']} (${row['E']})` : `${row['B']} (${row['E']})`) : `${row['A']} (${row['B']})`}
                                                        </div>
                                                      </Button>
                                                    ))}
                                                </div>
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-xs font-bold">R$ {formatCurrency(delivery.freight)}</TableCell>
                                    </TableRow>
                                  ))}
                                  <TableRow className="bg-slate-50 font-bold">
                                    <TableCell className="text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase text-slate-500">Total Entregas:</span>
                                        <Input 
                                          type="number" 
                                          className="h-7 w-16 text-xs font-bold bg-white" 
                                          value={load.manualDeliveryCount} 
                                          onChange={(e) => handleUpdateLoad(load.id, { manualDeliveryCount: parseInt(e.target.value) || 0 })}
                                        />
                                      </div>
                                    </TableCell>
                                    <TableCell colSpan={3} className="text-right uppercase text-[10px]">Total:</TableCell>
                                    <TableCell className="text-xs">{formatCurrency(load.parsedDeliveries?.reduce((acc, d) => acc + d.weight, 0) || 0)}</TableCell>
                                    <TableCell className="text-xs">-</TableCell>
                                    <TableCell className="text-xs text-amber-700">R$ {formatCurrency(load.parsedDeliveries?.reduce((acc, d) => acc + d.freight, 0) || 0)}</TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>

                              {(() => {
                                const totalReceived = load.parsedDeliveries?.reduce((acc, d) => acc + d.freight, 0) || 0;
                                const totalToPay = load.totalToPay || 0;
                                const tax = totalReceived * TAX_RATE;
                                const marginBefore = totalReceived - totalToPay;
                                const marginAfter = totalReceived - totalToPay - tax;
                                const marginBeforePct = totalReceived > 0 ? (marginBefore / totalReceived) * 100 : 0;
                                const marginAfterPct = totalReceived > 0 ? (marginAfter / totalReceived) * 100 : 0;

                                return (
                                  <div className="mt-6 flex flex-col items-end gap-2 border-t pt-4">
                                    <div className="flex items-center gap-8 text-xs">
                                      <span className="text-slate-500 font-bold uppercase">Total a Pagar:</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-slate-400">R$</span>
                                        <Input type="number" className="h-7 w-32 text-xs font-bold" value={totalToPay} onChange={(e) => handleUpdateLoad(load.id, { totalToPay: parseFloat(e.target.value) || 0 })} />
                                      </div>
                                    </div>
                                    <div className="flex gap-8 text-xs">
                                      <span className="text-slate-500 font-bold uppercase">Margem antes do Imposto:</span>
                                      <span className={`font-bold ${marginBefore >= 0 ? 'text-green-600' : 'text-red-600'}`}>R$ {formatCurrency(marginBefore)} ({marginBeforePct.toFixed(2)}%)</span>
                                    </div>
                                    <div className="flex gap-8 text-xs">
                                      <span className="text-slate-500 font-bold uppercase">Margem depois do Imposto (13%):</span>
                                      <span className={`font-bold ${marginAfter >= 0 ? 'text-green-700' : 'text-red-700'}`}>R$ {formatCurrency(marginAfter)} ({marginAfterPct.toFixed(2)}%)</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                      <TableCell className="text-[11px]">{load.data}</TableCell>
                      <TableCell className="text-[11px] font-medium max-w-[300px] truncate" title={load.rota}>{load.rota}</TableCell>
                      <TableCell className="text-[11px] text-center">{load.entregas}</TableCell>
                      <TableCell className="text-[11px] text-center font-bold">{load.uf}</TableCell>
                      <TableCell className="text-[11px] text-right">{load.peso}</TableCell>
                      <TableCell className="text-[11px] text-center"><span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">{load.frete}</span></TableCell>
                      <TableCell className="text-[11px]"><div className={`px-2 py-1 rounded-full text-[10px] font-bold text-center ${load.status.includes('AGENCIANDO') ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{load.status}</div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ExternalLoads;