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
  History,
  Save,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink
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
} from "@/components/ui/dialog";
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
  const [viewMode, setViewMode] = useState<'current' | 'previous'>('current');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });

  const SHEET_URL = "https://docs.google.com/spreadsheets/d/1_84-QjABx4I97rSUPIA1bNkZkZ3hVkdjM4fzc5o_Who/export?format=csv&gid=0";

  useEffect(() => {
    fetchSavedLoads();
  }, []);

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

  const parseRota = (rotaStr: string, uf: string) => {
    const deliveries: any[] = [];
    // Regex para encontrar "CIDADE (CONTEUDO)"
    const cityBlocks = rotaStr.match(/[^,]+?\s*\(.*?\)/g) || [];
    
    cityBlocks.forEach(block => {
      const match = block.match(/(.*?)\s*\((.*?)\)/);
      if (match) {
        const cityName = match[1].trim();
        const content = match[2];
        // Divide entregas por / ou +
        const deliveryParts = content.split(/[\/\+]/);
        
        deliveryParts.forEach(part => {
          const cleanPart = part.trim();
          if (!cleanPart) return;
          
          // Extrai peso e tipo (CIF ou FOB)
          const weightMatch = cleanPart.match(/([\d\.,]+)\s*(CIF|FOB)/i);
          if (weightMatch) {
            const weightStr = weightMatch[1].replace(/\./g, '').replace(',', '.');
            const weight = parseFloat(weightStr);
            const type = weightMatch[2].toUpperCase();
            deliveries.push({
              city: `${cityName}-${uf}`,
              type,
              weight,
              aliquot: 0,
              freight: 0
            });
          }
        });
      }
    });
    return deliveries;
  };

  const updateFromGoogleSheets = async () => {
    setUpdating(true);
    try {
      const response = await fetch(SHEET_URL);
      const csvText = await response.text();
      
      // Parse CSV simples (considerando que a planilha segue o padrão enviado)
      const rows = csvText.split('\n').map(row => {
        // Lógica para lidar com vírgulas dentro de aspas no CSV
        const matches = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        return matches ? matches.map(m => m.replace(/^"|"$/g, '')) : [];
      });

      if (rows.length < 2) throw new Error("Planilha vazia ou inválida.");

      const headers = rows[0];
      const dataRows = rows.slice(1).filter(r => r.length >= 8);

      const newLoads: ExternalLoad[] = dataRows.map((row, idx) => {
        const rota = row[1] || '';
        const uf = row[3] || '';
        return {
          id: `load-${idx}-${Date.now()}`,
          data: row[0] || '',
          rota: rota,
          entregas: row[2] || '',
          uf: uf,
          peso: row[4] || '',
          frete: row[5] || '',
          observacoes: row[6] || '',
          status: row[7] || '',
          parsedDeliveries: parseRota(rota, uf)
        };
      });

      // Versionamento no Supabase
      // 1. Deleta a versão 'previous' antiga
      await supabase.from('hidracor_external_loads').delete().eq('version', 'previous');
      
      // 2. Move a 'current' atual para 'previous'
      if (currentLoads.length > 0) {
        await supabase.from('hidracor_external_loads').update({ version: 'previous' }).eq('version', 'current');
      }

      // 3. Insere a nova como 'current'
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
      showSuccess("Dados atualizados com sucesso!");
    } catch (error: any) {
      showError("Erro ao atualizar: " + error.message);
    } finally {
      setUpdating(false);
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
      return Object.entries(columnFilters).every(([col, value]) => {
        if (!value) return true;
        return row[col as keyof ExternalLoad]?.toString().toLowerCase().includes(value.toLowerCase());
      });
    });
  }, [sortedData, columnFilters]);

  const handleFilterChange = (col: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [col]: value }));
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cargas Externas");
    XLSX.writeFile(wb, `CARGAS_EXTERNAS_${viewMode.toUpperCase()}_${new Date().toLocaleDateString()}.xlsx`);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <header className="max-w-full mx-auto w-full flex justify-between items-center p-4 lg:px-8 bg-white border-b shadow-sm z-50">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft /></Button>
          </Link>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Midas Log" className="h-10 w-auto" />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-slate-900">Cargas Externas Hidracor</h1>
              <p className="text-slate-500 text-xs">Monitoramento de cargas disponíveis no Google Sheets.</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
            <Button 
              variant={viewMode === 'current' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('current')}
              className={viewMode === 'current' ? 'bg-amber-600 hover:bg-amber-700' : ''}
            >
              Atual
            </Button>
            <Button 
              variant={viewMode === 'previous' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('previous')}
              className={viewMode === 'previous' ? 'bg-amber-600 hover:bg-amber-700' : ''}
              disabled={previousLoads.length === 0}
            >
              Anterior
            </Button>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={updateFromGoogleSheets}
            disabled={updating}
            className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
          >
            {updating ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            <span className="hidden sm:inline">Atualizar Planilha</span>
          </Button>

          <Button onClick={downloadExcel} size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-2">
            <Download size={16} /> <span className="hidden sm:inline">Exportar</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 lg:p-6 gap-4 overflow-hidden">
        <Card className="border-none shadow-sm overflow-hidden flex flex-col flex-1">
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-50/50 border-b gap-4 py-3">
            <div className="flex items-center gap-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter size={18} className="text-amber-600" /> 
                {viewMode === 'current' ? 'Cargas Atuais' : 'Versão Anterior'}
              </CardTitle>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">
                {filteredData.length} cargas
              </span>
            </div>
            <a 
              href="https://docs.google.com/spreadsheets/d/1_84-QjABx4I97rSUPIA1bNkZkZ3hVkdjM4fzc5o_Who/edit#gid=0" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-amber-600 flex items-center gap-1"
            >
              <ExternalLink size={12} /> Ver Planilha Original
            </a>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader className="bg-white sticky top-0 z-30 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    {['data', 'rota', 'entregas', 'uf', 'peso', 'frete', 'observacoes', 'status'].map(col => (
                      <TableHead key={col} className="min-w-[150px] py-4 px-4 bg-white">
                        <div className="space-y-2">
                          <div 
                            className="flex items-center justify-between cursor-pointer hover:text-amber-600 transition-colors"
                            onClick={() => handleSort(col)}
                          >
                            <span className="text-[10px] font-bold uppercase text-slate-500">{col}</span>
                            {sortConfig.key === col ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={12} className="text-slate-300" />
                            )}
                          </div>
                          <Input 
                            placeholder={`Filtrar...`}
                            className="h-7 text-[10px] bg-slate-50 border-slate-200"
                            value={columnFilters[col] || ''}
                            onChange={(e) => handleFilterChange(col, e.target.value)}
                          />
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((load) => (
                    <TableRow key={load.id} className="hover:bg-slate-50/50">
                      <TableCell className="p-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-50">
                              <Eye size={16} />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Detalhamento da Carga</DialogTitle>
                              <DialogDescription>
                                Rota: {load.rota}
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="mt-4">
                              <Table>
                                <TableHeader className="bg-slate-900">
                                  <TableRow>
                                    <TableHead className="text-white text-[10px] uppercase">Entregas</TableHead>
                                    <TableHead className="text-white text-[10px] uppercase">Cidade/UF</TableHead>
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
                                      <TableCell className="text-xs">{delivery.city}</TableCell>
                                      <TableCell className="text-xs">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${delivery.type === 'CIF' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                          {delivery.type}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-xs">{delivery.weight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                      <TableCell className="text-xs">0,0000</TableCell>
                                      <TableCell className="text-xs">R$ 0,00</TableCell>
                                    </TableRow>
                                  ))}
                                  <TableRow className="bg-slate-50 font-bold">
                                    <TableCell colSpan={3} className="text-right uppercase text-[10px]">Total:</TableCell>
                                    <TableCell className="text-xs">
                                      {load.parsedDeliveries?.reduce((acc, d) => acc + d.weight, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-xs">0,0000</TableCell>
                                    <TableCell className="text-xs text-amber-700">R$ 0,00</TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>

                              <div className="mt-6 flex flex-col items-end gap-2 border-t pt-4">
                                <div className="flex gap-8 text-xs">
                                  <span className="text-slate-500 font-bold uppercase">Total a Pagar:</span>
                                  <span className="font-bold">R$ 0,00</span>
                                </div>
                                <div className="flex gap-8 text-xs">
                                  <span className="text-slate-500 font-bold uppercase">Margem antes do Imposto:</span>
                                  <span className="font-bold text-green-600">R$ 0,00 (0,00%)</span>
                                </div>
                                <div className="flex gap-8 text-xs">
                                  <span className="text-slate-500 font-bold uppercase">Margem depois do Imposto:</span>
                                  <span className="font-bold text-green-700">R$ 0,00 (0,00%)</span>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                      <TableCell className="text-[11px]">{load.data}</TableCell>
                      <TableCell className="text-[11px] font-medium max-w-[300px] truncate" title={load.rota}>
                        {load.rota}
                      </TableCell>
                      <TableCell className="text-[11px] text-center">{load.entregas}</TableCell>
                      <TableCell className="text-[11px] text-center font-bold">{load.uf}</TableCell>
                      <TableCell className="text-[11px] text-right">{load.peso}</TableCell>
                      <TableCell className="text-[11px] text-center">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">{load.frete}</span>
                      </TableCell>
                      <TableCell className="text-[11px] max-w-[200px] truncate">{load.observacoes}</TableCell>
                      <TableCell className="text-[11px]">
                        <div className={`px-2 py-1 rounded-full text-[10px] font-bold text-center ${
                          load.status.includes('AGENCIANDO') ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {load.status}
                        </div>
                      </TableCell>
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