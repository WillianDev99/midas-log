"use client";

import React, { useState, useRef, useMemo } from 'react';
import { 
  ArrowLeft, 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  FileText, 
  ChevronRight, 
  Info, 
  Sparkles,
  RefreshCw,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Types
interface ExcelProduct {
  rowIndex: number;
  rawName: string;
  cleanName: string;
  format: string;
  level: number | null;
  code: string;
}

interface ParsedPdfPage {
  pageNum: number;
  group: string;
  format: string;
  uf: 'CE' | 'PI' | 'MA';
  clientSize: 'MICRO' | 'PEQUENO' | 'MEDIO' | 'GRANDE';
  priceGrid: Record<number, number[]>;
  productsByLevel: Record<number, string[]>;
}

interface PDFFileItem {
  id: string;
  file: File;
  uf: 'CE' | 'PI' | 'MA' | '';
  clientSize: 'MICRO' | 'PEQUENO' | 'MEDIO' | 'GRANDE' | '';
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  pageCount?: number;
  parsedPages?: ParsedPdfPage[];
}

interface FillReport {
  totalRows: number;
  filledCells: number;
  unmatchedProducts: { name: string; format: string; level: number | null }[];
  breakdown: Record<string, number>; // e.g. "PI/MICRO": 608
}

// Normalized utilities
const normalizeName = (name: string): string => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toUpperCase()
    .replace(/\bHD\b/gi, "") // remove HD
    .replace(/[^A-Z0-9\s]/g, "") // remove non-alphanumeric
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeFormat = (fmt: string): string => {
  return fmt
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/,/g, '.'); // convert comma to dot
};

const termsMap: Record<string, number> = {
  '0-14DM': 0,
  '14DM': 0,
  '28DM': 1,
  '42DM': 2,
  '56DM': 3,
  '70DM': 4,
  '84DM': 5,
  '98DM': 6,
  '112DM': 7
};

