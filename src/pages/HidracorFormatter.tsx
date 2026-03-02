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
  Filter,
  Calculator,
  Settings2,
  ChevronUp,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Truck,
  CheckSquare,
  Square,
  ListFilter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  Collapsible, 
  CollapsibleContent 
} from "@/components/ui/collapsible";
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
import { Checkbox } from "@/components/ui/checkbox";
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import * as XLSX from 'xlsx';
import { Link, useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
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
  
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [usedOrderIds, setUsedOrderIds] = useState<Map<string, string>>(new Map());

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedData = localStorage.getItem('hidracor_last_wallet');
    if (savedData) {
      setFormattedData(JSON.parse(savedData));
      setIsUploadOpen(false);
    }
    fetchBaseData();
    fetchUsedOrders();
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

  const fetchUsedOrders = async () => {
    const { data } = await supabase.from('hidracor_saved_loads').select('name, items');
    const orderMap = new Map<string, string>();
    data?.forEach(load => {
      load.items.forEach((item: any) => orderMap.set(item.Pedido?.toString(), load.name));
    });
    setUsedOrderIds(orderMap);
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

  const addCity = async (routeId: string) => {
    const input = prompt("Nomes das cidades (separe por vírgula ou linha):");
    if (!input) return;
    const names = input.split(/[,\n]/).map(n => n.trim().toUpperCase()).filter(n => n.length > 0);
    const { data, error } = await supabase.from('hidracor_cities').insert(names.map(n => ({ route_id: routeId, city_name: n, user_id: user?.id }))).select();
    if (error) showError(error.message);
    else { setCities([...cities, ...(data || [])]); showSuccess("Cidades adicionadas!"); }
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
        if (awaitingSet.has(clientName)) finalRoute = 'AG. CONFIRMAÇÃO';
        else if (pickupSet.has(clientName)) finalRoute = 'CLIENTE RETIRA';
        else if (cityToRouteMap[cityName]) finalRoute = cityToRouteMap[cityName];
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
        'peso possível': parseFloat(row[idxPP]?.toString().replace(',', '.') || '0').toFixed(2),
        'valor possível': parseFloat(row[idxVP]?.toString().replace(',', '.') || '0').toFixed(2),
        'peso total': parseFloat(row[idxPT]?.toString().replace(',', '.') || '0').toFixed(2),
        'valor total': parseFloat(row[idxVT]?.toString().replace(',', '.') || '0').toFixed(2)
      };
    });

    setFormattedData(formatted);
    localStorage.setItem('hidracor_last_wallet', JSON.stringify(formatted));
    setProcessing(false);
    setIsUploadOpen(false);
    showSuccess("Carteira formatada!");
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
    const result: Record<string, number> = {};
    const numericCols = ['peso possível', 'valor possível', 'peso total', 'valor total'];
    filteredData.forEach(row => {
      numericCols.forEach(col => {
        const val = parseFloat(row[col] || '0');
        result[col] = (result[col] || 0) + val;
      });
    });
    return result;
  }, [filteredData]);

  const handleCreateLoad = async () => {
    const loadName = prompt("Nome para esta carga:");
    if (!loadName) return;
    const itemsToSave = formattedData.filter(item => selectedItems.includes(item.Pedido?.toString()));
    const { data, error } = await supabase.from('hidracor_saved_loads').insert([{
      user_id: user?.id,
      name: loadName.toUpperCase(),
      items: itemsToSave,
      shipments: { "1": [], "2": [], "3": [] }
    }]).select();
    if (error) showError(error.message);
    else {
      showSuccess("Carga criada!");
      fetchUsedOrders();
      navigate(`/admin/hidracor-loads/${data[0].id}`);
    }
  };

  const downloadExcel = () => {
    const dataWithLoads = filteredData.map(row => ({
      ...row,
      'CARGAS': usedOrderIds.get(row.Pedido?.toString()) || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataWithLoads);
    const wb = XLSX.utils.book_new();
    
    const range = dataWithLoads.length + 1;
    const colsToSum = ['I', 'J', 'K', 'L']; // peso poss, valor poss, peso tot, valor tot
    colsToSum.forEach(col => {
      ws[`${col}${range + 1}`] = { t: 'n', f: `SUBTOTAL(9,${col}2:${col}${range})` };
    });
    ws[`H${range + 1}`] = { v: "TOTAL:" };

    XLSX.utils.book_append_sheet(wb, ws, "Carteira Hidracor");
    XLSX.writeFile(wb, `CARTEIRA_HIDRACOR_${new Date().toLocaleDateString()}.xlsx`);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <header className="max-w-full mx-auto w-full flex justify-between items-center p-4 lg:px-8 bg-white border-b shadow-sm z-50">
        <div className="flex items-center gap-4">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft /></Button></Link>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Midas Log" className="h-10 w-auto" />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-slate-900">Formatar Carteira Hidracor</h1>
              <p className="text-slate-500 text-xs">Lógica de prioridade ROTA e persistência de dados.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/hidracor-loads"><Button variant="outline" size="sm" className="gap-2"><ListFilter size={16} /> Minhas Cargas</Button></Link>
          {selectedItems.length > 0 && <Button onClick={handleCreateLoad} size="sm" className="bg-amber-600 text-white gap-2 animate-pulse"><Truck size={16} /> Criar Carga ({selectedItems.length})</Button>}
          {formattedData.length > 0 && <Button variant="outline" size="sm" onClick={() => setIsUploadOpen(!isUploadOpen)} className="gap-2 border-amber-200 text-amber-700"><RefreshCw size={14} /> {isUploadOpen ? "Fechar" : "Novo Upload"}</Button>}
          <Button onClick={downloadExcel} size="sm" className="bg-green-600 text-white gap-2"><Download size={16} /> Baixar Excel</Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 lg:p-6 gap-4 overflow-hidden">
        <Collapsible open={isUploadOpen} onOpenChange={setIsUploadOpen} className="w-full">
          <CollapsibleContent className="space-y-4">
            <Card className="border-none shadow-sm">
              <CardHeader className="py-4"><CardTitle className="text-lg">Upload da Carteira</CardTitle></CardHeader>
              <CardContent className="pb-6">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100">
                  <Upload className="w-8 h-8 mb-3 text-slate-400" />
                  <p className="text-sm text-slate-500 font-semibold">Clique para upload</p>
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                </label>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {formattedData.length > 0 && (
          <Card className="border-none shadow-sm overflow-hidden flex flex-col flex-1">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-50/50 border-b gap-4 py-3">
              <div className="flex items-center gap-4">
                <CardTitle className="text-lg flex items-center gap-2"><Filter size={18} className="text-amber-600" /> Preview</CardTitle>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">{filteredData.length} registros</span>
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
              <div style={{ width: '2800px', height: '1px' }} />
            </div>

            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
              <div ref={tableScrollRef} onScroll={handleTableScroll} className="flex-1 overflow-auto">
                <div className="min-w-[2800px]">
                  <Table>
                    <TableHeader className="bg-white sticky top-0 z-30 shadow-sm">
                      <TableRow>
                        <TableHead className="w-[50px] bg-white"></TableHead>
                        {Object.keys(formattedData[0]).map(col => (
                          <TableHead key={col} className="w-[200px] py-4 px-4 bg-white">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort(col)}>
                                <span className="text-[10px] font-bold uppercase text-slate-500">{col}</span>
                                <ArrowUpDown size={12} className="text-slate-300" />
                              </div>
                              <Input placeholder={`Filtrar...`} className="h-7 text-[10px]" onChange={(e) => setColumnFilters({...columnFilters, [col]: e.target.value})} />
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="w-[200px] bg-white text-[10px] font-bold uppercase text-slate-500">Cargas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((row, idx) => {
                        const pedidoId = row.Pedido?.toString();
                        const loadName = usedOrderIds.get(pedidoId);
                        return (
                          <TableRow key={idx} className={`hover:bg-slate-50/50 ${loadName ? 'bg-slate-50' : ''}`}>
                            <TableCell className="p-2 text-center">
                              <Checkbox 
                                checked={selectedItems.includes(pedidoId)}
                                onCheckedChange={() => setSelectedItems(prev => prev.includes(pedidoId) ? prev.filter(id => id !== pedidoId) : [...prev, pedidoId])}
                                disabled={!!loadName}
                              />
                            </TableCell>
                            {Object.keys(row).map(col => (
                              <TableCell key={col} className="text-[11px] py-2 px-4 border-r last:border-0">
                                {col === 'ROTA' ? (
                                  <div className={`px-2 py-1 rounded font-bold text-center border ${row[col] === 'LOG. HIDRACOR' ? 'bg-slate-900 text-white' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{row[col]}</div>
                                ) : (
                                  <span className="block truncate max-w-[180px]">{row[col]}</span>
                                )}
                              </TableCell>
                            ))}
                            <TableCell className="text-[11px] font-bold text-amber-600">{loadName || '-'}</TableCell>
                          </TableRow>
                        );
                      })}
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