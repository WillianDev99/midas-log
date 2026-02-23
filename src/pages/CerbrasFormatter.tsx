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
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings2,
  Calculator,
  Filter,
  ChevronUp,
  Search,
  FileUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import * as XLSX from 'xlsx';
import { Link } from 'react-router-dom';

interface CerbrasProduct {
  id: string;
  product_name: string;
  unit_m2: number;
  unit_peso: number;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc' | null;
};

const CerbrasFormatter = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<CerbrasProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [importingBase, setImportingBase] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(true);
  const [formattedData, setFormattedData] = useState<any[]>([]);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });
  const [searchTerm, setSearchTerm] = useState("");

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const baseInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('cerbras_products')
        .select('*')
        .order('product_name');
      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
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

  const addProduct = async () => {
    const name = prompt("Nome do Produto:");
    if (!name) return;
    const m2 = parseFloat(prompt("M² por Palete:")?.replace(',', '.') || "0");
    const peso = parseFloat(prompt("Peso por Palete:")?.replace(',', '.') || "0");

    const { data, error } = await supabase
      .from('cerbras_products')
      .insert([{ 
        product_name: name.toUpperCase(), 
        unit_m2: m2, 
        unit_peso: peso,
        user_id: user?.id 
      }])
      .select();

    if (error) showError(error.message);
    else {
      setProducts([...products, data[0]]);
      showSuccess("Produto adicionado!");
    }
  };

  const editProduct = async (product: CerbrasProduct) => {
    const name = prompt("Nome do Produto:", product.product_name);
    if (!name) return;
    const m2 = parseFloat(prompt("M² por Palete:", product.unit_m2.toString())?.replace(',', '.') || "0");
    const peso = parseFloat(prompt("Peso por Palete:", product.unit_peso.toString())?.replace(',', '.') || "0");

    const { error } = await supabase
      .from('cerbras_products')
      .update({ 
        product_name: name.toUpperCase(), 
        unit_m2: m2, 
        unit_peso: peso 
      })
      .eq('id', product.id);

    if (error) showError(error.message);
    else {
      setProducts(products.map(p => p.id === product.id ? { ...p, product_name: name.toUpperCase(), unit_m2: m2, unit_peso: peso } : p));
      showSuccess("Produto atualizado!");
    }
  };

  const handleBaseImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingBase(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rawData.length < 2) throw new Error("Planilha de base vazia.");

        const newProducts = rawData.slice(1).map(row => ({
          product_name: String(row[0] || '').toUpperCase().trim(),
          unit_m2: parseFloat(String(row[1] || '0').replace(',', '.')),
          unit_peso: parseFloat(String(row[2] || '0').replace(',', '.')),
          user_id: user?.id
        })).filter(p => p.product_name !== "");

        const { error } = await supabase.from('cerbras_products').insert(newProducts);
        if (error) throw error;

        showSuccess(`${newProducts.length} produtos importados com sucesso!`);
        fetchProducts();
      } catch (error: any) {
        showError("Erro na importação: " + error.message);
      } finally {
        setImportingBase(false);
        if (baseInputRef.current) baseInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Excluir este produto da base?")) return;
    const { error } = await supabase.from('cerbras_products').delete().eq('id', id);
    if (error) showError(error.message);
    else {
      setProducts(products.filter(p => p.id !== id));
      showSuccess("Produto removido!");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      processCerbrasWallet(rawData);
    };
    reader.readAsBinaryString(file);
  };

  const processCerbrasWallet = (rows: any[][]) => {
    setProcessing(true);
    if (rows.length < 2) {
      showError("Arquivo inválido.");
      setProcessing(false);
      return;
    }

    const getIdx = (letter: string) => letter.charCodeAt(0) - 65;

    const formatted = rows.slice(1)
      .filter(row => {
        const uf = String(row[getIdx('F')] || '').trim().toUpperCase();
        return uf !== "" && uf !== "UF";
      })
      .map((row) => {
        const productName = String(row[getIdx('I')] || '').toUpperCase().trim();
        const palet = parseFloat(String(row[getIdx('P')] || '0').replace(',', '.'));
        const valUni = parseFloat(String(row[getIdx('K')] || '0').replace(',', '.'));
        
        const productBase = products.find(p => p.product_name === productName);
        const m2 = productBase ? palet * productBase.unit_m2 : 0;
        const peso = productBase ? palet * productBase.unit_peso : 0;
        const valTot = m2 * valUni;

        return {
          'DATA': excelDateToJSDate(row[getIdx('G')]),
          'CLIENTE': row[getIdx('A')],
          'CNPJ': row[getIdx('C')],
          'CIDADE': row[getIdx('D')],
          'UF': row[getIdx('F')],
          'PEDIDO': row[getIdx('H')],
          'COM': row[getIdx('T')],
          'FIN': row[getIdx('V')],
          'EXP': row[getIdx('U')],
          'INI RES': excelDateToJSDate(row[getIdx('R')]),
          'FIM RES': excelDateToJSDate(row[getIdx('S')]),
          'PRODUTO': productName,
          'PALET': palet,
          'M²': m2,
          'PESO': peso,
          'LOTE': row[getIdx('M')],
          'VAL UNI': valUni,
          'VAL TOT': valTot
        };
      });

    setFormattedData(formatted);
    setProcessing(false);
    setIsUploadOpen(false);
    showSuccess("Carteira Cerbras formatada!");
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
    const cols = ['PALET', 'M²', 'PESO', 'VAL UNI', 'VAL TOT'];
    return filteredData.reduce((acc, row) => {
      cols.forEach(col => acc[col] = (acc[col] || 0) + (parseFloat(row[col]) || 0));
      return acc;
    }, {} as Record<string, number>);
  }, [filteredData]);

  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Aba DADOS
    const dadosWs = XLSX.utils.json_to_sheet(products.map(p => ({
      'PRODUTO': p.product_name,
      'M2_UNIT': p.unit_m2,
      'PESO_UNIT': p.unit_peso
    })));
    XLSX.utils.book_append_sheet(wb, dadosWs, "DADOS");

    // Aba Principal
    const mainWs = XLSX.utils.json_to_sheet(filteredData);
    
    // Inserir Fórmulas Dinâmicas
    const range = filteredData.length + 1;
    for(let i = 2; i <= range; i++) {
      const prodCell = `L${i}`;
      const paletCell = `M${i}`;
      const m2Cell = `N${i}`;
      const pesoCell = `O${i}`;
      const valUniCell = `Q${i}`;
      const valTotCell = `R${i}`;

      // M² = PALET * VLOOKUP(PRODUTO, DADOS!A:C, 2, FALSE)
      mainWs[m2Cell] = { f: `${paletCell}*IFERROR(VLOOKUP(${prodCell},DADOS!$A:$C,2,FALSE),0)` };
      // PESO = PALET * VLOOKUP(PRODUTO, DADOS!A:C, 3, FALSE)
      mainWs[pesoCell] = { f: `${paletCell}*IFERROR(VLOOKUP(${prodCell},DADOS!$A:$C,3,FALSE),0)` };
      // VAL TOT = M² * VAL UNI
      mainWs[valTotCell] = { f: `${m2Cell}*${valUniCell}` };
    }

    // Adicionar Linha de SUBTOTAL (Dinâmica com filtros do Excel)
    const subtotalRow = range + 1;
    const colsToSum = ['M', 'N', 'O', 'Q', 'R'];
    colsToSum.forEach(col => {
      const cell = `${col}${subtotalRow}`;
      mainWs[cell] = { f: `SUBTOTAL(9,${col}2:${col}${range})` };
    });

    // Adicionar label "SUBTOTAL"
    mainWs[`L${subtotalRow}`] = { v: "SUBTOTAL:" };

    XLSX.utils.book_append_sheet(wb, mainWs, "Carteira Cerbras");
    XLSX.writeFile(wb, `CARTEIRA_CERBRAS_${new Date().toLocaleDateString()}.xlsx`);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <header className="max-w-full mx-auto w-full flex justify-between items-center p-4 lg:px-8 bg-white border-b shadow-sm z-50">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft /></Button>
          </Link>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Midas Log" className="h-10 w-auto" />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-slate-900">Formatar Carteira Cerbras</h1>
              <p className="text-slate-500 text-xs">Processamento com busca em base técnica de produtos.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {formattedData.length > 0 && !isUploadOpen && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsUploadOpen(true)}
              className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              <RefreshCw size={14} /> 
              Novo Upload
            </Button>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-amber-200 hover:bg-amber-50">
                <Settings2 size={16} /> <span className="hidden sm:inline">Base de Produtos (DADOS)</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
              <SheetHeader className="mb-6">
                <SheetTitle>Base Técnica Cerbras</SheetTitle>
                <SheetDescription>Gerencie M² e Peso unitário por palete de cada produto.</SheetDescription>
              </SheetHeader>
              
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 justify-between items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2 top-2.5 text-slate-400" size={14} />
                    <Input 
                      placeholder="Buscar produto..." 
                      className="pl-8 h-9 text-xs"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <input type="file" className="hidden" ref={baseInputRef} accept=".xlsx, .xls" onChange={handleBaseImport} />
                    <Button size="sm" variant="outline" onClick={() => baseInputRef.current?.click()} disabled={importingBase} className="h-9 gap-1 border-slate-200">
                      {importingBase ? <Loader2 className="animate-spin" size={14} /> : <FileUp size={14} />}
                      Importar Excel
                    </Button>
                    <Button size="sm" onClick={addProduct} className="h-9 bg-amber-600 hover:bg-amber-700">
                      <Plus size={14} /> Novo
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[10px] uppercase">Produto</TableHead>
                        <TableHead className="text-[10px] uppercase">M²</TableHead>
                        <TableHead className="text-[10px] uppercase">Peso</TableHead>
                        <TableHead className="w-[80px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.filter(p => p.product_name.includes(searchTerm.toUpperCase())).map(product => (
                        <TableRow key={product.id}>
                          <TableCell className="text-[10px] font-bold uppercase">{product.product_name}</TableCell>
                          <TableCell className="text-[10px]">{product.unit_m2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-[10px]">{product.unit_peso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-600" onClick={() => editProduct(product)}>
                                <Edit2 size={12} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => deleteProduct(product.id)}>
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {formattedData.length > 0 && (
            <Button onClick={downloadExcel} size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-2">
              <Download size={16} /> <span className="hidden sm:inline">Baixar Excel</span>
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 lg:p-6 gap-4 overflow-hidden">
        <Collapsible open={isUploadOpen} onOpenChange={setIsUploadOpen} className="w-full">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-lg">Upload da Carteira Cerbras</CardTitle>
                <CardDescription>Selecione o arquivo data.xlsx para processamento.</CardDescription>
              </div>
              {formattedData.length > 0 && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronUp className={`transition-transform ${isUploadOpen ? "" : "rotate-180"}`} size={18} /> 
                    {isUploadOpen ? "Recolher" : "Expandir"}
                  </Button>
                </CollapsibleTrigger>
              )}
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pb-6">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-3 text-slate-400" />
                      <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Clique para upload</span></p>
                    </div>
                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                  </label>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {formattedData.length > 0 && (
          <Card className="border-none shadow-sm overflow-hidden flex flex-col flex-1">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-50/50 border-b gap-4 py-3">
              <div className="flex items-center gap-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter size={18} className="text-amber-600" /> Preview Cerbras
                </CardTitle>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">
                  {filteredData.length} registros
                </span>
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
              <div style={{ width: '3000px', height: '1px' }} />
            </div>

            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
              <div ref={tableScrollRef} onScroll={handleTableScroll} className="flex-1 overflow-auto">
                <div className="min-w-[3000px]">
                  <Table>
                    <TableHeader className="bg-white sticky top-0 z-30 shadow-sm">
                      <TableRow>
                        {Object.keys(formattedData[0]).map(col => (
                          <TableHead key={col} className="w-[180px] py-4 px-4 bg-white">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between cursor-pointer hover:text-amber-600 transition-colors" onClick={() => handleSort(col)}>
                                <span className="text-[10px] font-bold uppercase text-slate-500">{col}</span>
                                <ArrowUpDown size={12} className="text-slate-300" />
                              </div>
                              <Input 
                                placeholder={`Filtrar...`} 
                                className="h-7 text-[10px] bg-slate-50 border-slate-200" 
                                onChange={(e) => setColumnFilters({...columnFilters, [col]: e.target.value})} 
                              />
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((row, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50/50">
                          {Object.keys(row).map(col => (
                            <TableCell key={col} className="text-[11px] py-2 px-4 border-r last:border-0">
                              <span className="block truncate max-w-[160px]">
                                {typeof row[col] === 'number' ? row[col].toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : row[col]}
                              </span>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-100 font-bold">
                        {Object.keys(formattedData[0]).map(col => (
                          <TableCell key={col} className="text-[11px] py-2 px-4 border-r last:border-0">
                            {totals[col] !== undefined ? totals[col].toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                            {col === 'PRODUTO' ? 'SUBTOTAL:' : ''}
                          </TableCell>
                        ))}
                      </TableRow>
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

export default CerbrasFormatter;