"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Printer, 
  Download, 
  Loader2, 
  CreditCard, 
  CheckCircle2, 
  Undo2, 
  Calendar, 
  User, 
  Filter,
  Plus,
  Trash2,
  AlertTriangle,
  FileText,
  DollarSign,
  Coins,
  TrendingDown,
  Clock,
  ShieldAlert,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';

interface Adiantamento {
  amount: number;
  date: string;
  description: string;
}

interface Avaria {
  fabrica: string;
  valor: number;
  cliente: string;
  nfe: string;
  observacao: string;
}

interface RomaneioData {
  ciot_number?: string;
  ciot_ok?: boolean;
  manifesto_number?: string;
  manifesto_ok?: boolean;
  contas_pagar_mot_ok?: boolean;
  contas_receber_fob_ok?: boolean;
  duplicatas_boletos_ok?: boolean;
  ocorrencias?: string;
  adiantamentos?: Adiantamento[];
  tem_avaria?: boolean;
  avarias?: Avaria[];
  carga_quitada?: boolean;
  situacao?: string;
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
  items: any[];
  romaneio_data?: RomaneioData;
}

const DriverPaymentsReport = () => {
  const { user } = useAuth();
  const [calculations, setCalculations] = useState<SavedCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [reportMonth, setReportMonth] = useState<string>("ALL");
  const [reportYear, setReportYear] = useState<string>("ALL");
  const [reportFactoryFilter, setReportFactoryFilter] = useState<string>("ALL");
  const [selectedFinancialStatuses, setSelectedFinancialStatuses] = useState<string[]>([
    "adiantamento_pendente",
    "adiantamento_feito",
    "quitada"
  ]);
  const [reportSituationFilter, setReportSituationFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Estado para modal de adiantamentos
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [selectedCalc, setSelectedCalc] = useState<SavedCalculation | null>(null);
  const [advancesList, setAdvancesList] = useState<Adiantamento[]>([]);
  const [newAdvanceAmount, setNewAdvanceAmount] = useState<string>("");
  const [newAdvanceDate, setNewAdvanceDate] = useState<string>("");
  const [newAdvanceDesc, setNewAdvanceDesc] = useState<string>("");

  // Inicializa mês e ano atuais como padrão, mas permite ver todos
  useEffect(() => {
    const currentMonth = (new Date().getMonth() + 1).toString();
    const currentYear = new Date().getFullYear().toString();
    setReportMonth(currentMonth);
    setReportYear(currentYear);
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
      showError("Erro ao carregar cálculos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtra apenas as cargas que são Romaneios
  // Uma carga é Romaneio se tem itens e todos os itens têm NF-e e CT-e preenchidos
  const romaneioCalculations = useMemo(() => {
    return calculations.filter(calc => {
      const items = calc.items || [];
      return items.length > 0 && items.every(item => item.nfe?.trim() && item.cte?.trim());
    });
  }, [calculations]);

  // Aplica filtros em memória sobre os Romaneios
  const filteredCalculations = useMemo(() => {
    return romaneioCalculations.filter(calc => {
      // Filtro de Mês e Ano
      const dateStr = calc.billing_date || calc.created_at;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
      
      if (reportMonth !== "ALL") {
        const matchMonth = (utcDate.getMonth() + 1) === Number(reportMonth);
        if (!matchMonth) return false;
      }
      
      if (reportYear !== "ALL") {
        const matchYear = utcDate.getFullYear() === Number(reportYear);
        if (!matchYear) return false;
      }

      // Filtro de Fábrica
      if (reportFactoryFilter !== "ALL") {
        if (calc.factory !== reportFactoryFilter) return false;
      }

      const romData = calc.romaneio_data || {};
      const isQuitada = !!romData.carga_quitada;
      const totalAdiantamentos = (romData.adiantamentos || []).reduce((acc, a) => acc + (a.amount || 0), 0);

      // Filtro Financeiro
      const labelValue = isQuitada 
        ? "quitada" 
        : (totalAdiantamentos > 0 ? "adiantamento_feito" : "adiantamento_pendente");
      
      if (!selectedFinancialStatuses.includes(labelValue)) {
        return false;
      }

      // Filtro de Situação Geral
      if (reportSituationFilter !== "ALL") {
        const situacao = romData.situacao || "em_rota";
        if (situacao !== reportSituationFilter) return false;
      }

      // Busca Textual (Motorista ou Placa)
      if (searchTerm.trim() !== "") {
        const term = searchTerm.toLowerCase();
        const matchDriver = calc.driver_name.toLowerCase().includes(term);
        const matchPlate = (calc.driver_plate || "").toLowerCase().includes(term);
        if (!matchDriver && !matchPlate) return false;
      }

      return true;
    });
  }, [romaneioCalculations, reportMonth, reportYear, reportFactoryFilter, selectedFinancialStatuses, reportSituationFilter, searchTerm]);

  // Estatísticas das cargas filtradas
  const stats = useMemo(() => {
    let freteTotal = 0;
    let totalAdiantado = 0;
    let totalDescontos = 0;
    let saldoPendente = 0;

    filteredCalculations.forEach(calc => {
      const romData = calc.romaneio_data || {};
      const freight = calc.driver_payment || 0;
      const advances = (romData.adiantamentos || []).reduce((acc, a) => acc + (a.amount || 0), 0);
      const damages = (romData.avarias || []).reduce((acc, a) => acc + (a.valor || 0), 0);
      const isQuitada = !!romData.carga_quitada;

      freteTotal += freight;
      totalAdiantado += advances;
      totalDescontos += damages;
      
      if (!isQuitada) {
        saldoPendente += (freight - advances - damages);
      }
    });

    return { freteTotal, totalAdiantado, totalDescontos, saldoPendente };
  }, [filteredCalculations]);

  // Função para abrir modal de edição de adiantamentos
  const handleOpenAdvanceModal = (calc: SavedCalculation) => {
    setSelectedCalc(calc);
    setAdvancesList(calc.romaneio_data?.adiantamentos || []);
    setNewAdvanceAmount("");
    setNewAdvanceDate(new Date().toISOString().split('T')[0]);
    setNewAdvanceDesc("");
    setShowAdvanceModal(true);
  };

  // Salva a lista de adiantamentos atualizada no banco de dados
  const handleSaveAdvances = async () => {
    if (!selectedCalc) return;

    const romData = selectedCalc.romaneio_data || {};
    const updatedRomData = {
      ...romData,
      adiantamentos: advancesList
    };

    try {
      const { error } = await supabase
        .from('cerbras_freight_calculations')
        .update({ romaneio_data: updatedRomData })
        .eq('id', selectedCalc.id);

      if (error) throw error;

      // Atualiza o estado local
      setCalculations(prev => prev.map(c => {
        if (c.id === selectedCalc.id) {
          return { ...c, romaneio_data: updatedRomData };
        }
        return c;
      }));

      showSuccess("Adiantamentos atualizados com sucesso!");
      setShowAdvanceModal(false);
      setSelectedCalc(null);
    } catch (error: any) {
      showError("Erro ao salvar adiantamentos: " + error.message);
    }
  };

  // Adiciona adiantamento temporariamente na lista local do modal
  const handleAddAdvanceLocal = () => {
    const amount = parseFloat(newAdvanceAmount);
    if (isNaN(amount) || amount <= 0) {
      return showError("Insira um valor de adiantamento válido.");
    }
    if (!newAdvanceDate) {
      return showError("Selecione uma data para o adiantamento.");
    }

    const newAdv: Adiantamento = {
      amount,
      date: newAdvanceDate,
      description: newAdvanceDesc.trim() || "Adiantamento"
    };

    setAdvancesList(prev => [...prev, newAdv]);
    setNewAdvanceAmount("");
    setNewAdvanceDesc("");
  };

  // Remove adiantamento temporariamente da lista local do modal
  const handleRemoveAdvanceLocal = (index: number) => {
    setAdvancesList(prev => prev.filter((_, i) => i !== index));
  };

  // Atualiza quitação diretamente da tabela
  const handleToggleQuitação = async (calc: SavedCalculation) => {
    const romData = calc.romaneio_data || {};
    const isCurrentlyQuitada = !!romData.carga_quitada;
    const updatedRomData = {
      ...romData,
      carga_quitada: !isCurrentlyQuitada
    };

    try {
      const { error } = await supabase
        .from('cerbras_freight_calculations')
        .update({ romaneio_data: updatedRomData })
        .eq('id', calc.id);

      if (error) throw error;

      setCalculations(prev => prev.map(c => {
        if (c.id === calc.id) {
          return { ...c, romaneio_data: updatedRomData };
        }
        return c;
      }));

      showSuccess(isCurrentlyQuitada ? "Quitação revertida para pendente." : "Carga marcada como quitada!");
    } catch (error: any) {
      showError("Erro ao atualizar quitação: " + error.message);
    }
  };

  // Atualiza a situação geral da carga
  const handleUpdateSituation = async (calc: SavedCalculation, value: string) => {
    const romData = calc.romaneio_data || {};
    const updatedRomData = {
      ...romData,
      situacao: value
    };

    try {
      const { error } = await supabase
        .from('cerbras_freight_calculations')
        .update({ romaneio_data: updatedRomData })
        .eq('id', calc.id);

      if (error) throw error;

      setCalculations(prev => prev.map(c => {
        if (c.id === calc.id) {
          return { ...c, romaneio_data: updatedRomData };
        }
        return c;
      }));

      showSuccess(`Situação atualizada para: ${value === 'em_rota' ? 'EM ROTA' : 'FINALIZADA'}`);
    } catch (error: any) {
      showError("Erro ao atualizar situação: " + error.message);
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getFinancialStatusLabel = (calc: SavedCalculation) => {
    const romData = calc.romaneio_data || {};
    if (romData.carga_quitada) return "QUITADA";
    const totalAdiantamentos = (romData.adiantamentos || []).reduce((acc, a) => acc + (a.amount || 0), 0);
    if (totalAdiantamentos > 0) return "ADIANT. PARCIAL";
    return "PENDENTE";
  };

  const getFinancialStatusColor = (calc: SavedCalculation) => {
    const label = getFinancialStatusLabel(calc);
    if (label === "QUITADA") return "bg-green-50 text-green-700 border-green-200";
    if (label === "ADIANT. PARCIAL") return "bg-blue-50 text-blue-700 border-blue-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
  };

  // Impressão formatada
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const logoUrl = window.location.origin + "/logo.png";
    
    // Constrói informações dos filtros para o cabeçalho do print
    const monthText = reportMonth === "ALL" ? "TODOS" : new Date(2000, Number(reportMonth) - 1).toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
    const yearText = reportYear === "ALL" ? "TODOS" : reportYear;
    
    const content = `
      <html>
        <head>
          <title>Pagamentos de Motoristas - Midas Log</title>
          <style>
            body { font-family: sans-serif; padding: 25px; color: #333; }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #d97706; padding-bottom: 12px; margin-bottom: 15px; }
            .logo { height: 45px; }
            .title { font-size: 18px; font-weight: bold; color: #78350f; }
            .filter-info { font-size: 10px; color: #666; margin-bottom: 15px; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
            .stat-card { border: 1px solid #e2e8f0; padding: 8px; border-radius: 4px; background: #fafafa; }
            .stat-label { font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase; }
            .stat-val { font-size: 13px; font-weight: bold; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f8fafc; text-align: left; padding: 6px; font-size: 9px; text-transform: uppercase; border: 1px solid #cbd5e1; }
            td { padding: 6px; border: 1px solid #cbd5e1; font-size: 9px; }
            .total-row { font-weight: bold; background: #f1f5f9; }
            .badge { display: inline-block; padding: 1px 4px; border-radius: 3px; font-size: 8px; font-weight: bold; text-transform: uppercase; }
            .badge-quitada { background: #dcfce7; color: #15803d; }
            .badge-parcial { background: #dbeafe; color: #1d4ed8; }
            .badge-pendente { background: #fef3c7; color: #b45309; }
            .badge-finalizada { background: #f1f5f9; color: #334155; }
            .badge-rota { background: #ffedd5; color: #c2410c; }
            .driver-name { font-weight: bold; }
            .driver-plate { font-family: monospace; color: #64748b; font-size: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" class="logo" />
            <div class="title">Relatório de Pagamento de Motoristas</div>
          </div>
          <div class="filter-info">
            Período: ${monthText} / ${yearText} | 
            Fábrica: ${reportFactoryFilter} | 
            Situação: ${reportSituationFilter === 'ALL' ? 'TODAS' : reportSituationFilter === 'em_rota' ? 'EM ROTA' : 'FINALIZADAS'} |
            Status Financeiro: ${selectedFinancialStatuses.length === 3 ? 'TODOS' : selectedFinancialStatuses.length === 0 ? 'NENHUM' : selectedFinancialStatuses.map(s => {
              if (s === 'quitada') return 'QUITADA';
              if (s === 'adiantamento_feito') return 'ADIANT. PARCIAL';
              return 'ADIANT. PENDENTE';
            }).join(', ')}
          </div>
          
          <div class="stats-grid">
            <div class="stat-card" style="border-left: 3px solid #64748b;">
              <div class="stat-label">Frete Total</div>
              <div class="stat-val">R$ ${formatCurrency(stats.freteTotal)}</div>
            </div>
            <div class="stat-card" style="border-left: 3px solid #3b82f6;">
              <div class="stat-label">Total Adiantado</div>
              <div class="stat-val" style="color: #1d4ed8;">R$ ${formatCurrency(stats.totalAdiantado)}</div>
            </div>
            <div class="stat-card" style="border-left: 3px solid #ef4444;">
              <div class="stat-label">Total Descontos/Avarias</div>
              <div class="stat-val" style="color: #b91c1c;">R$ ${formatCurrency(stats.totalDescontos)}</div>
            </div>
            <div class="stat-card" style="border-left: 3px solid #f59e0b;">
              <div class="stat-label">Saldo Pendente</div>
              <div class="stat-val" style="color: #b45309;">R$ ${formatCurrency(stats.saldoPendente)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Data Fat.</th>
                <th>Motorista / Placa</th>
                <th>Fábrica</th>
                <th>Frete Orig.</th>
                <th>Adiantamentos</th>
                <th>Descontos/Avarias</th>
                <th>Saldo Aberto</th>
                <th>Situação</th>
                <th>Status Fin.</th>
              </tr>
            </thead>
            <tbody>
              ${filteredCalculations.map(calc => {
                const romData = calc.romaneio_data || {};
                const freight = calc.driver_payment || 0;
                const advances = (romData.adiantamentos || []).reduce((acc, a) => acc + (a.amount || 0), 0);
                const damages = (romData.avarias || []).reduce((acc, a) => acc + (a.valor || 0), 0);
                const openBalance = romData.carga_quitada ? 0 : (freight - advances - damages);
                const label = getFinancialStatusLabel(calc);
                const fStatusClass = label === 'QUITADA' ? 'badge-quitada' : label === 'ADIANT. PARCIAL' ? 'badge-parcial' : 'badge-pendente';
                const situacao = romData.situacao || 'em_rota';
                
                return `
                  <tr>
                    <td>${calc.billing_date ? calc.billing_date.split('-').reverse().join('/') : 'N/A'}</td>
                    <td>
                      <div class="driver-name">${calc.driver_name}</div>
                      <div class="driver-plate">${calc.driver_plate || ''}</div>
                    </td>
                    <td>${calc.factory || 'CERBRAS'}</td>
                    <td>R$ ${formatCurrency(freight)}</td>
                    <td>R$ ${formatCurrency(advances)}</td>
                    <td>R$ ${formatCurrency(damages)}</td>
                    <td style="font-weight: bold; color: ${openBalance > 0 ? '#b45309' : '#334155'};">
                      R$ ${formatCurrency(openBalance)}
                    </td>
                    <td>
                      <span class="badge ${situacao === 'finalizada' ? 'badge-finalizada' : 'badge-rota'}">
                        ${situacao === 'finalizada' ? 'Finalizada' : 'Em Rota'}
                      </span>
                    </td>
                    <td>
                      <span class="badge ${fStatusClass}">${label}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
              <tr class="total-row">
                <td colspan="3" style="text-align: right;">TOTAIS:</td>
                <td>R$ ${formatCurrency(stats.freteTotal)}</td>
                <td>R$ ${formatCurrency(stats.totalAdiantado)}</td>
                <td>R$ ${formatCurrency(stats.totalDescontos)}</td>
                <td style="color: #b45309;">R$ ${formatCurrency(stats.saldoPendente)}</td>
                <td colspan="2"></td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  // Exportar para Excel
  const handleExportExcel = () => {
    const dataToExport = filteredCalculations.map(calc => {
      const romData = calc.romaneio_data || {};
      const freight = calc.driver_payment || 0;
      const advances = (romData.adiantamentos || []).reduce((acc, a) => acc + (a.amount || 0), 0);
      const damages = (romData.avarias || []).reduce((acc, a) => acc + (a.valor || 0), 0);
      const openBalance = romData.carga_quitada ? 0 : (freight - advances - damages);
      
      return {
        'Data Faturamento': calc.billing_date ? calc.billing_date.split('-').reverse().join('/') : '',
        'Motorista': calc.driver_name.toUpperCase(),
        'Placa': (calc.driver_plate || '').toUpperCase(),
        'Fábrica': calc.factory,
        'Frete Original (R$)': freight,
        'Adiantamentos Feitos (R$)': advances,
        'Descontos / Avarias (R$)': damages,
        'Saldo em Aberto (R$)': openBalance,
        'Situação Carga': (romData.situacao || 'em_rota') === 'finalizada' ? 'FINALIZADA' : 'EM ROTA',
        'Status Financeiro': getFinancialStatusLabel(calc)
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    
    // Configura larguras de coluna básicas
    const colWidths = [
      { wch: 18 }, // Data Faturamento
      { wch: 25 }, // Motorista
      { wch: 12 }, // Placa
      { wch: 15 }, // Fábrica
      { wch: 20 }, // Frete Original
      { wch: 22 }, // Adiantamentos Feitos
      { wch: 22 }, // Descontos/Avarias
      { wch: 20 }, // Saldo em Aberto
      { wch: 15 }, // Situação Carga
      { wch: 18 }  // Status Financeiro
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagamento Motoristas");
    XLSX.writeFile(wb, `Pagamentos_Motoristas_${reportMonth}_${reportYear}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 lg:px-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon" className="h-9 w-9 border border-slate-100 hover:bg-slate-50"><ArrowLeft size={16} /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-amber-900 flex items-center gap-2">
              <CreditCard className="text-amber-600" size={20} /> Pagamento de Motoristas
            </h1>
            <p className="text-slate-500 text-xs">Acompanhamento e quitação de saldos de romaneios finalizados.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 h-9 border-slate-200 text-slate-700" onClick={handlePrint} disabled={filteredCalculations.length === 0}>
            <Printer size={16} /> Imprimir
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-9 border-green-200 text-green-700 hover:bg-green-50" onClick={handleExportExcel} disabled={filteredCalculations.length === 0}>
            <Download size={16} /> Excel
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-8 space-y-6">
        {/* Filtros */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <Filter size={16} className="text-amber-600" />
            <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-wider">Filtros de Busca</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4">
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

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Fábrica</Label>
              <Select value={reportFactoryFilter} onValueChange={setReportFactoryFilter}>
                <SelectTrigger className="h-9 border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">TODAS</SelectItem>
                  <SelectItem value="CERBRAS">CERBRAS</SelectItem>
                  <SelectItem value="HIDRACOR">HIDRACOR</SelectItem>
                  <SelectItem value="HIDRACOR_EXTERNA">HIDRACOR EXTERNA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Situação Carga</Label>
              <Select value={reportSituationFilter} onValueChange={setReportSituationFilter}>
                <SelectTrigger className="h-9 border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">TODAS</SelectItem>
                  <SelectItem value="em_rota">EM ROTA</SelectItem>
                  <SelectItem value="finalizada">FINALIZADA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Status Financeiro</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    role="combobox" 
                    className="w-full h-9 justify-between text-xs border-slate-200 bg-white hover:bg-slate-50 font-normal px-3"
                  >
                    <span className="truncate">
                      {selectedFinancialStatuses.length === 3 
                        ? "TODOS" 
                        : selectedFinancialStatuses.length === 0 
                          ? "NENHUM" 
                          : selectedFinancialStatuses.map(s => {
                              if (s === "quitada") return "QUITADA";
                              if (s === "adiantamento_feito") return "ADIANT. PARCIAL";
                              return "ADIANT. PENDENTE";
                            }).join(", ")
                      }
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-2 bg-white border border-slate-200" align="start">
                  <div className="space-y-2">
                    <div 
                      className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer"
                      onClick={() => {
                        if (selectedFinancialStatuses.length === 3) {
                          setSelectedFinancialStatuses([]);
                        } else {
                          setSelectedFinancialStatuses(["adiantamento_pendente", "adiantamento_feito", "quitada"]);
                        }
                      }}
                    >
                      <Checkbox 
                        id="select-all-financial" 
                        checked={selectedFinancialStatuses.length === 3}
                        onCheckedChange={() => {}}
                      />
                      <label htmlFor="select-all-financial" className="text-[11px] font-bold text-slate-700 cursor-pointer uppercase select-none w-full">
                        (TODOS)
                      </label>
                    </div>
                    
                    <div className="border-t border-slate-100 my-1" />
                    
                    {[
                      { id: "adiantamento_pendente", label: "ADIANT. PENDENTE" },
                      { id: "adiantamento_feito", label: "ADIANT. PARCIAL" },
                      { id: "quitada", label: "QUITADA" }
                    ].map((status) => {
                      const isChecked = selectedFinancialStatuses.includes(status.id);
                      return (
                        <div 
                          key={status.id}
                          className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer"
                          onClick={() => {
                            if (isChecked) {
                              setSelectedFinancialStatuses(prev => prev.filter(s => s !== status.id));
                            } else {
                              setSelectedFinancialStatuses(prev => [...prev, status.id]);
                            }
                          }}
                        >
                          <Checkbox 
                            id={`financial-${status.id}`} 
                            checked={isChecked}
                            onCheckedChange={() => {}}
                          />
                          <label htmlFor={`financial-${status.id}`} className="text-[11px] font-medium text-slate-700 cursor-pointer uppercase select-none w-full">
                            {status.label}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <Input 
                  placeholder="Motorista ou placa..." 
                  className="pl-9 h-9 text-xs border-slate-200" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm bg-white overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-400" />
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold uppercase text-slate-500">Frete Total</CardDescription>
              <CardTitle className="text-2xl font-black text-slate-800">R$ {formatCurrency(stats.freteTotal)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-slate-400">Total acordado para os romaneios filtrados.</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold uppercase text-slate-500">Adiantamentos Realizados</CardDescription>
              <CardTitle className="text-2xl font-black text-blue-700">R$ {formatCurrency(stats.totalAdiantado)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-slate-400">Valores antecipados para os motoristas.</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold uppercase text-slate-500">Descontos / Avarias</CardDescription>
              <CardTitle className="text-2xl font-black text-red-700">R$ {formatCurrency(stats.totalDescontos)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-slate-400">Deduções aplicadas devido a avarias na carga.</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold uppercase text-slate-500">Saldo Restante Aberto</CardDescription>
              <CardTitle className="text-2xl font-black text-amber-700">R$ {formatCurrency(stats.saldoPendente)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-slate-400">Saldos pendentes a pagar de cargas não quitadas.</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Lançamentos */}
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-amber-600 h-8 w-8" />
                <span className="text-xs text-slate-500 font-medium">Buscando dados de pagamento...</span>
              </div>
            ) : filteredCalculations.length === 0 ? (
              <div className="py-20 text-center">
                <ShieldAlert className="mx-auto text-slate-300 mb-4" size={48} />
                <p className="text-slate-500 text-sm font-semibold">Nenhum pagamento de romaneio encontrado.</p>
                <p className="text-slate-400 text-xs mt-1">
                  Nota: Apenas cargas de "Romaneio" (com todas as NF-e e CT-e preenchidas) aparecem aqui.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50 border-b border-slate-100">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Faturamento</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Motorista</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Fábrica</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Frete Original</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Adiantamentos</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Descontos</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Saldo em Aberto</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-center w-[130px]">Situação Carga</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-center">Status Fin.</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right w-[150px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCalculations.map((calc) => {
                      const romData = calc.romaneio_data || {};
                      const freight = calc.driver_payment || 0;
                      const advances = (romData.adiantamentos || []).reduce((acc, a) => acc + (a.amount || 0), 0);
                      const damages = (romData.avarias || []).reduce((acc, a) => acc + (a.valor || 0), 0);
                      const openBalance = romData.carga_quitada ? 0 : (freight - advances - damages);
                      const isQuitada = !!romData.carga_quitada;
                      
                      return (
                        <TableRow key={calc.id} className="hover:bg-slate-50/50">
                          <TableCell className="text-xs font-medium">
                            {calc.billing_date ? calc.billing_date.split('-').reverse().join('/') : 'N/A'}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-semibold uppercase text-slate-900">{calc.driver_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono font-bold uppercase">{calc.driver_plate || '-'}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50/50 font-bold text-[9px] h-5">
                              {calc.factory}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium text-slate-600">
                            R$ {formatCurrency(freight)}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium text-blue-600">
                            R$ {formatCurrency(advances)}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium text-red-600">
                            R$ {formatCurrency(damages)}
                          </TableCell>
                          <TableCell className={`text-xs text-right font-black ${openBalance > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                            R$ {formatCurrency(openBalance)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Select 
                              value={romData.situacao || 'em_rota'} 
                              onValueChange={(v) => handleUpdateSituation(calc, v)}
                            >
                              <SelectTrigger className="h-7 text-[10px] font-bold bg-white border-slate-200 text-slate-700 uppercase">
                                <SelectValue placeholder="Situação" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="em_rota" className="text-[10px] font-bold text-amber-700">EM ROTA</SelectItem>
                                <SelectItem value="finalizada" className="text-[10px] font-bold text-slate-700 font-medium">FINALIZADA</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${getFinancialStatusColor(calc)} text-[9px] font-bold h-5 border`}>
                              {getFinancialStatusLabel(calc)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 px-2 border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-semibold gap-1"
                                onClick={() => handleOpenAdvanceModal(calc)}
                                title="Editar Adiantamentos"
                              >
                                Adiantar
                              </Button>
                              {isQuitada ? (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-slate-400 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200"
                                  onClick={() => handleToggleQuitação(calc)}
                                  title="Estornar Quitação (Marcar como Pendente)"
                                >
                                  <Undo2 size={13} />
                                </Button>
                              ) : (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 px-2 border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300 text-[10px] font-black gap-1 shadow-sm"
                                  onClick={() => handleToggleQuitação(calc)}
                                >
                                  <CheckCircle2 size={12} /> Quitar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Modal de Gestão de Adiantamentos */}
      <Dialog open={showAdvanceModal} onOpenChange={setShowAdvanceModal}>
        <DialogContent className="sm:max-w-md bg-white border border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-900">
              <Coins className="text-amber-600" size={20} />
              Adiantamentos do Motorista
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Adicione e remova adiantamentos para esta carga. O saldo restante será recalculado automaticamente.
            </DialogDescription>
          </DialogHeader>

          {selectedCalc && (
            <div className="space-y-4 py-3">
              {/* Resumo da carga */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Motorista:</span>
                  <span className="font-bold uppercase text-slate-800">{selectedCalc.driver_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Fábrica:</span>
                  <span className="font-semibold text-slate-700">{selectedCalc.factory}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-1 mt-1 text-slate-700">
                  <span>Valor Total Frete:</span>
                  <span className="font-bold">R$ {formatCurrency(selectedCalc.driver_payment || 0)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Deduções Avarias:</span>
                  <span className="font-medium">- R$ {formatCurrency((selectedCalc.romaneio_data?.avarias || []).reduce((acc, a) => acc + (a.amount || a.valor || 0), 0))}</span>
                </div>
                <div className="flex justify-between text-blue-600">
                  <span>Total Adiantado:</span>
                  <span className="font-medium">- R$ {formatCurrency(advancesList.reduce((acc, a) => acc + (a.amount || 0), 0))}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-bold text-amber-700">
                  <span>Saldo a Pagar:</span>
                  <span>
                    R$ {formatCurrency(
                      (selectedCalc.driver_payment || 0) - 
                      advancesList.reduce((acc, a) => acc + (a.amount || 0), 0) - 
                      (selectedCalc.romaneio_data?.avarias || []).reduce((acc, a) => acc + (a.amount || a.valor || 0), 0)
                    )}
                  </span>
                </div>
              </div>

              {/* Formulário para novo adiantamento */}
              <div className="border border-amber-100 p-3 rounded-lg bg-amber-50/30 space-y-3">
                <h4 className="text-[10px] font-black uppercase text-amber-900 tracking-wider">Lançar Novo Adiantamento</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="adv-amount" className="text-[10px] font-bold uppercase text-slate-600">Valor (R$)</Label>
                    <Input 
                      id="adv-amount"
                      type="number"
                      placeholder="0.00"
                      className="h-8 text-xs bg-white"
                      value={newAdvanceAmount}
                      onChange={(e) => setNewAdvanceAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="adv-date" className="text-[10px] font-bold uppercase text-slate-600">Data</Label>
                    <Input 
                      id="adv-date"
                      type="date"
                      className="h-8 text-xs bg-white"
                      value={newAdvanceDate}
                      onChange={(e) => setNewAdvanceDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="adv-desc" className="text-[10px] font-bold uppercase text-slate-600">Descrição / Obs</Label>
                  <Input 
                    id="adv-desc"
                    type="text"
                    placeholder="Ex: Pix adiantamento oleo, pix Midas, etc"
                    className="h-8 text-xs bg-white"
                    value={newAdvanceDesc}
                    onChange={(e) => setNewAdvanceDesc(e.target.value)}
                  />
                </div>
                <Button 
                  type="button" 
                  className="w-full h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1 shadow-sm"
                  onClick={handleAddAdvanceLocal}
                >
                  <Plus size={14} /> Adicionar na Lista
                </Button>
              </div>

              {/* Lista local de adiantamentos */}
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Adiantamentos Lançados</h4>
                {advancesList.length === 0 ? (
                  <p className="text-slate-400 text-center text-xs py-4 border border-dashed border-slate-200 rounded-lg">
                    Nenhum adiantamento para esta carga.
                  </p>
                ) : (
                  <div className="max-h-[140px] overflow-y-auto space-y-1 border border-slate-100 rounded-lg p-1">
                    {advancesList.map((adv, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100 text-xs">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800">R$ {formatCurrency(adv.amount)}</div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {adv.date.split('-').reverse().join('/')} - {adv.description}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRemoveAdvanceLocal(idx)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-3 border-slate-100">
            <Button variant="outline" className="h-9 text-xs border-slate-200" onClick={() => {
              setShowAdvanceModal(false);
              setSelectedCalc(null);
            }}>
              Cancelar
            </Button>
            <Button 
              className="bg-amber-600 hover:bg-amber-700 text-white h-9 text-xs font-bold"
              onClick={handleSaveAdvances}
            >
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverPaymentsReport;
