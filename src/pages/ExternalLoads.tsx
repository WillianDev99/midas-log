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
  ExternalLink,
  Printer,
  Share2,
  Search
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
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  const [selectedUFs, setSelectedUFs] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });
  const [freightTables, setFreightTables] = useState<{ cif: any[], fob: any[] }>({ cif: [], fob: [] });

  const SHEET_URL = "https://docs.google.com/spreadsheets/d/1_84-QjABx4I97rSUPIA1bNkZkZ3hVkdjM4fzc5o_Who/export?format=csv&gid=0";

  useEffect(() => {
    const init = async () => {
      await loadFreightTables();
      await fetchSavedLoads();
    };
    init();
  }, []);

  const normalizeText = (text: string) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  };

  const loadFreightTables = async () => {
    try {
      const response = await fetch('/TABELA_MIDAS_2025.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      
      // Tabela CIF (Geralmente a primeira ou nomeada)
      const cifSheet = workbook.Sheets[workbook.SheetNames[0]];
      const cifData = XLSX.utils.sheet_to_json(cifSheet, { header: 'A' });
      
      // Tabela FOB (Geralmente a segunda ou nomeada)
      const fobSheet = workbook.Sheets[workbook.SheetNames[1]];
      const fobData = XLSX.utils.sheet_to_json(fobSheet, { header: 'A' });

      setFreightTables({
        cif: cifData.slice(1), // Pula cabeçalho
        fob: fobData.slice(1)
      });
    } catch (error) {
      console.error("Erro ao carregar tabelas de frete:", error);
    }
  };

  const getAliquot = (city: string, uf: string, type: string, weight: number) => {
    const normCity = normalizeText(city);
    const normUF = uf.toUpperCase();

    if (type === 'CIF') {
      const entry = freightTables.cif.find(row => 
        normalizeText(String(row['B'] || '')) === normCity && 
        String(row['E'] || '').toUpperCase() === normUF
      );
      if (!entry) return 0;
      
      // Colunas I (<=7t), J (7-17t), K (>17t) - Valores por tonelada
      let val = 0;
      if (weight <= 7000) val = parseFloat(String(entry['I'] || 0));
      else if (weight <= 17000) val = parseFloat(String(entry['J'] || 0));
      else val = parseFloat(String(entry['K'] || 0));
      
      return val / 1000; // Divide por 1000 para valor por kg
    } else {
      const entry = freightTables.fob.find(row => {
        const rowCity = normalizeText(String(row['A'] || ''));
        const rowRoute = String(row['B'] || '').toUpperCase();
        return rowCity === normCity && rowRoute.includes(normUF);
      });
      if (!entry) return 0;

      // Colunas C (<=3t), F (3-14t), I (>14t) - Valores por kg
      if (weight <= 3000) return parseFloat(String(entry['C'] || 0));
      if (weight <= 14000) return parseFloat(String(entry['F'] || 0));
      return parseFloat(String(entry['I'] || 0));
    }
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

  const parseRota = (rotaStr: string, uf: string) => {
    const deliveries: any[] = [];
    // Regex melhorada para capturar blocos de cidades e seus parênteses
    // Ex: BANZAÊ (6.453 FOB), PAULO AFONSO (4.900 FOB / 777 CIF)
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
          // Suporta formatos como "6.453 FOB", "59KG CIF", "1KG FOB"
          const weightMatch = cleanPart.match(/([\d\.,]+)\s*(?:KG\s*)?(CIF|FOB)/i);
          if (weightMatch) {
            const weightStr = weightMatch[1].replace(/\./g, '').replace(',', '.');
            const weight = parseFloat(weightStr);
            const type = weightMatch[2].toUpperCase();
            const aliquot = getAliquot(cityName, uf, type, weight);
            
            deliveries.push({
              city: cityName,
              uf: uf,
              type,
              weight,
              aliquot: aliquot,
              freight: weight * aliquot
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
      
      const rows = csvText.split('\n').map(row => {
        const matches = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        return matches ? matches.map(m => m.replace(/^"|"$/g, '')) : [];
      });

      if (rows.length < 2) throw new Error("Planilha vazia ou inválida.");

      const dataRows = rows.slice(1).filter(r => r.length >= 8);

      const newLoads: ExternalLoad[] = dataRows.map((row, idx) => {
        const rota = row[1] || '';
        const uf = row[3] || '';
        const parsed = parseRota(rota, uf);
        const totalFreight = parsed.reduce((acc, d) => acc + d.freight, 0);
        
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
          parsedDeliveries: parsed,
          totalToPay: totalFreight * 0.7 // Padrão: 30% de margem
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
    const updateFn = (loads: ExternalLoad[]) => loads.map(l => l.id === loadId ? { ...l, ...updates } : l);
    if (viewMode === 'current') setCurrentLoads(updateFn);
    else setPreviousLoads(updateFn);
  };

  const handleUpdateDelivery = (loadId: string, deliveryIdx: number, updates: any) => {
    const updateFn = (loads: ExternalLoad[]) => loads.map(l => {
      if (l.id === loadId && l.parsedDeliveries) {
        const newDeliveries = [...l.parsedDeliveries];
        newDeliveries[deliveryIdx] = { ...newDeliveries[deliveryIdx], ...updates };
        // Recalcula frete da entrega se peso ou alíquota mudar
        if (updates.weight !== undefined || updates.aliquot !== undefined) {
          newDeliveries[deliveryIdx].freight = newDeliveries[deliveryIdx].weight * newDeliveries[deliveryIdx].aliquot;
        }
        return { ...l, parsedDeliveries: newDeliveries };
      }
      return l;
    });
    if (viewMode === 'current') setCurrentLoads(updateFn);
    else setPreviousLoads(updateFn);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <html>
        <head>
          <title>Cargas Disponíveis - Midas Log</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; margin-bottom: 20px; }
            .logo { height: 50px; }
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
            <img src="/logo.png" class="logo" />
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
          <script>window.print();</script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
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

          <Button onClick={handlePrint} size="sm" className="bg-slate-900 hover:bg-slate-800 text-white gap-2">
            <Printer size={16} /> <span className="hidden sm:inline">Imprimir para Motorista</span>
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
                    <TableHead className="min-w-[120px] py-4 px-4 bg-white">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('data')}>
                          <span className="text-[10px] font-bold uppercase text-slate-500">Data</span>
                          <ArrowUpDown size={12} className="text-slate-300" />
                        </div>
                        <Input 
                          placeholder="Filtrar..." 
                          className="h-7 text-[10px]" 
                          onChange={(e) => handleFilterChange('data', e.target.value)}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[300px] py-4 px-4 bg-white">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('rota')}>
                          <span className="text-[10px] font-bold uppercase text-slate-500">Rota</span>
                          <ArrowUpDown size={12} className="text-slate-300" />
                        </div>
                        <Input 
                          placeholder="Filtrar..." 
                          className="h-7 text-[10px]" 
                          onChange={(e) => handleFilterChange('rota', e.target.value)}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[80px] py-4 px-4 bg-white">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('entregas')}>
                          <span className="text-[10px] font-bold uppercase text-slate-500">Entr.</span>
                          <ArrowUpDown size={12} className="text-slate-300" />
                        </div>
                        <Input 
                          placeholder="Filt." 
                          className="h-7 text-[10px]" 
                          onChange={(e) => handleFilterChange('entregas', e.target.value)}
                        />
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
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="w-full text-[10px] h-6 mt-2"
                                    onClick={() => setSelectedUFs([])}
                                  >
                                    Limpar
                                  </Button>
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
                        <Input 
                          placeholder="Filtrar..." 
                          className="h-7 text-[10px]" 
                          onChange={(e) => handleFilterChange('peso', e.target.value)}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[100px] py-4 px-4 bg-white">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort('frete')}>
                          <span className="text-[10px] font-bold uppercase text-slate-500">Frete</span>
                          <ArrowUpDown size={12} className="text-slate-300" />
                        </div>
                        <Input 
                          placeholder="Filtrar..." 
                          className="h-7 text-[10px]" 
                          onChange={(e) => handleFilterChange('frete', e.target.value)}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[150px] py-4 px-4 bg-white">
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase text-slate-500">Status</span>
                        <Input 
                          placeholder="Filtrar..." 
                          className="h-7 text-[10px]" 
                          onChange={(e) => handleFilterChange('status', e.target.value)}
                        />
                      </div>
                    </TableHead>
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
                          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-3">
                                <img src="/logo.png" className="h-8 w-auto" />
                                Detalhamento da Carga
                              </DialogTitle>
                              <DialogDescription className="font-bold text-slate-900">
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
                                      <TableCell className="text-xs">{delivery.city}-{delivery.uf}</TableCell>
                                      <TableCell className="text-xs">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${delivery.type === 'CIF' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                          {delivery.type}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        <Input 
                                          type="number" 
                                          className="h-7 w-24 text-xs" 
                                          value={delivery.weight}
                                          onChange={(e) => handleUpdateDelivery(load.id, dIdx, { weight: parseFloat(e.target.value) || 0 })}
                                        />
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        <div className="flex items-center gap-2">
                                          <Input 
                                            type="number" 
                                            step="0.0001"
                                            className={`h-7 w-24 text-xs ${delivery.aliquot === 0 ? 'border-red-500 bg-red-50' : ''}`}
                                            value={delivery.aliquot}
                                            onChange={(e) => handleUpdateDelivery(load.id, dIdx, { aliquot: parseFloat(e.target.value) || 0 })}
                                          />
                                          {delivery.aliquot === 0 && (
                                            <Popover>
                                              <PopoverTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500"><Search size={12} /></Button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-64 p-2">
                                                <p className="text-[10px] text-slate-500 mb-2">Cidade não encontrada na tabela. Selecione uma alíquota manualmente ou busque uma cidade próxima.</p>
                                                <div className="max-h-40 overflow-y-auto space-y-1">
                                                  {(delivery.type === 'CIF' ? freightTables.cif : freightTables.fob).slice(0, 20).map((row: any, idx: number) => (
                                                    <Button 
                                                      key={idx} 
                                                      variant="ghost" 
                                                      className="w-full justify-start text-[10px] h-7 px-2"
                                                      onClick={() => {
                                                        const weight = delivery.weight;
                                                        let val = 0;
                                                        if (delivery.type === 'CIF') {
                                                          if (weight <= 7000) val = parseFloat(String(row['I'] || 0));
                                                          else if (weight <= 17000) val = parseFloat(String(row['J'] || 0));
                                                          else val = parseFloat(String(row['K'] || 0));
                                                          val = val / 1000;
                                                        } else {
                                                          if (weight <= 3000) val = parseFloat(String(row['C'] || 0));
                                                          else if (weight <= 14000) val = parseFloat(String(row['F'] || 0));
                                                          else val = parseFloat(String(row['I'] || 0));
                                                        }
                                                        handleUpdateDelivery(load.id, dIdx, { aliquot: val });
                                                      }}
                                                    >
                                                      {delivery.type === 'CIF' ? `${row['B']} (${row['E']})` : `${row['A']} (${row['B']})`}
                                                    </Button>
                                                  ))}
                                                </div>
                                              </PopoverContent>
                                            </Popover>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-xs font-bold">
                                        {delivery.freight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  <TableRow className="bg-slate-50 font-bold">
                                    <TableCell colSpan={3} className="text-right uppercase text-[10px]">Total:</TableCell>
                                    <TableCell className="text-xs">
                                      {load.parsedDeliveries?.reduce((acc, d) => acc + d.weight, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-xs">-</TableCell>
                                    <TableCell className="text-xs text-amber-700">
                                      {load.parsedDeliveries?.reduce((acc, d) => acc + d.freight, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>

                              {(() => {
                                const totalReceived = load.parsedDeliveries?.reduce((acc, d) => acc + d.freight, 0) || 0;
                                const totalToPay = load.totalToPay || 0;
                                const tax = totalReceived * 0.0998;
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
                                        <Input 
                                          type="number" 
                                          className="h-7 w-32 text-xs font-bold" 
                                          value={totalToPay}
                                          onChange={(e) => handleUpdateLoad(load.id, { totalToPay: parseFloat(e.target.value) || 0 })}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex gap-8 text-xs">
                                      <span className="text-slate-500 font-bold uppercase">Margem antes do Imposto:</span>
                                      <span className={`font-bold ${marginBefore >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {marginBefore.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({marginBeforePct.toFixed(2)}%)
                                      </span>
                                    </div>
                                    <div className="flex gap-8 text-xs">
                                      <span className="text-slate-500 font-bold uppercase">Margem depois do Imposto:</span>
                                      <span className={`font-bold ${marginAfter >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                        {marginAfter.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({marginAfterPct.toFixed(2)}%)
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                      <TableCell className="text-[11px]">{load.data}</TableCell>
                      <TableCell className="text-[11px] font-medium max-w-[300px]">
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="truncate cursor-pointer hover:text-amber-600 transition-colors" title={load.rota}>
                              {load.rota}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-4 text-xs leading-relaxed bg-white shadow-xl border-amber-100">
                            <div className="font-bold text-amber-700 mb-2 uppercase border-b pb-1">Rota Completa</div>
                            {load.rota}
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="text-[11px] text-center">{load.entregas}</TableCell>
                      <TableCell className="text-[11px] text-center font-bold">{load.uf}</TableCell>
                      <TableCell className="text-[11px] text-right">{load.peso}</TableCell>
                      <TableCell className="text-[11px] text-center">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">{load.frete}</span>
                      </TableCell>
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