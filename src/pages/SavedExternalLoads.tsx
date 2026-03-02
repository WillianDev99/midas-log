"use client";

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Trash2, 
  Printer, 
  Calendar, 
  Truck, 
  Loader2,
  Search,
  FileText,
  Eye,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Link } from 'react-router-dom';

const SavedExternalLoads = () => {
  const { user } = useAuth();
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchSavedLoads();
  }, []);

  const fetchSavedLoads = async () => {
    try {
      const { data, error } = await supabase
        .from('hidracor_saved_external_loads')
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
    if (!confirm("Excluir esta carga salva permanentemente?")) return;
    
    const { error } = await supabase.from('hidracor_saved_external_loads').delete().eq('id', id);
    if (error) showError(error.message);
    else {
      setLoads(loads.filter(l => l.id !== id));
      showSuccess("Carga excluída!");
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handlePrintMotorista = (load: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const logoUrl = window.location.origin + "/logo.png";
    const totalWeight = load.deliveries?.reduce((acc: number, d: any) => acc + d.weight, 0) || 0;
    const totalToPayFormatted = formatCurrency(load.total_to_pay || 0);

    const content = `
      <html>
        <head>
          <title>Ordem de Carregamento - Midas Log</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #f59e0b; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { height: 70px; }
            .title { font-size: 28px; font-weight: bold; color: #1e293b; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; }
            .info-label { font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #1e293b; color: white; text-align: left; padding: 12px; border: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase; }
            td { padding: 12px; border: 1px solid #e2e8f0; font-size: 13px; }
            .total-row { background: #f1f5f9; font-weight: bold; font-size: 16px; }
            .note { margin-top: 40px; padding: 20px; border: 2px dashed #cbd5e1; border-radius: 8px; text-align: left; font-size: 14px; }
            .note-title { font-weight: bold; color: #b91c1c; font-size: 16px; margin-bottom: 10px; display: block; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; pt: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" class="logo" />
            <div class="title">Ordem de Carregamento</div>
          </div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Rota</div>
              <div style="font-size: 16px; font-weight: bold;">${load.rota}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Motorista</div>
              <div style="font-size: 16px; font-weight: bold;">${load.driver_name || 'NÃO INFORMADO'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Data de Emissão</div>
              <div>${new Date(load.created_at).toLocaleDateString('pt-BR')}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 60px">Entr.</th>
                <th>Cidade</th>
                <th style="width: 60px">UF</th>
                <th style="width: 100px">Tipo</th>
                <th style="width: 120px">Peso (KG)</th>
              </tr>
            </thead>
            <tbody>
              ${load.deliveries?.map((d: any, idx: number) => `
                <tr>
                  <td style="text-align: center">${idx + 1}</td>
                  <td style="text-transform: uppercase">${d.city}</td>
                  <td style="text-align: center; font-weight: bold;">${d.uf}</td>
                  <td style="text-align: center">${d.type}</td>
                  <td style="text-align: right">${formatCurrency(d.weight)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="4" style="text-align: right">PESO TOTAL:</td>
                <td style="text-align: right;">${formatCurrency(totalWeight)} KG</td>
              </tr>
              <tr class="total-row">
                <td colspan="4" style="text-align: right">VALOR DO FRETE:</td>
                <td style="text-align: right; color: #15803d;">R$ ${totalToPayFormatted}</td>
              </tr>
            </tbody>
          </table>

          <div class="note">
            <span class="note-title">⚠️ INFORMAÇÕES IMPORTANTES:</span>
            <p>• O DESCARREGO SERÁ POR CONTA DO MOTORISTA.</p>
            <p>• QUANTIDADE DE CHAPATEX NECESSÁRIA:<br>
               &nbsp;&nbsp;- TRUCK: 16 CHAPATEX<br>
               &nbsp;&nbsp;- BITRUCK: 24 CHAPATEX<br>
               &nbsp;&nbsp;- CARRETA: 32 CHAPATEX</p>
            <p>• VESTIMENTA EXIGIDA PELA FÁBRICA: Usar calça e calçado fechado.</p>
            <p>• AO CHEGAR NA FÁBRICA: Apresentar-se na portaria e informar que está para retirar uma carga contratada com a <strong>Midas Logística</strong>.</p>
          </div>

          <div class="footer">Midas Logística - Eficiência em Movimento</div>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintCompleto = (load: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const logoUrl = window.location.origin + "/logo.png";
    const totalWeight = load.deliveries?.reduce((acc: number, d: any) => acc + d.weight, 0) || 0;
    const totalFreight = load.deliveries?.reduce((acc: number, d: any) => acc + d.freight, 0) || 0;
    const totalToPay = load.total_to_pay || 0;
    const tax = totalFreight * 0.0998;
    const marginBefore = totalFreight - totalToPay;
    const marginAfter = totalFreight - totalToPay - tax;
    
    const marginBeforePct = totalFreight > 0 ? (marginBefore / totalFreight) * 100 : 0;
    const marginAfterPct = totalFreight > 0 ? (marginAfter / totalFreight) * 100 : 0;

    const content = `
      <html>
        <head>
          <title>Relatório Técnico de Carga - Midas Log</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1e293b; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { height: 60px; }
            .title { font-size: 24px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #1e293b; color: white; padding: 10px; font-size: 11px; text-transform: uppercase; }
            td { padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; }
            .summary { margin-top: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; }
            .summary-item { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
            .font-bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" class="logo" />
            <div class="title">Relatório Técnico de Carga</div>
          </div>
          <p><strong>Rota:</strong> ${load.rota}</p>
          <p><strong>Motorista:</strong> ${load.driver_name || 'NÃO INFORMADO'}</p>
          <p><strong>Data Salva:</strong> ${new Date(load.created_at).toLocaleString('pt-BR')}</p>
          
          <table>
            <thead>
              <tr>
                <th>Cidade</th>
                <th>UF</th>
                <th>Tipo</th>
                <th>Peso</th>
                <th>Alíquota</th>
                <th>Frete</th>
              </tr>
            </thead>
            <tbody>
              ${load.deliveries?.map((d: any) => `
                <tr>
                  <td>${d.city}</td>
                  <td style="text-align:center">${d.uf}</td>
                  <td style="text-align:center">${d.type}</td>
                  <td style="text-align:right">${formatCurrency(d.weight)}</td>
                  <td style="text-align:right">${d.aliquot.toFixed(4)}</td>
                  <td style="text-align:right">R$ ${formatCurrency(d.freight)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-item"><span>Peso Total:</span> <span class="font-bold">${formatCurrency(totalWeight)} KG</span></div>
            <div class="summary-item"><span>Frete Total Recebido:</span> <span class="font-bold">R$ ${formatCurrency(totalFreight)}</span></div>
            <div class="summary-item"><span>Total Pago ao Motorista:</span> <span class="font-bold">R$ ${formatCurrency(totalToPay)}</span></div>
            <div class="summary-item"><span>Imposto (9.98%):</span> <span class="font-bold">R$ ${formatCurrency(tax)}</span></div>
            
            <div class="summary-item" style="border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px;">
              <span>Margem Bruta (Antes do Imposto):</span> 
              <span class="font-bold" style="color: ${marginBefore >= 0 ? 'green' : 'red'}">
                R$ ${formatCurrency(marginBefore)} (${marginBeforePct.toFixed(2)}%)
              </span>
            </div>
            <div class="summary-item">
              <span class="font-bold">Margem Líquida (Depois do Imposto):</span> 
              <span class="font-bold" style="color: ${marginAfter >= 0 ? 'green' : 'red'}">
                R$ ${formatCurrency(marginAfter)} (${marginAfterPct.toFixed(2)}%)
              </span>
            </div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const filteredLoads = loads.filter(l => 
    l.rota.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 lg:px-8 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link to="/admin/external-loads">
            <Button variant="ghost" size="icon"><ArrowLeft /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Cargas Externas Salvas</h1>
            <p className="text-slate-500 text-xs">Histórico de snapshots salvos do Google Sheets.</p>
          </div>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <Input 
            placeholder="Buscar por rota..." 
            className="pl-10 h-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-8">
        <div className="grid gap-6">
          {filteredLoads.map(load => (
            <Card key={load.id} className="border-none shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-amber-600 mb-2">
                      <Calendar size={16} />
                      <span className="text-xs font-bold uppercase">Salvo em: {new Date(load.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{load.rota}</h3>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1"><Truck size={14} /> {load.deliveries?.length} entregas</span>
                      <span className="flex items-center gap-1 font-bold text-slate-700">
                        R$ {formatCurrency(load.total_to_pay)} (Pago)
                      </span>
                      <span className="flex items-center gap-1 text-blue-600 font-medium">
                        <User size={14} /> {load.driver_name || 'Sem motorista'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handlePrintMotorista(load)} className="gap-2">
                      <Printer size={16} /> Motorista
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePrintCompleto(load)} className="gap-2 border-amber-200 text-amber-700">
                      <FileText size={16} /> Imprimir Completo
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteLoad(load.id)} className="text-red-500 hover:bg-red-50">
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredLoads.length === 0 && (
            <div className="py-20 text-center bg-white rounded-xl border-2 border-dashed border-slate-200">
              <Bookmark className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-500">Nenhuma carga salva encontrada.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SavedExternalLoads;