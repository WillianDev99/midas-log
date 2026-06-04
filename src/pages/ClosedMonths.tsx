"use client";

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Lock, 
  Unlock, 
  CalendarDays, 
  AlertTriangle, 
  Info,
  CheckCircle,
  Copy,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from '@/components/AuthProvider';
import { Link } from 'react-router-dom';
import { fetchClosedMonths, closeMonth, reopenMonth } from '@/utils/closedMonths';

const ClosedMonths = () => {
  const { user } = useAuth();
  const [closedMonthsList, setClosedMonthsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'connected' | 'local_only' | 'checking'>('checking');
  
  // Selection States
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  const monthsMap = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  useEffect(() => {
    loadMonths();
  }, []);

  const loadMonths = async () => {
    setLoading(true);
    try {
      // Test Supabase connection
      const months = await fetchClosedMonths();
      setClosedMonthsList(months);
      
      // Check if we had DB connection or local fallback
      // We check if table exists in local storage cache only
      const cache = localStorage.getItem('midas_closed_months_cache');
      if (cache && !localStorage.getItem('midas_closed_months')) {
        setDbStatus('connected');
      } else if (localStorage.getItem('midas_closed_months')) {
        setDbStatus('local_only');
      } else {
        setDbStatus('connected');
      }
    } catch (e) {
      setDbStatus('local_only');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseMonth = async () => {
    const formattedMonth = selectedMonth.padStart(2, '0');
    const ym = `${selectedYear}-${formattedMonth}`;

    if (closedMonthsList.includes(ym)) {
      showError("Este mês já está fechado!");
      return;
    }

    setLoading(true);
    const dbSuccess = await closeMonth(ym, user?.id);
    if (dbSuccess) {
      setDbStatus('connected');
      showSuccess(`Mês ${monthsMap[Number(selectedMonth) - 1]} / ${selectedYear} fechado com sucesso!`);
    } else {
      setDbStatus('local_only');
      showSuccess(`Mês fechado localmente (Salvo no navegador). Execute o SQL abaixo no console Supabase para sincronizar.`);
    }
    
    await loadMonths();
  };

  const handleReopenMonth = async (ym: string) => {
    const [year, month] = ym.split('-');
    const monthName = monthsMap[Number(month) - 1];

    if (!confirm(`Tem certeza que deseja reabrir o mês de ${monthName} de ${year}? Os romaneios deste mês voltarão a ser editáveis.`)) {
      return;
    }

    setLoading(true);
    const dbSuccess = await reopenMonth(ym);
    if (dbSuccess) {
      setDbStatus('connected');
      showSuccess(`Mês ${monthName} / ${year} reaberto com sucesso!`);
    } else {
      setDbStatus('local_only');
      showSuccess(`Mês reaberto localmente.`);
    }

    await loadMonths();
  };

  const copySql = () => {
    const sqlText = `CREATE TABLE IF NOT EXISTS public.midas_closed_months (
  id uuid default gen_random_uuid() primary key,
  year_month text not null unique,
  closed boolean default true not null,
  closed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id)
);

ALTER TABLE public.midas_closed_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.midas_closed_months FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.midas_closed_months FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.midas_closed_months FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.midas_closed_months FOR DELETE USING (true);`;

    navigator.clipboard.writeText(sqlText);
    showSuccess("Script SQL copiado!");
  };

  const formatYearMonth = (ym: string) => {
    const [year, month] = ym.split('-');
    return `${monthsMap[Number(month) - 1]} / ${year}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 lg:px-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon" className="h-9 w-9 border border-slate-100 hover:bg-slate-50">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-amber-900 flex items-center gap-2">
              <Lock className="text-amber-600" size={20} /> Fechamento de Mês
            </h1>
            <p className="text-slate-500 text-xs">Bloqueie alterações e edições de romaneios para períodos já encerrados.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dbStatus === 'connected' ? (
            <Badge className="bg-green-50 text-green-700 border-green-200 text-xs px-2.5 py-1">
              BANCO DE DADOS CONECTADO
            </Badge>
          ) : (
            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs px-2.5 py-1 flex gap-1 items-center">
              <AlertTriangle size={12} /> APENAS LOCAL (SALVO NESTE NAVEGADOR)
            </Badge>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
        
        {/* SQL Warning Banner */}
        {dbStatus === 'local_only' && (
          <Card className="border-amber-200 bg-amber-50 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" /> Banco de dados pendente de configuração
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-amber-800 space-y-3 leading-relaxed">
              <p>
                Os meses estão sendo fechados e salvos **apenas no armazenamento local deste navegador**. Para que outros usuários do painel também vejam os meses bloqueados de forma síncrona na nuvem, você deve criar a tabela `midas_closed_months` no seu console do Supabase.
              </p>
              <div className="flex gap-2 items-center">
                <Button variant="outline" size="sm" className="h-8 text-amber-900 border-amber-300 hover:bg-amber-100 flex gap-1.5" onClick={copySql}>
                  <Copy size={12} /> Copiar SQL de Configuração
                </Button>
                <span className="text-[10px] text-amber-600">Copie e execute no editor SQL do seu Supabase Dashboard.</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Form Card */}
          <div className="md:col-span-1">
            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Plus size={16} className="text-amber-600" /> Fechar Novo Mês
                </CardTitle>
                <CardDescription className="text-xs">
                  Selecione o mês e o ano que deseja bloquear para edições.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Mês</label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="h-9 border-slate-200 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthsMap.map((name, i) => (
                        <SelectItem key={i+1} value={(i+1).toString()} className="text-xs">
                          {name.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Ano</label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="h-9 border-slate-200 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027].map(y => (
                        <SelectItem key={y} value={y.toString()} className="text-xs">{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-9 text-xs gap-1.5 shadow-sm mt-2"
                  onClick={handleCloseMonth}
                  disabled={loading}
                >
                  <Lock size={14} /> Fechar Período
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* List Card */}
          <div className="md:col-span-2">
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <CalendarDays size={16} className="text-amber-600" /> Períodos Bloqueados
                </CardTitle>
                <CardDescription className="text-xs">
                  Romaneios pertencentes aos meses abaixo não podem mais ser criados, alterados ou excluídos.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {closedMonthsList.length === 0 ? (
                  <div className="py-16 text-center">
                    <Unlock className="mx-auto text-slate-300 mb-4" size={40} />
                    <p className="text-slate-500 text-xs font-semibold">Nenhum mês fechado no momento.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Todos os romaneios de qualquer período estão liberados para edições.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50 border-b border-slate-100">
                      <TableRow>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase pl-6">Período Fechado</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Identificador</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase">Status</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase text-right pr-6">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closedMonthsList.map((ym) => (
                        <TableRow key={ym} className="hover:bg-slate-50/50">
                          <TableCell className="text-xs font-bold text-slate-800 pl-6">
                            {formatYearMonth(ym)}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-slate-500">
                            {ym}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-red-50 text-red-700 border-red-200 text-[9px] font-bold py-0.5 h-5">BLOQUEADO</Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 px-2 text-green-700 hover:text-green-900 hover:bg-green-50 text-[10px] gap-1"
                              onClick={() => handleReopenMonth(ym)}
                              disabled={loading}
                            >
                              <Unlock size={12} /> Reabrir Mês
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

        </div>

      </main>
    </div>
  );
};

export default ClosedMonths;
