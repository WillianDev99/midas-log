"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
  Calculator
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal
} from "@/components/ui/dropdown-menu";
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

const HidracorFormatter = () => {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [awaitingClients, setAwaitingClients] = useState<ClientBase[]>([]);
  const [pickupClients, setPickupClients] = useState<ClientBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [formattedData, setFormattedData] = useState<any[]>([]);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

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

  // --- Funções Auxiliares ---
  const excelDateToJSDate = (serial: any) => {
    if (!serial || isNaN(serial)) return serial;
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return date.toLocaleDateString('pt-BR');
  };

  // --- Gestão de Bases ---
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

  // --- Processamento ---
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

    // Mapeamento baseado na planilha CARTEIRA padrão
    // Col C (2): Data Emissão
    // Col D (3): Frete
    // Col E (4): Município
    // Col F (5): Estado
    // Col G (6): Pedido
    // Col H (7): Cód.Cliente
    // Col I (8): Nome Cliente
    // Col J (9): peso possível
    // Col K (10): valor possível
    // Col L (11): peso total
    // Col M (12): valor total

    const dataRows = rows.slice(1);
    const awaitingSet = new Set(awaitingClients.map(c => c.client_name.toUpperCase()));
    const pickupSet = new Set(pickupClients.map(c => c.client_name.toUpperCase()));
    const cityToRouteMap: Record<string, string> = {};
    cities.forEach(c => {
      const route = routes.find(r => r.id === c.route_id);
      if (route) cityToRouteMap[c.city_name.toUpperCase()] = route.name;
    });

    const formatted = dataRows.map((row) => {
      const freightType = (row[3] || '').toString().toUpperCase().trim(); 
      const cityName = (row[4] || '').toString().toUpperCase().trim();    
      const clientName = (row[8] || '').toString().toUpperCase().trim();   
      
      let finalRoute = 'NÃO ENCONTRADA';

      // Lógica de Prioridade
      if (freightType === 'CIF' || freightType === 'FOB DIRIGIDO') {
        finalRoute = 'LOG. HIDRACOR';
      } else if (freightType === 'FOB RETIRA') {
        if (awaitingSet.has(clientName)) {
          finalRoute = 'AG. CONFIRMAÇÃO';
        } else if (pickupSet.has(clientName)) {
          finalRoute = 'CLIENTE RETIRA';
        } else if (cityToRouteMap[cityName]) {
          finalRoute = cityToRouteMap[cityName];
        }
      }

      return {
        'Data Emissão': excelDateToJSDate(row[2]),
        'Frete': row[3],
        'ROTA': finalRoute,
        'Município': row[4],
        'Estado': row[5],
        'Pedido': row[6],
        'Cód.Cliente': row[7],
        'Nome Cliente': row[8],
        'peso possível': row[9],
        'valor possível': row[10],
        'peso total': row[11],
        'valor total': row[12]
      };
    });

    setFormattedData(formatted);
    setProcessing(false);
    showSuccess("Carteira formatada!");
  };

  // --- Filtros e Somatórios ---
  const filteredData = useMemo(() => {
    return formattedData.filter(row => {
      return Object.entries(columnFilters).every(([col, value]) => {
        if (!value) return true;
        return row[col]?.toString().toLowerCase().includes(value.toLowerCase());
      });
    });
  }, [formattedData, columnFilters]);

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
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <header className="max-w-7xl mx-auto flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Formatar Carteira Hidracor</h1>
            <p className="text-slate-500 text-sm">Saída com 12 colunas e lógica de prioridade ROTA.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {formattedData.length > 0 && (
            <Button onClick={downloadExcel} className="bg-green-600 hover:bg-green-700 text-white gap-2">
              <Download size={18} /> Baixar Excel ({filteredData.length})
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-8">
        {/* Gestão de Bases */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Gerenciar Bases</CardTitle>
              <CardDescription>Configure as prioridades para FOB RETIRA.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="routes" className="w-full">
                <TabsList className="w-full grid grid-cols-3 rounded-none border-b bg-transparent h-12">
                  <TabsTrigger value="routes" className="data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none">
                    <MapPin size={16} className="mr-2" /> Rotas
                  </TabsTrigger>
                  <TabsTrigger value="awaiting" className="data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none">
                    <Clock size={16} className="mr-2" /> Aguard.
                  </TabsTrigger>
                  <TabsTrigger value="pickup" className="data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none">
                    <PackageCheck size={16} className="mr-2" /> Retira
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="routes" className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-slate-500 uppercase">Base de Cidades</span>
                    <Button size="sm" variant="outline" onClick={addRoute} className="h-8 gap-1">
                      <Plus size={14} /> Rota
                    </Button>
                  </div>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-4">
                      {routes.map(route => (
                        <div key={route.id} className="border rounded-lg p-3 bg-white shadow-sm">
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
                                    <Edit2 className="mr-2 h-4 w-4" /> Renomear Rota
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => deleteRoute(route.id)} className="text-red-600">
                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir Rota
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {cities.filter(c => c.route_id === route.id).map(city => (
                              <DropdownMenu key={city.id}>
                                <DropdownMenuTrigger asChild>
                                  <button className="group flex items-center gap-1 bg-slate-50 px-2 py-1 rounded text-[10px] border border-slate-200 hover:border-amber-500 transition-colors">
                                    {city.city_name}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onClick={() => renameCity(city.id, city.city_name)}>
                                    <Edit2 className="mr-2 h-3 w-3" /> Renomear
                                  </DropdownMenuItem>
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                      <ArrowRightLeft className="mr-2 h-3 w-3" /> Mover para...
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                      <DropdownMenuSubContent>
                                        {routes.filter(r => r.id !== route.id).map(r => (
                                          <DropdownMenuItem key={r.id} onClick={() => moveCity(city.id, r.id)}>
                                            {r.name}
                                          </DropdownMenuItem>
                                        ))}
                                      </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                  </DropdownMenuSub>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => deleteCity(city.id)} className="text-red-600">
                                    <Trash2 className="mr-2 h-3 w-3" /> Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="awaiting" className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-slate-500 uppercase">Prioridade 1</span>
                    <Button size="sm" variant="outline" onClick={() => addClientsToBase('hidracor_awaiting_clients')} className="h-8 gap-1">
                      <Plus size={14} /> Cliente
                    </Button>
                  </div>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-2">
                      {awaitingClients.map(client => (
                        <div key={client.id} className="flex justify-between items-center p-2 bg-white border rounded-md text-xs">
                          <span className="font-medium">{client.client_name}</span>
                          <Button size="sm" variant="ghost" onClick={() => deleteClientFromBase(client.id, 'hidracor_awaiting_clients')} className="h-6 w-6 p-0 text-red-500">
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="pickup" className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-slate-500 uppercase">Prioridade 2</span>
                    <Button size="sm" variant="outline" onClick={() => addClientsToBase('hidracor_pickup_clients')} className="h-8 gap-1">
                      <Plus size={14} /> Cliente
                    </Button>
                  </div>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-2">
                      {pickupClients.map(client => (
                        <div key={client.id} className="flex justify-between items-center p-2 bg-white border rounded-md text-xs">
                          <span className="font-medium">{client.client_name}</span>
                          <Button size="sm" variant="ghost" onClick={() => deleteClientFromBase(client.id, 'hidracor_pickup_clients')} className="h-6 w-6 p-0 text-red-500">
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Preview e Processamento */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Upload da Carteira</CardTitle>
              <CardDescription>Selecione o arquivo CARTEIRA.xlsx.</CardDescription>
            </CardHeader>
            <CardContent>
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

          {formattedData.length > 0 && (
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-50/50 border-b gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter size={18} className="text-amber-600" /> Preview com Filtros
                  </CardTitle>
                  <CardDescription>Mostrando {filteredData.length} registros.</CardDescription>
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
              <CardContent className="p-0">
                <ScrollArea className="w-full whitespace-nowrap">
                  <div className="min-w-max">
                    <Table>
                      <TableHeader className="bg-white sticky top-0 z-20 shadow-sm">
                        <TableRow>
                          {Object.keys(formattedData[0]).map(col => (
                            <TableHead key={col} className="min-w-[180px] py-4 px-4">
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase text-slate-500">{col}</span>
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
                        {filteredData.slice(0, 500).map((row, idx) => (
                          <TableRow key={idx} className="hover:bg-slate-50/50">
                            {Object.keys(row).map(col => (
                              <TableCell key={col} className="text-[11px] py-2 px-4">
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
                                  <span className="block">
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
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default HidracorFormatter;