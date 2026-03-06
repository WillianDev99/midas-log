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
  RefreshCw,
  ArrowUpDown,
  Settings2,
  Calculator,
  Filter,
  ChevronUp,
  Search,
  FileUp,
  X,
  Users,
  MapPin,
  MoreVertical,
  Copy,
  Eraser
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import * as XLSX from 'xlsx';
import { Link } from 'react-router-dom';

interface CerbrasProduct {
  id: string;
  product_name: string;
  unit_m2: number;
  unit_peso: number;
}

interface Route {
  id: string;
  name: string;
}

interface City {
  id: string;
  route_id: string;
  city_name: string;
}

interface PickupClient {
  id: string;
  client_name: string;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc' | null;
};

const CerbrasFormatter = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<CerbrasProduct[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [pickupClients, setPickupClients] = useState<PickupClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [importingRoutes, setImportingRoutes] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(true);
  const [formattedData, setFormattedData] = useState<any[]>([]);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });
  const [searchTerm, setSearchTerm] = useState("");

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const routeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedData = localStorage.getItem('cerbras_last_wallet');
    if (savedData) {
      setFormattedData(JSON.parse(savedData));
      setIsUploadOpen(false);
    }
    fetchBaseData();
  }, []);

  const fetchBaseData = async () => {
    try {
      const [p, r, c, pc] = await Promise.all([
        supabase.from('cerbras_products').select('*').order('product_name'),
        supabase.from('cerbras_routes').select('*').order('name'),
        supabase.from('cerbras_cities').select('*').order('city_name'),
        supabase.from('cerbras_pickup_clients').select('*').order('client_name')
      ]);

      setProducts(p.data || []);
      setRoutes(r.data || []);
      setCities(c.data || []);
      setPickupClients(pc.data || []);
    } catch (error: any) {
      showError(error.message);
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

  // Funções de Gestão de Base
  const addProduct = async () => {
    const name = prompt("Nome do Produto:");
    if (!name) return;
    const m2 = parseFloat(prompt("M² por Palete:")?.replace(',', '.') || "0");
    const peso = parseFloat(prompt("Peso por Palete:")?.replace(',', '.') || "0");

    const { data, error } = await supabase.from('cerbras_products').insert([{ product_name: name.toUpperCase(), unit_m2: m2, unit_peso: peso, user_id: user?.id }]).select();
    if (error) showError(error.message);
    else { setProducts([...products, data[0]]); showSuccess("Produto adicionado!"); }
  };

  const editProduct = async (product: CerbrasProduct) => {
    const name = prompt("Nome do Produto:", product.product_name);
    if (!name) return;
    const m2 = parseFloat(prompt("M² por Palete:", product.unit_m2.toString())?.replace(',', '.') || "0");
    const peso = parseFloat(prompt("Peso por Palete:", product.unit_peso.toString())?.replace(',', '.') || "0");

    const { error } = await supabase.from('cerbras_products').update({ product_name: name.toUpperCase(), unit_m2: m2, unit_peso: peso }).eq('id', product.id);
    if (error) showError(error.message);
    else {
      setProducts(products.map(p => p.id === product.id ? { ...p, product_name: name.toUpperCase(), unit_m2: m2, unit_peso: peso } : p));
      showSuccess("Produto atualizado!");
    }
  };

  const copyProduct = async (product: CerbrasProduct) => {
    const name = prompt("Nome da Cópia do Produto:", `COPIA - ${product.product_name}`);
    if (!name) return;

    const { data, error } = await supabase
      .from('cerbras_products')
      .insert([{ 
        product_name: name.toUpperCase(), 
        unit_m2: product.unit_m2, 
        unit_peso: product.unit_peso, 
        user_id: user?.id 
      }])
      .select();

    if (error) showError(error.message);
    else { 
      setProducts([...products, data[0]]); 
      showSuccess("Cópia criada com sucesso!"); 
    }
  };

  const addRoute = async () => {
    const name = prompt("Nome da Rota:");
    if (!name) return;
    const { data, error } = await supabase.from('cerbras_routes').insert([{ name: name.toUpperCase(), user_id: user?.id }]).select();
    if (error) showError(error.message);
    else { setRoutes([...routes, data[0]]); showSuccess("Rota adicionada!"); }
  };

  const editRoute = async (route: Route) => {
    const name = prompt("Novo nome da Rota:", route.name);
    if (!name || name === route.name) return;
    const { error } = await supabase.from('cerbras_routes').update({ name: name.toUpperCase() }).eq('id', route.id);
    if (error) showError(error.message);
    else { setRoutes(routes.map(r => r.id === route.id ? { ...r, name: name.toUpperCase() } : r)); showSuccess("Rota atualizada!"); }
  };

  const addCity = async (routeId: string) => {
    const input = prompt("Nomes das cidades (separe por vírgula ou linha):");
    if (!input) return;
    const names = input.split(/[,\n]/).map(n => n.trim().toUpperCase()).filter(n => n.length > 0);
    const { data, error } = await supabase.from('cerbras_cities').insert(names.map(n => ({ route_id: routeId, city_name: n, user_id: user?.id }))).select();
    if (error) showError(error.message);
    else { setCities([...cities, ...(data || [])]); showSuccess("Cidades adicionadas!"); }
  };

  const editCity = async (city: City) => {
    const name = prompt("Novo nome da Cidade:", city.city_name);
    if (!name || name === city.city_name) return;
    const { error } = await supabase.from('cerbras_cities').update({ city_name: name.toUpperCase() }).eq('id', city.id);
    if (error) showError(error.message);
    else { setCities(cities.map(c => c.id === city.id ? { ...c, city_name: name.toUpperCase() } : c)); showSuccess("Cidade atualizada!"); }
  };

  const addPickupClients = async () => {
    const input = prompt("Nomes dos clientes (separe por vírgula ou linha):");
    if (!input) return;
    const names = input.split(/[,\n]/).map(n => n.trim().toUpperCase()).filter(n => n.length > 0);
    const { data, error } = await supabase.from('cerbras_pickup_clients').insert(names.map(n => ({ client_name: n, user_id: user?.id }))).select();
    if (error) showError(error.message);
    else { setPickupClients([...pickupClients, ...(data || [])]); showSuccess("Clientes adicionados!"); }
  };

  const editPickupClient = async (client: PickupClient) => {
    const name = prompt("Novo nome do Cliente:", client.client_name);
    if (!name || name === client.client_name) return;
    const { error } = await supabase.from('cerbras_pickup_clients').update({ client_name: name.toUpperCase() }).eq('id', client.id);
    if (error) showError(error.message);
    else { setPickupClients(pickupClients.map(c => c.id === client.id ? { ...c, client_name: name.toUpperCase() } : c)); showSuccess("Cliente atualizado!"); }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Excluir produto?")) return;
    const { error } = await supabase.from('cerbras_products').delete().eq('id', id);
    if (error) showError(error.message);
    else setProducts(products.filter(p => p.id !== id));
  };

  const deleteRoute = async (id: string) => {
    if (!confirm("Excluir rota e suas cidades?")) return;
    const { error } = await supabase.from('cerbras_routes').delete().eq('id', id);
    if (error) showError(error.message);
    else { setRoutes(routes.filter(r => r.id !== id)); setCities(cities.filter(c => c.route_id !== id)); }
  };

  const deleteAllRoutes = async () => {
    if (!confirm("ATENÇÃO: Isso excluirá TODAS as rotas e cidades cadastradas permanentemente. Deseja continuar?")) return;
    const { error } = await supabase.from('cerbras_routes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) showError(error.message);
    else {
      setRoutes([]);
      setCities([]);
      showSuccess("Base de rotas limpa com sucesso!");
    }
  };

  const deleteCity = async (id: string) => {
    const { error } = await supabase.from('cerbras_cities').delete().eq('id', id);
    if (error) showError(error.message);
    else setCities(cities.filter(c => c.id !== id));
  };

  const deletePickupClient = async (id: string) => {
    if (!confirm("Excluir cliente?")) return;
    const { error } = await supabase.from('cerbras_pickup_clients').delete().eq('id', id);
    if (error) showError(error.message);
    else setPickupClients(pickupClients.filter(c => c.id !== id));
  };

  const handleRouteImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingRoutes(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (data.length < 2) throw new Error("Arquivo vazio ou inválido.");

        // Coluna A (0): Cidade, Coluna C (2): Rota
        const startRow = (data[0][0]?.toString().toLowerCase().includes('cidade')) ? 1 : 0;
        const rows = data.slice(startRow).filter(r => r[0] && r[2]);

        const uniqueRouteNames = Array.from(new Set(rows.map(r => r[2].toString().toUpperCase().trim())));
        const currentRoutes = [...routes];
        const routeMap = new Map<string, string>();

        for (const routeName of uniqueRouteNames) {
          let existing = currentRoutes.find(r => r.name === routeName);
          if (!existing) {
            const { data: newRoute, error } = await supabase
              .from('cerbras_routes')
              .insert([{ name: routeName, user_id: user?.id }])
              .select()
              .single();
            if (error) throw error;
            existing = newRoute;
            currentRoutes.push(newRoute);
          }
          routeMap.set(routeName, existing.id);
        }

        const citiesToInsert = rows.map(r => ({
          route_id: routeMap.get(r[2].toString().toUpperCase().trim()),
          city_name: r[0].toString().toUpperCase().trim(),
          user_id: user?.id
        }));

        const { data: newCities, error: cityError } = await supabase
          .from('cerbras_cities')
          .insert(citiesToInsert)
          .select();

        if (cityError) throw cityError;

        setRoutes(currentRoutes);
        setCities(prev => [...prev, ...(newCities || [])]);
        showSuccess(`${newCities?.length} cidades importadas com sucesso!`);
      } catch (error: any) {
        showError("Erro na importação: " + error.message);
      } finally {
        setImportingRoutes(false);
        if (routeInputRef.current) routeInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      processCerbrasWallet(rawData);
    };
    reader.readAsBinaryString(file);
  };

  const processCerbrasWallet = (rows: any[][]) => {
    setProcessing(true);
    if (rows.length < 2) {
      showError("Arquivo inválido.");
      setProcessing(false);
      return;
    }

    const getIdx = (letter: string) => letter.charCodeAt(0) - 65;

    // Mapeamentos para busca rápida
    const pickupSet = new Set(pickupClients.map(c => c.client_name.toUpperCase()));
    const cityToRouteMap: Record<string, string> = {};
    cities.forEach(c => {
      const route = routes.find(r => r.id === c.route_id);
      if (route) cityToRouteMap[c.city_name.toUpperCase()] = route.name;
    });

    const formatted = rows.slice(1)
      .filter(row => {
        const uf = String(row[getIdx('F')] || '').trim().toUpperCase();
        return uf !== "" && uf !== "UF";
      })
      .map((row) => {
        const clientName = String(row[getIdx('A')] || '').toUpperCase().trim();
        const cityName = String(row[getIdx('D')] || '').toUpperCase().trim();
        const productName = String(row[getIdx('I')] || '').toUpperCase().trim();
        const palet = parseFloat(String(row[getIdx('P')] || '0').replace(',', '.'));
        const valUni = parseFloat(String(row[getIdx('K')] || '0').replace(',', '.'));
        
        // Lógica de ROTA
        let finalRoute = 'NÃO ENCONTRADA';
        if (pickupSet.has(clientName)) {
          finalRoute = 'CLIENTE RETIRA';
        } else if (cityToRouteMap[cityName]) {
          finalRoute = cityToRouteMap[cityName];
        }

        const productBase = products.find(p => p.product_name === productName);
        const m2 = productBase ? palet * productBase.unit_m2 : 0;
        const peso = productBase ? palet * productBase.unit_peso : 0;
        const valTot = m2 * valUni;

        return {
          'DATA': excelDateToJSDate(row[getIdx('G')]),
          'ROTA': finalRoute,
          'CLIENTE': row[getIdx('A')],
          'CNPJ': row[getIdx('C')],
          'CIDADE': row[getIdx('D')],
          'UF': row[getIdx('F')],
          'PEDIDO': row[getIdx('H')],
          'COM': row[getIdx('T')],
          'FIN': row[getIdx('V')],
          'EXP': row[getIdx('U')],
          'INI RES': excelDateToJSDate(row[getIdx('R')]),
          'FIM RES': excelDateToJSDate(row[getIdx('S')]),
          'PRODUTO': productName,
          'PALET': palet,
          'M²': m2,
          'PESO': peso,
          'LOTE': row[getIdx('M')],
          'VAL UNI': valUni,
          'VAL TOT': valTot
        };
      });

    setFormattedData(formatted);
    localStorage.setItem('cerbras_last_wallet', JSON.stringify(formatted));
    setProcessing(false);
    setIsUploadOpen(false);
    showSuccess("Carteira Cerbras formatada!");
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    else if (sortConfig.key === key && sortConfig.direction === 'desc') direction = null;
    setSortConfig({ key, direction });
  };

  const filteredData = useMemo(() => {
    let data = [...formattedData];
    if (sortConfig.direction !== null) {
      data.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data.filter(row => 
      Object.entries(columnFilters).every(([col, val]) => 
        !val || row[col]?.toString().toLowerCase().includes(val.toLowerCase())
      )
    );
  }, [formattedData, columnFilters, sortConfig]);

  const totals = useMemo(() => {
    const cols = ['PALET', 'M²', 'PESO', 'VAL UNI', 'VAL TOT'];
    return filteredData.reduce((acc, row) => {
      cols.forEach(col => acc[col] = (acc[col] || 0) + (parseFloat(row[col]) || 0));
      return acc;
    }, {} as Record<string, number>);
  }, [filteredData]);

  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();
    
    const dadosWs = XLSX.utils.json_to_sheet(products.map(p => ({
      'PRODUTO': p.product_name,
      'M2_UNIT': p.unit_m2,
      'PESO_UNIT': p.unit_peso
    })));
    XLSX.utils.book_append_sheet(wb, dadosWs, "DADOS");

    const mainWs = XLSX.utils.json_to_sheet(filteredData);
    const range = filteredData.length + 1;
    
    for(let i = 2; i <= range; i++) {
      const prodCell = `M${i}`;
      const paletCell = `N${i}`;
      const m2Cell = `O${i}`;
      const pesoCell = `P${i}`;
      const valUniCell = `R${i}`;
      const valTotCell = `S${i}`;

      mainWs[m2Cell] = { t: 'n', f: `${paletCell}*IFERROR(VLOOKUP(${prodCell},DADOS!$A:$C,2,FALSE),0)` };
      mainWs[pesoCell] = { t: 'n', f: `${paletCell}*IFERROR(VLOOKUP(${prodCell},DADOS!$A:$C,3,FALSE),0)` };
      mainWs[valTotCell] = { t: 'n', f: `${m2Cell}*${valUniCell}` };
    }

    const subtotalRow = range + 1;
    const colsToSum = ['N', 'O', 'P', 'R', 'S'];
    colsToSum.forEach(col => {
      mainWs[`${col}${subtotalRow}`] = { t: 'n', f: `SUBTOTAL(9,${col}2:${col}${range})` };
    });
    mainWs[`M${subtotalRow}`] = { v: "SUBTOTAL:" };

    const range_ref = XLSX.utils.decode_range(mainWs['!ref']!);
    range_ref.e.r = subtotalRow - 1;
    mainWs['!ref'] = XLSX.utils.encode_range(range_ref);

    XLSX.utils.book_append_sheet(wb, mainWs, "Carteira Cerbras");
    XLSX.writeFile(wb, `CARTEIRA_CERBRAS_${new Date().toLocaleDateString()}.xlsx`);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

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
              <h1 className="text-lg font-bold text-slate-900">Formatar Carteira Cerbras</h1>
              <p className="text-slate-500 text-[10px]">Processamento com busca em base técnica de produtos e rotas.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {formattedData.length > 0 && !isUploadOpen && (
            <Button variant="outline" size="sm" onClick={() => setIsUploadOpen(true)} className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 h-8 text-xs">
              <RefreshCw size={14} /> Novo Upload
            </Button>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-amber-200 hover:bg-amber-50 h-8 text-xs">
                <Settings2 size={14} /> <span className="hidden sm:inline">Base Técnica</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[600px] overflow-y-auto">
              <SheetHeader className="mb-6">
                <SheetTitle>Configuração de Base Técnica</SheetTitle>
                <SheetDescription>Gerencie produtos, rotas e clientes retira.</SheetDescription>
              </SheetHeader>
              
              <Tabs defaultValue="products" className="w-full">
                <TabsList className="grid grid-cols-3 mb-6">
                  <TabsTrigger value="products">Produtos</TabsTrigger>
                  <TabsTrigger value="routes">Rotas</TabsTrigger>
                  <TabsTrigger value="pickup">Retira</TabsTrigger>
                </TabsList>

                <TabsContent value="products" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase text-slate-500">Produtos Cadastrados</h3>
                    <Button size="sm" onClick={addProduct} className="h-8 bg-amber-600 hover:bg-amber-700"><Plus size={14} /> Novo</Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-[10px] uppercase">Produto</TableHead>
                          <TableHead className="text-[10px] uppercase">M²</TableHead>
                          <TableHead className="text-[10px] uppercase">Peso</TableHead>
                          <TableHead className="w-[100px] text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="text-[10px] font-bold uppercase">{p.product_name}</TableCell>
                            <TableCell className="text-[10px]">{p.unit_m2}</TableCell>
                            <TableCell className="text-[10px]">{p.unit_peso}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600" onClick={() => copyProduct(p)} title="Criar Cópia">
                                  <Copy size={12} />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-600" onClick={() => editProduct(p)}>
                                  <Edit2 size={12} />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => deleteProduct(p.id)}>
                                  <Trash2 size={12} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="routes" className="space-y-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold uppercase text-slate-500">Rotas e Cidades</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <Button size="sm" variant="outline" onClick={() => routeInputRef.current?.click()} disabled={importingRoutes} className="h-8 border-amber-200 text-amber-700 text-[10px] px-2">
                        {importingRoutes ? <Loader2 className="animate-spin" size={14} /> : <FileUp size={14} />}
                        <span className="ml-1">Importar Excel</span>
                      </Button>
                      <Button size="sm" variant="destructive" onClick={deleteAllRoutes} className="h-8 gap-1 text-[10px] px-2">
                        <Eraser size={14} /> Limpar Tudo
                      </Button>
                      <Button size="sm" onClick={addRoute} className="h-8 bg-amber-600 hover:bg-amber-700 text-[10px] px-2 col-span-2 sm:col-span-1">
                        <Plus size={14} /> Nova Rota
                      </Button>
                    </div>
                    <input type="file" ref={routeInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleRouteImport} />
                  </div>
                  <div className="space-y-4 mt-4">
                    {routes.map(route => (
                      <div key={route.id} className="border rounded-lg p-3 bg-slate-50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-amber-700 text-xs uppercase">{route.name}</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => editRoute(route)} className="h-6 w-6 p-0 text-amber-600"><Edit2 size={14} /></Button>
                            <Button size="sm" variant="ghost" onClick={() => addCity(route.id)} className="h-6 w-6 p-0 text-green-600"><Plus size={14} /></Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteRoute(route.id)} className="h-6 w-6 p-0 text-red-500"><Trash2 size={14} /></Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {cities.filter(c => c.route_id === route.id).map(city => (
                            <DropdownMenu key={city.id}>
                              <DropdownMenuTrigger asChild>
                                <button className="bg-white px-2 py-0.5 rounded text-[9px] border border-slate-200 uppercase hover:border-amber-500">{city.city_name}</button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => editCity(city)}>Renomear</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => deleteCity(city.id)} className="text-red-600">Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="pickup" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase text-slate-500">Clientes Retira</h3>
                    <Button size="sm" onClick={addPickupClients} className="h-8 bg-amber-600 hover:bg-amber-700"><Plus size={14} /> Adicionar Clientes</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {pickupClients.map(client => (
                      <div key={client.id} className="flex justify-between items-center p-2 bg-slate-50 border rounded text-[10px] uppercase">
                        <span className="truncate">{client.client_name}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-amber-600" onClick={() => editPickupClient(client)}><Edit2 size={12} /></Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500" onClick={() => deletePickupClient(client.id)}><Trash2 size={12} /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </SheetContent>
          </Sheet>

          {formattedData.length > 0 && (
            <Button onClick={downloadExcel} size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-2 h-8 text-xs">
              <Download size={14} /> <span className="hidden sm:inline">Baixar Excel</span>
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 lg:p-6 gap-4 overflow-hidden">
        {isUploadOpen && (
          <Card className="border-none shadow-sm mb-4">
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-lg">Upload da Carteira Cerbras</CardTitle>
                <CardDescription>Selecione o arquivo data.xlsx para processamento.</CardDescription>
              </div>
              {formattedData.length > 0 && (
                <Button variant="ghost" size="icon" onClick={() => setIsUploadOpen(false)}><X size={20} /></Button>
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
        )}

        {formattedData.length > 0 && (
          <Card className="border-none shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-50/50 border-b gap-4 py-3">
              <div className="flex items-center gap-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter size={18} className="text-amber-600" /> Preview Cerbras
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
                    <span className="ml-1 font-bold text-amber-700">{val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </CardHeader>

            <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto bg-slate-100 border-b h-4 min-h-[16px]">
              <div style={{ width: '3200px', height: '1px' }} />
            </div>

            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col min-h-0">
              <div ref={tableScrollRef} onScroll={handleTableScroll} className="flex-1 overflow-auto">
                <div className="min-w-[3200px]">
                  <Table>
                    <TableHeader className="bg-white sticky top-0 z-30 shadow-sm">
                      <TableRow>
                        {Object.keys(formattedData[0]).map(col => (
                          <TableHead key={col} className="w-[180px] py-4 px-4 bg-white">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between cursor-pointer hover:text-amber-600 transition-colors" onClick={() => handleSort(col)}>
                                <span className="text-[10px] font-bold uppercase text-slate-500">{col}</span>
                                <ArrowUpDown size={12} className="text-slate-300" />
                              </div>
                              <Input placeholder={`Filtrar...`} className="h-7 text-[10px] bg-slate-50 border-slate-200" onChange={(e) => setColumnFilters({...columnFilters, [col]: e.target.value})} />
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
                                  row[col] === 'CLIENTE RETIRA' ? 'bg-green-50 text-green-700 border-green-200' :
                                  row[col] === 'NÃO ENCONTRADA' ? 'bg-red-50 text-red-600 border-red-200' :
                                  'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {row[col]}
                                </div>
                              ) : (
                                <span className="block truncate max-w-[160px]">
                                  {typeof row[col] === 'number' ? row[col].toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : row[col]}
                                </span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-100 font-bold">
                        {Object.keys(formattedData[0]).map(col => (
                          <TableCell key={col} className="text-[11px] py-2 px-4 border-r last:border-0">
                            {totals[col] !== undefined ? totals[col].toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                            {col === 'PRODUTO' ? 'SUBTOTAL:' : ''}
                          </TableCell>
                        ))}
                      </TableRow>
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

export default CerbrasFormatter;