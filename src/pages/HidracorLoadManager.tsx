"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Truck, 
  Package, 
  Printer, 
  Save, 
  Loader2,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useParams, Link, useNavigate } from 'react-router-dom';

const HidracorLoadManager = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [load, setLoad] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeShipment, setActiveShipment] = useState("1");

  useEffect(() => {
    fetchLoad();
  }, [id]);

  const fetchLoad = async () => {
    try {
      const { data, error } = await supabase.from('hidracor_saved_loads').select('*').eq('id', id).single();
      if (error) throw error;
      setLoad(data);
    } catch (error: any) {
      showError(error.message);
      navigate('/admin/hidracor-loads');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('hidracor_saved_loads').update({ shipments: load.shipments }).eq('id', id);
      if (error) throw error;
      showSuccess("Embarques salvos!");
    } catch (error: any) {
      showError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const formatWeight = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg';
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const moveToShipment = (pedidoId: string, targetShipment: string) => {
    const newShipments = { ...load.shipments };
    Object.keys(newShipments).forEach(key => {
      newShipments[key] = newShipments[key].filter((id: string) => id !== pedidoId);
    });
    if (targetShipment !== "0") newShipments[targetShipment].push(pedidoId);
    setLoad({ ...load, shipments: newShipments });
  };

  const getShipmentItems = (shipmentId: string) => {
    const ids = load.shipments[shipmentId] || [];
    return load.items.filter((item: any) => ids.includes(item.Pedido?.toString()));
  };

  const unassignedItems = useMemo(() => {
    if (!load) return [];
    const assignedIds = new Set<string>();
    Object.values(load.shipments).forEach((ids: any) => ids.forEach((id: string) => assignedIds.add(id)));
    return load.items.filter((item: any) => !assignedIds.has(item.Pedido?.toString()));
  }, [load]);

  const handlePrintLoad = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalPeso = load.items.reduce((acc: number, i: any) => acc + parseFloat(i['peso total'] || 0), 0);
    const totalValor = load.items.reduce((acc: number, i: any) => acc + parseFloat(i['valor total'] || 0), 0);

    const content = `
      <html>
        <head>
          <title>Carga Hidracor - ${load.name}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            h1 { color: #1e293b; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f8fafc; text-align: left; padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; }
            td { padding: 10px; border: 1px solid #e2e8f0; font-size: 11px; }
            .total-row { background: #f1f5f9; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Carga: ${load.name}</h1>
          <p>Data: ${new Date(load.created_at).toLocaleDateString('pt-BR')}</p>
          <table>
            <thead>
              <tr><th>Pedido</th><th>Cliente</th><th>Município</th><th>Peso Total</th><th>Valor Total</th></tr>
            </thead>
            <tbody>
              ${load.items.map((item: any) => `
                <tr>
                  <td>${item.Pedido}</td><td>${item['Nome Cliente']}</td><td>${item['Município']}</td>
                  <td style="text-align:right">${formatWeight(parseFloat(item['peso total']))}</td>
                  <td style="text-align:right">${formatCurrency(parseFloat(item['valor total']))}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="3" style="text-align:right">SOMA TOTAL:</td>
                <td style="text-align:right">${formatWeight(totalPeso)}</td>
                <td style="text-align:right">${formatCurrency(totalValor)}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintShipments = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let shipmentsHtml = '';
    let grandTotalPeso = 0;
    let grandTotalValor = 0;

    Object.keys(load.shipments).forEach(key => {
      const items = getShipmentItems(key);
      if (items.length === 0) return;

      const subPeso = items.reduce((acc: number, i: any) => acc + parseFloat(i['peso total'] || 0), 0);
      const subValor = items.reduce((acc: number, i: any) => acc + parseFloat(i['valor total'] || 0), 0);
      grandTotalPeso += subPeso;
      grandTotalValor += subValor;

      shipmentsHtml += `
        <div style="page-break-after: always; margin-bottom: 40px;">
          <h2 style="background: #1e293b; color: white; padding: 10px;">EMBARQUE ${key} - ${load.name}</h2>
          <table>
            <thead>
              <tr><th>Pedido</th><th>Cliente</th><th>Município</th><th>Peso Total</th><th>Valor Total</th></tr>
            </thead>
            <tbody>
              ${items.map((item: any) => `
                <tr>
                  <td>${item.Pedido}</td><td>${item['Nome Cliente']}</td><td>${item['Município']}</td>
                  <td style="text-align:right">${formatWeight(parseFloat(item['peso total']))}</td>
                  <td style="text-align:right">${formatCurrency(parseFloat(item['valor total']))}</td>
                </tr>
              `).join('')}
              <tr style="background:#f8fafc; font-weight:bold;">
                <td colspan="3" style="text-align:right">SUBTOTAL EMBARQUE ${key}:</td>
                <td style="text-align:right">${formatWeight(subPeso)}</td>
                <td style="text-align:right">${formatCurrency(subValor)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    });

    const content = `
      <html>
        <head>
          <title>Embarques - ${load.name}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f8fafc; text-align: left; padding: 8px; border: 1px solid #e2e8f0; font-size: 12px; }
            td { padding: 8px; border: 1px solid #e2e8f0; font-size: 11px; }
            .grand-total { margin-top: 40px; padding: 20px; border: 2px solid #1e293b; background: #f1f5f9; }
          </style>
        </head>
        <body>
          ${shipmentsHtml || '<p>Nenhum embarque configurado.</p>'}
          <div class="grand-total">
            <h3 style="margin-top:0">RESUMO GERAL DA CARGA</h3>
            <p><strong>PESO TOTAL (TODOS EMBARQUES):</strong> ${formatWeight(grandTotalPeso)}</p>
            <p><strong>VALOR TOTAL (TODOS EMBARQUES):</strong> ${formatCurrency(grandTotalValor)}</p>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b p-4 lg:px-8 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link to="/admin/hidracor-loads"><Button variant="ghost" size="icon"><ArrowLeft /></Button></Link>
          <div><h1 className="text-xl font-bold text-slate-900">{load.name}</h1><p className="text-slate-500 text-xs">Gerenciamento de embarques.</p></div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrintLoad} className="gap-2"><Printer size={16} /> Imprimir Carga</Button>
          <Button variant="outline" size="sm" onClick={handlePrintShipments} className="gap-2"><Package size={16} /> Imprimir Embarques</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-amber-600 text-white gap-2">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar</Button>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-8 grid lg:grid-cols-3 gap-8 overflow-hidden">
        <Card className="lg:col-span-1 flex flex-col overflow-hidden border-none shadow-sm">
          <CardHeader className="bg-slate-900 text-white py-4"><CardTitle className="text-sm uppercase tracking-wider">Itens Disponíveis ({unassignedItems.length})</CardTitle></CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            <div className="divide-y">
              {unassignedItems.map((item: any) => (
                <div key={item.Pedido} className="p-4 hover:bg-slate-50 group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-amber-600">PEDIDO: {item.Pedido}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {[1, 2, 3].map(n => <Button key={n} size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => moveToShipment(item.Pedido?.toString(), n.toString())}>E{n}</Button>)}
                    </div>
                  </div>
                  <p className="text-xs font-bold uppercase truncate">{item['Nome Cliente']}</p>
                  <div className="mt-2 flex justify-between text-[10px] font-medium">
                    <span>PESO: {formatWeight(parseFloat(item['peso total']))}</span>
                    <span className="text-amber-700">VALOR: {formatCurrency(parseFloat(item['valor total']))}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 flex flex-col overflow-hidden border-none shadow-sm">
          <CardHeader className="py-4 border-b">
            <Tabs value={activeShipment} onValueChange={setActiveShipment} className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="1">Embarque 1</TabsTrigger><TabsTrigger value="2">Embarque 2</TabsTrigger><TabsTrigger value="3">Embarque 3</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="text-[10px] uppercase">Pedido</TableHead>
                  <TableHead className="text-[10px] uppercase">Cliente</TableHead>
                  <TableHead className="text-[10px] uppercase">Peso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getShipmentItems(activeShipment).map((item: any) => (
                  <TableRow key={item.Pedido}>
                    <TableCell className="text-xs font-bold">{item.Pedido}</TableCell>
                    <TableCell className="text-xs uppercase truncate max-w-[200px]">{item['Nome Cliente']}</TableCell>
                    <TableCell className="text-xs">{formatWeight(parseFloat(item['peso total']))}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => moveToShipment(item.Pedido?.toString(), "0")}><Trash2 size={14} /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <div className="p-4 bg-slate-50 border-t flex justify-between items-center">
            <div className="text-xs font-bold text-slate-600">{getShipmentItems(activeShipment).length} ITENS</div>
            <div className="text-xs font-bold text-amber-700">
              PESO TOTAL: {formatWeight(getShipmentItems(activeShipment).reduce((acc: number, i: any) => acc + parseFloat(i['peso total'] || 0), 0))}
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default HidracorLoadManager;