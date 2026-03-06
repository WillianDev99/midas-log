"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Edit2, 
  Upload, 
  Loader2, 
  Users, 
  UserSquare2, 
  Package,
  Search,
  FileUp,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';

const LuzarteBaseData = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [c, s] = await Promise.all([
        supabase.from('luzarte_clients').select('*').order('razao_social'),
        supabase.from('luzarte_sellers').select('*').order('name')
      ]);
      setClients(c.data || []);
      setSellers(s.data || []);
    } catch (error: any) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Gestão de Clientes
  const addClient = async () => {
    const razao = prompt("Razão Social:");
    if (!razao) return;
    const cnpj = prompt("CNPJ:");
    const cidade = prompt("Cidade:");
    const estado = prompt("Estado (UF):");
    const tabela = prompt("Tabela de Preços (Ex: TABELA 1):");

    const { data, error } = await supabase.from('luzarte_clients').insert([{
      user_id: user?.id,
      razao_social: razao.toUpperCase(),
      cnpj,
      cidade: cidade?.toUpperCase(),
      estado: estado?.toUpperCase(),
      tabela_precos: tabela?.toUpperCase() || 'PADRÃO'
    }]).select();

    if (error) showError(error.message);
    else { setClients([...clients, data[0]]); showSuccess("Cliente adicionado!"); }
  };

  const deleteClient = async (id: string) => {
    if (!confirm("Excluir cliente?")) return;
    const { error } = await supabase.from('luzarte_clients').delete().eq('id', id);
    if (error) showError(error.message);
    else setClients(clients.filter(c => c.id !== id));
  };

  // Gestão de Vendedores
  const addSeller = async () => {
    const name = prompt("Nome do Vendedor:");
    if (!name) return;
    const phone = prompt("Telefone:");

    const { data, error } = await supabase.from('luzarte_sellers').insert([{
      user_id: user?.id,
      name: name.toUpperCase(),
      phone
    }]).select();

    if (error) showError(error.message);
    else { setSellers([...sellers, data[0]]); showSuccess("Vendedor adicionado!"); }
  };

  const deleteSeller = async (id: string) => {
    if (!confirm("Excluir vendedor?")) return;
    const { error } = await supabase.from('luzarte_sellers').delete().eq('id', id);
    if (error) showError(error.message);
    else setSellers(sellers.filter(s => s.id !== id));
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 lg:px-8 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Base Técnica Luzarte</h1>
            <p className="text-slate-500 text-xs">Gerencie clientes e vendedores para orçamentos.</p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-8 max-w-6xl mx-auto w-full">
        <Tabs defaultValue="clients" className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="clients" className="gap-2"><Users size={16} /> Clientes</TabsTrigger>
            <TabsTrigger value="sellers" className="gap-2"><UserSquare2 size={16} /> Vendedores</TabsTrigger>
          </TabsList>

          <TabsContent value="clients">
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Clientes Luzarte</CardTitle>
                  <CardDescription>Lista de clientes cadastrados para emissão de orçamentos.</CardDescription>
                </div>
                <Button onClick={addClient} className="bg-amber-600 hover:bg-amber-700 gap-2">
                  <Plus size={16} /> Novo Cliente
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Razão Social</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Tabela</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map(client => (
                      <TableRow key={client.id}>
                        <TableCell className="font-bold uppercase">{client.razao_social}</TableCell>
                        <TableCell>{client.cnpj}</TableCell>
                        <TableCell>{client.cidade}/{client.estado}</TableCell>
                        <TableCell><span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold">{client.tabela_precos}</span></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteClient(client.id)}>
                            <Trash2 size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {clients.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">Nenhum cliente cadastrado.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sellers">
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Vendedores</CardTitle>
                  <CardDescription>Equipe de vendas Luzarte.</CardDescription>
                </div>
                <Button onClick={addSeller} className="bg-amber-600 hover:bg-amber-700 gap-2">
                  <Plus size={16} /> Novo Vendedor
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sellers.map(seller => (
                      <TableRow key={seller.id}>
                        <TableCell className="font-bold uppercase">{seller.name}</TableCell>
                        <TableCell>{seller.phone || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteSeller(seller.id)}>
                            <Trash2 size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {sellers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-slate-500">Nenhum vendedor cadastrado.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default LuzarteBaseData;