const CerbrasTableUpdate = () => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  
  // Step 1: Base Spreadsheet States
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [excelProducts, setExcelProducts] = useState<ExcelProduct[]>([]);
  const [excelGroup, setExcelGroup] = useState<'CERÂMICA' | 'SUPER PRIME' | 'PORCELANATO' | ''>('');
  const [excelSearch, setExcelSearch] = useState('');
  
  // Step 2: PDF Uploads States
  const [pdfFiles, setPdfFiles] = useState<PDFFileItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  // Step 3: Match & Update States
  const [allParsedPages, setAllParsedPages] = useState<ParsedPdfPage[]>([]);
  const [report, setReport] = useState<FillReport | null>(null);
  const [updatedWorkbook, setUpdatedWorkbook] = useState<XLSX.WorkBook | null>(null);

  // Auto-detect group from excel filename
  const detectGroupFromFilename = (filename: string): 'CERÂMICA' | 'SUPER PRIME' | 'PORCELANATO' | '' => {
    const upper = filename.toUpperCase();
    if (upper.includes('SUPER') || upper.includes('PRIME')) return 'SUPER PRIME';
    if (upper.includes('PORCELANATO')) return 'PORCELANATO';
    if (upper.includes('CERAMICA') || upper.includes('CERÂMICA')) return 'CERÂMICA';
    return '';
  };

  // Auto-detect UF from PDF filename
  const detectUFFromFilename = (filename: string): 'CE' | 'PI' | 'MA' | '' => {
    const upper = filename.toUpperCase();
    if (upper.includes('CEARÁ') || upper.includes('CEARA') || /\bCE\b/.test(upper)) return 'CE';
    if (upper.includes('PIAUÍ') || upper.includes('PIAUI') || /\bPI\b/.test(upper)) return 'PI';
    if (upper.includes('MARANHÃO') || upper.includes('MARANHAO') || /\bMA\b/.test(upper)) return 'MA';
    return '';
  };

  // Auto-detect Client Size from PDF filename
  const detectClientSizeFromFilename = (filename: string): 'MICRO' | 'PEQUENO' | 'MEDIO' | 'GRANDE' | '' => {
    const upper = filename.toUpperCase();
    if (upper.includes('MICRO')) return 'MICRO';
    if (upper.includes('PEQUENO') || upper.includes('PEQ')) return 'PEQUENO';
    if (upper.includes('MEDIO') || upper.includes('MÉDIO') || upper.includes('MED')) return 'MEDIO';
    if (upper.includes('GRANDE') || upper.includes('GTE')) return 'GRANDE';
    return '';
  };

  // Handle excel upload
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    const group = detectGroupFromFilename(file.name);
    setExcelGroup(group);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);

        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        
        const products: ExcelProduct[] = [];
        
        for (let r = 1; r <= range.e.r; r++) {
          const nameCellRef = XLSX.utils.encode_cell({ c: 2, r: r }); // Col C
          const nameCell = sheet[nameCellRef];
          if (!nameCell || !nameCell.v) continue;

          const rawName = String(nameCell.v).trim();
          const codeCellRef = XLSX.utils.encode_cell({ c: 3, r: r }); // Col D
          const codeCell = sheet[codeCellRef];
          const code = codeCell ? String(codeCell.v).trim() : '';

          // Parse format, level and clean name
          const levelMatch = rawName.match(/-\s*N(\d+)/i);
          const level = levelMatch ? parseInt(levelMatch[1]) : null;

          const formatMatch = rawName.match(/\b\d+(?:[\.,]\d+)?\s*[xX]\s*\d+(?:[\.,]\d+)?\b/);
          const format = formatMatch ? formatMatch[0].replace(/\s+/g, '').toUpperCase() : '';

          // Strip complement for product matching
          let cleanedName = rawName;
          if (formatMatch) cleanedName = cleanedName.replace(formatMatch[0], '');
          cleanedName = cleanedName.replace(/-\s*N\d+/i, '');
          cleanedName = cleanedName.replace(/\b[AC]\b/g, '');
          cleanedName = cleanedName.replace(/cx\s*[\d,.]+\s*m2/i, '');
          cleanedName = cleanedName.replace(/\s+/g, ' ').trim();

          products.push({
            rowIndex: r,
            rawName,
            cleanName: cleanedName,
            format,
            level,
            code
          });
        }

        setExcelProducts(products);
        showSuccess("Planilha base carregada com sucesso!");
      } catch (err: any) {
        showError("Erro ao ler a planilha: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Add PDF files
  const handlePdfAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: PDFFileItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newItems.push({
        id: Math.random().toString(36).substr(2, 9),
        file,
        uf: detectUFFromFilename(file.name),
        clientSize: detectClientSizeFromFilename(file.name),
        status: 'pending'
      });
    }

    setPdfFiles(prev => [...prev, ...newItems]);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  // Remove PDF file
  const removePdf = (id: string) => {
    setPdfFiles(prev => prev.filter(f => f.id !== id));
  };

  // Update PDF metadata
  const updatePdfMeta = (id: string, field: 'uf' | 'clientSize', value: string) => {
    setPdfFiles(prev => prev.map(f => {
      if (f.id === id) {
        return { ...f, [field]: value };
      }
      return f;
    }));
  };

  // Parse items from page
  const parsePageItems = (
    items: any[], 
    pageNum: number, 
    uf: 'CE' | 'PI' | 'MA', 
    clientSize: 'MICRO' | 'PEQUENO' | 'MEDIO' | 'GRANDE'
  ): ParsedPdfPage => {
    const linesMap = new Map<number, any[]>();
    items.forEach(item => {
      let foundKey: number | null = null;
      for (const key of linesMap.keys()) {
        if (Math.abs(key - item.y) < 3.0) {
          foundKey = key;
          break;
        }
      }
      if (foundKey !== null) {
        linesMap.get(foundKey)!.push(item);
      } else {
        linesMap.set(item.y, [item]);
      }
    });
    
    const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
    const lines = sortedY.map(y => {
      const lineItems = linesMap.get(y)!;
      lineItems.sort((a, b) => a.x - b.x);
      return {
        y: y,
        items: lineItems,
        text: lineItems.map(it => it.str).join(' ')
      };
    });
    
    let group = "";
    let format = "";
    
    for (const line of lines) {
      if (line.text.includes("TABELA DE PREÇOS")) {
        const parts = line.text.split('-').map(p => p.trim());
        if (parts.length >= 3) {
          group = parts[1].toUpperCase();
          format = parts[2].replace(/\s+/g, '').toUpperCase();
        }
        break;
      }
    }
    
    // Grid of prices (Nivel 1 to Nivel 9)
    const priceGrid: Record<number, number[]> = {};
    for (let i = 1; i <= 9; i++) {
      priceGrid[i] = [];
    }
    
    const niveisLines: { level: number; line: any }[] = [];
    lines.forEach(line => {
      if (line.y >= 600) {
        const match = line.text.match(/Nivel\s*([1-9])/i);
        if (match) {
          const level = parseInt(match[1]);
          niveisLines.push({ level, line });
        }
      }
    });
    
    niveisLines.forEach(({ level, line }) => {
      const priceItems = line.items.filter((item: any) => {
        const str = item.str.trim();
        return str && !str.toLowerCase().includes("nivel");
      });
      
      const tokens: string[] = [];
      for (let i = 0; i < priceItems.length; i++) {
        const str = priceItems[i].str.trim();
        if (str === "R$") {
          if (i + 1 < priceItems.length) {
            tokens.push("R$ " + priceItems[i+1].str.trim());
            i++;
          } else {
            tokens.push("R$");
          }
        } else if (str.startsWith("R$")) {
          tokens.push(str);
        } else if (str.match(/^\d+[,.]\d+$/)) {
          tokens.push("R$ " + str);
        } else {
          tokens.push(str);
        }
      }
      
      const pricesOnly = tokens.filter(t => t.includes("R$") || t.match(/^\d+[,.]\d+$/));
      
      const priceFloats = pricesOnly.map(p => {
        const cleaned = p.replace("R$", "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
        return parseFloat(cleaned);
      });
      
      priceGrid[level] = priceFloats;
    });
    
    // Products by Level
    let prodNivelStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].text.includes("Produtos por Nível")) {
        prodNivelStartIndex = i;
        break;
      }
    }
    
    const productsByLevel: Record<number, string[]> = {};
    for (let l = 1; l <= 9; l++) {
      productsByLevel[l] = [];
    }
    
    if (prodNivelStartIndex !== -1) {
      let headersLine: any = null;
      let headersLineIndex = -1;
      for (let i = prodNivelStartIndex + 1; i < lines.length; i++) {
        if (lines[i].text.includes("Nivel 1") && lines[i].text.includes("Nivel 2")) {
          headersLine = lines[i];
          headersLineIndex = i;
          break;
        }
      }
      
      if (headersLine) {
        const levelX: Record<number, number> = {};
        headersLine.items.forEach((item: any) => {
          const match = item.str.match(/Nivel\s*([1-9])/i);
          if (match) {
            levelX[parseInt(match[1])] = item.x;
          }
        });
        
        for (let i = headersLineIndex + 1; i < lines.length; i++) {
          const line = lines[i];
          if (line.text.includes("Condições Gerais") || line.text.includes("Preços FOB")) {
            break;
          }
          
          line.items.forEach((item: any) => {
            const str = item.str.trim();
            if (str && !str.includes("Nivel")) {
              let closestLevel: number | null = null;
              let minDiff = 20.0;
              
              for (const [levelStr, x] of Object.entries(levelX)) {
                const level = parseInt(levelStr);
                const diff = Math.abs(item.x - x);
                if (diff < minDiff) {
                  minDiff = diff;
                  closestLevel = level;
                }
              }
              
              if (closestLevel !== null) {
                productsByLevel[closestLevel].push(str);
              }
            }
          });
        }
      }
    }
    
    return {
      pageNum,
      group,
      format,
      uf,
      clientSize,
      priceGrid,
      productsByLevel
    };
  };

  // Parse a single PDF file
  const parsePDFFile = async (item: PDFFileItem): Promise<ParsedPdfPage[]> => {
    if (!item.uf || !item.clientSize) {
      throw new Error("UF e Tamanho de Cliente são obrigatórios.");
    }
    const arrayBuffer = await item.file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      disableFontFace: true
    });
    const pdf = await loadingTask.promise;
    const pages: ParsedPdfPage[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const items = textContent.items.map((it: any) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5]
      }));
      pages.push(parsePageItems(items, i, item.uf, item.clientSize));
    }
    return pages;
  };

  // Find product level inside parsed PDF page productsByLevel table
  const findProductLevelInPdf = (sheetProductNameCleaned: string, pdfProductsByLevel: Record<number, string[]>): number | null => {
    const normSheet = normalizeName(sheetProductNameCleaned);
    if (!normSheet) return null;
    
    for (let level = 1; level <= 9; level++) {
      const pdfProds = pdfProductsByLevel[level] || [];
      for (const pdfProd of pdfProds) {
        const normPdf = normalizeName(pdfProd);
        if (!normPdf) continue;
        
        // Exact normalized name match
        if (normSheet === normPdf) {
          return level;
        }
        
        // Substring checks
        if (normSheet.includes(normPdf) && normPdf.length > 4) {
          return level;
        }
        if (normPdf.includes(normSheet) && normSheet.length > 4) {
          return level;
        }
      }
    }
    return null;
  };

  // Run PDF processing and proceed to step 3
  const handleProcessPdfs = async () => {
    // Validate inputs
    const invalid = pdfFiles.some(f => !f.uf || !f.clientSize);
    if (invalid) {
      showError("Por favor, preencha o Estado (UF) e o Tamanho de Cliente para todos os arquivos.");
      return;
    }

    if (pdfFiles.length === 0) {
      showError("Adicione pelo menos um arquivo PDF.");
      return;
    }

    setIsParsing(true);
    setParseProgress(0);
    
    const allPages: ParsedPdfPage[] = [];
    let completed = 0;

    const updatedFiles = [...pdfFiles];

    for (let i = 0; i < updatedFiles.length; i++) {
      const item = updatedFiles[i];
      try {
        updatedFiles[i] = { ...item, status: 'processing' };
        setPdfFiles([...updatedFiles]);

        const pages = await parsePDFFile(item);
        
        allPages.push(...pages);
        updatedFiles[i] = { 
          ...item, 
          status: 'success', 
          pageCount: pages.length,
          parsedPages: pages 
        };
      } catch (err: any) {
        console.error(err);
        updatedFiles[i] = { 
          ...item, 
          status: 'error', 
          error: err.message || "Erro desconhecido" 
        };
      }
      completed++;
      setParseProgress(Math.round((completed / updatedFiles.length) * 100));
      setPdfFiles([...updatedFiles]);
    }

    setIsParsing(false);
    
    // Check if we have successfully parsed pages
    if (allPages.length === 0) {
      showError("Nenhum preço foi extraído dos PDFs. Verifique os erros.");
      return;
    }

    setAllParsedPages(allPages);
    showSuccess(`${allPages.length} páginas processadas! Gerando cruzamento com Excel...`);
    
    // Run comparison and spreadsheet update in memory
    runComparison(allPages);
  };

  // Cross-reference data and update the spreadsheet structure in memory
  const runComparison = (parsedPages: ParsedPdfPage[]) => {
    if (!workbook || !excelProducts.length || !excelGroup) return;

    // Clone workbook and sheet to work on it
    const wbClone = JSON.parse(JSON.stringify(workbook)) as XLSX.WorkBook;
    const sheetName = wbClone.SheetNames[0];
    const sheet = wbClone.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

    let filledCount = 0;
    const unmatchedSet = new Set<string>();
    const breakdown: Record<string, number> = {};

    // For tracking products state
    const unmatchedProductsList: { name: string; format: string; level: number | null }[] = [];

    excelProducts.forEach(prod => {
      const { rowIndex, cleanName, format, level: excelLevel } = prod;
      const normalizedFmt = normalizeFormat(format);
      
      let productMatchedInAnyPage = false;

      // Find price columns in the sheet row and fill them
      for (let c = 7; c <= range.e.c; c++) {
        const headerCellRef = XLSX.utils.encode_cell({ c, r: 0 });
        const headerCell = sheet[headerCellRef];
        if (!headerCell || !headerCell.v) continue;

        const headerName = String(headerCell.v).trim();
        if (!headerName.startsWith('Preço#')) continue;

        const parts = headerName.replace('Preço#', '').split('/');
        if (parts.length < 3) continue;

        const colUF = parts[0].toUpperCase() as 'CE' | 'PI' | 'MA';
        const colSize = parts[1].toUpperCase() as 'MICRO' | 'PEQUENO' | 'MEDIO' | 'GRANDE';
        const colTerm = parts[2].toUpperCase();

        const termIndex = termsMap[colTerm];
        if (termIndex === undefined) continue;

        // Find the page in PDF that matches: Group, Format, ClientSize, UF
        const matchPage = parsedPages.find(p => 
          p.group === excelGroup &&
          normalizeFormat(p.format) === normalizedFmt &&
          p.clientSize === colSize &&
          p.uf === colUF
        );

        if (matchPage) {
          // Determine product level
          // 1. Look in PDF productsByLevel
          let level = findProductLevelInPdf(cleanName, matchPage.productsByLevel);
          
          // 2. Fallback to level in Excel cell name
          if (level === null) {
            level = excelLevel;
          }

          if (level !== null && matchPage.priceGrid[level] && matchPage.priceGrid[level][termIndex] !== undefined) {
            const price = matchPage.priceGrid[level][termIndex];
            const targetCellRef = XLSX.utils.encode_cell({ c, r: rowIndex });
            
            sheet[targetCellRef] = { t: 'n', v: price };
            filledCount++;
            productMatchedInAnyPage = true;

            // Update breakdown metric
            const breakKey = `${colUF}/${colSize}`;
            breakdown[breakKey] = (breakdown[breakKey] || 0) + 1;
          }
        }
      }

      if (!productMatchedInAnyPage) {
        unmatchedSet.add(prod.rawName);
        unmatchedProductsList.push({
          name: prod.rawName,
          format: prod.format,
          level: prod.level
        });
      }
    });

    setReport({
      totalRows: excelProducts.length,
      filledCells: filledCount,
      unmatchedProducts: unmatchedProductsList,
      breakdown
    });

    setUpdatedWorkbook(wbClone);
    setCurrentStep(3);
  };

  // Download updated Excel file
  const handleDownloadExcel = () => {
    if (!updatedWorkbook) return;
    try {
      const out = XLSX.write(updatedWorkbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Planilha_${excelGroup.replace(/\s+/g, '_')}_Atualizada_${new Date().getFullYear()}.xlsx`;
      a.click();
      showSuccess("Planilha atualizada baixada com sucesso!");
    } catch (err: any) {
      showError("Erro ao exportar planilha: " + err.message);
    }
  };

  // Search filtered products
  const filteredExcelProducts = useMemo(() => {
    return excelProducts.filter(p => 
      p.rawName.toLowerCase().includes(excelSearch.toLowerCase()) ||
      p.code.toLowerCase().includes(excelSearch.toLowerCase())
    );
  }, [excelProducts, excelSearch]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="max-w-full mx-auto w-full flex justify-between items-center p-4 lg:px-8 bg-white border-b shadow-sm h-16">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-900">
              <ArrowLeft />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Midas Log" className="h-7 w-auto" />
            <div>
              <h1 className="text-lg font-bold text-slate-900">Atualização de Tabelas Cerbras</h1>
              <p className="text-slate-500 text-[10px]">Carga automática de preços a partir de PDF da fábrica para planilhas de vendas.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-200 text-amber-800 bg-amber-50 gap-1.5 px-3 py-1 font-semibold">
            <Sparkles size={12} className="text-amber-500" />
            Módulo Cerbras
          </Badge>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 space-y-6">
        
        {/* Stepper Card */}
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              
              {/* Step 1 */}
              <button 
                onClick={() => excelFile && setCurrentStep(1)}
                className={`flex items-center gap-2 transition-all ${currentStep === 1 ? 'text-amber-600 font-bold' : excelFile ? 'text-slate-800 hover:text-amber-600' : 'text-slate-400 cursor-not-allowed'}`}
                disabled={!excelFile}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                  currentStep === 1 ? 'border-amber-500 bg-amber-50 text-amber-600' : excelFile ? 'border-green-500 bg-green-50 text-green-600' : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}>
                  {excelFile && currentStep > 1 ? <CheckCircle2 size={16} className="text-green-600" /> : "1"}
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-xs font-semibold leading-none">Planilha Base</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Definir planilha e grupo</p>
                </div>
              </button>

              <ChevronRight size={18} className="text-slate-300 hidden md:block" />

              {/* Step 2 */}
              <button 
                onClick={() => excelFile && setCurrentStep(2)}
                className={`flex items-center gap-2 transition-all ${currentStep === 2 ? 'text-amber-600 font-bold' : allParsedPages.length > 0 ? 'text-slate-800 hover:text-amber-600' : 'text-slate-400 cursor-not-allowed'}`}
                disabled={!excelFile}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                  currentStep === 2 ? 'border-amber-500 bg-amber-50 text-amber-600' : allParsedPages.length > 0 ? 'border-green-500 bg-green-50 text-green-600' : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}>
                  {allParsedPages.length > 0 && currentStep > 2 ? <CheckCircle2 size={16} className="text-green-600" /> : "2"}
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-xs font-semibold leading-none">PDFs da Fábrica</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Inserir PDFs e definir UF/Tamanho</p>
                </div>
              </button>

              <ChevronRight size={18} className="text-slate-300 hidden md:block" />

              {/* Step 3 */}
              <div className={`flex items-center gap-2 ${currentStep === 3 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                  currentStep === 3 ? 'border-amber-500 bg-amber-50 text-amber-600 font-bold' : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}>
                  3
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-xs font-semibold leading-none">Mapeamento e Download</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Gerar e baixar planilha preenchida</p>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Step 1: Base Spreadsheet Box */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSpreadsheet className="text-amber-600" size={20} />
                    Planilha Modelo Base
                  </CardTitle>
                  <CardDescription>Envie o arquivo modelo em Excel (ex: SUPER PRIME 2026.xlsx).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-slate-400 animate-pulse" />
                        <p className="mb-1 text-xs text-slate-500"><span className="font-semibold">Clique para upload</span> ou arraste</p>
                        <p className="text-[10px] text-slate-400">Excel (XLSX, XLSM)</p>
                      </div>
                      <input type="file" className="hidden" accept=".xlsx, .xlsm, .xls" onChange={handleExcelUpload} />
                    </label>
                  </div>

                  {excelFile && (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                      <div>
                        <p className="text-xs text-slate-500">Arquivo Carregado</p>
                        <p className="text-sm font-bold text-slate-800 truncate">{excelFile.name}</p>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-500 font-semibold">Grupo de Produtos</label>
                        <Select 
                          value={excelGroup} 
                          onValueChange={(val) => setExcelGroup(val as any)}
                        >
                          <SelectTrigger className="bg-white h-9 border-slate-200">
                            <SelectValue placeholder="Selecione o Grupo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CERÂMICA">CERÂMICA</SelectItem>
                            <SelectItem value="SUPER PRIME">SUPER PRIME</SelectItem>
                            <SelectItem value="PORCELANATO">PORCELANATO</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-500">Total de Linhas / Produtos:</span>
                        <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {excelProducts.length} itens
                        </span>
                      </div>
                    </div>
                  )}

                  {excelFile && (
                    <Button 
                      onClick={() => setCurrentStep(2)}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                      disabled={!excelGroup}
                    >
                      Continuar para PDFs
                      <ChevronRight size={16} className="ml-1" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Product Preview Table */}
            <div className="lg:col-span-2">
              <Card className="border-none shadow-sm h-full flex flex-col min-h-[400px]">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base">Visualização dos Produtos da Planilha</CardTitle>
                    <CardDescription>Estes são os produtos identificados na Coluna C da planilha.</CardDescription>
                  </div>
                  {excelFile && (
                    <div className="relative w-48 sm:w-64">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input 
                        placeholder="Buscar produto ou código..." 
                        value={excelSearch}
                        onChange={(e) => setExcelSearch(e.target.value)}
                        className="pl-9 h-9 bg-slate-50/50"
                      />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-auto max-h-[500px]">
                  {excelProducts.length > 0 ? (
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="w-[100px] text-xs">CÓDIGO</TableHead>
                          <TableHead className="text-xs">PRODUTO COMPLETO (EXCEL)</TableHead>
                          <TableHead className="w-[120px] text-xs">FORMATO</TableHead>
                          <TableHead className="w-[80px] text-center text-xs">NÍVEL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExcelProducts.map((p, idx) => (
                          <TableRow key={idx} className="hover:bg-slate-50/50">
                            <TableCell className="font-mono text-[10px] text-slate-600">{p.code || '-'}</TableCell>
                            <TableCell className="text-xs font-bold text-slate-700">{p.rawName}</TableCell>
                            <TableCell className="text-xs text-slate-500 font-mono">{p.format || '-'}</TableCell>
                            <TableCell className="text-center">
                              {p.level ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-bold border-amber-200">
                                  N{p.level}
                                </Badge>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[350px] text-slate-400 p-8 text-center space-y-3">
                      <FileSpreadsheet size={48} className="text-slate-300 animate-pulse" />
                      <p className="text-sm">Nenhuma planilha carregada. Envie o arquivo base ao lado para começar.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 2: PDF Uploads Box */}
        {currentStep === 2 && (
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="text-amber-600" size={20} />
                  Upload de PDFs de Preços da Fábrica
                </CardTitle>
                <CardDescription>Envie os PDFs recebidos da fábrica. Defina o Estado (UF) e o tipo de cliente de cada arquivo.</CardDescription>
              </div>
              <Button 
                onClick={() => pdfInputRef.current?.click()}
                disabled={isParsing}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold h-9"
              >
                <Upload size={16} className="mr-2" />
                Adicionar Arquivos PDF
              </Button>
              <input 
                type="file" 
                ref={pdfInputRef} 
                className="hidden" 
                accept=".pdf" 
                multiple 
                onChange={handlePdfAdd} 
              />
            </CardHeader>
            <CardContent className="space-y-6">
              
              {pdfFiles.length === 0 ? (
                <div 
                  className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-12 text-center bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
                  onClick={() => pdfInputRef.current?.click()}
                >
                  <Upload className="w-10 h-10 text-slate-400 mb-3" />
                  <p className="text-sm font-semibold text-slate-700">Adicione os PDFs da fábrica</p>
                  <p className="text-xs text-slate-400 mt-1">Selecione vários arquivos de uma vez. Mapeamos estados CE, PI e MA por cliente.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden bg-white">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-xs">ARQUIVO</TableHead>
                        <TableHead className="w-[140px] text-xs">ESTADO (UF)</TableHead>
                        <TableHead className="w-[180px] text-xs">TAMANHO DE CLIENTE</TableHead>
                        <TableHead className="w-[150px] text-xs">STATUS</TableHead>
                        <TableHead className="w-[80px] text-center text-xs">AÇÕES</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pdfFiles.map((item) => (
                        <TableRow key={item.id} className="hover:bg-slate-50/50">
                          
                          <TableCell className="max-w-[200px] sm:max-w-xs md:max-w-md">
                            <div className="flex items-center gap-2.5">
                              <FileText className="text-red-500 shrink-0" size={18} />
                              <div className="truncate">
                                <p className="text-xs font-semibold text-slate-800 truncate" title={item.file.name}>{item.file.name}</p>
                                <p className="text-[10px] text-slate-400">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Select 
                              value={item.uf} 
                              onValueChange={(val) => updatePdfMeta(item.id, 'uf', val)}
                              disabled={isParsing || item.status === 'success'}
                            >
                              <SelectTrigger className="bg-white h-8 border-slate-200 text-xs">
                                <SelectValue placeholder="UF..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CE">CE (Ceará)</SelectItem>
                                <SelectItem value="PI">PI (Piauí)</SelectItem>
                                <SelectItem value="MA">MA (Maranhão)</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>

                          <TableCell>
                            <Select 
                              value={item.clientSize} 
                              onValueChange={(val) => updatePdfMeta(item.id, 'clientSize', val)}
                              disabled={isParsing || item.status === 'success'}
                            >
                              <SelectTrigger className="bg-white h-8 border-slate-200 text-xs">
                                <SelectValue placeholder="Cliente..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="MICRO">MICRO</SelectItem>
                                <SelectItem value="PEQUENO">PEQUENO</SelectItem>
                                <SelectItem value="MEDIO">MÉDIO</SelectItem>
                                <SelectItem value="GRANDE">GRANDE</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              {item.status === 'pending' && (
                                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                                  Pendente
                                </Badge>
                              )}
                              {item.status === 'processing' && (
                                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                                  <Loader2 className="animate-spin h-3.5 w-3.5" />
                                  <span>Processando...</span>
                                </div>
                              )}
                              {item.status === 'success' && (
                                <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 gap-1">
                                  <CheckCircle2 size={10} className="text-green-600" />
                                  Ok ({item.pageCount} págs)
                                </Badge>
                              )}
                              {item.status === 'error' && (
                                <Badge variant="destructive" className="gap-1" title={item.error}>
                                  <AlertTriangle size={10} />
                                  Erro
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                              onClick={() => removePdf(item.id)}
                              disabled={isParsing || item.status === 'success'}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </TableCell>

                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Progress feedback bar */}
              {isParsing && (
                <div className="space-y-2 p-4 bg-amber-50/50 rounded-lg border border-amber-200">
                  <div className="flex justify-between items-center text-xs font-semibold text-amber-800">
                    <span className="flex items-center gap-2">
                      <Loader2 className="animate-spin h-3 w-3" />
                      Lendo e interpretando páginas de PDF. Aguarde...
                    </span>
                    <span>{parseProgress}%</span>
                  </div>
                  <Progress value={parseProgress} className="h-2 bg-slate-200 [&>div]:bg-amber-500" />
                </div>
              )}

              {/* Bottom Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <Button 
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  disabled={isParsing}
                >
                  Voltar
                </Button>
                {pdfFiles.length > 0 && (
                  <Button 
                    onClick={handleProcessPdfs}
                    disabled={isParsing}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                  >
                    Processar e Gerar Preços
                    <ChevronRight size={16} className="ml-1" />
                  </Button>
                )}
              </div>

            </CardContent>
          </Card>
        )}

        {/* Step 3: Match, Preview & Download */}
        {currentStep === 3 && report && (
          <div className="space-y-6">
            
            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-6 flex flex-col justify-between h-32">
                  <p className="text-xs font-bold text-slate-500 uppercase leading-none">Produtos na Planilha</p>
                  <p className="text-3xl font-extrabold text-slate-800">{report.totalRows}</p>
                  <p className="text-[10px] text-slate-400">Total de linhas atualizáveis</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-6 flex flex-col justify-between h-32">
                  <p className="text-xs font-bold text-slate-500 uppercase leading-none">Valores Preenchidos</p>
                  <p className="text-3xl font-extrabold text-green-600">{report.filledCells}</p>
                  <p className="text-[10px] text-green-500 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={10} /> Preenchimento concluído
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-6 flex flex-col justify-between h-32">
                  <p className="text-xs font-bold text-slate-500 uppercase leading-none">Arquivos PDF Lidos</p>
                  <p className="text-3xl font-extrabold text-slate-800">{pdfFiles.filter(f => f.status === 'success').length}</p>
                  <p className="text-[10px] text-slate-400">Total de arquivos processados</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-6 flex flex-col justify-between h-32">
                  <p className="text-xs font-bold text-slate-500 uppercase leading-none">Produtos Não Encontrados</p>
                  <p className="text-3xl font-extrabold text-amber-600">{report.unmatchedProducts.length}</p>
                  <p className="text-[10px] text-amber-500 font-semibold flex items-center gap-1">
                    <AlertTriangle size={10} /> Requer atenção
                  </p>
                </CardContent>
              </Card>

            </div>

            {/* Main Action Card */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="text-amber-500 animate-spin" size={20} />
                    Resultado do Processamento
                  </CardTitle>
                  <CardDescription>Os preços dos PDFs da fábrica foram cruzados e mapeados para a planilha correspondente.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep(2)}
                    className="h-9"
                  >
                    Voltar para PDFs
                  </Button>
                  <Button 
                    onClick={handleDownloadExcel}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold h-9 gap-2"
                  >
                    <Download size={16} />
                    Baixar Planilha Atualizada
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Breakdown by UF / Client */}
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Resumo de Células Atualizadas por Categoria</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {Object.entries(report.breakdown).map(([key, count]) => {
                      const [uf, size] = key.split('/');
                      return (
                        <div key={key} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <Badge variant="outline" className="bg-white border-amber-200 text-amber-800 text-[9px] px-1 font-bold">
                              {uf}
                            </Badge>
                            <span className="text-[9px] font-bold text-slate-500 uppercase">{size}</span>
                          </div>
                          <p className="text-lg font-bold text-slate-800">{count}</p>
                          <p className="text-[9px] text-slate-400">células atualizadas</p>
                        </div>
                      );
                    })}
                    {Object.keys(report.breakdown).length === 0 && (
                      <div className="col-span-full text-center py-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
                        Nenhuma célula de preço correspondeu aos arquivos PDF e planilha carregados.
                      </div>
                    )}
                  </div>
                </div>

                {/* Discrepancies Warnings */}
                {report.unmatchedProducts.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                      <AlertTriangle size={16} className="text-amber-500" />
                      Aviso: {report.unmatchedProducts.length} produtos na planilha não tiveram correspondência de preços nos PDFs
                    </div>
                    <p className="text-xs text-slate-500">
                      Isto acontece se o produto tem um formato que não está contido nos PDFs carregados, se há divergência no grupo, ou se o produto não foi listado em nenhuma tabela de nível do PDF. Estas linhas permaneceram inalteradas.
                    </p>
                    <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white">
                      <Table>
                        <TableHeader className="bg-slate-50 sticky top-0">
                          <TableRow>
                            <TableHead className="text-xs">PRODUTO NÃO ENCONTRADO NO PDF</TableHead>
                            <TableHead className="w-[120px] text-xs">FORMATO</TableHead>
                            <TableHead className="w-[100px] text-center text-xs">NÍVEL MODELO</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.unmatchedProducts.map((p, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/50">
                              <TableCell className="text-xs font-bold text-slate-700">{p.name}</TableCell>
                              <TableCell className="text-xs text-slate-500 font-mono">{p.format || '-'}</TableCell>
                              <TableCell className="text-center">
                                {p.level ? (
                                  <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-bold text-[10px]">
                                    N{p.level}
                                  </Badge>
                                ) : (
                                  <span className="text-slate-400 text-xs">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>

          </div>
        )}

      </main>
    </div>
  );
};

export default CerbrasTableUpdate;
