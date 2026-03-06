"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Loader2, 
  Search, 
  Calculator,
  User,
  UserSquare2,
  Package,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useParams, Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

interface BudgetItem {
  id: string;
  code: string;
  description: string;
  quantity: number;
  price: number;
  total: number;
}

const LuzarteBudgetForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [budgetName, setBudgetName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedSellerName, setSelectedSellerName] = useState("");
  const [paymentTerm, setPaymentTerm] = useState("30/60/90 DIAS");
  const [items, setItems] = useState<BudgetItem[]>([]);
  
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  const fetchInitialData = async () => {
    try {
      const [c, s] = await Promise.all([
        supabase.from('luzarte_clients').select('*').order('razao_social'),
        supabase.from('luzarte_sellers').select('*').order('name')
      ]);
      
      setClients(c.data || []);
      setSellers(s.data || []);
      
      // Carregar produtos do Excel local
      const response = await fetch('/LUZARTE_BASE.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      const ws = workbook.Sheets[workbook.SheetNames[0]];
      const rawData: any[] = XLSX.utils.sheet_to_json(ws);
      setProducts(rawData);

      if (id && id !== 'new') {
        const { data: budget, error } = await supabase
          .from('luzarte_budgets')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) throw error;
        
        setBudgetName(budget.name || "");
        setSelectedClientId(budget.client_id || "");
        setSelectedSellerName(budget.seller_name || "");
        setPaymentTerm(budget.payment_term || "");
        setItems(budget.items || []);
      }
    } catch (error: any) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const addItem = (product: any) => {
    const newItem: BudgetItem = {
      id: Math.random().toString(36).substr(2, 9),
      code: product.CODIGO || product.Código || "",
      description: product.DESCRICAO || product.Descrição || "",
      quantity: 1,
      price: parseFloat(product.PRECO || product.Preço || 0),
      total: parseFloat(product.PRECO || product.Preço || 0)
    };
    setItems([...items, newItem]);
    setProductSearch("");
    showSuccess("Item adicionado!");
  };

  const updateItem = (id: string, field: keyof BudgetItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'price') {
          updated.total = updated.quantity * updated.price;
        }
        return updated;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const totalValue = useMemo(() => items.reduce((acc, i) => acc + i.total, 0), [items]);

  const handleSave = async () => {
    if (!selectedClientId) return showError("Selecione um cliente.");
    if (items.length === 0) return showError("Adicione pelo menos um item.");

    setSaving(true);
    try {
      const budgetData = {
        user_id: user?.id,
        name: budgetName.toUpperCase() || `ORÇAMENTO ${new Date().toLocaleDateString()}`,
        client_id: selectedClientId,
        seller_name: selectedSellerName,
        payment_term: paymentTerm,
        items: items,
        total_value: totalValue
      };

      if (id && id !== 'new') {
        const { error } = await supabase.from('luzarte_budgets').update(budgetData).eq('id', id);
        if (error) throw error;
        showSuccess("Orçamento atualizado!");
      } else {
        const { error } = await supabase.from('luzarte_budgets').insert([budgetData]);
        if (error) throw error;
        showSuccess("Orçamento criado!");
      }
      navigate('/admin/luzarte-budgets');
    } catch (error: any) {
      showError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch) return [];
    return products.filter(p => 
      String(p.DESCRICAO || p.Descrição || "").toLowerCase().includes(productSearch.toLowerCase()) ||
      String(p.CODIGO || p.Código || "").toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 10);
  }, [productSearch, products]);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 lg:px-8 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/admin/luzarte-budgets">
            <Button variant="ghost" size="icon"><ArrowLeft /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {id === 'new' ? 'Novo Orçamento Luzarte' : 'Editar Orçamento'}
            </h1>
            <p className="text-slate-500 text-xs">Preencha os dados para gerar o documento.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Salvar Orçamento
        </Button>
      </header>

      <main className="flex-1 p-4 lg:p-8 max-w-6xl mx-auto w-full space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Dados do Cabeçalho */}
          <Card className="lg:col-span-1 border-none shadow-sm h-fit">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
                <FileText size={18} className="text-amber-600" /> Informações Gerais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Identificação do Orçamento</Label>
                <Input 
                  placeholder="Ex: OBRA CENTRO" 
                  value={budgetName}
                  onChange={(e) => setBudgetName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><User size={14} /> Cliente</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><UserSquare2 size={14} /> Vendedor</Label>
                <Select value={selectedSellerName} onValueChange={setSelectedSellerName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {sellers.map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Condição de Pagamento</Label>
                <Input 
                  placeholder="Ex: 30/60/90 DIAS" 
                  value={paymentTerm}
                  onChange={(e) => setPaymentTerm(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Itens do Orçamento */}
          <Card className="lg:col-span-2 border-none shadow-sm flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
                <Package size={18} className="text-amber-600" /> Itens do Orçamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 flex-1 flex flex-col">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <Input 
                  placeholder="Pesquisar produto por código ou descrição..." 
                  className="pl-10"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                {filteredProducts.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredProducts.map((p, idx) => (
                      <button
                        key={idx}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b last:border-0 flex justify-between items-center"
                        onClick={() => addItem(p)}
                      >
                        <div>
                          <p className="text-xs font-bold text-amber-600">{p.CODIGO || p.Código}</p>
                          <p className="text-sm font-medium uppercase">{p.DESCRICAO || p.Descrição}</p>
                        </div>
                        <p className="font-bold text-slate-900">
                          {(p.PRECO || p.Preço || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="border rounded-lg overflow-hidden flex-1">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[100px]">Cód.</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[100px]">Qtd.</TableHead>
                      <TableHead className="w-[120px]">Preço</TableHead>
                      <TableHead className="w-[120px]">Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs font-bold">{item.code}</TableCell>
                        <TableCell className="text-xs uppercase">{item.description}</TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            className="h-8 text-xs" 
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            className="h-8 text-xs" 
                            value={item.price}
                            onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-xs font-bold">
                          {item.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeItem(item.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                          Nenhum item adicionado. Use a busca acima para encontrar produtos.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-slate-900 text-white p-6 rounded-xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Calculator className="text-amber-500" size={24} />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Total do Orçamento</p>
                    <p className="text-2xl font-bold">
                      {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Itens</p>
                  <p className="text-xl font-bold">{items.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default LuzarteBudgetForm;