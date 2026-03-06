"use client";

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  FileText, 
  Trash2, 
  Printer, 
  Loader2,
  Calendar,
  User,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Link, useNavigate } from 'react-router-dom';

const LuzarteBudgets = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchBudgets();
  }, []);

  const fetchBudgets = async () => {
    try {
      const { data, error } = await supabase
        .from('luzarte_budgets')
        .select(`
          *,
          luzarte_clients (razao_social, cidade, estado)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBudgets(data || []);
    } catch (error: any) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteBudget = async (id: string) => {
    if (!confirm("Excluir este orçamento permanentemente?")) return;
    const { error } = await supabase.from('luzarte_budgets').delete().eq('id', id);
    if (error) showError(error.message);
    else {
      setBudgets(budgets.filter(b => b.id !== id));
      showSuccess("Orçamento excluído!");
    }
  };

  const filteredBudgets = budgets.filter(b => 
    b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.luzarte_clients?.razao_social?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link to="/admin">
              <Button variant="ghost" size="icon"><ArrowLeft /></Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Orçamentos Luzarte</h1>
              <p className="text-slate-500">Gerencie e emita orçamentos para clientes Luzarte.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <Input 
                placeholder="Buscar orçamento ou cliente..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Link to="/admin/luzarte-budgets/new">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
                <Plus size={18} /> Novo
              </Button>
            </Link>
          </div>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBudgets.map(budget => (
            <Card key={budget.id} className="hover:shadow-md transition-all border-slate-200 group">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="bg-amber-100 p-2 rounded-lg text-amber-700">
                    <FileText size={24} />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-slate-400 hover:text-red-600"
                    onClick={() => deleteBudget(budget.id)}
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
                <CardTitle className="mt-4 text-xl truncate">{budget.name || 'Orçamento sem nome'}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Calendar size={14} /> {new Date(budget.created_at).toLocaleDateString('pt-BR')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <User size={16} className="text-amber-600" />
                    <span className="font-bold uppercase truncate">{budget.luzarte_clients?.razao_social}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 uppercase font-bold">Total:</span>
                    <span className="text-lg font-bold text-amber-700">
                      {budget.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-2 text-xs h-9">
                    <Printer size={14} /> Imprimir
                  </Button>
                  <Link to={`/admin/luzarte-budgets/${budget.id}`} className="flex-1">
                    <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white gap-2 text-xs h-9">
                      Editar <ChevronRight size={14} />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredBudgets.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-xl border-2 border-dashed border-slate-200">
              <FileText className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-500">Nenhum orçamento encontrado.</p>
              <Link to="/admin/luzarte-budgets/new">
                <Button variant="link" className="text-amber-600">Criar primeiro orçamento</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LuzarteBudgets;