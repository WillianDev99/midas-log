"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Printer, 
  Download, 
  Loader2, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Undo2,
  Calendar,
  CreditCard,
  User,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { fetchClosedMonths, isMonthClosed } from '@/utils/closedMonths';

interface AvariaRow {
  calculationId: string;
  driverName: string;
  driverPlate: string;
  billingDate: string;
  createdAt: string;
  factory: string;
  avariaId: string;
  idx: number;
  fabrica: string;
  valor: number;
  cliente: string;
  nfe: string;
  observacao: string;
  status: 'a_pagar' | 'paga';
  data_pagamento?: string;
  beneficiario?: string;
}

const AvariasReport = () => {
  const { user } = useAuth();
  const [calculations, setCalculations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [closedMonths, setClosedMonths] = useState<string[]>([]);
  
  // Filtros
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
  const [reportFactoryFilter, setReportFactoryFilter] = useState<string>("ALL");
  const [reportStatusFilter, setReportStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Estado para modal de pagamento
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedAvaria, setSelectedAvaria] = useState<AvariaRow | null>(null);
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [beneficiary, setBeneficiary] = useState<string>("");

  useEffect(() => {
    fetchCalculations();
    loadClosedMonths();
  }, []);

  const loadClosedMonths = async () => {
    try {
      const months = await fetchClosedMonths();
      setClosedMonths(months);
    } catch (e) {
      console.error("[AvariasReport] Error loading closed months:", e);
    }
  };

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

  // Mapeia todas as avarias das cargas carregadas
  const allAvarias = useMemo(() => {
    const rows: AvariaRow[] = [];
    calculations.forEach(calc => {
      const romData = calc.romaneio_data || {};
      const avList = romData.avarias || [];
      avList.forEach((av: any, idx: number) => {
        // Gera um ID estável se não existir no banco
        const avId = av.id || `${calc.id}-${idx}`;
        rows.push({
          calculationId: calc.id,
          driverName: calc.driver_name,
          driverPlate: calc.driver_plate || '',
          billingDate: calc.billing_date,
          createdAt: calc.created_at,
          factory: calc.factory || 'CERBRAS',
          avariaId: avId,
          idx: idx,
          fabrica: av.fabrica || calc.factory || 'CERBRAS',
          valor: Number(av.valor) || 0,
          cliente: av.cliente || '',
          nfe: av.nfe || '',
          observacao: av.observacao || '',
          status: av.status || 'a_pagar',
          data_pagamento: av.data_pagamento || '',
          beneficiario: av.beneficiario || ''
        });
      });
    });
    return rows;
  }, [calculations]);

  // Filtra as avarias em memória
  const filteredAvarias = useMemo(() => {
    return allAvarias.filter(row => {
      // Filtro de Mês e Ano baseados na data de faturamento (billingDate) ou cadastro (createdAt)
      const dateStr = row.billingDate || row.createdAt;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      
      // Corrige timezone offset ao parsear data YYYY-MM-DD
      const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
      
      const matchMonth = (utcDate.getMonth() + 1) === reportMonth;
      const matchYear = utcDate.getFullYear() === reportYear;

      if (!matchMonth || !matchYear) return false;

      // Filtro de Fábrica
      if (reportFactoryFilter !== "ALL") {
        if (row.fabrica !== reportFactoryFilter) return false;
      }

      // Filtro de Status
      if (reportStatusFilter !== "ALL") {
        if (row.status !== reportStatusFilter) return false;
      }

      // Filtro de busca textual (Motorista, Cliente, NF ou Observação)
      if (searchTerm.trim() !== "") {
        const term = searchTerm.toLowerCase();
        const matchDriver = row.driverName.toLowerCase().includes(term);
        const matchClient = row.cliente.toLowerCase().includes(term);
        const matchNfe = row.nfe.toLowerCase().includes(term);
        const matchObs = row.observacao.toLowerCase().includes(term);
        
        if (!matchDriver && !matchClient && !matchNfe && !matchObs) return false;
      }

      return true;
    });
  }, [allAvarias, reportMonth, reportYear, reportFactoryFilter, reportStatusFilter, searchTerm]);

  // Totais das avarias filtradas
  const stats = useMemo(() => {
    let total = 0;
    let pago = 0;
    let aPagar = 0;

    filteredAvarias.forEach(av => {
      total += av.valor;
      if (av.status === 'paga') {
        pago += av.valor;
      } else {
        aPagar += av.valor;
      }
    });

    return { total, pago, aPagar };
  }, [filteredAvarias]);

  // Abre modal para preencher os dados de pagamento
  const handleOpenPayModal = (avaria: AvariaRow) => {
    if (isMonthClosed(avaria.billingDate, closedMonths)) {
      showError("Este mês está fechado. Não é possível alterar o pagamento.");
      return;
    }
    setSelectedAvaria(avaria);
    setPaymentDate(new Date().toISOString().split('T')[0]); // Data de hoje
    setBeneficiary(avaria.driverName); // Beneficiário padrão é o próprio motorista
    setShowPayModal(true);
  };

  // Atualiza no Supabase o status de uma avaria
  const handleUpdateStatus = async (avaria: AvariaRow, newStatus: 'a_pagar' | 'paga', customDate?: string, customBeneficiary?: string) => {
    if (isMonthClosed(avaria.billingDate, closedMonths)) {
      showError("Este mês está fechado. Não é possível alterar o status das avarias.");
      return;
    }
    const calc = calculations.find(c => c.id === avaria.calculationId);
    if (!calc) return;

    const romData = calc.romaneio_data || {};
    const updatedAvarias = (romData.avarias || []).map((av: any, i: number) => {
      const isMatch = av.id === avaria.avariaId || `${avaria.calculationId}-${i}` === avaria.avariaId;
      if (isMatch) {
        return {
          ...av,
          status: newStatus,
          data_pagamento: newStatus === 'paga' ? (customDate || '') : null,
          beneficiario: newStatus === 'paga' ? (customBeneficiary || '') : null
        };
      }
      return av;
    });

    const updatedRomData = {
      ...romData,
      avarias: updatedAvarias
    };

    try {
      const { error } = await supabase
        .from('cerbras_freight_calculations')
        .update({ romaneio_data: updatedRomData })
        .eq('id', avaria.calculationId);

      if (error) throw error;

      // Atualiza estado local
      setCalculations(prev => prev.map(c => {
        if (c.id === avaria.calculationId) {
          return { ...c, romaneio_data: updatedRomData };
        }
        return c;
      }));

      showSuccess("Status da avaria atualizado!");
      setShowPayModal(false);
      setSelectedAvaria(null);
    } catch (error: any) {
      showError("Erro ao salvar alterações: " + error.message);
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const logoUrl = window.location.origin + "/logo.png";
    
    const content = `
      <html>
        <head>
          <title>Relatório de Avarias - Midas Log</title>
          <style>
            body { font-family: sans-serif; padding: 30px; color: #333; }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #b91c1c; padding-bottom: 15px; margin-bottom: 20px; }
            .logo { height: 50px; }
            .title { font-size: 20px; font-weight: bold; }
            .filter-info { font-size: 11px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #f1f5f9; text-align: left; padding: 8px; font-size: 10px; text-transform: uppercase; border: 1px solid #cbd5e1; }
            td { padding: 8px; border: 1px solid #cbd5e1; font-size: 11px; }
            .total-row { font-weight: bold; background: #f8fafc; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase; }
            .badge-paga { background: #dcfce7; color: #15803d; }
            .badge-pagar { background: #fef3c7; color: #b45309; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" class="logo" />
            <div class="title">Relatório de Avarias de Cargas</div>
          </div>
          <div class="filter-info">
            Período: ${new Date(2000, reportMonth - 1).toLocaleString('pt-BR', { month: 'long' }).toUpperCase()} / ${reportYear} | 
            Fábrica: ${reportFactoryFilter} | 
            Status: ${reportStatusFilter === 'ALL' ? 'TODAS' : reportStatusFilter === 'paga' ? 'PAGAS' : 'A PAGAR'}
          </div>
          <table>
            <thead>
              <tr>
                <th>Data Faturam.</th>
                <th>Motorista</th>
                <th>Fábrica</th>
                <th>Cliente</th>
                <th>NF-e</th>
                <th>Valor (R$)</th>
                <th>Status</th>
                <th>Detalhes Pagamento</th>
              </tr>
            </thead>
            <tbody>
              ${filteredAvarias.map(av => `
                <tr>
                  <td>${av.billingDate ? av.billingDate.split('-').reverse().join('/') : 'N/A'}</td>
                  <td style="text-transform: uppercase;">${av.driverName}</td>
                  <td>${av.fabrica}</td>
                  <td style="text-transform: uppercase;">${av.cliente}</td>
                  <td>${av.nfe}</td>
                  <td style="text-align: right;">R$ ${formatCurrency(av.valor)}</td>
                  <td>
                    <span class="badge ${av.status === 'paga' ? 'badge-paga' : 'badge-pagar'}">
                      ${av.status === 'paga' ? 'Paga' : 'A Pagar'}
                    </span>
                  </td>
                  <td>
                    ${av.status === 'paga' 
                      ? `Pago em: ${av.data_pagamento ? av.data_pagamento.split('-').reverse().join('/') : 'N/A'}<br/>Rec: ${av.beneficiario || 'N/A'}` 
                      : '-'
                    }
                  </td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="5" style="text-align: right;">TOTAIS:</td>
                <td style="text-align: right;">R$ ${formatCurrency(stats.total)}</td>
                <td colspan="2">Pagas: R$ ${formatCurrency(stats.pago)} | A Pagar: R$ ${formatCurrency(stats.aPagar)}</td>
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

  const handleExportExcel = () => {
    const dataToExport = filteredAvarias.map(av => ({
      'Data Faturamento': av.billingDate ? av.billingDate.split('-').reverse().join('/') : '',
      'Motorista': av.driverName.toUpperCase(),
      'Placa': av.driverPlate.toUpperCase(),
      'Fábrica': av.fabrica,
      'Cliente': av.cliente.toUpperCase(),
      'NF-e': av.nfe,
      'Valor (R$)': av.valor,
      'Status': av.status === 'paga' ? 'PAGA' : 'A PAGAR',
      'Data de Pagamento': av.data_pagamento ? av.data_pagamento.split('-').reverse().join('/') : '',
      'Beneficiário': av.beneficiario || '',
      'Observação': av.observacao
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Avarias");
    XLSX.writeFile(wb, `Relatorio_Avarias_${reportMonth}_${reportYear}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 lg:px-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="text-red-600" size={20} /> Relatório de Avarias
            </h1>
            <p className="text-slate-500 text-xs">Controle de pagamentos e deduções das avarias de cargas.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={handlePrint} disabled={filteredAvarias.length === 0}>
            <Printer size={16} /> Imprimir
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-9 border-green-200 text-green-700 hover:bg-green-50" onClick={handleExportExcel} disabled={filteredAvarias.length === 0}>
            <Download size={16} /> Excel
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-8 space-y-6">
        {/* Filtros */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-wider">Filtros de Período e Categorias</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Mês</Label>
              <Select value={reportMonth.toString()} onValueChange={(v) => setReportMonth(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
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
              <Select value={reportYear.toString()} onValueChange={(v) => setReportYear(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Fábrica</Label>
              <Select value={reportFactoryFilter} onValueChange={setReportFactoryFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">TODAS</SelectItem>
                  <SelectItem value="CERBRAS">CERBRAS</SelectItem>
                  <SelectItem value="HIDRACOR">HIDRACOR</SelectItem>
                  <SelectItem value="HIDRACOR_EXTERNA">HIDRACOR EXTERNA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Status do Pagamento</Label>
              <Select value={reportStatusFilter} onValueChange={setReportStatusFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">TODOS</SelectItem>
                  <SelectItem value="a_pagar">PENDENTE / A PAGAR</SelectItem>
                  <SelectItem value="paga">PAGO / QUITADO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <Input 
                  placeholder="Motorista, cliente, NF..." 
                  className="pl-9 h-9 text-xs" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-none shadow-sm bg-white overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold uppercase text-slate-500">Valor Acumulado</CardDescription>
              <CardTitle className="text-2xl font-black text-slate-900">R$ {formatCurrency(stats.total)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-slate-400">Total de avarias registradas no período.</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500" />
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold uppercase text-slate-500">Total Pago</CardDescription>
              <CardTitle className="text-2xl font-black text-green-700">R$ {formatCurrency(stats.pago)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-slate-400">Descontado e repassado aos beneficiários.</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold uppercase text-slate-500">Total Pendente (A Pagar)</CardDescription>
              <CardTitle className="text-2xl font-black text-amber-700">R$ {formatCurrency(stats.aPagar)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-slate-400">Avarias pendentes de liquidação/desconto.</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-amber-600 h-8 w-8" />
                <span className="text-xs text-slate-500">Buscando avarias registradas...</span>
              </div>
            ) : filteredAvarias.length === 0 ? (
              <div className="py-20 text-center">
                <AlertTriangle className="mx-auto text-slate-300 mb-4" size={48} />
                <p className="text-slate-500 text-sm">Nenhuma avaria encontrada no filtro selecionado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50 border-b border-slate-100">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Data Faturam.</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Motorista</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Fábrica</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Cliente</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase">NF-e</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Valor</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-center">Status</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Pagamento</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAvarias.map((row) => (
                      <TableRow key={row.avariaId} className="hover:bg-slate-50/50">
                        <TableCell className="text-xs">
                          {row.billingDate ? row.billingDate.split('-').reverse().join('/') : 'N/A'}
                        </TableCell>
                        <TableCell className="font-semibold text-xs uppercase">
                          <div>{row.driverName}</div>
                          <div className="text-[9px] text-slate-400 font-mono">{row.driverPlate}</div>
                        </TableCell>
                        <TableCell className="text-xs uppercase text-slate-500 font-medium">
                          {row.fabrica}
                        </TableCell>
                        <TableCell className="text-xs uppercase max-w-[180px] truncate" title={row.cliente}>
                          {row.cliente}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{row.nfe}</TableCell>
                        <TableCell className="text-xs text-right font-bold text-slate-900">
                          R$ {formatCurrency(row.valor)}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.status === 'paga' ? (
                            <Badge className="bg-green-50 text-green-700 border-green-200 text-[9px] h-5 hover:bg-green-50">QUITADA</Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] h-5 hover:bg-amber-50">PENDENTE</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {row.status === 'paga' ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 text-[10px]">
                                <Calendar size={12} className="text-slate-400" />
                                <span>{row.data_pagamento ? row.data_pagamento.split('-').reverse().join('/') : 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px]">
                                <User size={12} className="text-slate-400" />
                                <span className="truncate max-w-[120px]" title={row.beneficiario}>{row.beneficiario || 'N/A'}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.status === 'paga' ? (
                            <div className="flex justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-2 text-slate-500 hover:text-amber-700 hover:bg-amber-50 text-[10px] gap-1"
                                onClick={() => handleOpenPayModal(row)}
                                title="Editar dados de pagamento"
                                disabled={isMonthClosed(row.billingDate, closedMonths)}
                              >
                                Editar
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleUpdateStatus(row, 'a_pagar')}
                                title="Marcar como A Pagar (Reverter)"
                                disabled={isMonthClosed(row.billingDate, closedMonths)}
                              >
                                <Undo2 size={14} />
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 px-3 border-amber-200 text-amber-700 hover:bg-amber-50 text-[10px] font-bold gap-1 shadow-sm"
                              onClick={() => handleOpenPayModal(row)}
                              disabled={isMonthClosed(row.billingDate, closedMonths)}
                            >
                              <CheckCircle2 size={12} /> Quitar
                            </Button>
                          )}
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

      {/* Modal de Pagamento */}
      <Dialog open={showPayModal} onOpenChange={setShowPayModal}>
        <DialogContent className="sm:max-w-md bg-white border border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="text-amber-600" size={20} />
              {selectedAvaria?.status === 'paga' ? 'Editar Pagamento' : 'Confirmar Pagamento'}
            </DialogTitle>
            <DialogDescription>
              Insira os dados do acerto financeiro desta avaria.
            </DialogDescription>
          </DialogHeader>

          {selectedAvaria && (
            <div className="space-y-4 py-3">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Motorista:</span>
                  <span className="font-bold uppercase text-slate-800">{selectedAvaria.driverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cliente:</span>
                  <span className="font-bold uppercase text-slate-800">{selectedAvaria.cliente}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">NF-e:</span>
                  <span className="font-bold text-slate-800">{selectedAvaria.nfe || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5 text-sm">
                  <span className="font-semibold text-slate-700">Valor Deduzido:</span>
                  <span className="font-black text-red-600">R$ {formatCurrency(selectedAvaria.valor)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="payment-date" className="text-xs font-bold text-slate-700 uppercase">Data do Pagamento</Label>
                <Input 
                  id="payment-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="beneficiary-name" className="text-xs font-bold text-slate-700 uppercase">Beneficiário / Quem Recebeu</Label>
                <Input 
                  id="beneficiary-name"
                  type="text"
                  placeholder="Nome de quem recebeu o acerto"
                  value={beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setShowPayModal(false);
              setSelectedAvaria(null);
            }}>
              Cancelar
            </Button>
            <Button 
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                if (selectedAvaria) {
                  handleUpdateStatus(selectedAvaria, 'paga', paymentDate, beneficiary);
                }
              }}
              disabled={!paymentDate || !beneficiary.trim()}
            >
              Salvar Acerto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AvariasReport;
