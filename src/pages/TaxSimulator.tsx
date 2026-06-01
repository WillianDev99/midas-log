"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Printer, 
  Download, 
  Loader2, 
  Percent, 
  Calendar, 
  FileText, 
  Coins, 
  Filter, 
  CreditCard, 
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  driver_plate?: string;
  billing_date: string;
  created_at: string;
  factory: string;
  driver_payment: number;
  tax_percent: number;
  items: FreightItem[];
  romaneio_data?: any;
}

const TaxSimulator = () => {
  const { user } = useAuth();
  const [calculations, setCalculations] = useState<SavedCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [reportMonth, setReportMonth] = useState<string>(
    (new Date().getMonth() + 1).toString()
  );
  const [reportYear, setReportYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [onlyRomaneios, setOnlyRomaneios] = useState<boolean>(true);
  const [taxRate, setTaxRate] = useState<number>(13);
  
  // Navegação de Abas Detalhadas
  const [activeTab, setActiveTab] = useState<"mdf_ce" | "mdf_pima" | "ext_hidracor">("mdf_ce");

  useEffect(() => {
    fetchCalculations();
  }, []);

  const fetchCalculations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cerbras_freight_calculations')
        .select('*')
        .order('billing_date', { ascending: false });

      if (error) throw error;
      setCalculations(data || []);
    } catch (error: any) {
      showError("Erro ao carregar romaneios: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Cálculo das Bases de Imposto e Cargas Filtradas
  const parsedData = useMemo(() => {
    let mdfCeBase = 0;
    let mdfPiMaBase = 0;
    let hidracorExternaBase = 0;
    
    const ceCalculations: any[] = [];
    const piMaCalculations: any[] = [];
    const extCalculations: any[] = [];

    const filtered = calculations.filter(calc => {
      const dateStr = calc.billing_date || calc.created_at;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      // Ajuste de timezone UTC
      const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
      
      if (reportMonth !== "ALL") {
        if ((utcDate.getMonth() + 1) !== Number(reportMonth)) return false;
      }
      
      if (reportYear !== "ALL") {
        if (utcDate.getFullYear() !== Number(reportYear)) return false;
      }

      if (onlyRomaneios) {
        const items = calc.items || [];
        if (items.length === 0 || !items.every(item => item.nfe?.trim() && item.cte?.trim())) {
          return false;
        }
      }

      return true;
    });

    filtered.forEach(calc => {
      const items = calc.items || [];
      
      if (calc.factory === 'HIDRACOR_EXTERNA') {
        const totalVal = items.reduce((acc, i) => acc + (i.valor || 0), 0);
        if (totalVal > 0) {
          hidracorExternaBase += totalVal;
          extCalculations.push({
            id: calc.id,
            billing_date: calc.billing_date,
            driver_name: calc.driver_name,
            driver_plate: calc.driver_plate,
            clients: Array.from(new Set(items.map(i => i.cliente))).join(', '),
            baseValue: totalVal,
            nfeCtes: items.map(i => `${i.nfe || ''}/${i.cte || ''}`).filter(x => x !== '/').join(', ')
          });
        }
      } else if (calc.factory === 'CERBRAS' || calc.factory === 'HIDRACOR') {
        const ceWeight = items.filter(i => i.uf === 'CE').reduce((acc, i) => acc + (i.peso || 0), 0);
        const otherWeight = items.filter(i => i.uf !== 'CE').reduce((acc, i) => acc + (i.peso || 0), 0);
        
        if (ceWeight > 0) {
          const baseCe = ceWeight * 0.02;
          mdfCeBase += baseCe;
          ceCalculations.push({
            id: calc.id,
            billing_date: calc.billing_date,
            driver_name: calc.driver_name,
            driver_plate: calc.driver_plate,
            factory: calc.factory,
            clients: Array.from(new Set(items.filter(i => i.uf === 'CE').map(i => i.cliente))).join(', '),
            weight: ceWeight,
            baseValue: baseCe,
            nfeCtes: items.filter(i => i.uf === 'CE').map(i => `${i.nfe || ''}/${i.cte || ''}`).filter(x => x !== '/').join(', ')
          });
        }
        
        if (otherWeight > 0) {
          const baseOther = otherWeight * 0.08;
          mdfPiMaBase += baseOther;
          piMaCalculations.push({
            id: calc.id,
            billing_date: calc.billing_date,
            driver_name: calc.driver_name,
            driver_plate: calc.driver_plate,
            factory: calc.factory,
            clients: Array.from(new Set(items.filter(i => i.uf !== 'CE').map(i => i.cliente))).join(', '),
            weight: otherWeight,
            baseValue: baseOther,
            nfeCtes: items.filter(i => i.uf !== 'CE').map(i => `${i.nfe || ''}/${i.cte || ''}`).filter(x => x !== '/').join(', ')
          });
        }
      }
    });

    return {
      mdfCeBase,
      mdfPiMaBase,
      hidracorExternaBase,
      ceCalculations,
      piMaCalculations,
      extCalculations
    };
  }, [calculations, reportMonth, reportYear, onlyRomaneios]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Resumo Geral
    const summaryData = [
      { 'Categoria': 'Frete MDF CE (2%)', 'Base de Cálculo (R$)': parsedData.mdfCeBase, 'Imposto Simulado (R$)': parsedData.mdfCeBase * (taxRate / 100) },
      { 'Categoria': 'Frete MDF PI/MA (8%)', 'Base de Cálculo (R$)': parsedData.mdfPiMaBase, 'Imposto Simulado (R$)': parsedData.mdfPiMaBase * (taxRate / 100) },
      { 'Categoria': 'Cargas Externas Hidracor', 'Base de Cálculo (R$)': parsedData.hidracorExternaBase, 'Imposto Simulado (R$)': parsedData.hidracorExternaBase * (taxRate / 100) },
      { 'Categoria': 'TOTAL GERAL', 'Base de Cálculo (R$)': parsedData.mdfCeBase + parsedData.mdfPiMaBase + parsedData.hidracorExternaBase, 'Imposto Simulado (R$)': (parsedData.mdfCeBase + parsedData.mdfPiMaBase + parsedData.hidracorExternaBase) * (taxRate / 100) }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo Simulação");

    // Sheet 2: MDF CE (2%)
    const ceData = parsedData.ceCalculations.map(c => ({
      'Data Faturamento': c.billing_date ? c.billing_date.split('-').reverse().join('/') : '',
      'Motorista': c.driver_name,
      'Placa': c.driver_plate || '',
      'Fábrica': c.factory,
      'Clientes (CE)': c.clients,
      'Peso CE (KG)': c.weight,
      'Base MDF CE (R$)': c.baseValue,
      'Imposto Simulado (R$)': c.baseValue * (taxRate / 100),
      'Documentos (NF/CTE)': c.nfeCtes
    }));
    if (ceData.length > 0) {
      const wsCE = XLSX.utils.json_to_sheet(ceData);
      XLSX.utils.book_append_sheet(wb, wsCE, "Detalhe MDF CE (2%)");
    }

    // Sheet 3: MDF PI/MA (8%)
    const piMaData = parsedData.piMaCalculations.map(c => ({
      'Data Faturamento': c.billing_date ? c.billing_date.split('-').reverse().join('/') : '',
      'Motorista': c.driver_name,
      'Placa': c.driver_plate || '',
      'Fábrica': c.factory,
      'Clientes': c.clients,
      'Peso Outros (KG)': c.weight,
      'Base MDF PI/MA (R$)': c.baseValue,
      'Imposto Simulado (R$)': c.baseValue * (taxRate / 100),
      'Documentos (NF/CTE)': c.nfeCtes
    }));
    if (piMaData.length > 0) {
      const wsPiMa = XLSX.utils.json_to_sheet(piMaData);
      XLSX.utils.book_append_sheet(wb, wsPiMa, "Detalhe MDF PI-MA (8%)");
    }

    // Sheet 4: Hidracor Externa
    const extData = parsedData.extCalculations.map(c => ({
      'Data Faturamento': c.billing_date ? c.billing_date.split('-').reverse().join('/') : '',
      'Motorista': c.driver_name,
      'Placa': c.driver_plate || '',
      'Clientes': c.clients,
      'Valor Carga (R$)': c.baseValue,
      'Imposto Simulado (R$)': c.baseValue * (taxRate / 100),
      'Documentos (NF/CTE)': c.nfeCtes
    }));
    if (extData.length > 0) {
      const wsExt = XLSX.utils.json_to_sheet(extData);
      XLSX.utils.book_append_sheet(wb, wsExt, "Detalhe Hidracor Externa");
    }

    XLSX.writeFile(wb, `Simulador_Imposto_${reportMonth}_${reportYear}_${taxRate}pct.xlsx`);
    showSuccess("Relatório Excel exportado!");
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const logoUrl = window.location.origin + "/logo.png";
    const monthText = reportMonth === "ALL" ? "TODOS" : new Date(2000, Number(reportMonth) - 1).toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
    
    const content = `
      <html>
        <head>
          <title>Simulação de Imposto - Midas Log</title>
          <style>
            body { font-family: sans-serif; padding: 25px; color: #333; }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 15px; }
            .logo { height: 45px; }
            .title { font-size: 18px; font-weight: bold; color: #065f46; }
            .subtitle { font-size: 10px; color: #666; margin-bottom: 15px; }
            .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .summary-table th { background: #ecfdf5; border: 1px solid #cbd5e1; padding: 8px; font-size: 10px; text-transform: uppercase; text-align: left; }
            .summary-table td { border: 1px solid #cbd5e1; padding: 8px; font-size: 10px; }
            .summary-table .bold { font-weight: bold; background: #f1f5f9; }
            
            .section-title { font-size: 12px; font-weight: bold; color: #334155; margin-top: 20px; margin-bottom: 8px; text-transform: uppercase; border-left: 3px solid #059669; padding-left: 6px; }
            
            .detail-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .detail-table th { background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px; font-size: 8px; text-transform: uppercase; text-align: left; }
            .detail-table td { border: 1px solid #cbd5e1; padding: 6px; font-size: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" class="logo" />
            <div class="title">Simulador de Imposto (Alíquota: ${taxRate}%)</div>
          </div>
          <div class="subtitle">
            Período: ${monthText} / ${reportYear} | 
            Romaneios Documentados: ${onlyRomaneios ? "SIM" : "NÃO"} | 
            Gerado em: ${new Date().toLocaleString('pt-BR')}
          </div>
          
          <table class="summary-table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Base de Cálculo</th>
                <th>Imposto Simulado (${taxRate}%)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Frete MDF CE (2%)</td>
                <td>R$ ${formatCurrency(parsedData.mdfCeBase)}</td>
                <td>R$ ${formatCurrency(parsedData.mdfCeBase * (taxRate / 100))}</td>
              </tr>
              <tr>
                <td>Frete MDF PI/MA (8%)</td>
                <td>R$ ${formatCurrency(parsedData.mdfPiMaBase)}</td>
                <td>R$ ${formatCurrency(parsedData.mdfPiMaBase * (taxRate / 100))}</td>
              </tr>
              <tr>
                <td>Cargas Externas Hidracor</td>
                <td>R$ ${formatCurrency(parsedData.hidracorExternaBase)}</td>
                <td>R$ ${formatCurrency(parsedData.hidracorExternaBase * (taxRate / 100))}</td>
              </tr>
              <tr class="bold">
                <td>TOTAL GERAL</td>
                <td>R$ ${formatCurrency(parsedData.mdfCeBase + parsedData.mdfPiMaBase + parsedData.hidracorExternaBase)}</td>
                <td>R$ ${formatCurrency((parsedData.mdfCeBase + parsedData.mdfPiMaBase + parsedData.hidracorExternaBase) * (taxRate / 100))}</td>
              </tr>
            </tbody>
          </table>

          <!-- MDF CE DETAILED -->
          ${parsedData.ceCalculations.length > 0 ? `
            <div class="section-title">Detalhamento MDF CE (2%)</div>
            <table class="detail-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Motorista/Placa</th>
                  <th>Fábrica</th>
                  <th>Clientes</th>
                  <th>Peso (KG)</th>
                  <th>Base (R$)</th>
                  <th>Imp. (${taxRate}%)</th>
                </tr>
              </thead>
              <tbody>
                ${parsedData.ceCalculations.map(c => `
                  <tr>
                    <td>${c.billing_date ? c.billing_date.split('-').reverse().join('/') : ''}</td>
                    <td>${c.driver_name} (${c.driver_plate || ''})</td>
                    <td>${c.factory}</td>
                    <td>${c.clients}</td>
                    <td>${c.weight.toLocaleString('pt-BR')}</td>
                    <td>R$ ${formatCurrency(c.baseValue)}</td>
                    <td>R$ ${formatCurrency(c.baseValue * (taxRate / 100))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          <!-- MDF PIMA DETAILED -->
          ${parsedData.piMaCalculations.length > 0 ? `
            <div class="section-title">Detalhamento MDF PI/MA (8%)</div>
            <table class="detail-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Motorista/Placa</th>
                  <th>Fábrica</th>
                  <th>Clientes</th>
                  <th>Peso (KG)</th>
                  <th>Base (R$)</th>
                  <th>Imp. (${taxRate}%)</th>
                </tr>
              </thead>
              <tbody>
                ${parsedData.piMaCalculations.map(c => `
                  <tr>
                    <td>${c.billing_date ? c.billing_date.split('-').reverse().join('/') : ''}</td>
                    <td>${c.driver_name} (${c.driver_plate || ''})</td>
                    <td>${c.factory}</td>
                    <td>${c.clients}</td>
                    <td>${c.weight.toLocaleString('pt-BR')}</td>
                    <td>R$ ${formatCurrency(c.baseValue)}</td>
                    <td>R$ ${formatCurrency(c.baseValue * (taxRate / 100))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          <!-- EXTERNAL HIDRACOR DETAILED -->
          ${parsedData.extCalculations.length > 0 ? `
            <div class="section-title">Detalhamento Cargas Externas Hidracor</div>
            <table class="detail-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Motorista/Placa</th>
                  <th>Clientes</th>
                  <th>Valor Total (R$)</th>
                  <th>Imp. (${taxRate}%)</th>
                </tr>
              </thead>
              <tbody>
                ${parsedData.extCalculations.map(c => `
                  <tr>
                    <td>${c.billing_date ? c.billing_date.split('-').reverse().join('/') : ''}</td>
                    <td>${c.driver_name} (${c.driver_plate || ''})</td>
                    <td>${c.clients}</td>
                    <td>R$ ${formatCurrency(c.baseValue)}</td>
                    <td>R$ ${formatCurrency(c.baseValue * (taxRate / 100))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </body>
      </html>
    `;
    
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const totalBase = parsedData.mdfCeBase + parsedData.mdfPiMaBase + parsedData.hidracorExternaBase;
  const totalImpostoSimulado = totalBase * (taxRate / 100);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 lg:px-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon" className="h-9 w-9 border border-slate-100 hover:bg-slate-50"><ArrowLeft size={16} /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Percent className="text-emerald-600" size={20} /> Simulador de Imposto
            </h1>
            <p className="text-slate-500 text-xs">Simulação e auditoria tributária baseada nos romaneios do período.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 h-9 border-slate-200 text-slate-700" onClick={handlePrint} disabled={calculations.length === 0}>
            <Printer size={16} /> Imprimir
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={handleExportExcel} disabled={calculations.length === 0}>
            <Download size={16} /> Excel
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-8 space-y-6">
        {/* Painel de Filtros e Parâmetros */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <Filter size={16} className="text-emerald-600" />
            <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-wider">Filtros & Configuração</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Mês</Label>
              <Select value={reportMonth} onValueChange={setReportMonth}>
                <SelectTrigger className="h-9 border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">TODOS</SelectItem>
                  {Array.from({length: 12}, (_, i) => (
                    <SelectItem key={i+1} value={(i+1).toString()}>
                      {new Date(2000, i).toLocaleString('pt-BR', {month: 'long'}).toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Ano</Label>
              <Select value={reportYear} onValueChange={setReportYear}>
                <SelectTrigger className="h-9 border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">TODOS</SelectItem>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 md:col-span-2 lg:col-span-2 flex flex-col justify-end pb-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="onlyRomaneios" 
                  checked={onlyRomaneios} 
                  onCheckedChange={(checked) => setOnlyRomaneios(!!checked)}
                  className="border-slate-300 accent-emerald-600"
                />
                <label
                  htmlFor="onlyRomaneios"
                  className="text-xs font-bold text-slate-600 uppercase cursor-pointer select-none"
                >
                  Apenas Romaneios Documentados (NF-e/CT-e)
                </label>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">Exclui simulações que não possuem documentação fiscal preenchida.</p>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                <Percent size={12} /> Alíquota Simulação (%)
              </Label>
              <div className="relative">
                <Input 
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  className="pr-8 h-9 border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500 font-bold"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumo de Métricas / Cards Interativos */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <Loader2 className="animate-spin text-emerald-600 h-8 w-8" />
            <span className="text-xs text-slate-500 font-medium">Processando romaneios...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Card 1: MDF CE */}
              <Card 
                className={`border-none shadow-sm cursor-pointer transition-all relative overflow-hidden ${
                  activeTab === 'mdf_ce' ? 'ring-2 ring-emerald-500 bg-emerald-50/10' : 'bg-white hover:bg-slate-50/50'
                }`}
                onClick={() => setActiveTab('mdf_ce')}
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-400" />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardDescription className="text-[10px] font-bold uppercase text-slate-500">MDF CE (2%)</CardDescription>
                    <Badge variant="outline" className="text-[8px] bg-slate-50 font-bold text-slate-600">Categoria</Badge>
                  </div>
                  <CardTitle className="text-xl font-black text-slate-800">
                    R$ {formatCurrency(parsedData.mdfCeBase)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-[10px] text-slate-400">Base tributável calculada (2% do peso).</p>
                  <p className="text-xs font-bold text-emerald-700">
                    Simulado ({taxRate}%): R$ {formatCurrency(parsedData.mdfCeBase * (taxRate / 100))}
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: MDF PI/MA */}
              <Card 
                className={`border-none shadow-sm cursor-pointer transition-all relative overflow-hidden ${
                  activeTab === 'mdf_pima' ? 'ring-2 ring-emerald-500 bg-emerald-50/10' : 'bg-white hover:bg-slate-50/50'
                }`}
                onClick={() => setActiveTab('mdf_pima')}
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-500" />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardDescription className="text-[10px] font-bold uppercase text-slate-500">MDF PI/MA (8%)</CardDescription>
                    <Badge variant="outline" className="text-[8px] bg-slate-50 font-bold text-slate-600">Categoria</Badge>
                  </div>
                  <CardTitle className="text-xl font-black text-slate-800">
                    R$ {formatCurrency(parsedData.mdfPiMaBase)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-[10px] text-slate-400">Base tributável calculada (8% do peso).</p>
                  <p className="text-xs font-bold text-emerald-700">
                    Simulado ({taxRate}%): R$ {formatCurrency(parsedData.mdfPiMaBase * (taxRate / 100))}
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: Hidracor Externa */}
              <Card 
                className={`border-none shadow-sm cursor-pointer transition-all relative overflow-hidden ${
                  activeTab === 'ext_hidracor' ? 'ring-2 ring-emerald-500 bg-emerald-50/10' : 'bg-white hover:bg-slate-50/50'
                }`}
                onClick={() => setActiveTab('ext_hidracor')}
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardDescription className="text-[10px] font-bold uppercase text-slate-500">Externa Hidracor</CardDescription>
                    <Badge variant="outline" className="text-[8px] bg-amber-50 font-bold text-amber-700 border-amber-200">Categoria</Badge>
                  </div>
                  <CardTitle className="text-xl font-black text-slate-800">
                    R$ {formatCurrency(parsedData.hidracorExternaBase)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-[10px] text-slate-400">Base total recebida de cargas externas.</p>
                  <p className="text-xs font-bold text-emerald-700">
                    Simulado ({taxRate}%): R$ {formatCurrency(parsedData.hidracorExternaBase * (taxRate / 100))}
                  </p>
                </CardContent>
              </Card>

              {/* Card 4: Total Geral */}
              <Card className="border-none shadow-sm bg-white relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-600" />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardDescription className="text-[10px] font-bold uppercase text-slate-500">Base Tributável Total</CardDescription>
                    <TrendingUp size={16} className="text-emerald-600" />
                  </div>
                  <CardTitle className="text-2xl font-black text-slate-800">
                    R$ {formatCurrency(totalBase)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-[10px] text-slate-400">Soma das bases tributáveis do período.</p>
                  <div className="border-t border-slate-100 my-1 pt-1" />
                  <p className="text-xs font-black text-emerald-700 uppercase tracking-tight flex justify-between">
                    <span>Imposto ({taxRate}%):</span>
                    <span>R$ {formatCurrency(totalImpostoSimulado)}</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Abas e Tabelas Drill-down */}
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="border-b bg-slate-50/50 pb-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Coins className="text-emerald-600" size={18} /> 
                      Detalhamento por Carga / Romaneio
                    </CardTitle>
                    <CardDescription className="text-[10px]">
                      Mostrando lançamentos vinculados à categoria selecionada acima.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 border rounded-lg bg-white p-1">
                    <Button 
                      variant={activeTab === 'mdf_ce' ? 'default' : 'ghost'} 
                      size="sm" 
                      className={`h-7 px-3 text-[10px] font-bold ${activeTab === 'mdf_ce' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}`}
                      onClick={() => setActiveTab('mdf_ce')}
                    >
                      MDF CE (2%)
                    </Button>
                    <Button 
                      variant={activeTab === 'mdf_pima' ? 'default' : 'ghost'} 
                      size="sm" 
                      className={`h-7 px-3 text-[10px] font-bold ${activeTab === 'mdf_pima' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}`}
                      onClick={() => setActiveTab('mdf_pima')}
                    >
                      MDF PI/MA (8%)
                    </Button>
                    <Button 
                      variant={activeTab === 'ext_hidracor' ? 'default' : 'ghost'} 
                      size="sm" 
                      className={`h-7 px-3 text-[10px] font-bold ${activeTab === 'ext_hidracor' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}`}
                      onClick={() => setActiveTab('ext_hidracor')}
                    >
                      Externa Hidracor
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Tabela MDF CE (2%) */}
                {activeTab === "mdf_ce" && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-[100px]">Data Fat.</TableHead>
                          <TableHead className="w-[180px]">Motorista / Placa</TableHead>
                          <TableHead className="w-[100px]">Fábrica</TableHead>
                          <TableHead>Clientes (Destinatários CE)</TableHead>
                          <TableHead className="text-right w-[120px]">Peso CE (KG)</TableHead>
                          <TableHead className="text-right w-[150px]">Base MDF CE (2%)</TableHead>
                          <TableHead className="text-right w-[160px]">Imp. Simulado ({taxRate}%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.ceCalculations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-32 text-center text-slate-400 text-xs">
                              Nenhum romaneio com destino CE registrado para este período.
                            </TableCell>
                          </TableRow>
                        ) : (
                          parsedData.ceCalculations.map((c) => (
                            <TableRow key={c.id} className="hover:bg-slate-50/50">
                              <TableCell className="text-xs">{c.billing_date ? c.billing_date.split('-').reverse().join('/') : 'N/A'}</TableCell>
                              <TableCell>
                                <p className="text-xs font-bold truncate max-w-[170px]">{c.driver_name}</p>
                                <p className="text-[10px] text-slate-400 font-mono">{c.driver_plate || '---'}</p>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-[9px] font-bold">
                                  {c.factory}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <p className="text-xs text-slate-600 truncate max-w-[300px] uppercase" title={c.clients}>
                                  {c.clients}
                                </p>
                                <p className="text-[9px] text-slate-400 truncate max-w-[300px]">Doc: {c.nfeCtes || 'Sem Doc'}</p>
                              </TableCell>
                              <TableCell className="text-right text-xs font-mono">{c.weight.toLocaleString('pt-BR')} KG</TableCell>
                              <TableCell className="text-right text-xs font-bold font-mono">R$ {formatCurrency(c.baseValue)}</TableCell>
                              <TableCell className="text-right text-xs font-bold font-mono text-emerald-700">
                                R$ {formatCurrency(c.baseValue * (taxRate / 100))}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                      {parsedData.ceCalculations.length > 0 && (
                        <TableFooter className="bg-slate-100 font-bold">
                          <TableRow>
                            <TableCell colSpan={4} className="text-right text-xs text-slate-600 uppercase">Totais da Categoria:</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {parsedData.ceCalculations.reduce((acc, c) => acc + c.weight, 0).toLocaleString('pt-BR')} KG
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              R$ {formatCurrency(parsedData.mdfCeBase)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-emerald-700">
                              R$ {formatCurrency(parsedData.mdfCeBase * (taxRate / 100))}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      )}
                    </Table>
                  </div>
                )}

                {/* Tabela MDF PI/MA (8%) */}
                {activeTab === "mdf_pima" && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-[100px]">Data Fat.</TableHead>
                          <TableHead className="w-[180px]">Motorista / Placa</TableHead>
                          <TableHead className="w-[100px]">Fábrica</TableHead>
                          <TableHead>Clientes (Destinatários Fora CE)</TableHead>
                          <TableHead className="text-right w-[120px]">Peso Outros (KG)</TableHead>
                          <TableHead className="text-right w-[150px]">Base MDF PI/MA (8%)</TableHead>
                          <TableHead className="text-right w-[160px]">Imp. Simulado ({taxRate}%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.piMaCalculations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-32 text-center text-slate-400 text-xs">
                              Nenhum romaneio com destinos interestaduais registrado para este período.
                            </TableCell>
                          </TableRow>
                        ) : (
                          parsedData.piMaCalculations.map((c) => (
                            <TableRow key={c.id} className="hover:bg-slate-50/50">
                              <TableCell className="text-xs">{c.billing_date ? c.billing_date.split('-').reverse().join('/') : 'N/A'}</TableCell>
                              <TableCell>
                                <p className="text-xs font-bold truncate max-w-[170px]">{c.driver_name}</p>
                                <p className="text-[10px] text-slate-400 font-mono">{c.driver_plate || '---'}</p>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-[9px] font-bold">
                                  {c.factory}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <p className="text-xs text-slate-600 truncate max-w-[300px] uppercase" title={c.clients}>
                                  {c.clients}
                                </p>
                                <p className="text-[9px] text-slate-400 truncate max-w-[300px]">Doc: {c.nfeCtes || 'Sem Doc'}</p>
                              </TableCell>
                              <TableCell className="text-right text-xs font-mono">{c.weight.toLocaleString('pt-BR')} KG</TableCell>
                              <TableCell className="text-right text-xs font-bold font-mono">R$ {formatCurrency(c.baseValue)}</TableCell>
                              <TableCell className="text-right text-xs font-bold font-mono text-emerald-700">
                                R$ {formatCurrency(c.baseValue * (taxRate / 100))}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                      {parsedData.piMaCalculations.length > 0 && (
                        <TableFooter className="bg-slate-100 font-bold">
                          <TableRow>
                            <TableCell colSpan={4} className="text-right text-xs text-slate-600 uppercase">Totais da Categoria:</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {parsedData.piMaCalculations.reduce((acc, c) => acc + c.weight, 0).toLocaleString('pt-BR')} KG
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              R$ {formatCurrency(parsedData.mdfPiMaBase)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-emerald-700">
                              R$ {formatCurrency(parsedData.mdfPiMaBase * (taxRate / 100))}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      )}
                    </Table>
                  </div>
                )}

                {/* Tabela Cargas Externas Hidracor */}
                {activeTab === "ext_hidracor" && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-[100px]">Data Fat.</TableHead>
                          <TableHead className="w-[180px]">Motorista / Placa</TableHead>
                          <TableHead>Clientes (Carga Externa)</TableHead>
                          <TableHead className="w-[200px]">Documentos (NF/CTE)</TableHead>
                          <TableHead className="text-right w-[180px]">Valor Total Recebido (Base)</TableHead>
                          <TableHead className="text-right w-[180px]">Imp. Simulado ({taxRate}%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.extCalculations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-32 text-center text-slate-400 text-xs">
                              Nenhuma carga externa Hidracor registrada para este período.
                            </TableCell>
                          </TableRow>
                        ) : (
                          parsedData.extCalculations.map((c) => (
                            <TableRow key={c.id} className="hover:bg-slate-50/50">
                              <TableCell className="text-xs">{c.billing_date ? c.billing_date.split('-').reverse().join('/') : 'N/A'}</TableCell>
                              <TableCell>
                                <p className="text-xs font-bold truncate max-w-[170px]">{c.driver_name}</p>
                                <p className="text-[10px] text-slate-400 font-mono">{c.driver_plate || '---'}</p>
                              </TableCell>
                              <TableCell>
                                <p className="text-xs text-slate-600 truncate max-w-[320px] uppercase" title={c.clients}>
                                  {c.clients}
                                </p>
                              </TableCell>
                              <TableCell className="text-xs text-slate-500 font-mono truncate max-w-[200px]" title={c.nfeCtes}>
                                {c.nfeCtes || 'Sem Docs'}
                              </TableCell>
                              <TableCell className="text-right text-xs font-bold font-mono">R$ {formatCurrency(c.baseValue)}</TableCell>
                              <TableCell className="text-right text-xs font-bold font-mono text-emerald-700">
                                R$ {formatCurrency(c.baseValue * (taxRate / 100))}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                      {parsedData.extCalculations.length > 0 && (
                        <TableFooter className="bg-slate-100 font-bold">
                          <TableRow>
                            <TableCell colSpan={4} className="text-right text-xs text-slate-600 uppercase">Totais da Categoria:</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              R$ {formatCurrency(parsedData.hidracorExternaBase)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-emerald-700">
                              R$ {formatCurrency(parsedData.hidracorExternaBase * (taxRate / 100))}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      )}
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default TaxSimulator;
