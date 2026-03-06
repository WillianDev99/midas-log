"use client";

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Truck, 
  Trash2, 
  Eye, 
  Calendar, 
  Package, 
  Loader2,
  Search,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Link, useNavigate } from 'react-router-dom';

const HidracorLoadsList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchLoads();
  }, []);

  const fetchLoads = async () => {
    try {
      const { data, error } = await supabase
        .from('hidracor_saved_loads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLoads(data || []);
    } catch (error: any) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteLoad = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta carga permanentemente?")) return;
    
    const { error } = await supabase.from('hidracor_saved_loads').delete().eq('id', id);
    if (error) showError(error.message);
    else {
      setLoads(loads.filter(l => l.id !== id));
      showSuccess("Carga excluída!");
    }
  };

  const filteredLoads = loads.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link to="/admin/hidracor-formatter">
              <Button variant="ghost" size="icon"><ArrowLeft /></Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Minhas Cargas</h1>
              <p className="text-slate-500">Gerencie as cargas criadas a partir da carteira Hidracor.</p>
            </div>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <Input 
              placeholder="Buscar carga..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLoads.map(load => (
            <Card key={load.id} className="hover:shadow-md transition-all border-slate-200 group">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="bg-amber-100 p-2 rounded-lg text-amber-700">
                    <Truck size={24} />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-slate-400 hover:text-red-600"
                    onClick={() => deleteLoad(load.id)}
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
                <CardTitle className="mt-4 text-xl">{load.name}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Calendar size={14} /> {new Date(load.created_at).toLocaleDateString('pt-BR')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-slate-600 mb-6">
                  <div className="flex items-center gap-1">
                    <Package size={16} className="text-amber-600" />
                    <span className="font-bold">{load.items.length}</span> itens
                  </div>
                </div>
                <Link to={`/admin/hidracor-loads/${load.id}`}>
                  <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white justify-between">
                    Gerenciar Embarques
                    <ChevronRight size={16} />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}

          {filteredLoads.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-xl border-2 border-dashed border-slate-200">
              <Truck className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-500">Nenhuma carga encontrada.</p>
              <Link to="/admin/hidracor-formatter">
                <Button variant="link" className="text-amber-600">Criar nova carga</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HidracorLoadsList;