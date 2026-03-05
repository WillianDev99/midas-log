"use client";

import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, 
  FileUp, 
  Download, 
  Trash2, 
  Loader2, 
  FileText, 
  Table as TableIcon,
  Plus,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showSuccess, showError } from '@/utils/toast';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

// Configuração do Worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface CollectionItem {
  id: string;
  data: string;
  representacao: string;
  segmento: 'Varejo' | 'Engenharia';
  cliente: string;
  pedido: string;
  produtos: string;
  plt: number;
  m2: number;
  transportadora: 'Midas Log' | 'Cliente retira';
}

const CerbrasCollectionForecast = () => {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [debugText, setDebugText] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item: any) => item.str).join(" ") + "\n";
    }
    return fullText;
  };

  const parseAllOrders = (text: string): CollectionItem[] => {
    let cleanText = text;
    // Normalização de espaços fantasmas
    if (text.match(/P\s*e\s*d\s*i\s*d\s*o/i)) {
      cleanText = text.replace(/([A-Za-z0-9])\s(?=[A-Za-z0-9]\s)/g, '$1');
    }
    
    setDebugText(cleanText);
    const orders: CollectionItem[] = [];
    
    // Lógica Global de Transportadora: Verifica se 8402 existe no documento inteiro
    const hasMidasCodeGlobal = cleanText.includes('8402');
    
    // Busca por blocos de pedido
    const pedidoPattern = /(?:Pedido|N[º°.]?\s*Pedido|PEDIDO)\s*[:\-]?\s*(\d{5,10})/gi;
    let match;
    const foundStarts = [];
    
    while ((match = pedidoPattern.exec(cleanText)) !== null) {
      foundStarts.push({
        index: match.index,
        pedido: match[1]
      });
    }

    if (foundStarts.length === 0) {
      const fallbackPattern = /\b(\d{6,7})\b/g;
      while ((match = fallbackPattern.exec(cleanText)) !== null) {
        foundStarts.push({
          index: match.index,
          pedido: match[1]
        });
      }
    }

    for (let i = 0; i < foundStarts.length; i++) {
      const start = foundStarts[i].index;
      const end = foundStarts[i + 1] ? foundStarts[i + 1].index : cleanText.length;
      const segment = cleanText.substring(start, end).replace(/\s+/g, ' ');

      // Extração de campos
      const clienteMatch = segment.match(/(?:Cliente|CLIENTE)\s*[:\-]?\s*([^:\n]+?)(?=\s*(?:Produto|Código|UF|Peso|Paletes|Cidade|CNPJ|Endereço|Bairro|PEDIDO|Pedido|$))/i);
      const produtosMatch = segment.match(/(?:Produto|Descrição|PRODUTO)\s*[:\-]?\s*([^:\n]+?)(?=\s*(?:Qtd|Peso|Paletes|M2|Metragem|Valor|Quantidade|$))/i);
      
      // M² agora vem do campo "Quantidade" conforme solicitado
      const m2Match = segment.match(/(?:Quantidade|M2|Metragem|M²)\s*[:\-]?\s*([\d.,]+)/i);
      const paletesMatch = segment.match(/(?:Paletes|Plts|Qtd\.?\s*Paletes|PALETES|PLT)\s*[:\-]?\s*(\d+)/i);
      
      // Se o código global for 8402, define como Midas Log. Caso contrário, verifica no segmento.
      const hasMidasCodeInSegment = segment.includes('8402');
      const transportadoraDefault = (hasMidasCodeGlobal || hasMidasCodeInSegment) ? 'Midas Log' : 'Cliente retira';

      orders.push({
        id: Math.random().toString(36).substr(2, 9),
        data: new Date().toLocaleDateString('pt-BR'),
        representacao: "Midas Representações",
        segmento: "Varejo",
        cliente: clienteMatch ? clienteMatch[1].trim().toUpperCase() : "NÃO IDENTIFICADO",
        pedido: foundStarts[i].pedido,
        produtos: produtosMatch ? produtosMatch[1].trim().toUpperCase() : "",
        plt: paletesMatch ? parseInt(paletesMatch[1]) : 0,
        m2: m2Match ? parseFloat(m2Match[1].replace(/\./g, '').replace(',', '.')) || 0 : 0,
        transportadora: transportadoraDefault
      });
    }
    
    return orders;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setProcessing(true);
    let allExtractedItems: CollectionItem[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const text = await extractTextFromPDF(files[i]);
        const extractedFromThisFile = parseAllOrders(text);
        allExtractedItems = [...allExtractedItems, ...extractedFromThisFile];
      } catch (error) {
        console.error("[CerbrasCollectionForecast] Erro ao processar PDF:", error);
        showError(`Erro no arquivo: ${files[i].name}`);
      }
    }

    if (allExtractedItems.length > 0) {
      setItems(prev => [...prev, ...allExtractedItems]);
      showSuccess(`${allExtractedItems.length} pedidos extraídos com sucesso!`);
    } else {
      showError("Não foi possível identificar pedidos.");
      setShowDebug(true);
    }
    
    setProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addNewRow = () => {
    const newItem: CollectionItem = {
      id: Math.random().toString(36).substr(2, 9),
      id: Math.random().toString(36).substr(2, 9),
      data: new Date().toLocaleDateString('pt-BR'),
      representacao: "Midas Representações",
      segmento: "Varejo",
      cliente: "",
      pedido: "",
      produtos: "",
      plt: 0,
      m2: 0,
      transportadora: "Cliente retira"
    };
    setItems(prev => [...prev, newItem]);
  };

  const updateItem = (id: string, field: keyof CollectionItem, value: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const downloadExcel = () => {
    if (items.length === 0) return;

    const dataToExport = items.map(item => ({
      'DATA': item.data,
      'REPRESENTAÇÃO': item.representacao,
      'SEGMENTO': item.segmento,
      'CLIENTE': item.cliente,
      'Nº PEDIDO': item.pedido,
      'PRODUTOS': item.produtos,
      'PLT': item.plt,
      'M²': item.m2,
      'TRANSPORTADORA/RETIRA': item.transportadora
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Previsão de Coleta");
    
    const wscols = [
      {wch: 12}, {wch: 25}, {wch: 15}, {wch: 45}, {wch: 15}, {wch: 40}, {wch: 8}, {wch: 12}, {wch: 25}
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, `PREVISAO_COLETA_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
    showSuccess("Excel gerado com sucesso!");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 lg:px-8 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Previsão de Coleta Diária</h1>
            <p className="text-slate-500 text-xs">Extração automática de múltiplos pedidos por PDF.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
          >
            {processing ? <Loader2 className="animate-spin" size={16} /> : <FileUp size={16} />}
            Importar PDFs
          </Button>
          <Button 
            onClick={downloadExcel} 
            disabled={items.length === 0}
            size="sm" 
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
          >
            <Download size={16} /> Gerar Excel
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-8 max-w-full mx-auto w-full space-y-6">
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".pdf" 
          multiple 
          onChange={handleFileUpload} 
        />

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <div className="bg-amber-50 p-6 rounded-full mb-4">
              <FileText className="text-amber-600" size={48} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Nenhum pedido carregado</h3>
            <p className="text-slate-500 max-w-xs text-center mt-2">
              Selecione os arquivos PDF para extração automática.
            </p>
            <div className="flex gap-4 mt-6">
              <Button onClick={() => fileInputRef.current?.click()} className="bg-amber-600 hover:bg-amber-700">Selecionar Arquivos</Button>
              <Button variant="outline" onClick={addNewRow} className="border-slate-300">Adicionar Manualmente</Button>
            </div>
          </div>
        ) : (
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-slate-900 text-white py-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TableIcon size={20} className="text-amber-500" /> 
                    Pedidos Identificados ({items.length})
                  </CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addNewRow} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    <Plus size={16} className="mr-1" /> Nova Linha
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setItems([])} className="gap-2">
                    <X size={16} /> Limpar Tudo
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-amber-500 scrollbar-track-slate-100">
                <Table className="min-w-[1500px]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[120px] text-[10px] uppercase font-bold">Data</TableHead>
                      <TableHead className="w-[220px] text-[10px] uppercase font-bold">Representação</TableHead>
                      <TableHead className="w-[130px] text-[10px] uppercase font-bold">Segmento</TableHead>
                      <TableHead className="min-w-[250px] text-[10px] uppercase font-bold">Cliente</TableHead>
                      <TableHead className="w-[120px] text-[10px] uppercase font-bold">Nº Pedido</TableHead>
                      <TableHead className="min-w-[200px] text-[10px] uppercase font-bold">Produtos</TableHead>
                      <TableHead className="w-[80px] text-[10px] uppercase font-bold">PLT</TableHead>
                      <TableHead className="w-[100px] text-[10px] uppercase font-bold">M²</TableHead>
                      <TableHead className="w-[180px] text-[10px] uppercase font-bold">Transportadora/Retira</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <Input value={item.data} onChange={(e) => updateItem(item.id, 'data', e.target.value)} className="h-8 text-[10px] border-none bg-transparent" />
                        </TableCell>
                        <TableCell>
                          <Input value={item.representacao} onChange={(e) => updateItem(item.id, 'representacao', e.target.value)} className="h-8 text-[10px] border-none bg-transparent" />
                        </TableCell>
                        <TableCell>
                          <select 
                            value={item.segmento} 
                            onChange={(e) => updateItem(item.id, 'segmento', e.target.value)}
                            className="w-full h-8 text-[10px] font-bold rounded border-none bg-slate-100 px-1"
                          >
                            <option value="Varejo">Varejo</option>
                            <option value="Engenharia">Engenharia</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <Input value={item.cliente} onChange={(e) => updateItem(item.id, 'cliente', e.target.value.toUpperCase())} className="h-8 text-[10px] font-bold border-none bg-transparent" />
                        </TableCell>
                        <TableCell>
                          <Input value={item.pedido} onChange={(e) => updateItem(item.id, 'pedido', e.target.value)} className="h-8 text-[10px] border-none bg-transparent" />
                        </TableCell>
                        <TableCell>
                          <Input value={item.produtos} onChange={(e) => updateItem(item.id, 'produtos', e.target.value.toUpperCase())} className="h-8 text-[10px] border-none bg-transparent" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.plt} onChange={(e) => updateItem(item.id, 'plt', parseInt(e.target.value) || 0)} className="h-8 text-[10px] border-none bg-transparent font-bold" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.m2} onChange={(e) => updateItem(item.id, 'm2', parseFloat(e.target.value) || 0)} className="h-8 text-[10px] border-none bg-transparent text-blue-600 font-bold" />
                        </TableCell>
                        <TableCell>
                          <select 
                            value={item.transportadora} 
                            onChange={(e) => updateItem(item.id, 'transportadora', e.target.value)}
                            className={`w-full h-8 text-[10px] font-bold rounded border-none px-1 ${item.transportadora === 'Midas Log' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}
                          >
                            <option value="Midas Log">Midas Log</option>
                            <option value="Cliente retira">Cliente retira</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="h-8 w-8 text-red-500 hover:bg-red-50"><Trash2 size={14} /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 bg-slate-50 border-t flex justify-between items-center">
                <div className="flex gap-6">
                  <div className="text-xs"><span className="text-slate-500 uppercase font-bold">Total Pedidos:</span><span className="ml-2 font-bold text-slate-900">{items.length}</span></div>
                  <div className="text-xs"><span className="text-slate-500 uppercase font-bold">Total M²:</span><span className="ml-2 font-bold text-blue-600">{items.reduce((acc, i) => acc + i.m2, 0).toLocaleString('pt-BR')} M²</span></div>
                  <div className="text-xs"><span className="text-slate-500 uppercase font-bold">Total Paletes:</span><span className="ml-2 font-bold text-amber-700">{items.reduce((acc, i) => acc + i.plt, 0)}</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-200 shadow-sm">
          <button onClick={() => setShowDebug(!showDebug)} className="w-full p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2 text-slate-600"><AlertCircle size={18} /><span className="text-sm font-bold uppercase">Painel de Depuração (Texto do PDF)</span></div>
            {showDebug ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showDebug && (
            <CardContent className="p-4 bg-slate-900 text-green-400 font-mono text-[10px] overflow-x-auto">
              <pre className="whitespace-pre-wrap">{debugText || "Nenhum arquivo processado ainda."}</pre>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  );
};

export default CerbrasCollectionForecast;