"use client";

import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MoveHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import * as XLSX from 'xlsx';
import { Link } from 'react-router-dom';

interface Route {
  id: string;
  name: string;
}

interface City {
  id: string;
  route_id: string;
  city_name: string;
}

const HidracorFormatter = () => {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Estados para a Carteira
  const [rawWalletData, setRawWalletData] = useState<any[]>([]);
  const [formattedData, setFormattedData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBaseData();
  }, []);

  const fetchBaseData = async () => {
    try {
      const { data: routesData } = await supabase
        .from('hidracor_routes')
        .select('*')
        .order('name');
      
      const { data: citiesData } = await supabase
        .from('hidracor_cities')
        .select('*')
        .order('city_name');

      setRoutes(routesData || []);
      setCities(citiesData || []);
    } catch (error) {
      showError("Erro ao carregar base de dados.");
    } finally {
      setLoading(false);
    }
  };

  // --- Lógica de Gestão da Base ---
  const addRoute = async () => {
    const name = prompt("Nome da nova rota:");
    if (!name) return;
    const { data, error } = await supabase
      .from('hidracor_routes')
      .insert([{ name, user_id: user?.id }])
      .select();
    if (error) showError(error.message);
    else {
      setRoutes([...routes, data[0]]);
      showSuccess("Rota adicionada!");
    }
  };

  const addCity = async (routeId: string) => {
    const cityName = prompt("Nome da cidade:");
    if (!cityName) return;
    const { data, error } = await supabase
      .from('hidracor_cities')
      .insert([{ route_id: routeId, city_name: cityName.toUpperCase(), user_id: user?.id }])
      .select();
    if (error) showError(error.message);
    else {
      setCities([...cities, data[0]]);
      showSuccess("Cidade adicionada!");
    }
  };

  const deleteCity = async (id: string) => {
    if (!confirm("Excluir esta cidade?")) return;
    const { error } = await supabase.from('hidracor_cities').delete().eq('id', id);
    if (error) showError(error.message);
    else setCities(cities.filter(c => c.id !== id));
  };

  // --- Lógica de Processamento da Carteira ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setRawWalletData(data);
      processWallet(data);
    };
    reader.readAsBinaryString(file);
  };

  const processWallet = (data: any[]) => {
    setProcessing(true);
    // Mapeamento de cidade -> rota para busca rápida
    const cityToRouteMap: Record<string, string> = {};
    cities.forEach(c => {
      const route = routes.find(r => r.id === c.route_id);
      if (route) cityToRouteMap[c.city_name.toUpperCase()] = route.name;
    });

    const formatted = data.map(row => {
      // Tenta encontrar a cidade na linha (ajuste o nome da coluna conforme seu CARTEIRA.xlsx)
      const cityInRow = (row['Cidade'] || row['CIDADE'] || '').toString().toUpperCase().trim();
      return {
        ...row,
        'ROTA': cityToRouteMap[cityInRow] || 'NÃO ENCONTRADA'
      };
    });

    setFormattedData(formatted);
    setProcessing(false);
    showSuccess("Carteira processada com sucesso!");
  };

  const handleCellEdit = (index: number, field: string, value: string) => {
    const newData = [...formattedData];
    newData[index][field] = value;
    setFormattedData(newData);
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Carteira Formatada");
    XLSX.writeFile(wb, `CARTEIRA_HIDRACOR_FORMATADA_${new Date().toLocaleDateString()}.xlsx`);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <header className="max-w-7xl mx-auto flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Formatar Carteira Hidracor</h1>
            <p className="text-slate-500 text-sm">Gerencie sua base e processe planilhas.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {formattedData.length > 0 && (
            <Button onClick={downloadExcel} className="bg-green-600 hover:bg-green-700 text-white gap-2">
              <Download size={18} /> Baixar Excel
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-8">
        {/* Coluna da Esquerda: Gestão da Base */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Base de Rotas</CardTitle>
                <Button size="sm" variant="outline" onClick={addRoute} className="h-8 gap-1">
                  <Plus size={14} /> Rota
                </Button>
              </div>
              <CardDescription>Cidades organizadas por rota.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {routes.map(route => (
                    <div key={route.id} className="border rounded-lg p-3 bg-white">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-amber-700 text-sm uppercase">{route.name}</span>
                        <Button size="sm" variant="ghost" onClick={() => addCity(route.id)} className="h-7 w-7 p-0">
                          <Plus size={14} />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cities.filter(c => c.route_id === route.id).map(city => (
                          <div key={city.id} className="group flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200">
                            {city.city_name}
                            <button onClick={() => deleteCity(city.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Coluna da Direita: Processamento */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Upload da Carteira</CardTitle>
              <CardDescription>Selecione o arquivo CARTEIRA.xlsx para formatar.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-3 text-slate-400" />
                    <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Clique para upload</span> ou arraste o arquivo</p>
                    <p className="text-xs text-slate-400">XLSX, XLS (Máx. 10MB)</p>
                  </div>
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                </label>
              </div>
            </CardContent>
          </Card>

          {formattedData.length > 0 && (
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Preview da Carteira</CardTitle>
                  <CardDescription>{formattedData.length} linhas processadas.</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 text-slate-400" size={16} />
                  <Input 
                    placeholder="Filtrar preview..." 
                    className="pl-8 h-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-[150px]">Rota</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Peso</TableHead>
                        <TableHead>Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formattedData
                        .filter(row => 
                          Object.values(row).some(val => 
                            val?.toString().toLowerCase().includes(searchTerm.toLowerCase())
                          )
                        )
                        .slice(0, 100) // Limitamos o preview para performance
                        .map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Input 
                              value={row['ROTA']} 
                              onChange={(e) => handleCellEdit(idx, 'ROTA', e.target.value)}
                              className={`h-8 text-xs font-bold ${row['ROTA'] === 'NÃO ENCONTRADA' ? 'text-red-500 border-red-200' : 'text-amber-700'}`}
                            />
                          </TableCell>
                          <TableCell className="text-xs">{row['Cidade'] || row['CIDADE']}</TableCell>
                          <TableCell className="text-xs truncate max-w-[200px]">{row['Cliente'] || row['NOME']}</TableCell>
                          <TableCell className="text-xs">{row['Peso'] || row['PESO']}</TableCell>
                          <TableCell className="text-xs">{row['Valor'] || row['VALOR']}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {formattedData.length > 100 && (
                    <div className="p-4 text-center text-xs text-slate-500 bg-slate-50">
                      Exibindo as primeiras 100 linhas. O arquivo final conterá todas as {formattedData.length} linhas.
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default HidracorFormatter;