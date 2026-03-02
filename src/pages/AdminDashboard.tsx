"use client";

import React from 'react';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Truck, 
  MapPin, 
  LogOut, 
  ChevronRight,
  Database,
  Settings,
  Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { showSuccess } from '@/utils/toast';
import { useAuth } from '@/components/AuthProvider';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    showSuccess("Sessão encerrada.");
  };

  const ToolCard = ({ title, description, icon: Icon, href }: { title: string, description: string, icon: any, href?: string }) => (
    <Card className="hover:shadow-md transition-all cursor-pointer group border-slate-200">
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className="bg-amber-50 p-2 rounded-lg group-hover:bg-amber-500 transition-colors">
          <Icon className="text-amber-600 group-hover:text-white transition-colors" size={24} />
        </div>
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="mb-4">{description}</CardDescription>
        {href ? (
          <Link to={href}>
            <Button variant="outline" className="w-full justify-between group-hover:border-amber-500 group-hover:text-amber-600">
              Acessar Ferramenta
              <ChevronRight size={16} />
            </Button>
          </Link>
        ) : (
          <Button variant="outline" className="w-full justify-between group-hover:border-amber-500 group-hover:text-amber-600">
            Acessar Ferramenta
            <ChevronRight size={16} />
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white hidden lg:flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Midas Log" className="h-10 w-auto brightness-0 invert" />
            <span className="font-bold tracking-tight">MIDAS ADM</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Menu Principal</div>
          <a href="#" className="flex items-center gap-3 px-4 py-2 bg-amber-600 rounded-lg text-white">
            <LayoutDashboard size={20} />
            Dashboard
          </a>
          <Link to="/" className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
            <Home size={20} />
            Voltar ao Site
          </Link>
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
            <Database size={20} />
            Base de Dados
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
            <Settings size={20} />
            Configurações
          </a>
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-red-900/20"
            onClick={handleLogout}
          >
            <LogOut size={20} />
            Sair do Sistema
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Painel de Logística</h1>
            <p className="text-slate-500">Gerencie suas operações e processe dados de transporte.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-slate-900">{user?.user_metadata?.full_name || 'Administrador'}</p>
              <p className="text-xs text-slate-500">Midas Logística</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold">
              ADM
            </div>
          </div>
        </header>

        <Tabs defaultValue="hidracor" className="space-y-8">
          <TabsList className="bg-white border border-slate-200 p-1 h-12">
            <TabsTrigger value="hidracor" className="px-8 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
              HIDRACOR
            </TabsTrigger>
            <TabsTrigger value="cerbras" className="px-8 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
              CERBRAS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hidracor" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <ToolCard 
                title="Formatar Carteira Hidracor" 
                description="Upload de planilha base para formatação automática de acordo com os parâmetros da Hidracor."
                icon={FileSpreadsheet}
                href="/admin/hidracor-formatter"
              />
              <ToolCard 
                title="Cargas Externas Hidracor" 
                description="Análise e processamento de dados de cargas externas para integração logística."
                icon={Truck}
                href="/admin/external-loads"
              />
            </div>
          </TabsContent>

          <TabsContent value="cerbras" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <ToolCard 
                title="Formatar Carteira Cerbras" 
                description="Processamento de dados da carteira Cerbras com saída em planilha formatada."
                icon={FileSpreadsheet}
                href="/admin/cerbras-formatter"
              />
              <ToolCard 
                title="Pesos por Cidade" 
                description="Cálculo e análise de distribuição de pesos por região e cidade para a Cerbras."
                icon={MapPin}
                href="/admin/cerbras-weights"
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;