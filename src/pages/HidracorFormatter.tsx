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
  Filter,
  Calculator,
  Settings2,
  RefreshCw,
  ArrowUpDown,
  Truck,
  ListFilter,
  MoveHorizontal,
  FileUp,
  Eraser,
  Printer,
  XCircle
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
  const [importingRoutes, setImportingRoutes] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(true);
  
  const [formattedData, setFormattedData] = useState<any[]>([]);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [minWeightFilter, setMinWeightFilter] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });
  
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [usedOrderIds, setUsedOrderIds] = useState<Map<string, string>>(new Map());

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const routeInputRef = useRef<HTMLInputElement>(null);

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

  const formatWeight = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg';
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const excelDateToJSDate = (serial: any) => {
    if (!serial || isNaN(serial)) return serial;
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return date.toLocaleDateString('pt-BR');
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setMinWeightFilter("");
    showSuccess("Filtros limpos!");
  };

  const handlePrintSelection = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const logoUrl = window.location.origin + "/logo.png";
    const totalPeso = filteredData.reduce((acc, row) => acc + parseFloat(row['peso possível'] || '0'), 0);
    const totalValor = filteredData.reduce((acc, row) => acc + parseFloat(row['valor possível'] || '0'), 0);

    const content = `
      <html>
        <head>
          <title>Relatório de Seleção - Midas Log</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; margin-bottom: 20px; }
            .logo { height: 50px; }
            .title { font-size: 20px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f8fafc; text-align: left; padding: 8px; border: 1px solid #e2e8f0; font-size: 10px; text-transform: uppercase; }
            td { padding: 8px; border: 1px solid #e2e8f0; font-size: 10px; }
            .total-row { background: #f1f5f9; font-weight: bold; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" class="logo" />
            <div class="title">Relatório de Carteira Filtrada</div>
            <div style="text-align: right; font-size: 10px;">${new Date().toLocaleDateString()}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Rota</th>
                <th>Município</th>
                <th>Estado</th>
                <th>Pedido</th>
                <th>Cód. Cliente</th>
                <th>Nome Cliente</th>
                <th style="text-align: right;">Peso Possível</th>
                <th style="text-align: right;">Valor Possível</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map(row => `
                <tr>
                  <td>${row['ROTA']}</td>
                  <td>${row['Município']}</td>
                  <td>${row['Estado']}</td>
                  <td>${row['Pedido']}</td>
                  <td>${row['Cód.Cliente']}</td>
                  <td style="text-transform: uppercase;">${row['Nome Cliente']}</td>
                  <td style="text-align: right;">${formatWeight(parseFloat(row['peso possível']))}</td>
                  <td style="text-align: right;">${formatCurrency(parseFloat(row['valor possível']))}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="6" style="text-align: right;">SOMA TOTAL:</td>
                <td style="text-align: right;">${formatWeight(totalPeso)}</td>
                <td style="text-align: right;">${formatCurrency(totalValor)}</td>
              </tr>
            </tbody>
          </table>
          <div class="footer">Midas Logística - Eficiência em Movimento</div>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  const addRoute = async () => {
    const name = prompt("Nome da nova rota:");
    if (!name) return;
    const { data, error } = await supabase.from('hidracor_routes').insert([{ name: name.toUpperCase(), user_id: user?.id }]).select();
    if (error) showError(error.message);
    else { setRoutes([...routes, data[0]]); showSuccess("Rota adicionada!"); }
  };

  const editRoute = async (route: Route) => {
    const name = prompt("Novo nome da rota:", route.name);
    if (!name || name === route.name) return;
    const { error } = await supabase.from('hidracor_routes').update({ name: name.toUpperCase() }).eq('id', route.id);
    if (error) showError(error.message);
    else { setRoutes(routes.map(r => r.id === route.id ? { ...r, name: name.toUpperCase() } : r)); showSuccess("Rota atualizada!"); }
  };

  const deleteRoute = async (id: string) => {
    if (!confirm("Excluir rota e todas as suas cidades?")) return;
    const { error } = await supabase.from('hidracor_routes').delete().eq('id', id);
    if (error) showError(error.message);
    else {
      setRoutes(routes.filter(r => r.id !== id));
      setCities(cities.filter(c => c.route_id !== id));
      showSuccess("Rota excluída!");
    }
  };

  const deleteAllRoutes = async () => {
    if (!confirm("ATENÇÃO: Isso excluirá TODAS as rotas e cidades cadastradas permanentemente. Deseja continuar?")) return;
    const { error } = await supabase.from('hidracor_routes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) showError(error.message);
    else {
      setRoutes([]);
      setCities([]);
      showSuccess("Base de rotas limpa com sucesso!");
    }
  };

  const addCity = async (routeId: string) => {
    const input = prompt("Nomes das cidades (separe por vírgula ou linha):");
    if (!input) return;
    const names = input.split(/[,\n]/).map(n => n.trim().toUpperCase()).filter(n => n.length > 0);
    const { data, error } = await supabase.from('hidracor_cities').insert(names.map(n => ({ route_id: routeId, city_name: n, user_id: user?.id }))).select();
    if (error) showError(error.message);
    else { setCities([...cities, ...(data || [])]); showSuccess("Cidades adicionadas!"); }
  };

  const editCity = async (city: City) => {
    const name = prompt("Novo nome da cidade:", city.city_name);
    if (!name || name === city.city_name) return;
    const { error } = await supabase.from('hidracor_cities').update({ city_name: name.toUpperCase() }).eq('id', city.id);
    if (error) showError(error.message);
    else { setCities(cities.map(c => c.id === city.id ? { ...c, city_name: name.toUpperCase() } : c)); showSuccess("Cidade atualizada!"); }
  };

  const deleteCity = async (id: string) => {
    if (!confirm("Excluir cidade?")) return;
    const { error } = await supabase.from('hidracor_cities').delete().eq('id', id);
    if (error) showError(error.message);
    else { setCities(cities.filter(c => c.id !== id)); showSuccess("Cidade excluída!"); }
  };

  const moveCity = async (city: City, newRouteId: string) => {
    const { error } = await supabase.from('hidracor_cities').update({ route_id: newRouteId }).eq('id', city.id);
    if (error) showError(error.message);
    else { setCities(cities.map(c => c.id === city.id ? { ...c, route_id: newRouteId } : c)); showSuccess("Cidade movida!"); }
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

  const editClient = async (client: ClientBase, table: 'hidracor_awaiting_clients' | 'hidracor_pickup_clients') => {
    const name = prompt("Novo nome do cliente:", client.client_name);
    if (!name || name === client.client_name) return;
    const { error = null } = await supabase.from(table).update({ client_name: name.toUpperCase() }).eq('id', client.id);
    if (error) showError(error.message);
    else {
      if (table === 'hidracor_awaiting_clients') setAwaitingClients(awaitingClients.map(c => c.id === client.id ? { ...c, client_name: name.toUpperCase() } : c));
      else setPickupClients(pickupClients.map(c => c.id === client.id ? { ...c, client_name: name.toUpperCase() } : c));
      showSuccess("Cliente atualizado!");
    }
  };

  const deleteClient = async (id: string, table: 'hidracor_awaiting_clients' | 'hidracor_pickup_clients') => {
    if (!confirm("Excluir cliente?")) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) showError(error.message);
    else {
      if (table === 'hidracor_awaiting_clients') setAwaitingClients(awaitingClients.filter(c => c.id !== id));
      else setPickupClients(pickupClients.filter(c => c.id !== id));
      showSuccess("Cliente excluído!");
    }
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

        const startRow = (data[0][0]?.toString().toLowerCase().includes('rota')) ? 1 : 0;
        const rows = data.slice(startRow).filter(r => r[0] && r[1]);

        const uniqueRouteNames = Array.from(new Set(rows.map(r => r[0].toString().toUpperCase().trim())));
        const currentRoutes = [...routes];
        const routeMap = new Map<string, string>();

        for (const routeName of uniqueRouteNames) {
          let existing = currentRoutes.find(r => r.name === routeName);
          if (!existing) {
            const { data: newRoute, error } = await supabase
              .from('hidracor_routes')
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
          route_id: routeMap.get(r[0].toString().toUpperCase().trim()),
          city_name: r[1].toString().toUpperCase().trim(),
          user_id: user?.id
        }));

        const { data: newCities, error: cityError } = await supabase
          .from('hidracor_cities')
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
    
    // 1. Aplicar Filtros de Coluna
    data = data.filter(row => 
      Object.entries(columnFilters).every(([col, val]) => 
        !val || row[col]?.toString().toLowerCase().includes(val.toLowerCase())
      )
    );

    // 2. Aplicar Filtro de Peso Mínimo Inteligente
    const minWeight = parseFloat(minWeightFilter.replace(',', '.'));
    if (!isNaN(minWeight) && minWeight > 0) {
      const clientGroups = new Map<string, any[]>();
      data.forEach(row => {
        const clientId = String(row['Cód.Cliente'] || row['Nome Cliente'] || 'unknown');
        if (!clientGroups.has(clientId)) clientGroups.set(clientId, []);
        clientGroups.get(clientId)!.push(row);
      });

      const validClientIds = new Set<string>();
      clientGroups.forEach((items, clientId) => {
        const hasSingleOrderAboveMin = items.some(item => {
          const val = parseFloat(String(item['peso possível'] || '0').replace(',', '.'));
          return !isNaN(val) && val >= minWeight;
        });
        const totalWeight = items.reduce((acc, item) => {
          const val = parseFloat(String(item['peso possível'] || '0').replace(',', '.'));
          return acc + (isNaN(val) ? 0 : val);
        }, 0);
        
        if (hasSingleOrderAboveMin || totalWeight >= minWeight) {
          validClientIds.add(clientId);
        }
      });

      data = data.filter(row => validClientIds.has(String(row['Cód.Cliente'] || row['Nome Cliente'] || 'unknown')));
    }

    // 3. Aplicar Ordenação
    if (sortConfig.direction !== null) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return data;
  }, [formattedData, columnFilters, minWeightFilter, sortConfig]);

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
      'peso possível': parseFloat(row['peso possível']),
      'valor possível': parseFloat(row['valor possível']),
      'peso total': parseFloat(row['peso total']),
      'valor total': parseFloat(row['valor total']),
      'CARGAS': usedOrderIds.get(row.Pedido?.toString()) || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataWithLoads);
    const wb = XLSX.utils.book_new();
    
    const range = dataWithLoads.length + 1;
    const colsToSum = ['I', 'J', 'K', 'L']; 
    colsToSum.forEach(col => {
      const cellRef = `${col}${range + 1}`;
      ws[cellRef] = { t: 'n', f: `SUBTOTAL(9,${col}2:${col}${range})` };
    });
    ws[`H${range + 1}`] = { v: "TOTAL:" };

    const range_ref = XLSX.utils.decode_range(ws['!ref']!);
    range_ref.e.r = range;
    ws['!ref'] = XLSX.utils.encode_range(range_ref);

    XLSX.utils.book_append_sheet(wb, ws, "Carteira Hidracor");
    XLSX.writeFile(wb, `CARTEIRA_HIDRACOR_${new Date().toLocaleDateString()}.xlsx`);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <header className="h-20 shrink-0 max-w-full mx-auto w-full flex justify-between items-center p-4 lg:px-8 bg-white border-b shadow-sm z-50">
        <div className="flex items-center gap-4">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft /></Button></Link>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Midas Log" className="h-7 w-auto" />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-slate-900">Formatar Carteira Hidracor</h1>
              <p className="text-slate-500 text-xs">Lógica de prioridade ROTA e persistência de dados.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/hidracor-loads" target="_blank"><Button variant="outline" size="sm" className="gap-2"><ListFilter size={16} /> Minhas Cargas</Button></Link>
          
          <Button variant="outline" size="sm" onClick={handlePrintSelection} className="gap-2 border-slate-200 hover:bg-slate-50">
            <Printer size={16} /> Imprimir Seleção
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-amber-200 hover:bg-amber-50">
                <Settings2 size={16} /> <span className="hidden sm:inline">Base Técnica Hidracor</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[600px] overflow-y-auto">
              <SheetHeader className="mb-6">
                <SheetTitle>Configuração de Base Técnica</SheetTitle>
                <SheetDescription>Gerencie rotas, clientes aguardando e clientes retira.</SheetDescription>
              </SheetHeader>
              
              <Tabs defaultValue="routes" className="w-full">
                <TabsList className="grid grid-cols-3 mb-6">
                  <TabsTrigger value="routes">Rotas</TabsTrigger>
                  <TabsTrigger value="awaiting">Aguardando</TabsTrigger>
                  <TabsTrigger value="pickup">Retira</TabsTrigger>
                </TabsList>

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
                                <button className="bg-white px-2 py-0.5 rounded text-[9px] border border-slate-200 uppercase hover:border-amber-500 transition-colors">
                                  {city.city_name}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => editCity(city)} className="gap-2">
                                  <Edit2 size={14} /> Editar Nome
                                </DropdownMenuItem>
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger className="gap-2">
                                    <MoveHorizontal size={14} /> Mover para Rota
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuPortal>
                                    <DropdownMenuSubContent>
                                      {routes.filter(r => r.id !== route.id).map(r => (
                                        <DropdownMenuItem key={r.id} onClick={() => moveCity(city, r.id)}>
                                          {r.name}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuPortal>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => deleteCity(city.id)} className="text-red-600 gap-2">
                                  <Trash2 size={14} /> Excluir Cidade
                                </DropdownMenuItem>
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
                    <h3 className="text-sm font-bold uppercase text-slate-500">Clientes Aguardando Confirmação</h3>
                    <Button size="sm" onClick={() => addClientsToBase('hidracor_awaiting_clients')} className="h-8 bg-amber-600 hover:bg-amber-700"><Plus size={14} /> Adicionar</Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {awaitingClients.map(client => (
                      <div key={client.id} className="flex justify-between items-center p-2 bg-slate-50 border rounded text-[10px] uppercase group">
                        <span className="truncate">{client.client_name}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-amber-600" onClick={() => editClient(client, 'hidracor_awaiting_clients')}><Edit2 size={12} /></Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500" onClick={() => deleteClient(client.id, 'hidracor_awaiting_clients')}><Trash2 size={12} /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="pickup" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase text-slate-500">Clientes Retira</h3>
                    <Button size="sm" onClick={() => addClientsToBase('hidracor_pickup_clients')} className="h-8 bg-amber-600 hover:bg-amber-700"><Plus size={14} /> Adicionar</Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {pickupClients.map(client => (
                      <div key={client.id} className="flex justify-between items-center p-2 bg-slate-50 border rounded text-[10px] uppercase group">
                        <span className="truncate">{client.client_name}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-amber-600" onClick={() => editClient(client, 'hidracor_pickup_clients')}><Edit2 size={12} /></Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500" onClick={() => deleteClient(client.id, 'hidracor_pickup_clients')}><Trash2 size={12} /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </SheetContent>
          </Sheet>

          {selectedItems.length > 0 && <Button onClick={handleCreateLoad} size="sm" className="bg-amber-600 text-white gap-2 animate-pulse"><Truck size={16} /> Criar Carga ({selectedItems.length})</Button>}
          {formattedData.length > 0 && <Button variant="outline" size="sm" onClick={() => setIsUploadOpen(!isUploadOpen)} className="gap-2 border-amber-200 text-amber-700"><RefreshCw size={14} /> {isUploadOpen ? "Fechar" : "Novo Upload"}</Button>}
          <Button onClick={downloadExcel} size="sm" className="bg-green-600 text-white gap-2"><Download size={16} /> Baixar Excel</Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 lg:p-6 lg:pb-4 gap-4 overflow-hidden min-h-0 max-h-[calc(100vh-5rem)]">
        <Collapsible open={isUploadOpen} onOpenChange={setIsUploadOpen} className="w-full shrink-0">
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
          <Card className="border-none shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-50/50 border-b gap-4 py-2 shrink-0">
              <div className="flex items-center gap-4">
                <CardTitle className="text-lg flex items-center gap-2"><Filter size={18} className="text-amber-600" /> Preview</CardTitle>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">{filteredData.length} registros</span>
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2 h-8">
                  <XCircle size={16} /> Limpar Filtros
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-lg border shadow-sm">
                <Calculator size={16} className="text-slate-400" />
                <div className="text-[10px] border-r pr-2">
                  <span className="text-slate-500 font-medium uppercase">Peso Possível:</span>
                  <span className="ml-1 font-bold text-blue-600">{formatWeight(totals['peso possível'])}</span>
                </div>
                <div className="text-[10px] border-r pr-2">
                  <span className="text-slate-500 font-medium uppercase">Valor Possível:</span>
                  <span className="ml-1 font-bold text-blue-600">{formatCurrency(totals['valor possível'])}</span>
                </div>
                <div className="text-[10px] border-r pr-2">
                  <span className="text-slate-500 font-medium uppercase">Peso Total:</span>
                  <span className="ml-1 font-bold text-amber-700">{formatWeight(totals['peso total'])}</span>
                </div>
                <div className="text-[10px]">
                  <span className="text-slate-500 font-medium uppercase">Valor Total:</span>
                  <span className="ml-1 font-bold text-amber-700">{formatCurrency(totals['valor total'])}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 flex flex-col min-h-0 overflow-hidden">
              <style>{`
                .scrollbar-custom::-webkit-scrollbar {
                  height: 16px;
                  width: 16px;
                }
                .scrollbar-custom::-webkit-scrollbar-track {
                  background: #f1f5f9;
                }
                .scrollbar-custom::-webkit-scrollbar-thumb {
                  background-color: #f59e0b;
                  border-radius: 8px;
                  border: 3px solid #f1f5f9;
                }
                .scrollbar-custom::-webkit-scrollbar-thumb:hover {
                  background-color: #d97706;
                }
              `}</style>
              <div 
                ref={tableScrollRef} 
                className="flex-1 overflow-auto scrollbar-custom"
              >
                <Table className="border-separate border-spacing-0 min-w-[2800px]">
                  <TableHeader className="bg-white sticky top-0 z-50 shadow-sm">
                    <TableRow>
                      <TableHead className="w-[50px] bg-white sticky left-0 z-[60] border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)]"></TableHead>
                      {Object.keys(formattedData[0]).map(col => (
                        <TableHead key={col} className="w-[200px] py-4 px-4 bg-white">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSort(col)}>
                              <span className="text-[10px] font-bold uppercase text-slate-500">{col}</span>
                              <ArrowUpDown size={12} className="text-slate-300" />
                            </div>
                            {col === 'peso possível' ? (
                              <div className="flex items-center gap-1 bg-slate-50 border rounded px-1">
                                <Truck size={12} className="text-amber-600" />
                                <Input 
                                  placeholder="Mínimo..." 
                                  className="h-7 text-[10px] border-none bg-transparent focus-visible:ring-0 p-0" 
                                  value={minWeightFilter}
                                  onChange={(e) => setMinWeightFilter(e.target.value)} 
                                />
                              </div>
                            ) : (
                              <Input 
                                placeholder={`Filtrar...`} 
                                className="h-7 text-[10px]" 
                                value={columnFilters[col] || ""}
                                onChange={(e) => setColumnFilters({...columnFilters, [col]: e.target.value})} 
                                />
                            )}
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
                          <TableCell className="p-2 text-center sticky left-0 bg-white z-40 border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
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
                                <span className="block truncate max-w-[180px]">
                                  {col.includes('peso') ? formatWeight(parseFloat(row[col])) : col.includes('valor') ? formatCurrency(parseFloat(row[col])) : row[col]}
                                </span>
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
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default HidracorFormatter;