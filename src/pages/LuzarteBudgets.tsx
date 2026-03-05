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
  Check
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';

interface LuzarteClient {
  id: string;
  razao_social: string;
  cnpj: string;
  cidade: string;
  estado: string;
  tabela_precos: string;
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
}

const ESTADOS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

const LuzarteBudgets = () => {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [clients, setClients] = useState<LuzarteClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'form' | 'view'>('list');
  const [priceBase, setPriceBase] = useState<Record<string, any[]>>({});
  
  // Form State
  const [budgetName, setBudgetName] = useState("");
  const [selectedClient, setSelectedClient] = useState<LuzarteClient | null>(null);
  const [sellerName, setSellerName] = useState("");
  const [paymentTerm, setPaymentTerm] = useState("30/45/60");
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [viewingBudget, setViewingBudget] = useState<any>(null);

  // Client Registration State
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [citiesList, setCitiesList] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [newClient, setNewClient] = useState({
    razao_social: "",
    cnpj: "",
    cidade: "",
    estado: "CE",
    tabela_precos: "ATACADO"
  });

  useEffect(() => {
    fetchData();
    loadPriceBase();
  }, []);

  // Busca cidades do IBGE quando o estado muda
  useEffect(() => {
    const fetchCities = async () => {
      if (!newClient.estado) return;
      setLoadingCities(true);
      try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${newClient.estado}/municipios`);
        const data = await response.json();
        setCitiesList(data.map((c: any) => c.nome).sort());
        // Reseta a cidade se ela não pertencer ao novo estado
        setNewClient(prev => ({ ...prev, cidade: "" }));
      } catch (error) {
        console.error("Erro ao buscar cidades:", error);
      } finally {
        setLoadingCities(false);
      }
    };
    fetchCities();
  }, [newClient.estado]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, cRes] = await Promise.all([
        supabase.from('luzarte_budgets').select('*, luzarte_clients(*)').order('created_at', { ascending: false }),
        supabase.from('luzarte_clients').select('*').order('razao_social')
      ]);
      setBudgets(bRes.data || []);
      setClients(cRes.data || []);
    } catch (error: any) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPriceBase = async () => {
    try {
      const response = await fetch('/LUZARTE_BASE.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      const base: Record<string, any[]> = {};
      
      workbook.SheetNames.forEach(name => {
        const sheet = workbook.Sheets[name];
        base[name.toUpperCase()] = XLSX.utils.sheet_to_json(sheet);
      });
      setPriceBase(base);
    } catch (error) {
      console.error("Erro ao carregar base de preços:", error);
    }
  };

  const handleRegisterClient = async () => {
    if (!newClient.razao_social || !newClient.cnpj || !newClient.cidade) {
      showError("Preencha os campos obrigatórios.");
      return;
    }
    try {
      const { data, error } = await supabase.from('luzarte_clients').insert([{
        ...newClient,
        user_id: user?.id
      }]).select().single();
      
      if (error) throw error;
      setClients([...clients, data]);
      setSelectedClient(data);
      setIsClientDialogOpen(false);
      setNewClient({ razao_social: "", cnpj: "", cidade: "", estado: "CE", tabela_precos: "ATACADO" });
      showSuccess("Cliente cadastrado com sucesso!");
    } catch (error: any) {
      showError(error.message);
    }
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
      quantidade: 1
    };
    setItems([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof BudgetItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      // Se mudar o produto, limpa os campos dependentes
      if (field === 'produto') {
        updated.forma = "";
        updated.cor = "";
        updated.litros = "";
        updated.valor = 0;
      }

      // Lógica de preenchimento automático de valor
      if (selectedClient && updated.produto && updated.cor) {
        const table = selectedClient.tabela_precos.toUpperCase();
        const data = priceBase[table] || [];
        
        const match = data.find(row => 
          String(row.NOME || '').toUpperCase() === updated.produto.toUpperCase() &&
          String(row.COR || '').toUpperCase() === updated.cor.toUpperCase() &&
          (updated.litros ? String(row.LITROS || '').toUpperCase() === updated.litros.toUpperCase() : true) &&
          (updated.forma ? String(row.FORMA || '').toUpperCase() === updated.forma.toUpperCase() : true)
        );

        if (match) {
          updated.valor = typeof match.VALOR === 'number' ? match.VALOR : parseFloat(String(match.VALOR).replace('R$', '').replace('.', '').replace(',', '.').trim()) || 0;
        }
      }
      
      return updated;
    }));
  };

  const saveBudget = async () => {
    if (!selectedClient || !sellerName || items.length === 0) {
      showError("Preencha todos os campos obrigatórios.");
      return;
    }

    const total = items.reduce((acc, item) => acc + (item.valor * item.quantidade), 0);
    const budgetData = {
      user_id: user?.id,
      name: budgetName || `Orçamento ${selectedClient.razao_social}`,
      client_id: selectedClient.id,
      seller_name: sellerName,
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
    } catch (error: any) {
      showError(error.message);
    }
  };

  const copyBudget = (budget: any) => {
    setBudgetName(`CÓPIA - ${budget.name}`);
    setSelectedClient(budget.luzarte_clients);
    setSellerName(budget.seller_name);
    setPaymentTerm(budget.payment_term);
    setItems(budget.items.map((item: any) => ({ ...item, id: Math.random().toString(36).substr(2, 9) })));
    setEditingBudgetId(null);
    setViewMode('form');
    showSuccess("Cópia criada! Você pode renomear e ajustar os itens.");
  };

  const editBudget = (budget: any) => {
    setBudgetName(budget.name);
    setSelectedClient(budget.luzarte_clients);
    setSellerName(budget.seller_name);
    setPaymentTerm(budget.payment_term);
    setItems(budget.items);
    setEditingBudgetId(budget.id);
    setViewMode('form');
  };

  const deleteBudget = async (id: string) => {
    if (!confirm("Excluir este orçamento permanentemente?")) return;
    try {
      await supabase.from('luzarte_budgets').delete().eq('id', id);
      setBudgets(budgets.filter(b => b.id !== id));
      showSuccess("Orçamento excluído.");
    } catch (error: any) {
      showError(error.message);
    }
  };

  const availableProducts = useMemo(() => {
    if (!selectedClient) return [];
    const table = selectedClient.tabela_precos.toUpperCase();
    const data = priceBase[table] || [];
    return Array.from(new Set(data.map(row => String(row.NOME || '').toUpperCase()))).sort();
  }, [selectedClient, priceBase]);

  const getOptionsForProduct = (item: BudgetItem, field: 'COR' | 'LITROS' | 'FORMA') => {
    if (!selectedClient || !item.produto) return [];
    const table = selectedClient.tabela_precos.toUpperCase();
    const data = priceBase[table] || [];
    
    let filtered = data.filter(row => String(row.NOME || '').toUpperCase() === item.produto.toUpperCase());
    
    // Se estivermos buscando Litros, filtramos também pela Cor já selecionada
    if (field === 'LITROS' && item.cor) {
      filtered = filtered.filter(row => String(row.COR || '').toUpperCase() === item.cor.toUpperCase());
    }
    
    // Se estivermos buscando Cor, filtramos pela Forma se já selecionada
    if (field === 'COR' && item.forma) {
      filtered = filtered.filter(row => String(row.FORMA || '').toUpperCase() === item.forma.toUpperCase());
    }

    return Array.from(new Set(filtered
      .map(row => String(row[field] || '').toUpperCase())
      .filter(val => val !== "" && val !== "UNDEFINED")
    )).sort();
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
        {viewMode === 'list' && (
          <Button onClick={() => { setViewMode('form'); setEditingBudgetId(null); setItems([]); setSelectedClient(null); setBudgetName(""); }} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
            <Plus size={18} /> Novo Orçamento
          </Button>
        )}
        {viewMode === 'view' && (
          <Button onClick={() => window.print()} className="bg-slate-900 text-white gap-2">
            <Printer size={18} /> Imprimir (Ctrl+P)
          </Button>
        )}
      </header>

      <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
        {viewMode === 'form' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-none shadow-lg">
              <CardHeader className="bg-slate-900 text-white rounded-t-xl">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>{editingBudgetId ? "Editar Orçamento" : "Novo Orçamento"}</CardTitle>
                    <CardDescription className="text-slate-400">Configure os detalhes da proposta comercial.</CardDescription>
                  </div>
                  <div className="w-72">
                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Nome do Orçamento</label>
                    <Input 
                      placeholder="Ex: Orçamento Obra X" 
                      className="bg-white/10 border-white/20 text-white h-9"
                      value={budgetName}
                      onChange={(e) => setBudgetName(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">Vendedor</label>
                    <Input 
                      placeholder="Nome do vendedor" 
                      value={sellerName} 
                      onChange={(e) => setSellerName(e.target.value)} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">Cliente</label>
                    <div className="flex gap-2">
                      <Select 
                        value={selectedClient?.id} 
                        onValueChange={(id) => setSelectedClient(clients.find(c => c.id === id) || null)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione um cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon" className="shrink-0"><UserPlus size={18} /></Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <label className="text-xs font-bold">Razão Social</label>
                              <Input value={newClient.razao_social} onChange={(e) => setNewClient({...newClient, razao_social: e.target.value.toUpperCase()})} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold">CNPJ</label>
                              <Input value={newClient.cnpj} onChange={(e) => setNewClient({...newClient, cnpj: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-xs font-bold">Estado</label>
                                <Select value={newClient.estado} onValueChange={(v) => setNewClient({...newClient, estado: v})}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {ESTADOS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold">Cidade</label>
                                <Select 
                                  value={newClient.cidade} 
                                  onValueChange={(v) => setNewClient({...newClient, cidade: v})}
                                  disabled={loadingCities || citiesList.length === 0}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={loadingCities ? "Carregando..." : "Selecione a cidade"} />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    {citiesList.map(city => (
                                      <SelectItem key={city} value={city}>{city}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold">Tabela de Preços</label>
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
                          </div>
                          <DialogFooter>
                            <Button onClick={handleRegisterClient} className="bg-amber-600 text-white w-full">Cadastrar Cliente</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">Prazo de Pagamento</label>
                    <Select value={paymentTerm} onValueChange={setPaymentTerm}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30/45/60">30/45/60 DIAS</SelectItem>
                        <SelectItem value="ANTECIPADO">ANTECIPADO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedClient && (
                  <div className="pt-6 border-t space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <Calculator size={18} className="text-amber-600" /> Itens do Orçamento
                      </h3>
                      <Button onClick={addItem} variant="outline" size="sm" className="gap-2">
                        <Plus size={16} /> Adicionar Produto
                      </Button>
                    </div>

                    <div className="border rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="w-[60px]">#</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>Forma</TableHead>
                            <TableHead>Cor</TableHead>
                            <TableHead>Litros</TableHead>
                            <TableHead className="w-[100px]">Qtd</TableHead>
                            <TableHead className="w-[150px]">Valor Unit.</TableHead>
                            <TableHead className="w-[150px]">Subtotal</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item, idx) => {
                            const formas = getOptionsForProduct(item, 'FORMA');
                            const cores = getOptionsForProduct(item, 'COR');
                            const litros = getOptionsForProduct(item, 'LITROS');

                            return (
                              <TableRow key={item.id}>
                                <TableCell className="font-bold text-slate-400">{idx + 1}</TableCell>
                                <TableCell>
                                  <Select value={item.produto} onValueChange={(v) => updateItem(item.id, 'produto', v)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Produto" /></SelectTrigger>
                                    <SelectContent>
                                      {availableProducts.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Select 
                                    value={item.forma} 
                                    onValueChange={(v) => updateItem(item.id, 'forma', v)}
                                    disabled={formas.length === 0}
                                  >
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="-" /></SelectTrigger>
                                    <SelectContent>
                                      {formas.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Select value={item.cor} onValueChange={(v) => updateItem(item.id, 'cor', v)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Cor" /></SelectTrigger>
                                    <SelectContent>
                                      {cores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Select 
                                    value={item.litros} 
                                    onValueChange={(v) => updateItem(item.id, 'litros', v)}
                                    disabled={litros.length === 0}
                                  >
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="-" /></SelectTrigger>
                                    <SelectContent>
                                      {litros.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Input type="number" className="h-8 text-xs" value={item.quantidade} onChange={(e) => updateItem(item.id, 'quantidade', parseInt(e.target.value) || 0)} />
                                </TableCell>
                                <TableCell>
                                  <Input type="number" className="h-8 text-xs font-bold text-blue-600" value={item.valor} onChange={(e) => updateItem(item.id, 'valor', parseFloat(e.target.value) || 0)} />
                                </TableCell>
                                <TableCell className="font-bold text-slate-900">
                                  {(item.valor * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setItems(items.filter(i => i.id !== item.id))}>
                                    <Trash2 size={14} />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-end pt-4">
                      <div className="bg-slate-900 text-white p-4 rounded-xl min-w-[250px]">
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Valor Total do Orçamento</p>
                        <p className="text-2xl font-bold">
                          {items.reduce((acc, item) => acc + (item.valor * item.quantidade), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-slate-50 p-6 flex justify-between border-t">
                <Button variant="ghost" onClick={() => setViewMode('list')}>Cancelar</Button>
                <Button onClick={saveBudget} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
                  <Save size={18} /> {editingBudgetId ? "Atualizar Orçamento" : "Salvar Orçamento"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {viewMode === 'view' && viewingBudget && (
          <div className="animate-in fade-in duration-500">
            <style>{`
              @media print {
                @page { size: portrait; margin: 1cm; }
                body { background: white; }
                .print-hidden { display: none !important; }
                .print-container { width: 100% !important; max-width: none !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
                .print-table th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
                .print-header { border-bottom: 2px solid #f59e0b !important; -webkit-print-color-adjust: exact; }
              }
            `}</style>
            
            <Card className="border-none shadow-xl print-container">
              <CardHeader className="border-b-2 border-amber-500 pb-6 print-header">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <img src="/logo.png" alt="Midas Log" className="h-12 w-auto" />
                    <div>
                      <CardTitle className="text-2xl font-bold text-slate-900 uppercase">{viewingBudget.name}</CardTitle>
                      <CardDescription className="text-slate-500 font-medium">
                        Emitido em: {new Date(viewingBudget.created_at).toLocaleDateString('pt-BR')}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">MIDAS LOGÍSTICA</p>
                    <p className="text-xs text-slate-500">Vendedor: {viewingBudget.seller_name}</p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-8 bg-slate-50 p-6 rounded-xl border border-slate-100">
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Dados do Cliente</h4>
                    <p className="text-lg font-bold text-slate-900">{viewingBudget.luzarte_clients?.razao_social}</p>
                    <p className="text-sm text-slate-600">CNPJ: {viewingBudget.luzarte_clients?.cnpj}</p>
                    <p className="text-sm text-slate-600">{viewingBudget.luzarte_clients?.cidade} - {viewingBudget.luzarte_clients?.estado}</p>
                  </div>
                  <div className="space-y-2 text-right">
                    <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Condições Comerciais</h4>
                    <p className="text-sm font-bold text-slate-900">Prazo: {viewingBudget.payment_term}</p>
                    <p className="text-sm text-slate-600">Tabela: {viewingBudget.luzarte_clients?.tabela_precos}</p>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden">
                  <Table className="print-table">
                    <TableHeader className="bg-slate-100">
                      <TableRow>
                        <TableHead className="w-[50px] font-bold text-slate-900">#</TableHead>
                        <TableHead className="font-bold text-slate-900">Produto</TableHead>
                        <TableHead className="font-bold text-slate-900">Forma</TableHead>
                        <TableHead className="font-bold text-slate-900">Cor</TableHead>
                        <TableHead className="font-bold text-slate-900">Litros</TableHead>
                        <TableHead className="text-center font-bold text-slate-900">Qtd</TableHead>
                        <TableHead className="text-right font-bold text-slate-900">V. Unitário</TableHead>
                        <TableHead className="text-right font-bold text-slate-900">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingBudget.items.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{idx + 1}</TableCell>
                          <TableCell className="font-bold uppercase">{item.produto}</TableCell>
                          <TableCell className="uppercase">{item.forma || '-'}</TableCell>
                          <TableCell className="uppercase">{item.cor}</TableCell>
                          <TableCell className="uppercase">{item.litros || '-'}</TableCell>
                          <TableCell className="text-center font-bold">{item.quantidade}</TableCell>
                          <TableCell className="text-right">
                            {item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {(item.valor * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end">
                  <div className="bg-slate-900 text-white p-6 rounded-2xl min-w-[300px] text-right shadow-lg">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Valor Total da Proposta</p>
                    <p className="text-4xl font-bold">
                      {viewingBudget.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="border-t p-8 flex justify-between items-center bg-slate-50/50">
                <div className="text-[10px] text-slate-400 uppercase font-medium">
                  Este orçamento tem validade de 7 dias a partir da data de emissão.
                </div>
                <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
                  <Check size={16} /> Midas Logística - Eficiência em Movimento
                </div>
              </CardFooter>
            </Card>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="space-y-8">
            <div className="grid md:grid-cols-4 gap-6">
              <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
                      <FileText size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">Total Orçamentos</p>
                      <p className="text-2xl font-bold text-slate-900">{budgets.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <History size={20} className="text-amber-600" /> Histórico de Orçamentos
                </h2>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {budgets.map(budget => (
                  <Card key={budget.id} className="hover:shadow-md transition-all border-slate-200 group">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                          <FileText size={20} />
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => copyBudget(budget)} title="Criar Cópia"><Copy size={16} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" onClick={() => editBudget(budget)} title="Editar"><Edit3 size={16} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteBudget(budget.id)} title="Excluir"><Trash2 size={16} /></Button>
                        </div>
                      </div>
                      <CardTitle className="mt-4 text-lg uppercase truncate">{budget.name || budget.luzarte_clients?.razao_social}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {new Date(budget.created_at).toLocaleDateString('pt-BR')} • {budget.seller_name}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold text-slate-500 uppercase">{budget.items.length} itens</span>
                        <span className="font-bold text-slate-900">{budget.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full justify-between group-hover:border-amber-500 group-hover:text-amber-600"
                        onClick={() => { setViewingBudget(budget); setViewMode('view'); }}
                      >
                        Visualizar Detalhes
                        <ChevronRight size={16} />
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                {budgets.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
                    <FileText className="mx-auto text-slate-300 mb-4" size={48} />
                    <p className="text-slate-500">Nenhum orçamento encontrado.</p>
                    <Button variant="link" className="text-amber-600" onClick={() => setViewMode('form')}>Criar primeiro orçamento</Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default LuzarteBudgets;