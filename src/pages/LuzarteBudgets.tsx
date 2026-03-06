"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  FileText, 
  Copy, 
  Edit3, 
  Trash2, 
  Loader2, 
  Printer,
  Save,
  UserPlus,
  ChevronRight,
  History,
  Calculator,
  X,
  Check,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Settings2,
  Users,
  UserCheck,
  Phone,
  MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter 
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

interface LuzarteClient {
  id: string;
  razao_social: string;
  cnpj: string;
  cidade: string;
  estado: string;
  tabela_precos: string;
}

interface LuzarteSeller {
  id: string;
  name: string;
  phone: string;
  city: string;
  state: string;
}

interface BudgetItem {
  id: string;
  ordem: number;
  produto: string;
  forma: string;
  cor: string;
  litros: string;
  valor: number;
  quantidade: number;
  observacao?: string;
}

const ESTADOS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

const LuzarteBudgets = () => {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [clients, setClients] = useState<LuzarteClient[]>([]);
  const [sellers, setSellers] = useState<LuzarteSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'form' | 'view'>('list');
  const [priceBase, setPriceBase] = useState<Record<string, any[]>>({});
  
  // Form State
  const [budgetName, setBudgetName] = useState("");
  const [selectedClient, setSelectedClient] = useState<LuzarteClient | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<LuzarteSeller | null>(null);
  const [paymentTerm, setPaymentTerm] = useState("30/45/60");
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [viewingBudget, setViewingBudget] = useState<any>(null);
  const [expandedObs, setExpandedObs] = useState<Record<string, boolean>>({});

  // Management Dialog State
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<LuzarteClient | null>(null);
  const [editingSeller, setEditingSeller] = useState<LuzarteSeller | null>(null);

  // Registration State
  const [citiesList, setCitiesList] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [newClient, setNewClient] = useState({
    razao_social: "",
    cnpj: "",
    cidade: "",
    estado: "CE",
    tabela_precos: "ATACADO"
  });
  const [newSeller, setNewSeller] = useState({
    name: "",
    phone: "",
    city: "",
    state: "CE"
  });

  useEffect(() => {
    fetchData();
    loadPriceBase();
  }, []);

  // Busca cidades do IBGE quando o estado muda
  const fetchCities = async (uf: string) => {
    if (!uf) return;
    setLoadingCities(true);
    try {
      const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
      const data = await response.json();
      setCitiesList(data.map((c: any) => c.nome).sort());
    } catch (error) {
      console.error("Erro ao buscar cidades:", error);
    } finally {
      setLoadingCities(false);
    }
  };

  useEffect(() => {
    if (newClient.estado) fetchCities(newClient.estado);
  }, [newClient.estado]);

  useEffect(() => {
    if (newSeller.state) fetchCities(newSeller.state);
  }, [newSeller.state]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, cRes, sRes] = await Promise.all([
        supabase.from('luzarte_budgets').select('*, luzarte_clients(*)').order('created_at', { ascending: false }),
        supabase.from('luzarte_clients').select('*').order('razao_social'),
        supabase.from('luzarte_sellers').select('*').order('name')
      ]);
      setBudgets(bRes.data || []);
      setClients(cRes.data || []);
      setSellers(sRes.data || []);
    } catch (error: any) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPriceBase = async () => {
    try {
      const response = await fetch('/BASE.xlsx');
      if (!response.ok) throw new Error("Arquivo BASE.xlsx não encontrado.");
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      const base: Record<string, any[]> = {};
      
      workbook.SheetNames.forEach(name => {
        const sheet = workbook.Sheets[name];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
          const row = rawRows[i];
          if (row && row.some(cell => /NOME|PRODUTO|DESCRI|ITEM/i.test(String(cell)))) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx === -1) return;

        const headers = rawRows[headerRowIdx].map(h => String(h || '').toUpperCase().trim());
        const dataRows = rawRows.slice(headerRowIdx + 1);

        const normalizedData = dataRows
          .filter(row => row.length > 0 && row.some(cell => cell !== null && cell !== ""))
          .map(row => {
            const obj: any = {};
            headers.forEach((header, idx) => {
              const val = row[idx];
              if (['NOME', 'PRODUTO', 'DESCRIÇÃO', 'DESCRICAO', 'ITEM'].some(k => header.includes(k))) obj.NOME = val;
              else if (['COR', 'CORES'].some(k => header.includes(k))) obj.COR = val;
              else if (['LITROS', 'CAPACIDADE', 'LITRAGEM', 'LTS'].some(k => header.includes(k))) obj.LITROS = val;
              else if (['FORMA', 'MODELO', 'FORMATO'].some(k => header.includes(k))) obj.FORMA = val;
              else if (['VALOR', 'PREÇO', 'PRECO', 'UNIT'].some(k => header.includes(k))) obj.VALOR = val;
              obj[header] = val;
            });
            return obj;
          });
        
        base[name.toUpperCase().trim()] = normalizedData;
      });
      setPriceBase(base);
    } catch (error) {
      console.error("Erro ao carregar base de preços:", error);
    }
  };

  const formatCNPJ = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 18);
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .substring(0, 15);
  };

  // CRUD Clientes
  const handleSaveClient = async () => {
    if (!newClient.razao_social || !newClient.cnpj || !newClient.cidade) {
      showError("Preencha os campos obrigatórios.");
      return;
    }
    try {
      if (editingClient) {
        const { data, error } = await supabase.from('luzarte_clients').update(newClient).eq('id', editingClient.id).select().single();
        if (error) throw error;
        setClients(clients.map(c => c.id === data.id ? data : c));
        showSuccess("Cliente atualizado!");
      } else {
        const { data, error } = await supabase.from('luzarte_clients').insert([{ ...newClient, user_id: user?.id }]).select().single();
        if (error) throw error;
        setClients([...clients, data]);
        setSelectedClient(data);
        showSuccess("Cliente cadastrado!");
      }
      setEditingClient(null);
      setNewClient({ razao_social: "", cnpj: "", cidade: "", estado: "CE", tabela_precos: "ATACADO" });
    } catch (error: any) { showError(error.message); }
  };

  const deleteClient = async (id: string) => {
    if (!confirm("Excluir este cliente? Isso não afetará orçamentos já salvos.")) return;
    try {
      await supabase.from('luzarte_clients').delete().eq('id', id);
      setClients(clients.filter(c => c.id !== id));
      if (selectedClient?.id === id) setSelectedClient(null);
      showSuccess("Cliente removido.");
    } catch (error: any) { showError(error.message); }
  };

  // CRUD Vendedores
  const handleSaveSeller = async () => {
    if (!newSeller.name || !newSeller.phone || !newSeller.city) {
      showError("Preencha os campos obrigatórios.");
      return;
    }
    try {
      if (editingSeller) {
        const { data, error } = await supabase.from('luzarte_sellers').update(newSeller).eq('id', editingSeller.id).select().single();
        if (error) throw error;
        setSellers(sellers.map(s => s.id === data.id ? data : s));
        showSuccess("Vendedor atualizado!");
      } else {
        const { data, error } = await supabase.from('luzarte_sellers').insert([{ ...newSeller, user_id: user?.id }]).select().single();
        if (error) throw error;
        setSellers([...sellers, data]);
        setSelectedSeller(data);
        showSuccess("Vendedor cadastrado!");
      }
      setEditingSeller(null);
      setNewSeller({ name: "", phone: "", city: "", state: "CE" });
    } catch (error: any) { showError(error.message); }
  };

  const deleteSeller = async (id: string) => {
    if (!confirm("Excluir este vendedor?")) return;
    try {
      await supabase.from('luzarte_sellers').delete().eq('id', id);
      setSellers(sellers.filter(s => s.id !== id));
      if (selectedSeller?.id === id) setSelectedSeller(null);
      showSuccess("Vendedor removido.");
    } catch (error: any) { showError(error.message); }
  };

  const addItem = () => {
    const newItem: BudgetItem = {
      id: Math.random().toString(36).substr(2, 9),
      ordem: items.length + 1,
      produto: "",
      forma: "",
      cor: "",
      litros: "",
      valor: 0,
      quantidade: 1,
      observacao: ""
    };
    setItems([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof BudgetItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      
      if (field === 'produto') {
        updated.forma = ""; updated.cor = ""; updated.litros = ""; updated.valor = 0;
      }

      if (selectedClient && updated.produto && updated.cor) {
        const table = selectedClient.tabela_precos.toUpperCase().trim();
        const sheetKey = Object.keys(priceBase).find(k => k === table || k.includes(table) || table.includes(k)) || table;
        const data = priceBase[sheetKey] || [];
        
        const match = data.find(row => 
          String(row.NOME || '').toUpperCase().trim() === updated.produto.toUpperCase().trim() &&
          String(row.COR || '').toUpperCase().trim() === updated.cor.toUpperCase().trim() &&
          (updated.litros ? String(row.LITROS || '').toUpperCase().trim() === updated.litros.toUpperCase().trim() : true) &&
          (updated.forma ? String(row.FORMA || '').toUpperCase().trim() === updated.forma.toUpperCase().trim() : true)
        );

        if (match) {
          updated.valor = typeof match.VALOR === 'number' ? match.VALOR : parseFloat(String(match.VALOR).replace('R$', '').replace('.', '').replace(',', '.').trim()) || 0;
        }
      }
      return updated;
    }));
  };

  const saveBudget = async () => {
    if (!selectedClient || !selectedSeller || items.length === 0) {
      showError("Preencha todos os campos obrigatórios.");
      return;
    }

    const total = items.reduce((acc, item) => acc + (item.valor * item.quantidade), 0);
    const budgetData = {
      user_id: user?.id,
      name: budgetName || `Orçamento ${selectedClient.razao_social}`,
      client_id: selectedClient.id,
      seller_name: selectedSeller.name,
      payment_term: paymentTerm,
      items: items,
      total_value: total
    };

    try {
      if (editingBudgetId) {
        await supabase.from('luzarte_budgets').update(budgetData).eq('id', editingBudgetId);
        showSuccess("Orçamento atualizado!");
      } else {
        await supabase.from('luzarte_budgets').insert([budgetData]);
        showSuccess("Orçamento salvo!");
      }
      setViewMode('list');
      setEditingBudgetId(null);
      setItems([]);
      fetchData();
    } catch (error: any) { showError(error.message); }
  };

  const availableProducts = useMemo(() => {
    if (!selectedClient || Object.keys(priceBase).length === 0) return [];
    const table = selectedClient.tabela_precos.toUpperCase().trim();
    const sheetKey = Object.keys(priceBase).find(k => k === table || k.includes(table) || table.includes(k)) || Object.keys(priceBase)[0];
    const data = priceBase[sheetKey] || [];
    return Array.from(new Set(data.map(row => String(row.NOME || '').trim()).filter(val => val !== "" && val !== "undefined"))).sort();
  }, [selectedClient, priceBase]);

  const getOptionsForProduct = (item: BudgetItem, field: 'COR' | 'LITROS' | 'FORMA') => {
    if (!selectedClient || !item.produto || Object.keys(priceBase).length === 0) return [];
    const table = selectedClient.tabela_precos.toUpperCase().trim();
    const sheetKey = Object.keys(priceBase).find(k => k === table || k.includes(table) || table.includes(k)) || Object.keys(priceBase)[0];
    const data = priceBase[sheetKey] || [];
    let filtered = data.filter(row => String(row.NOME || '').toUpperCase().trim() === item.produto.toUpperCase().trim());
    if (field === 'LITROS' && item.cor) filtered = filtered.filter(row => String(row.COR || '').toUpperCase().trim() === item.cor.toUpperCase().trim());
    if (field === 'COR' && item.forma) filtered = filtered.filter(row => String(row.FORMA || '').toUpperCase().trim() === item.forma.toUpperCase().trim());
    return Array.from(new Set(filtered.map(row => String(row[field] || '').trim()).filter(val => val !== "" && val !== "undefined"))).sort();
  };

  const SearchableSelect = ({ 
    options, 
    value, 
    onSelect, 
    placeholder, 
    emptyMessage = "Não encontrado." 
  }: { 
    options: string[], 
    value: string, 
    onSelect: (v: string) => void, 
    placeholder: string,
    emptyMessage?: string
  }) => {
    const [open, setOpen] = useState(false);
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-8 text-xs font-normal">
            {value || placeholder}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder={`Buscar ${placeholder.toLowerCase()}...`} className="h-8" />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup className="max-h-60 overflow-y-auto">
                {options.map((opt) => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={(v) => {
                      onSelect(v.toUpperCase());
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                    {opt}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col print:bg-white">
      <header className="bg-white border-b p-4 lg:px-8 flex justify-between items-center sticky top-0 z-50 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setViewMode('list')}><ArrowLeft /></Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Orçamentos Luzarte</h1>
            <p className="text-slate-500 text-xs">Gestão de orçamentos e tabelas de preços.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-slate-200 h-8 text-xs">
                <Settings2 size={14} /> Gerenciar Cadastros
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Gestão de Base de Dados</DialogTitle></DialogHeader>
              <Tabs defaultValue="clients" className="w-full">
                <TabsList className="grid grid-cols-2 mb-6">
                  <TabsTrigger value="clients" className="gap-2"><Users size={16} /> Clientes</TabsTrigger>
                  <TabsTrigger value="sellers" className="gap-2"><UserCheck size={16} /> Vendedores</TabsTrigger>
                </TabsList>

                <TabsContent value="clients" className="space-y-6">
                  <Card className="border-slate-100 shadow-sm">
                    <CardHeader className="py-4"><CardTitle className="text-sm uppercase">{editingClient ? "Editar Cliente" : "Novo Cliente"}</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><label className="text-[10px] font-bold uppercase">Razão Social</label><Input value={newClient.razao_social} onChange={(e) => setNewClient({...newClient, razao_social: e.target.value.toUpperCase()})} /></div>
                      <div className="space-y-1"><label className="text-[10px] font-bold uppercase">CNPJ</label><Input value={newClient.cnpj} onChange={(e) => setNewClient({...newClient, cnpj: formatCNPJ(e.target.value)})} /></div>
                      <div className="space-y-1"><label className="text-[10px] font-bold uppercase">Estado</label>
                        <SearchableSelect 
                          options={ESTADOS} 
                          value={newClient.estado} 
                          onSelect={(v) => setNewClient({...newClient, estado: v})} 
                          placeholder="Estado" 
                        />
                      </div>
                      <div className="space-y-1"><label className="text-[10px] font-bold uppercase">Cidade</label>
                        <SearchableSelect 
                          options={citiesList} 
                          value={newClient.cidade} 
                          onSelect={(v) => setNewClient({...newClient, cidade: v})} 
                          placeholder="Cidade" 
                          emptyMessage={loadingCities ? "Carregando..." : "Selecione o estado primeiro."}
                        />
                      </div>
                      <div className="col-span-2 space-y-1"><label className="text-[10px] font-bold uppercase">Tabela</label>
                        <Select value={newClient.tabela_precos} onValueChange={(v) => setNewClient({...newClient, tabela_precos: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ATACADO">ATACADO</SelectItem>
                            <SelectItem value="VAREJO 15.000">VAREJO 15.000</SelectItem>
                            <SelectItem value="VAREJO 25.000">VAREJO 25.000</SelectItem>
                            <SelectItem value="VAREJO 50.000">VAREJO 50.000</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                    <CardFooter className="justify-end gap-2 py-3 bg-slate-50">
                      {editingClient && <Button variant="ghost" size="sm" onClick={() => { setEditingClient(null); setNewClient({ razao_social: "", cnpj: "", cidade: "", estado: "CE", tabela_precos: "ATACADO" }); }}>Cancelar</Button>}
                      <Button size="sm" onClick={handleSaveClient} className="bg-amber-600 text-white">{editingClient ? "Atualizar" : "Cadastrar"}</Button>
                    </CardFooter>
                  </Card>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50"><TableRow><TableHead>Cliente</TableHead><TableHead>Cidade/UF</TableHead><TableHead>Tabela</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {clients.map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="text-xs font-bold">{c.razao_social}</TableCell>
                            <TableCell className="text-xs">{c.cidade} - {c.estado}</TableCell>
                            <TableCell className="text-[10px] font-bold text-amber-600">{c.tabela_precos}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" onClick={() => { setEditingClient(c); setNewClient(c); }}><Edit3 size={14} /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteClient(c.id)}><Trash2 size={14} /></Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="sellers" className="space-y-6">
                  <Card className="border-slate-100 shadow-sm">
                    <CardHeader className="py-4"><CardTitle className="text-sm uppercase">{editingSeller ? "Editar Vendedor" : "Novo Vendedor"}</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><label className="text-[10px] font-bold uppercase">Nome Completo</label><Input value={newSeller.name} onChange={(e) => setNewSeller({...newSeller, name: e.target.value.toUpperCase()})} /></div>
                      <div className="space-y-1"><label className="text-[10px] font-bold uppercase">Telefone</label><Input value={newSeller.phone} onChange={(e) => setNewSeller({...newSeller, phone: formatPhone(e.target.value)})} placeholder="(00) 00000-0000" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-bold uppercase">Estado</label>
                        <SearchableSelect 
                          options={ESTADOS} 
                          value={newSeller.state} 
                          onSelect={(v) => setNewSeller({...newSeller, state: v})} 
                          placeholder="Estado" 
                        />
                      </div>
                      <div className="space-y-1"><label className="text-[10px] font-bold uppercase">Cidade</label>
                        <SearchableSelect 
                          options={citiesList} 
                          value={newSeller.city} 
                          onSelect={(v) => setNewSeller({...newSeller, city: v})} 
                          placeholder="Cidade" 
                          emptyMessage={loadingCities ? "Carregando..." : "Selecione o estado primeiro."}
                        />
                      </div>
                    </CardContent>
                    <CardFooter className="justify-end gap-2 py-3 bg-slate-50">
                      {editingSeller && <Button variant="ghost" size="sm" onClick={() => { setEditingSeller(null); setNewSeller({ name: "", phone: "", city: "", state: "CE" }); }}>Cancelar</Button>}
                      <Button size="sm" onClick={handleSaveSeller} className="bg-amber-600 text-white">{editingSeller ? "Atualizar" : "Cadastrar"}</Button>
                    </CardFooter>
                  </Card>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50"><TableRow><TableHead>Vendedor</TableHead><TableHead>Telefone</TableHead><TableHead>Cidade/UF</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {sellers.map(s => (
                          <TableRow key={s.id}>
                            <TableCell className="text-xs font-bold">{s.name}</TableCell>
                            <TableCell className="text-xs">{s.phone}</TableCell>
                            <TableCell className="text-xs">{s.city} - {s.state}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" onClick={() => { setEditingSeller(s); setNewSeller(s); }}><Edit3 size={14} /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteSeller(s.id)}><Trash2 size={14} /></Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          {viewMode === 'list' && (
            <Button onClick={() => { setViewMode('form'); setEditingBudgetId(null); setItems([]); setSelectedClient(null); setSelectedSeller(null); setBudgetName(""); }} className="bg-amber-600 hover:bg-amber-700 text-white gap-2 h-8 text-xs">
              <Plus size={16} /> Novo Orçamento
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
        {viewMode === 'form' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-none shadow-lg">
              <CardHeader className="bg-slate-900 text-white rounded-t-xl">
                <div className="flex justify-between items-center">
                  <div><CardTitle>{editingBudgetId ? "Editar Orçamento" : "Novo Orçamento"}</CardTitle><CardDescription className="text-slate-400">Configure os detalhes da proposta comercial.</CardDescription></div>
                  <div className="w-72"><label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Nome do Orçamento</label><Input placeholder="Ex: Orçamento Obra X" className="bg-white/10 border-white/20 text-white h-9" value={budgetName} onChange={(e) => setBudgetName(e.target.value)} /></div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-slate-500">Vendedor</label>
                    <Select value={selectedSeller?.id} onValueChange={(id) => setSelectedSeller(sellers.find(s => s.id === id) || null)}>
                      <SelectTrigger><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
                      <SelectContent>{sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-slate-500">Cliente</label>
                    <Select value={selectedClient?.id} onValueChange={(id) => setSelectedClient(clients.find(c => c.id === id) || null)}>
                      <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                      <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-slate-500">Prazo de Pagamento</label>
                    <Select value={paymentTerm} onValueChange={setPaymentTerm}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="30/45/60">30/45/60 DIAS</SelectItem><SelectItem value="ANTECIPADO">ANTECIPADO</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedClient && (
                  <div className="pt-6 border-t space-y-4">
                    <div className="flex justify-between items-center"><h3 className="font-bold text-slate-900 flex items-center gap-2"><Calculator size={18} className="text-amber-600" /> Itens do Orçamento</h3><Button onClick={addItem} variant="outline" size="sm" className="gap-2"><Plus size={16} /> Adicionar Produto</Button></div>
                    <div className="border rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader className="bg-slate-50"><TableRow><TableHead className="w-[60px]">#</TableHead><TableHead>Produto</TableHead><TableHead>Forma</TableHead><TableHead>Cor</TableHead><TableHead>Litros</TableHead><TableHead className="w-[100px]">Qtd</TableHead><TableHead className="w-[150px]">Valor Unit.</TableHead><TableHead className="w-[150px]">Subtotal</TableHead><TableHead className="w-[100px] text-right">Ações</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {items.map((item, idx) => {
                            const formas = getOptionsForProduct(item, 'FORMA');
                            const cores = getOptionsForProduct(item, 'COR');
                            const litros = getOptionsForProduct(item, 'LITROS');
                            return (
                              <React.Fragment key={item.id}>
                                <TableRow>
                                  <TableCell className="font-bold text-slate-400">{idx + 1}</TableCell>
                                  <TableCell>
                                    <SearchableSelect 
                                      options={availableProducts} 
                                      value={item.produto} 
                                      onSelect={(v) => updateItem(item.id, 'produto', v)} 
                                      placeholder="Produto" 
                                    />
                                  </TableCell>
                                  <TableCell><Select value={item.forma} onValueChange={(v) => updateItem(item.id, 'forma', v)} disabled={formas.length === 0}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="-" /></SelectTrigger><SelectContent>{formas.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></TableCell>
                                  <TableCell><Select value={item.cor} onValueChange={(v) => updateItem(item.id, 'cor', v)}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Cor" /></SelectTrigger><SelectContent>{cores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></TableCell>
                                  <TableCell><Select value={item.litros} onValueChange={(v) => updateItem(item.id, 'litros', v)} disabled={litros.length === 0}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="-" /></SelectTrigger><SelectContent>{litros.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></TableCell>
                                  <TableCell><Input type="number" className="h-8 text-xs" value={item.quantidade} onChange={(e) => updateItem(item.id, 'quantidade', parseInt(e.target.value) || 0)} /></TableCell>
                                  <TableCell><Input type="number" className="h-8 text-xs font-bold text-blue-600" value={item.valor} onChange={(e) => updateItem(item.id, 'valor', parseFloat(e.target.value) || 0)} /></TableCell>
                                  <TableCell className="font-bold text-slate-900">{(item.valor * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                                  <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className={cn("h-8 w-8", expandedObs[item.id] ? "text-amber-600 bg-amber-50" : "text-slate-400")} onClick={() => setExpandedObs({...expandedObs, [item.id]: !expandedObs[item.id]})}>{expandedObs[item.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setItems(items.filter(i => i.id !== item.id))}><Trash2 size={14} /></Button></div></TableCell>
                                </TableRow>
                                {expandedObs[item.id] && <TableRow className="bg-slate-50/50"><TableCell colSpan={9} className="p-4"><div className="flex items-start gap-3"><MessageSquare size={16} className="text-slate-400 mt-2" /><Textarea placeholder="Observação..." className="min-h-[60px] text-xs bg-white" value={item.observacao || ""} onChange={(e) => updateItem(item.id, 'observacao', e.target.value)} /></div></TableCell></TableRow>}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-end pt-4"><div className="bg-slate-900 text-white p-4 rounded-xl min-w-[250px]"><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total</p><p className="text-2xl font-bold">{items.reduce((acc, item) => acc + (item.valor * item.quantidade), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div></div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-slate-50 p-6 flex justify-between border-t"><Button variant="ghost" onClick={() => setViewMode('list')}>Cancelar</Button><Button onClick={saveBudget} className="bg-amber-600 hover:bg-amber-700 text-white gap-2"><Save size={18} /> {editingBudgetId ? "Atualizar" : "Salvar"}</Button></CardFooter>
            </Card>
          </div>
        )}

        {viewMode === 'view' && viewingBudget && (
          <div className="animate-in fade-in duration-500">
            <style>{`@media print { @page { size: portrait; margin: 1cm; } body { background: white; } .print-hidden { display: none !important; } .print-container { width: 100% !important; max-width: none !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important; } .print-table th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; } .print-header { border-bottom: 2px solid #f59e0b !important; -webkit-print-color-adjust: exact; } }`}</style>
            <Card className="border-none shadow-xl print-container">
              <CardHeader className="border-b-2 border-amber-500 pb-6 print-header">
                <div className="flex justify-between items-start">
                  <div><CardTitle className="text-2xl font-bold text-slate-900 uppercase">{viewingBudget.name}</CardTitle><CardDescription className="text-slate-500 font-medium">Emitido em: {new Date(viewingBudget.created_at).toLocaleDateString('pt-BR')}</CardDescription></div>
                  <div className="text-right"><p className="text-sm font-bold text-slate-900 uppercase">Proposta Comercial</p><p className="text-xs text-slate-500">Vendedor: {viewingBudget.seller_name}</p></div>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-8 bg-slate-50 p-6 rounded-xl border border-slate-100">
                  <div className="space-y-2"><h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Dados do Cliente</h4><p className="text-lg font-bold text-slate-900">{viewingBudget.luzarte_clients?.razao_social}</p><p className="text-sm text-slate-600">CNPJ: {viewingBudget.luzarte_clients?.cnpj}</p><p className="text-sm text-slate-600">{viewingBudget.luzarte_clients?.cidade} - {viewingBudget.luzarte_clients?.estado}</p></div>
                  <div className="space-y-2 text-right"><h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Condições</h4><p className="text-sm font-bold text-slate-900">Prazo: {viewingBudget.payment_term}</p><p className="text-sm text-slate-600">Tabela: {viewingBudget.luzarte_clients?.tabela_precos}</p></div>
                </div>
                <div className="border rounded-xl overflow-hidden">
                  <Table className="print-table">
                    <TableHeader className="bg-slate-100"><TableRow><TableHead className="w-[50px]">#</TableHead><TableHead>Produto</TableHead><TableHead>Forma</TableHead><TableHead>Cor</TableHead><TableHead>Litros</TableHead><TableHead className="text-center">Qtd</TableHead><TableHead className="text-right">V. Unitário</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {viewingBudget.items.map((item: any, idx: number) => (
                        <React.Fragment key={idx}>
                          <TableRow><TableCell>{idx + 1}</TableCell><TableCell className="font-bold uppercase">{item.produto}</TableCell><TableCell className="uppercase">{item.forma || '-'}</TableCell><TableCell className="uppercase">{item.cor}</TableCell><TableCell className="uppercase">{item.litros || '-'}</TableCell><TableCell className="text-center font-bold">{item.quantidade}</TableCell><TableCell className="text-right">{item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell><TableCell className="text-right font-bold">{(item.valor * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell></TableRow>
                          {item.observacao && <TableRow className="bg-slate-50/30"><TableCell colSpan={8} className="py-2 px-8 italic text-[10px] text-slate-500"><strong>Obs:</strong> {item.observacao}</TableCell></TableRow>}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end"><div className="bg-slate-900 text-white p-6 rounded-2xl min-w-[300px] text-right shadow-lg"><p className="text-xs font-bold text-slate-400 uppercase mb-2">Valor Total</p><p className="text-4xl font-bold">{viewingBudget.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div></div>
              </CardContent>
              <CardFooter className="border-t p-8 flex justify-between items-center bg-slate-50/50"><div className="text-[10px] text-slate-400 uppercase font-medium">Validade: 7 dias.</div><div className="flex items-center gap-2 text-amber-600 font-bold text-sm"><Check size={16} /> Proposta Comercial Luzarte</div></CardFooter>
            </Card>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="space-y-8">
            <div className="grid md:grid-cols-4 gap-6">
              <Card className="border-none shadow-sm bg-white"><CardContent className="p-6"><div className="flex items-center gap-4"><div className="bg-amber-100 p-3 rounded-xl text-amber-600"><FileText size={24} /></div><div><p className="text-xs font-bold text-slate-500 uppercase">Total Orçamentos</p><p className="text-2xl font-bold text-slate-900">{budgets.length}</p></div></div></CardContent></Card>
              <Card className="border-none shadow-sm bg-white"><CardContent className="p-6"><div className="flex items-center gap-4"><div className="bg-blue-100 p-3 rounded-xl text-blue-600"><Users size={24} /></div><div><p className="text-xs font-bold text-slate-500 uppercase">Clientes</p><p className="text-2xl font-bold text-slate-900">{clients.length}</p></div></div></CardContent></Card>
              <Card className="border-none shadow-sm bg-white"><CardContent className="p-6"><div className="flex items-center gap-4"><div className="bg-green-100 p-3 rounded-xl text-green-600"><UserCheck size={24} /></div><div><p className="text-xs font-bold text-slate-500 uppercase">Vendedores</p><p className="text-2xl font-bold text-slate-900">{sellers.length}</p></div></div></CardContent></Card>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><History size={20} className="text-amber-600" /> Histórico</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {budgets.map(budget => (
                  <Card key={budget.id} className="hover:shadow-md transition-all border-slate-200 group">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start"><div className="bg-slate-100 p-2 rounded-lg text-slate-600"><FileText size={20} /></div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => copyBudget(budget)}><Copy size={16} /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" onClick={() => editBudget(budget)}><Edit3 size={16} /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteBudget(budget.id)}><Trash2 size={16} /></Button></div></div>
                      <CardTitle className="mt-4 text-lg uppercase truncate">{budget.name || budget.luzarte_clients?.razao_social}</CardTitle>
                      <CardDescription>{new Date(budget.created_at).toLocaleDateString('pt-BR')} • {budget.seller_name}</CardDescription>
                    </CardHeader>
                    <CardContent><div className="flex justify-between items-center mb-4"><span className="text-xs font-bold text-slate-500 uppercase">{budget.items.length} itens</span><span className="font-bold text-slate-900">{budget.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div><Button variant="outline" className="w-full justify-between group-hover:border-amber-500 group-hover:text-amber-600" onClick={() => { setViewingBudget(budget); setViewMode('view'); }}>Visualizar Detalhes<ChevronRight size={16} /></Button></CardContent>
                  </Card>
                ))}
                {budgets.length === 0 && <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200"><FileText className="mx-auto text-slate-300 mb-4" size={48} /><p className="text-slate-500">Nenhum orçamento encontrado.</p></div>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default LuzarteBudgets;