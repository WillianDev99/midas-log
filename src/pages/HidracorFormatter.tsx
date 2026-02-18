"use client";

import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  Edit2, 
  ArrowLeft,
  Search,
  Loader2,
  MoreVertical,
  ArrowRightLeft,
  Clock,
  PackageCheck,
  MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
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
  const [searchTerm, setSearchTerm] = useState('');

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
      showError("Erro ao carregar base de dados.");
    } finally {
      setLoading(false);
    }
  };

  // --- Lógica de Gestão da Base ---
  const addRoute = async () => {
    const name = prompt("Nome da nova rota:");
    if (!name) return;
    const { data, error } = await supabase
      .from('hidracor_routes')
      .insert([{ name: name.toUpperCase(), user_id: user?.id }])
      .select();
    if (error) showError(error.message);
    else {
      setRoutes([...routes, data[0]]);
      showSuccess("Rota adicionada!");
    }
  };

  const renameRoute = async (id: string, currentName: string) => {
    const newName = prompt("Novo nome para a rota:", currentName);
    if (!newName || newName === currentName) return;
    const { error } = await supabase
      .from('hidracor_routes')
      .update({ name: newName.toUpperCase() })
      .eq('id', id);
    if (error) showError(error.message);
    else {
      setRoutes(routes.map(r => r.id === id ? { ...r, name: newName.toUpperCase() } : r));
      showSuccess("Rota renomeada!");
    }
  };

  const deleteRoute = async (id: string) => {
    if (!confirm("ATENÇÃO: Isso excluirá a rota e TODAS as cidades vinculadas a ela. Confirmar?")) return;
    const { error } = await supabase.from('hidracor_routes').delete().eq('id', id);
    if (error) showError(error.message);
    else {
      setRoutes(routes.filter(r => r.id !== id));
      setCities(cities.filter(c => c.route_id !== id));
      showSuccess("Rota excluída!");
    }
  };

  const addCity = async (routeId: string) => {
    const input = prompt("Nomes das cidades (separe por vírgula ou cole uma lista):");
    if (!input) return;
    const cityNames = input.split(/[,\n]/).map(name => name.trim().toUpperCase()).filter(name => name.length > 0);
    if (cityNames.length === 0) return;

    const { data, error } = await supabase
      .from('hidracor_cities')
      .insert(cityNames.map(name => ({ route_id: routeId, city_name: name, user_id: user?.id })))
      .select();

    if (error) showError(error.message);
    else {
      setCities([...cities, ...(data || [])]);
      showSuccess(`${data.length} cidades adicionadas!`);
    }
  };

  const deleteCity = async (id: string) => {
    if (!confirm("Excluir esta cidade?")) return;
    const { error } = await supabase.from('hidracor_cities').delete().eq('id', id);
    if (error) showError(error.message);
    else setCities(cities.filter(c => c.id !== id));
  };

  const addClientsToBase = async (table: 'hidracor_awaiting_clients' | 'hidracor_pickup_clients') => {
    const input = prompt("Nomes dos clientes (separe por vírgula ou cole uma lista):");
    if (!input) return;
    const names = input.split(/[,\n]/).map(name => name.trim().toUpperCase()).filter(name => name.length > 0);
    if (names.length === 0) return;

    const { data, error } = await supabase
      .from(table)
      .insert(names.map(name => ({ client_name: name, user_id: user?.id })))
      .select();

    if (error) showError(error.message);
    else {
      if (table === 'hidracor_awaiting_clients') setAwaitingClients([...awaitingClients, ...(data || [])]);
      else setPickupClients([...pickupClients, ...(data || [])]);
      showSuccess(`${data.length} clientes adicionados!`);
    }
  };

  const deleteClientFromBase = async (id: string, table: 'hidracor_awaiting_clients' | 'hidracor_pickup_clients') => {
    if (!confirm("Excluir este cliente da base?")) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) showError(error.message);
    else {
      if (table === 'hidracor_awaiting_clients') setAwaitingClients(awaitingClients.filter(c => c.id !== id));
      else setPickupClients(pickupClients.filter(c => c.id !== id));
    }
  };

  // --- Lógica de Processamento da Carteira ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      processWallet(data);
    };
    reader.readAsBinaryString(file);
  };

  const processWallet = (data: any[]) => {
    setProcessing(true);
    
    const awaitingSet = new Set(awaitingClients.map(c => c.client_name.toUpperCase()));
    const pickupSet = new Set(pickupClients.map(c => c.client_name.toUpperCase()));
    const cityToRouteMap: Record<string, string> = {};
    cities.forEach(c => {
      const route = routes.find(r => r.id === c.route_id);
      if (route) cityToRouteMap[c.city_name.toUpperCase()] = route.name;
    });

    const formatted = data.map(row => {
      const clientInRow = (row['Cliente'] || row['NOME'] || '').toString().toUpperCase().trim();
      const cityInRow = (row['Cidade'] || row['CIDADE'] || '').toString().toUpperCase().trim();

      let finalRoute = 'NÃO ENCONTRADA';

      if (awaitingSet.has(clientInRow)) {
        finalRoute = 'AGUARDANDO CONFIRMAÇÃO';
      } 
      else if (pickupSet.has(clientInRow)) {
        finalRoute = 'RETIRA';
      }
      else if (cityToRouteMap[cityInRow]) {
        finalRoute = cityToRouteMap[cityInRow];
      }

      return {
        ...row,
        'ROTA': finalRoute
      };
    });

    setFormattedData(formatted);
    setProcessing(false);
    showSuccess("Carteira processada com prioridades aplicadas!");
  };

  const handleCellEdit = (index: number, field: string, value: string) => {
    const newData = [...formattedData];
    newData[index][field] = value;
    setFormattedData(newData);
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Carteira Formatada");
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
            <p className="text-slate-500 text-sm">Gestão de base e processamento inteligente.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {formattedData.length > 0 && (
            <Button onClick={downloadExcel} className="bg-green-600 hover:bg-green-700 text-white gap-2">
              <Download size={18} /> Baixar Excel
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Gerenciar Bases</CardTitle>
              <CardDescription>Configure as prioridades de marcação.</CardDescription>
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
                              <div key={city.id} className="group flex items-center gap-1 bg-slate-50 px-2 py-1 rounded text-[10px] border border-slate-200">
                                {city.city_name}
                                <button onClick={() => deleteCity(city.id)} className="text-slate-400 hover:text-red-500">
                                  <Trash2 size={10} />
                                </button>
                              </div>
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
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Preview Editável</CardTitle>
                  <CardDescription>{formattedData.length} linhas processadas.</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 text-slate-400" size={16} />
                  <input 
                    placeholder="Filtrar preview..." 
                    className="pl-8 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-[180px]">Marcação (ROTA)</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Peso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formattedData
                        .filter(row => 
                          Object.values(row).some(val => 
                            val?.toString().toLowerCase().includes(searchTerm.toLowerCase())
                          )
                        )
                        .slice(0, 100)
                        .map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Input 
                              value={row['ROTA']} 
                              onChange={(e) => handleCellEdit(idx, 'ROTA', e.target.value)}
                              className={`h-8 text-[10px] font-bold ${
                                row['ROTA'] === 'AGUARDANDO CONFIRMAÇÃO' ? 'text-blue-600 border-blue-200 bg-blue-50' :
                                row['ROTA'] === 'RETIRA' ? 'text-green-600 border-green-200 bg-green-50' :
                                row['ROTA'] === 'NÃO ENCONTRADA' ? 'text-red-500 border-red-200' : 'text-amber-700'
                              }`}
                            />
                          </TableCell>
                          <TableCell className="text-xs">{row['Cidade'] || row['CIDADE']}</TableCell>
                          <TableCell className="text-xs truncate max-w-[200px]">{row['Cliente'] || row['NOME']}</TableCell>
                          <TableCell className="text-xs">{row['Peso'] || row['PESO']}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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