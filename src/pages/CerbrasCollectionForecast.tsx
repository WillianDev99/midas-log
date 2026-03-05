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
  X
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
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface CollectionItem {
  id: string;
  data: string;
  cliente: string;
  pedido: string;
  cidade: string;
  peso: number;
  paletes: number;
  status: string;
}

const CerbrasCollectionForecast = () => {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // Unimos os itens com espaço para manter a continuidade das frases
      fullText += textContent.items.map((item: any) => item.str).join(" ") + "\n";
    }
    return fullText;
  };

  const parseAllOrders = (text: string): CollectionItem[] => {
    const orders: CollectionItem[] = [];
    
    // Dividimos o texto por "Pedido:", ignorando o primeiro pedaço (cabeçalho geral)
    const segments = text.split(/Pedido\s*:/i);
    
    const cleanNumber = (val: string | null) => {
      if (!val) return 0;
      // Remove pontos de milhar e troca vírgula por ponto decimal
      return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
    };

    for (let i = 1; i < segments.length; i++) {
      const segment = segments[i];
      
      // 1. Número do Pedido (está logo no início do segmento após o split)
      const pedidoMatch = segment.match(/^\s*(\d+)/);
      
      // 2. Cliente (entre "Cliente:" e "Produto:" ou "UF:")
      // Tentamos pegar o bloco de texto do cliente que pode ter quebras de linha
      const clienteBlockMatch = segment.match(/Cliente\s*:\s*(.*?)\s*(?:Produto|Código do Produto|UF:)/i);
      let cliente = "NÃO IDENTIFICADO";
      if (clienteBlockMatch) {
        // Limpamos informações de UF e CNPJ que podem estar na mesma linha no stream de texto
        cliente = clienteBlockMatch[1]
          .replace(/UF\s*:\s*[A-Z]{2}/i, '')
          .replace(/CNPJ\s*:\s*[\d./-]+/i, '')
          .trim()
          .toUpperCase();
      }

      // 3. Peso
      const pesoMatch = segment.match(/Peso\s*:\s*([\d.,]+)/i);
      
      // 4. Paletes
      const paletesMatch = segment.match(/Paletes\s*:\s*(\d+)/i);

      // 5. Cidade (Geralmente vem após o nome do cliente ou em um campo específico)
      const cidadeMatch = segment.match(/Cidade\s*:\s*([^-\n]+)/i);

      if (pedidoMatch) {
        orders.push({
          id: Math.random().toString(36).substr(2, 9),
          data: new Date().toLocaleDateString('pt-BR'),
          pedido: pedidoMatch[1],
          cliente: cliente,
          cidade: cidadeMatch ? cidadeMatch[1].trim().toUpperCase() : "",
          peso: pesoMatch ? cleanNumber(pesoMatch[1]) : 0,
          paletes: paletesMatch ? parseInt(paletesMatch[1]) : 0,
          status: "AGUARDANDO"
        });
      }
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
        console.error("Erro ao processar PDF:", error);
        showError(`Erro no arquivo: ${files[i].name}`);
      }
    }

    if (allExtractedItems.length > 0) {
      setItems(prev => [...prev, ...allExtractedItems]);
      showSuccess(`${allExtractedItems.length} pedidos extraídos com sucesso!`);
    } else {
      showError("Nenhum pedido identificado nos arquivos.");
    }
    
    setProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      'CLIENTE': item.cliente,
      'PEDIDO': item.pedido,
      'CIDADE': item.cidade,
      'PESO (KG)': item.peso,
      'PALETES': item.paletes,
      'STATUS': item.status
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Previsão de Coleta");
    
    const wscols = [
      {wch: 12}, {wch: 45}, {wch: 15}, {wch: 25}, {wch: 15}, {wch: 10}, {wch: 20}
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

      <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
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
              Selecione os arquivos PDF. O sistema irá identificar cada bloco de "Pedido" e criar uma linha na tabela.
            </p>
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              className="mt-6 bg-amber-600 hover:bg-amber-700"
            >
              Selecionar Arquivos
            </Button>
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
                  <CardDescription className="text-slate-400">
                    Revise os dados extraídos. Cada bloco "Pedido" do PDF virou uma linha abaixo.
                  </CardDescription>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => setItems([])}
                  className="gap-2"
                >
                  <X size={16} /> Limpar Tudo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[120px] text-[10px] uppercase font-bold">Data</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold">Cliente</TableHead>
                      <TableHead className="w-[120px] text-[10px] uppercase font-bold">Pedido</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold">Cidade</TableHead>
                      <TableHead className="w-[120px] text-[10px] uppercase font-bold">Peso (KG)</TableHead>
                      <TableHead className="w-[100px] text-[10px] uppercase font-bold">Paletes</TableHead>
                      <TableHead className="w-[150px] text-[10px] uppercase font-bold">Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <Input 
                            value={item.data} 
                            onChange={(e) => updateItem(item.id, 'data', e.target.value)}
                            className="h-8 text-xs border-none bg-transparent focus-visible:ring-1"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            value={item.cliente} 
                            onChange={(e) => updateItem(item.id, 'cliente', e.target.value.toUpperCase())}
                            className="h-8 text-xs font-bold border-none bg-transparent focus-visible:ring-1"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            value={item.pedido} 
                            onChange={(e) => updateItem(item.id, 'pedido', e.target.value)}
                            className="h-8 text-xs border-none bg-transparent focus-visible:ring-1"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            value={item.cidade} 
                            onChange={(e) => updateItem(item.id, 'cidade', e.target.value.toUpperCase())}
                            className="h-8 text-xs border-none bg-transparent focus-visible:ring-1"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            value={item.peso} 
                            onChange={(e) => updateItem(item.id, 'peso', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs border-none bg-transparent focus-visible:ring-1 text-blue-600 font-bold"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            value={item.paletes} 
                            onChange={(e) => updateItem(item.id, 'paletes', parseInt(e.target.value) || 0)}
                            className="h-8 text-xs border-none bg-transparent focus-visible:ring-1"
                          />
                        </TableCell>
                        <TableCell>
                          <select 
                            value={item.status}
                            onChange={(e) => updateItem(item.id, 'status', e.target.value)}
                            className="w-full h-8 text-[10px] font-bold rounded border-none bg-slate-100 px-2 focus:ring-1 focus:ring-amber-500"
                          >
                            <option value="AGUARDANDO">AGUARDANDO</option>
                            <option value="COLETADO">COLETADO</option>
                            <option value="EM ROTA">EM ROTA</option>
                            <option value="ENTREGUE">ENTREGUE</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeItem(item.id)}
                            className="h-8 w-8 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 bg-slate-50 border-t flex justify-between items-center">
                <div className="flex gap-6">
                  <div className="text-xs">
                    <span className="text-slate-500 uppercase font-bold">Total Pedidos:</span>
                    <span className="ml-2 font-bold text-slate-900">{items.length}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500 uppercase font-bold">Peso Total:</span>
                    <span className="ml-2 font-bold text-blue-600">
                      {items.reduce((acc, i) => acc + i.peso, 0).toLocaleString('pt-BR')} KG
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500 uppercase font-bold">Total Paletes:</span>
                    <span className="ml-2 font-bold text-amber-700">
                      {items.reduce((acc, i) => acc + i.paletes, 0)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default CerbrasCollectionForecast;