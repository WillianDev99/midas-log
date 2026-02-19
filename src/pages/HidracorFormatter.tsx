"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  Edit2, 
  ArrowLeft,
  Loader2,
  MoreVertical,
  ArrowRightLeft,
  Clock,
  PackageCheck,
  MapPin,
  Filter,
  Calculator,
  Settings2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal
} from "@/components/ui/dropdown-menu";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import * as XLSX from 'xlsx';
import { Link } from 'react-router-dom';

interface Route {
  id: string;
  name: string;
}

interface City {
  id: string;
  route_id: string;
  city_name: string;
}

interface ClientBase {
  id: string;
  client_name: string;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc' | null;
};

const HidracorFormatter = () => {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [awaitingClients, setAwaitingClients] = useState<ClientBase[]>([]);
  const [pickupClients, setPickupClients] = useState<ClientBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(true);
  
  const [formattedData, setFormattedData] = useState<any[]>([]);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBaseData();
  }, []);

  const fetchBaseData = async () => {
    try {
      const [r, c, a, p] = await Promise.all([
        supabase.from('hidracor_routes').select('*').order('name'),
        supabase.from('hidracor_cities').select('*').order('city_name'),
        supabase.from('hidracor_awaiting_clients').select('*').order('client_name'),
        supabase.from('hidracor_pickup_clients').select('*').order('client_name')
      ]);

      setRoutes(r.data || []);
      setCities(c.data || []);
      setAwaitingClients(a.data || []);
      setPickupClients(p.data || []);
    } catch (error) {
      console.error("Erro ao carregar base:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTopScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  };

  const excelDateToJSDate = (serial: any) => {
    if (!serial || isNaN(serial)) return serial;
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return date.toLocaleDateString('pt-BR');
  };

  const addRoute = async () => {
    const name = prompt("Nome da nova rota:");
    if (!name) return;
    const { data, error } = await supabase.from('hidracor_routes').insert([{ name: name.toUpperCase(), user_id: user?.id }]).select();
    if (error) showError(error.message);
    else { setRoutes([...routes, data[0]]); showSuccess("Rota adicionada!"); }
  };

  const renameRoute = async (id: string, currentName: string) => {
    const newName = prompt("Novo nome para a rota:", currentName);
    if (!newName || newName === currentName) return;
    const { error } = await supabase.from('hidracor_routes').update({ name: newName.toUpperCase() }).eq('id', id);
    if (error) showError(error.message);
    else { setRoutes(routes.map(r => r.id === id ? { ...r, name: newName.toUpperCase() } : r)); showSuccess("Rota renomeada!"); }
  };

  const deleteRoute = async (id: string) => {
    if (!confirm("Excluir rota e cidades?")) return;
    const { error } = await supabase.from('hidracor_routes').delete().eq('id', id);
    if (error) showError(error.message);
    else { setRoutes(routes.filter(r => r.id !== id)); setCities(cities.filter(c => c.route_id !== id)); showSuccess("Rota excluída!"); }
  };

  const addCity = async (routeId: string) => {
    const input = prompt("Nomes das cidades:");
    if (!input) return;
    const names = input.split(/[,\n]/).map(n => n.trim().toUpperCase()).filter(n => n.length > 0);
    const { data, error } = await supabase.from('hidracor_cities').insert(names.map(n => ({ route_id: routeId, city_name: n, user_id: user?.id }))).select();
    if (error) showError(error.message);
    else { setCities([...cities, ...(data || [])]); showSuccess("Cidades adicionadas!"); }
  };

  const renameCity = async (id: string, currentName: string) => {
    const newName = prompt("Novo nome:", currentName);
    if (!newName) return;
    const { error } = await supabase.from('hidracor_cities').update({ city_name: newName.toUpperCase() }).eq('id', id);
    if (error) showError(error.message);
    else setCities(cities.map(c => c.id === id ? { ...c, city_name: newName.toUpperCase() } : c));
  };

  const moveCity = async (cityId: string, newRouteId: string) => {
    const { error } = await supabase.from('hidracor_cities').update({ route_id: newRouteId }).eq('id', cityId);
    if (error) showError(error.message);
    else setCities(cities.map(c => c.id === cityId ? { ...c, route_id: newRouteId } : c));
  };

  const deleteCity = async (id: string) => {
    const { error } = await supabase.from('hidracor_cities').delete().eq('id', id);
    if (error) showError(error.message);
    else setCities(cities.filter(c => c.id !== id));
  };

  const addClientsToBase = async (table: 'hidracor_awaiting_clients' | 'hidracor_pickup_clients') => {
    const input = prompt("Nomes dos clientes:");
    if (!input) return;
    const names = input.split(/[,\n]/).map(n => n.trim().toUpperCase()).filter(n => n.length > 0);
    const { data, error } = await supabase.from(table).insert(names.map(n => ({ client_name: n, user_id: user?.id }))).select();
    if (error) showError(error.message);
    else {
      if (table === 'hidracor_awaiting_clients') setAwaitingClients([...awaitingClients, ...(data || [])]);
      else setPickupClients([...pickupClients, ...(data || [])]);
      showSuccess("Clientes adicionados!");
    }
  };

  const deleteClientFromBase = async (id: string, table: 'hidracor_awaiting_clients' | 'hidracor_pickup_clients') => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) showError(error.message);
    else {
      if (table === 'hidracor_awaiting_clients') setAwaitingClients(awaitingClients.filter(c => c.id !== id));
      else setPickupClients(pickupClients.filter(c => c.id !== id));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      processWallet(rawData);
    };
    reader.readAsBinaryString(file);
  };

  const processWallet = (rows: any[][]) => {
    setProcessing(true);
    if (rows.length < 2) {
      showError("Arquivo inválido.");
      setProcessing(false);
      return;
    }

    const headers = rows[0].map(h => h?.toString().trim());
    const getIdx = (name: string) => headers.indexOf(name);

    const idxData = getIdx('Data Emissão');
    const idxFrete = getIdx('Frete');
    const idxMun = getIdx('Município');
    const idxEst = getIdx('Estado');
    const idxPed = getIdx('Pedido');
    const idxCod = getIdx('Cód.Cliente');
    const idxNom = getIdx('Nome Cliente');
    const idxPP = getIdx('peso possível');
    const idxVP = getIdx('valor possível');
    const idxPT = getIdx('peso total');
    const idxVT = getIdx('valor total');

    if (idxFrete === -1 || idxNom === -1 || idxMun === -1) {
      showError("Colunas obrigatórias não encontradas na planilha.");
      setProcessing(false);
      return;
    }

    const dataRows = rows.slice(1);
    const awaitingSet = new Set(awaitingClients.map(c => c.client_name.toUpperCase()));
    const pickupSet = new Set(pickupClients.map(c => c.client_name.toUpperCase()));
    const cityToRouteMap: Record<string, string> = {};
    cities.forEach(c => {
      const route = routes.find(r => r.id === c.route_id);
      if (route) cityToRouteMap[c.city_name.toUpperCase()] = route.name;
    });

    const formatted = dataRows.map((row) => {
      const freightType = (row[idxFrete] || '').toString().toUpperCase().trim(); 
      const cityName = (row[idxMun] || '').toString().toUpperCase().trim();    
      const clientName = (row[idxNom] || '').toString().toUpperCase().trim();   
      
      let finalRoute = 'NÃO ENCONTRADA';

      if (freightType === 'CIF' || freightType === 'FOB DIRIGIDO') {
        finalRoute = 'LOG. HIDRACOR';
      } else if (freightType === 'FOB RETIRA') {
        if (awaitingSet.has(clientName)) {
          finalRoute = 'AG. CONFIRMAÇÃO';
        } 
        else if (pickupSet.has(clientName)) {
          finalRoute = 'CLIENTE RETIRA';
        } 
        else if (cityToRouteMap[cityName]) {
          finalRoute = cityToRouteMap[cityName];
        }
      }

      return {
        'Data Emissão': excelDateToJSDate(row[idxData]),
        'Frete': row[idxFrete],
        'ROTA': finalRoute,
        'Município': row[idxMun],
        'Estado': row[idxEst],
        'Pedido': row[idxPed],
        'Cód.Cliente': row[idxCod],
        'Nome Cliente': row[idxNom],
        'peso possível': row[idxPP],
        'valor possível': row[idxVP],
        'peso total': row[idxPT],
        'valor total': row[idxVT]
      };
    });

    setFormattedData(formatted);
    setProcessing(false);
    setIsUploadOpen(false); // Fecha o upload após processar
    showSuccess("Carteira formatada!");
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

  const sortedData = useMemo(() => {
    let sortableItems = [...formattedData];
    if (sortConfig.direction !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [formattedData, sortConfig]);

  const filteredData = useMemo(() => {
    return sortedData.filter(row => {
      return Object.entries(columnFilters).every(([col, value]) => {
        if (!value) return true;
        return row[col]?.toString().toLowerCase().includes(value.toLowerCase());
      });
    });
  }, [sortedData, columnFilters]);

  const totals = useMemo(() => {
    const result: Record<string, number> = {};
    const numericCols = ['peso possível', 'valor possível', 'peso total', 'valor total'];
    
    filteredData.forEach(row => {
      numericCols.forEach(col => {
        let val = row[col];
        if (typeof val === 'string') {
          val = parseFloat(val.replace('.', '').replace(',', '.'));
        }
        if (!isNaN(val)) {
          result[col] = (result[col] || 0) + val;
        }
      });
    });
    return result;
  }, [filteredData]);

  const handleFilterChange = (col: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [col]: value }));
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Carteira Hidracor");
    XLSX.writeFile(wb, `CARTEIRA_HIDRACOR_${new Date().toLocaleDateString()}.xlsx`);
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
              <h1 className="text-xl font-bold text-slate-900">Formatar Carteira Hidracor</h1>
              <p className="text-slate-500 text-xs">Saída com 12 colunas e lógica de prioridade ROTA.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {formattedData.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsUploadOpen(!isUploadOpen)}
              className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              <RefreshCw size={14} /> 
              <span className="hidden sm:inline">{isUploadOpen ? "Fechar Upload" : "Novo Upload"}</span>
            </Button>
          )}
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-amber-200 hover:bg-amber-50">
                <Settings2 size={16} /> <span className="hidden sm:inline">Gerenciar Bases</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
              <SheetHeader className="mb-6">
                <SheetTitle>Configuração de Bases</SheetTitle>
                <SheetDescription>
                  Ajuste as rotas e prioridades para o processamento automático.
                </SheetDescription>
              </SheetHeader>
              
              <Tabs defaultValue="routes" className="w-full">
                <TabsList className="w-full grid grid-cols-3 mb-6">
                  <TabsTrigger value="routes">Rotas</TabsTrigger>
                  <TabsTrigger value="awaiting">Aguard.</TabsTrigger>
                  <TabsTrigger value="pickup">Retira</TabsTrigger>
                </TabsList>

                <TabsContent value="routes" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase text-slate-500">Cidades por Rota</h3>
                    <Button size="sm" onClick={addRoute} className="h-8 gap-1 bg-amber-600 hover:bg-amber-700">
                      <Plus size={14} /> Nova Rota
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {routes.map(route => (
                      <div key={route.id} className="border rounded-lg p-3 bg-slate-50">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-bold text-amber-700 text-sm uppercase">{route.name}</span>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => addCity(route.id)} className="h-7 w-7 p-0 text-green-600">
                              <Plus size={14} />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-7 w-7 p-0"><MoreVertical size={14} /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => renameRoute(route.id, route.name)}>
                                  <Edit2 className="mr-2 h-4 w-4" /> Renomear
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => deleteRoute(route.id)} className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {cities.filter(c => c.route_id === route.id).map(city => (
                            <DropdownMenu key={city.id}>
                              <DropdownMenuTrigger asChild>
                                <button className="bg-white px-2 py-1 rounded text-[10px] border border-slate-200 hover:border-amber-500">
                                  {city.city_name}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => renameCity(city.id, city.city_name)}>Renomear</DropdownMenuItem>
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>Mover para...</DropdownMenuSubTrigger>
                                  <DropdownMenuPortal>
                                    <DropdownMenuSubContent>
                                      {routes.filter(r => r.id !== route.id).map(r => (
                                        <DropdownMenuItem key={r.id} onClick={() => moveCity(city.id, r.id)}>{r.name}</DropdownMenuItem>
                                      ))}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuPortal>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => deleteCity(city.id)} className="text-red-600">Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="awaiting" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase text-slate-500">Prioridade 1 (Aguardando)</h3>
                    <Button size="sm" onClick={() => addClientsToBase('hidracor_awaiting_clients')} className="h-8 gap-1 bg-amber-600 hover:bg-amber-700">
                      <Plus size={14} /> Cliente
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {awaitingClients.map(client => (
                      <div key={client.id} className="flex justify-between items-center p-3 bg-slate-50 border rounded-md text-xs">
                        <span className="font-medium">{client.client_name}</span>
                        <Button size="sm" variant="ghost" onClick={() => deleteClientFromBase(client.id, 'hidracor_awaiting_clients')} className="h-6 w-6 p-0 text-red-500">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="pickup" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase text-slate-500">Prioridade 2 (Retira)</h3>
                    <Button size="sm" onClick={() => addClientsToBase('hidracor_pickup_clients')} className="h-8 gap-1 bg-amber-600 hover:bg-amber-700">
                      <Plus size={14} /> Cliente
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {pickupClients.map(client => (
                      <div key={client.id} className="flex justify-between items-center p-3 bg-slate-50 border rounded-md text-xs">
                        <span className="font-medium">{client.client_name}</span>
                        <Button size="sm" variant="ghost" onClick={() => deleteClientFromBase(client.id, 'hidracor_pickup_clients')} className="h-6 w-6 p-0 text-red-500">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </SheetContent>
          </Sheet>

          {formattedData.length > 0 && (
            <Button onClick={downloadExcel} size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-2">
              <Download size={16} /> <span className="hidden sm:inline">Baixar Excel</span>
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 lg:p-6 gap-4 overflow-hidden">
        <Collapsible open={isUploadOpen} onOpenChange={setIsUploadOpen} className="w-full">
          <CollapsibleContent className="space-y-4">
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <div>
                  <CardTitle className="text-lg">Upload da Carteira</CardTitle>
                  <CardDescription>Selecione o arquivo CARTEIRA.xlsx para processamento.</CardDescription>
                </div>
                {formattedData.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setIsUploadOpen(false)}>
                    <ChevronUp size={18} /> Recolher
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pb-6">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-3 text-slate-400" />
                      <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Clique para upload</span></p>
                    </div>
                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                  </label>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {formattedData.length > 0 && (
          <Card className="border-none shadow-sm overflow-hidden flex flex-col flex-1">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-50/50 border-b gap-4 py-3">
              <div className="flex items-center gap-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter size={18} className="text-amber-600" /> Preview com Filtros
                </CardTitle>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">
                  {filteredData.length} registros
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-lg border shadow-sm">
                <Calculator size={16} className="text-slate-400" />
                {Object.entries(totals).map(([col, val]) => (
                  <div key={col} className="text-[10px] border-r last:border-0 pr-2 last:pr-0">
                    <span className="text-slate-500 font-medium uppercase">{col}:</span>
                    <span className="ml-1 font-bold text-amber-700">
                      {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </CardHeader>

            <div 
              ref={topScrollRef}
              onScroll={handleTopScroll}
              className="overflow-x-auto bg-slate-100 border-b h-4 min-h-[16px]"
            >
              <div style={{ width: '2400px', height: '1px' }} />
            </div>

            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
              <div 
                ref={tableScrollRef}
                onScroll={handleTableScroll}
                className="flex-1 overflow-auto"
              >
                <div className="min-w-[2400px]">
                  <Table>
                    <TableHeader className="bg-white sticky top-0 z-30 shadow-sm">
                      <TableRow>
                        {Object.keys(formattedData[0]).map(col => (
                          <TableHead key={col} className="w-[200px] py-4 px-4 bg-white">
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
                      {filteredData.map((row, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50/50">
                          {Object.keys(row).map(col => (
                            <TableCell key={col} className="text-[11px] py-2 px-4 border-r last:border-0">
                              {col === 'ROTA' ? (
                                <div className={`px-2 py-1 rounded font-bold text-center border ${
                                  row[col] === 'LOG. HIDRACOR' ? 'bg-slate-900 text-white border-slate-900' :
                                  row[col] === 'AG. CONFIRMAÇÃO' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  row[col] === 'CLIENTE RETIRA' ? 'bg-green-50 text-green-700 border-green-200' :
                                  row[col] === 'NÃO ENCONTRADA' ? 'bg-red-50 text-red-600 border-red-200' :
                                  'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {row[col]}
                                </div>
                              ) : (
                                <span className="block truncate max-w-[180px]">
                                  {typeof row[col] === 'number' && (col.includes('peso') || col.includes('valor')) 
                                    ? row[col].toLocaleString('pt-BR', { minimumFractionDigits: 2 }) 
                                    : row[col]}
                                </span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default HidracorFormatter;