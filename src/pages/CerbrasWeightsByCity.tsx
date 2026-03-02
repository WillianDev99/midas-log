"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
  Upload, 
  MapPin, 
  Truck, 
  Package, 
  Calculator, 
  Loader2, 
  Save, 
  Trash2, 
  Plus,
  X,
  ChevronRight,
  Layers,
  Route as RouteIcon,
  RotateCcw,
  Search,
  Printer,
  Edit3,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Correção para ícones do Leaflet no React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const MARACANAU_COORDS: [number, number] = [-3.8767, -38.6256];

interface DeliveryItem {
  cliente: string;
  cidade: string;
  uf: string;
  peso: number;
  pedido: string;
  produto: string;
  palet: number;
  m2: number;
  valorTot: number;
  chave: string; 
}

interface RouteClient {
  name: string;
  weight: number;
  pedido: string;
  produto: string;
  palet: number;
  m2: number;
  valorTot: number;
}

interface RoutePoint {
  city: string;
  uf: string;
  coords: [number, number];
  clients: RouteClient[];
  totalWeight: number;
}

const MapController = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds([MARACANAU_COORDS, ...points]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [points, map]);
  return null;
};

const CerbrasWeightsByCity = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [cityCoords, setCityCoords] = useState<Record<string, [number, number]>>({});
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<RoutePoint[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<any[]>([]);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      // Carregar coordenadas salvas primeiro
      const savedCoords = localStorage.getItem('cerbras_city_coords');
      if (savedCoords) {
        setCityCoords(JSON.parse(savedCoords));
      } else {
        await loadCityCoords();
      }

      const savedData = localStorage.getItem('cerbras_map_data');
      if (savedData) setDeliveries(JSON.parse(savedData));
      
      await fetchSavedRoutes();
      setLoading(false);
    };
    init();
  }, []);

  // Salvar coordenadas sempre que mudarem
  useEffect(() => {
    if (Object.keys(cityCoords).length > 0) {
      localStorage.setItem('cerbras_city_coords', JSON.stringify(cityCoords));
    }
  }, [cityCoords]);

  const normalizarParaMatch = (txt: any) => {
    if (!txt) return "";
    return String(txt)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .trim();
  };

  const converterNumero = (v: any): number => {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === 'number') return v;
    let s = String(v).trim().replace(/\s/g, '');
    if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
    else if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  };

  const loadCityCoords = async () => {
    try {
      const response = await fetch('/CIDADES.xlsx');
      if (!response.ok) throw new Error("Arquivo CIDADES.xlsx não encontrado");
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      const coords: Record<string, [number, number]> = {};
      data.forEach((row, i) => {
        if (i === 0) return;
        const city = normalizarParaMatch(row[0]);
        const uf = normalizarParaMatch(row[1]);
        const lat = converterNumero(row[2]);
        const lng = converterNumero(row[3]);
        
        if (city && uf && lat !== 0 && lng !== 0) {
          coords[`${city}|${uf}`] = [lat, lng];
        }
      });
      setCityCoords(coords);
    } catch (error) {
      console.warn("Aviso: Não foi possível carregar CIDADES.xlsx");
    }
  };

  const fetchCoordsFromAPI = async (cidade: string, uf: string) => {
    try {
      const query = encodeURIComponent(`${cidade}, ${uf}, Brazil`);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)] as [number, number];
      }
    } catch (error) {
      console.error(`Erro ao buscar coordenadas para ${cidade}:`, error);
    }
    return null;
  };

  const fetchSavedRoutes = async () => {
    const { data, error } = await supabase
      .from('cerbras_map_routes')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setSavedRoutes(data || []);
  };

  // Algoritmo de ordenação lógica (Vizinho Mais Próximo)
  const sortRouteLogically = (points: RoutePoint[]): RoutePoint[] => {
    if (points.length <= 1) return points;

    const calculateDistance = (c1: [number, number], c2: [number, number]) => {
      return Math.sqrt(Math.pow(c1[0] - c2[0], 2) + Math.pow(c1[1] - c2[1], 2));
    };

    const sorted: RoutePoint[] = [];
    let remaining = [...points];
    let currentPos = MARACANAU_COORDS;

    while (remaining.length > 0) {
      let closestIdx = 0;
      let minDistance = calculateDistance(currentPos, remaining[0].coords);

      for (let i = 1; i < remaining.length; i++) {
        const dist = calculateDistance(currentPos, remaining[i].coords);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }

      const nextPoint = remaining.splice(closestIdx, 1)[0];
      sorted.push(nextPoint);
      currentPos = nextPoint.coords;
    }

    return sorted;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetName = wb.SheetNames.find(n => n.toUpperCase().includes("CARTEIRA")) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const headers = rawData[0].map(h => String(h).toUpperCase().trim());
        const getIdx = (name: string) => headers.indexOf(name);

        const idxCli = getIdx('CLIENTE');
        const idxCid = getIdx('CIDADE');
        const idxUF = getIdx('UF');
        const idxPeso = getIdx('PESO');
        const idxPed = getIdx('PEDIDO');
        const idxProd = getIdx('PRODUTO');
        const idxPalet = getIdx('PALET');
        const idxM2 = getIdx('M²');
        const idxVal = getIdx('VAL TOT');

        const items: DeliveryItem[] = rawData.slice(1)
          .filter(row => row[idxCid] && !String(row[idxCid]).toUpperCase().includes("TOTAL"))
          .map(row => {
            const cidade = String(row[idxCid]).trim();
            const uf = String(row[idxUF] || '').trim();
            return {
              cliente: String(row[idxCli] || 'NÃO INFORMADO').toUpperCase(),
              cidade: cidade,
              uf: uf,
              chave: `${normalizarParaMatch(cidade)}|${normalizarParaMatch(uf)}`,
              peso: converterNumero(row[idxPeso]),
              pedido: String(row[idxPed] || ''),
              produto: String(row[idxProd] || ''),
              palet: converterNumero(row[idxPalet]),
              m2: converterNumero(row[idxM2]),
              valorTot: converterNumero(row[idxVal])
            };
          });

        setDeliveries(items);
        localStorage.setItem('cerbras_map_data', JSON.stringify(items));
        await geocodeMissingCities(items);
        showSuccess(`${items.length} registros carregados!`);
      } catch (error: any) {
        showError("Erro ao processar: " + error.message);
      } finally {
        setProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const geocodeMissingCities = async (items: DeliveryItem[]) => {
    setGeocoding(true);
    const uniqueCities = Array.from(new Set(items.map(i => i.chave)));
    const newCoords = { ...cityCoords };
    let foundCount = 0;

    for (const chave of uniqueCities) {
      if (!newCoords[chave]) {
        const item = items.find(i => i.chave === chave);
        if (item) {
          const coords = await fetchCoordsFromAPI(item.cidade, item.uf);
          if (coords) {
            newCoords[chave] = coords;
            foundCount++;
            await new Promise(r => setTimeout(r, 500));
          }
        }
      }
    }

    if (foundCount > 0) setCityCoords(newCoords);
    setGeocoding(false);
  };

  const citySummary = useMemo(() => {
    const summary: Record<string, { totalWeight: number, clients: Record<string, DeliveryItem[]>, originalName: string, uf: string }> = {};
    deliveries.forEach(d => {
      if (!summary[d.chave]) {
        summary[d.chave] = { totalWeight: 0, clients: {}, originalName: d.cidade, uf: d.uf };
      }
      summary[d.chave].totalWeight += d.peso;
      if (!summary[d.chave].clients[d.cliente]) {
        summary[d.chave].clients[d.cliente] = [];
      }
      summary[d.chave].clients[d.cliente].push(d);
    });
    return summary;
  }, [deliveries]);

  const stats = useMemo(() => {
    const totalWeight = deliveries.reduce((acc, d) => acc + d.peso, 0);
    const totalDeliveries = new Set(deliveries.map(d => d.cliente)).size;
    const totalCities = Object.keys(citySummary).length;
    return { totalWeight, totalDeliveries, totalCities };
  }, [deliveries, citySummary]);

  const getCoordsForCity = (chave: string) => {
    return cityCoords[chave] || null;
  };

  const activeMarkersCoords = useMemo(() => {
    return Object.keys(citySummary)
      .map(chave => getCoordsForCity(chave))
      .filter((coords): coords is [number, number] => !!coords);
  }, [citySummary, cityCoords]);

  const handleAddClientToRoute = (chave: string, coords: [number, number], clientName: string) => {
    if (!isRouteMode) return;
    const cityData = citySummary[chave];
    const clientItems = cityData.clients[clientName];
    
    let newRoute = [...currentRoute];
    const existingPointIdx = newRoute.findIndex(p => `${normalizarParaMatch(p.city)}|${normalizarParaMatch(p.uf)}` === chave);

    if (existingPointIdx > -1) {
      const point = { ...newRoute[existingPointIdx] };
      const alreadyHasClient = point.clients.some(c => c.name === clientName);
      
      if (alreadyHasClient) {
        // Remover todos os itens desse cliente
        const clientWeight = clientItems.reduce((acc, i) => acc + i.peso, 0);
        point.totalWeight -= clientWeight;
        point.clients = point.clients.filter(c => c.name !== clientName);
        
        if (point.clients.length === 0) {
          newRoute.splice(existingPointIdx, 1);
        } else {
          newRoute[existingPointIdx] = point;
        }
        showSuccess(`${clientName} removido.`);
      } else {
        // Adicionar todos os itens desse cliente
        clientItems.forEach(item => {
          point.clients.push({
            name: item.cliente,
            weight: item.peso,
            pedido: item.pedido,
            produto: item.produto,
            palet: item.palet,
            m2: item.m2,
            valorTot: item.valorTot
          });
          point.totalWeight += item.peso;
        });
        newRoute[existingPointIdx] = point;
        showSuccess(`${clientName} adicionado.`);
      }
    } else {
      const clientsToAdd = clientItems.map(item => ({
        name: item.cliente,
        weight: item.peso,
        pedido: item.pedido,
        produto: item.produto,
        palet: item.palet,
        m2: item.m2,
        valorTot: item.valorTot
      }));
      newRoute.push({
        city: cityData.originalName,
        uf: cityData.uf,
        coords,
        clients: clientsToAdd,
        totalWeight: clientItems.reduce((acc, i) => acc + i.peso, 0)
      });
      showSuccess(`${clientName} adicionado.`);
    }
    setCurrentRoute(sortRouteLogically(newRoute));
  };

  const handleAddAllCityToRoute = (chave: string, coords: [number, number]) => {
    if (!isRouteMode) return;
    const cityData = citySummary[chave];
    
    let newRoute = [...currentRoute];
    const existingPointIdx = newRoute.findIndex(p => `${normalizarParaMatch(p.city)}|${normalizarParaMatch(p.uf)}` === chave);

    const allClients: RouteClient[] = [];
    Object.values(cityData.clients).forEach(items => {
      items.forEach(item => {
        allClients.push({
          name: item.cliente,
          weight: item.peso,
          pedido: item.pedido,
          produto: item.produto,
          palet: item.palet,
          m2: item.m2,
          valorTot: item.valorTot
        });
      });
    });

    if (existingPointIdx > -1) {
      const currentPoint = newRoute[existingPointIdx];
      if (currentPoint.clients.length === allClients.length) {
        newRoute.splice(existingPointIdx, 1);
        showSuccess(`Cidade ${cityData.originalName} removida.`);
      } else {
        newRoute[existingPointIdx] = {
          ...currentPoint,
          clients: allClients,
          totalWeight: cityData.totalWeight
        };
        showSuccess(`Cidade ${cityData.originalName} completa.`);
      }
    } else {
      newRoute.push({
        city: cityData.originalName,
        uf: cityData.uf,
        coords,
        clients: allClients,
        totalWeight: cityData.totalWeight
      });
      showSuccess(`Cidade ${cityData.originalName} adicionada.`);
    }
    setCurrentRoute(sortRouteLogically(newRoute));
  };

  const saveRoute = async () => {
    const name = prompt("Nome para esta rota:", editingRouteId ? savedRoutes.find(r => r.id === editingRouteId)?.name : "");
    if (!name || currentRoute.length === 0) return;

    if (editingRouteId) {
      const { error } = await supabase.from('cerbras_map_routes').update({
        name: name.toUpperCase(),
        route_data: currentRoute
      }).eq('id', editingRouteId);
      if (error) showError(error.message);
      else {
        showSuccess("Rota atualizada!");
        setEditingRouteId(null);
        setIsRouteMode(false);
        setCurrentRoute([]);
        fetchSavedRoutes();
      }
    } else {
      const { error } = await supabase.from('cerbras_map_routes').insert([{
        user_id: user?.id,
        name: name.toUpperCase(),
        route_data: currentRoute
      }]);
      if (error) showError(error.message);
      else {
        showSuccess("Rota salva!");
        setIsRouteMode(false);
        setCurrentRoute([]);
        fetchSavedRoutes();
      }
    }
  };

  const editSavedRoute = (route: any) => {
    setEditingRouteId(route.id);
    setCurrentRoute(route.route_data);
    setIsRouteMode(true);
    showSuccess(`Editando rota: ${route.name}`);
  };

  const deleteRoute = async (id: string) => {
    if (!confirm("Excluir rota?")) return;
    const { error } = await supabase.from('cerbras_map_routes').delete().eq('id', id);
    if (!error) fetchSavedRoutes();
  };

  const handlePrintRoute = (route: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalWeight = route.route_data.reduce((acc: number, p: any) => acc + p.totalWeight, 0);
    const totalPalet = route.route_data.reduce((acc: number, p: any) => acc + p.clients.reduce((a: number, c: any) => a + (c.palet || 0), 0), 0);
    const totalM2 = route.route_data.reduce((acc: number, p: any) => acc + p.clients.reduce((a: number, c: any) => a + (c.m2 || 0), 0), 0);
    const totalVal = route.route_data.reduce((acc: number, p: any) => acc + p.clients.reduce((a: number, c: any) => a + (c.valorTot || 0), 0), 0);
    
    const logoUrl = window.location.origin + "/logo.png";

    const content = `
      <html>
        <head>
          <title>Rota Cerbras - ${route.name}</title>
          <style>
            body { font-family: sans-serif; padding: 30px; color: #333; font-size: 12px; }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #f59e0b; padding-bottom: 15px; margin-bottom: 20px; }
            .logo { height: 50px; }
            .title { font-size: 20px; font-weight: bold; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .summary-item { text-align: center; }
            .summary-label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: bold; }
            .summary-value { font-size: 14px; font-weight: bold; color: #1e293b; }
            .stop { margin-bottom: 25px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            .stop-header { background: #1e293b; color: white; padding: 8px 15px; display: flex; justify-content: space-between; align-items: center; }
            .stop-title { font-weight: bold; text-transform: uppercase; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; padding: 8px 12px; background: #f1f5f9; font-size: 9px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0; }
            td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 10px; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" class="logo" />
            <div class="title">Relatório de Rota Cerbras</div>
          </div>
          
          <div class="summary">
            <div class="summary-item">
              <div class="summary-label">Rota</div>
              <div class="summary-value">${route.name}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Peso Total</div>
              <div class="summary-value">${totalWeight.toLocaleString('pt-BR')} kg</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total M²</div>
              <div class="summary-value">${totalM2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} m²</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Valor Total</div>
              <div class="summary-value">R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          ${route.route_data.map((p: any, i: number) => `
            <div class="stop">
              <div class="stop-header">
                <div class="stop-title">PARADA ${i + 1}: ${p.city} - ${p.uf}</div>
                <div style="font-size: 10px">${p.totalWeight.toLocaleString('pt-BR')} kg</div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Produto</th>
                    <th class="text-right">Palet</th>
                    <th class="text-right">M²</th>
                    <th class="text-right">Peso</th>
                    <th class="text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  ${p.clients.map((c: any) => `
                    <tr>
                      <td>${c.pedido}</td>
                      <td style="text-transform: uppercase">${c.name}</td>
                      <td style="text-transform: uppercase">${c.produto}</td>
                      <td class="text-right">${c.palet}</td>
                      <td class="text-right">${c.m2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td class="text-right font-bold">${c.weight.toLocaleString('pt-BR')} kg</td>
                      <td class="text-right">R$ ${c.valorTot.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}

          <div class="footer">Midas Logística - Eficiência em Movimento</div>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const totalRouteWeightValue = useMemo(() => {
    return currentRoute.reduce((acc, p) => acc + p.totalWeight, 0);
  }, [currentRoute]);

  const totalRouteClientsCount = useMemo(() => {
    return currentRoute.reduce((acc, p) => acc + p.clients.length, 0);
  }, [currentRoute]);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b p-4 lg:px-8 flex justify-between items-center z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft /></Button></Link>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Midas Log" className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">Pesos por Cidade (Cerbras)</h1>
              <p className="text-slate-500 text-xs">Visualização geográfica e montagem de rotas.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {geocoding && (
            <div className="flex items-center gap-2 text-amber-600 animate-pulse mr-4">
              <Search size={16} className="animate-bounce" />
              <span className="text-[10px] font-bold uppercase">Buscando Coordenadas...</span>
            </div>
          )}

          <div className="hidden md:flex items-center gap-4 mr-6">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Peso Total</p>
              <p className="text-sm font-bold text-amber-600">{stats.totalWeight.toLocaleString('pt-BR')} kg</p>
            </div>
            <div className="text-right border-l pl-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Entregas</p>
              <p className="text-sm font-bold text-blue-600">{stats.totalDeliveries}</p>
            </div>
            <div className="text-right border-l pl-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Cidades</p>
              <p className="text-sm font-bold text-slate-700">{stats.totalCities}</p>
            </div>
          </div>

          <Button variant="outline" size="sm" className="gap-2 border-amber-200 text-amber-700" onClick={() => fileInputRef.current?.click()} disabled={processing}>
            {processing ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
            Upload Base
          </Button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />

          <Button variant={isRouteMode ? "destructive" : "default"} size="sm" onClick={() => { setIsRouteMode(!isRouteMode); if (!isRouteMode) { setCurrentRoute([]); setEditingRouteId(null); } }} className="gap-2">
            {isRouteMode ? <X size={16} /> : <RouteIcon size={16} />}
            {isRouteMode ? "Cancelar Rota" : "Montar Rota"}
          </Button>

          {isRouteMode && currentRoute.length > 0 && (
            <Button size="sm" onClick={saveRoute} className="bg-green-600 hover:bg-green-700 gap-2">
              <Save size={16} /> {editingRouteId ? "Atualizar Rota" : "Salvar Rota"}
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <aside className="w-80 bg-white border-r overflow-y-auto hidden lg:flex flex-col">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Layers size={18} className="text-amber-600" /> Rotas Salvas
            </h3>
          </div>
          <div className="flex-1 divide-y">
            {savedRoutes.map(route => (
              <div key={route.id} className="p-4 hover:bg-slate-50 group transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-sm text-slate-800">{route.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-500" onClick={() => handlePrintRoute(route)}>
                      <Printer size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-500" onClick={() => editSavedRoute(route)}>
                      <Edit3 size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => deleteRoute(route.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  {route.route_data.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span className="uppercase">{p.city} ({p.clients.length} cli)</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex-1 relative z-10">
          <MapContainer center={MARACANAU_COORDS} zoom={7} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapController points={activeMarkersCoords} />
            
            <Marker position={MARACANAU_COORDS} icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: #1e293b; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            })}>
              <Popup><strong>PONTO INICIAL: MARACANAÚ-CE</strong></Popup>
            </Marker>

            {Object.entries(citySummary).map(([chave, data]) => {
              const coords = getCoordsForCity(chave);
              if (!coords) return null;
              const isSelectedInCurrentRoute = currentRoute.some(p => `${normalizarParaMatch(p.city)}|${normalizarParaMatch(data.uf)}` === chave);

              return (
                <Marker key={chave} position={coords} icon={L.divIcon({
                  className: 'custom-div-icon',
                  html: `<div style="background-color: ${isSelectedInCurrentRoute ? '#16a34a' : '#f59e0b'}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8]
                })}>
                  <Popup className="custom-popup">
                    <div className="p-2 min-w-[240px]">
                      <h3 className="font-bold text-lg border-b pb-1 mb-2 uppercase">{data.originalName} - {data.uf}</h3>
                      <div className="flex justify-between items-center mb-3 bg-amber-50 p-2 rounded">
                        <span className="text-xs font-bold text-amber-700">PESO TOTAL:</span>
                        <span className="font-bold text-amber-900">{data.totalWeight.toLocaleString('pt-BR')} kg</span>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1 mb-4">
                        {Object.entries(data.clients).map(([client, items]) => {
                          const isClientSelected = currentRoute.some(p => 
                            `${normalizarParaMatch(p.city)}|${normalizarParaMatch(data.uf)}` === chave && 
                            p.clients.some(c => c.name === client)
                          );
                          const clientWeight = items.reduce((acc, i) => acc + i.peso, 0);
                          return (
                            <div key={client} className="flex justify-between items-center text-[10px] border-b border-slate-100 pb-2 last:border-0">
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-600 truncate max-w-[140px]">{client}</span>
                                <span className="font-bold text-slate-900">{clientWeight.toLocaleString('pt-BR')} kg</span>
                              </div>
                              {isRouteMode && (
                                <Button 
                                  size="icon" 
                                  variant={isClientSelected ? "default" : "outline"} 
                                  className={`h-6 w-6 ${isClientSelected ? 'bg-red-500 hover:bg-red-600 border-red-500' : ''}`} 
                                  onClick={() => handleAddClientToRoute(chave, coords, client)}
                                >
                                  {isClientSelected ? <X size={12} /> : <Plus size={12} />}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {isRouteMode && (
                        <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700 h-8 text-[10px] gap-2" onClick={() => handleAddAllCityToRoute(chave, coords)}>
                          <Plus size={12} /> {isSelectedInCurrentRoute ? "Remover/Atualizar Cidade" : "Incluir Cidade Completa"}
                        </Button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {isRouteMode && currentRoute.length > 0 && (
              <Polyline positions={[MARACANAU_COORDS, ...currentRoute.map(p => p.coords)]} color="#16a34a" weight={3} dashArray="5, 10" />
            )}

            {savedRoutes.map((route, idx) => (
              <Polyline key={route.id} positions={[MARACANAU_COORDS, ...route.route_data.map((p: any) => p.coords)]} color={['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'][idx % 4]} weight={2} opacity={0.6} />
            ))}
          </MapContainer>

          {isRouteMode && (
            <div className="absolute bottom-10 left-10 z-[1000] bg-white p-5 rounded-lg shadow-2xl border-2 border-slate-900 w-80">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-sm uppercase tracking-tight flex items-center gap-2">
                  <Truck size={18} className="text-amber-600" /> Painel de Rota
                </h4>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentRoute([])}><RotateCcw size={14} /></Button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 p-2 rounded border">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Cidades</p>
                    <p className="text-sm font-bold">{currentRoute.length}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Clientes</p>
                    <p className="text-sm font-bold">{totalRouteClientsCount}</p>
                  </div>
                </div>
                <div className="flex justify-between text-xs bg-amber-50 p-2 rounded border border-amber-100">
                  <span className="text-amber-700 font-bold uppercase">Peso Total:</span>
                  <span className="font-bold text-amber-900">{totalRouteWeightValue.toLocaleString('pt-BR')} kg</span>
                </div>
                <div className="border-t pt-3 mt-3 max-h-40 overflow-y-auto space-y-2">
                  <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                    <div className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[8px]">0</div>
                    MARACANAÚ
                  </div>
                  {currentRoute.map((p, i) => (
                    <div key={i} className="flex flex-col gap-1 p-2 bg-slate-50 rounded border border-slate-100 group">
                      <div className="flex items-center gap-3 text-[10px]">
                        <div className="w-4 h-4 rounded-full bg-green-600 text-white flex items-center justify-center text-[8px]">{i + 1}</div>
                        <span className="uppercase font-bold flex-1 truncate">{p.city}</span>
                        <span className="text-slate-400">{(p.totalWeight/1000).toFixed(1)}t</span>
                        <button onClick={() => setCurrentRoute(currentRoute.filter((_, idx) => idx !== i))} className="text-red-400 opacity-0 group-hover:opacity-100"><X size={12} /></button>
                      </div>
                      <div className="pl-7 flex flex-wrap gap-1">
                        {p.clients.map((c, ci) => (
                          <span key={ci} className="text-[8px] bg-white px-1 rounded border text-slate-500 flex items-center gap-1">
                            {c.name.split(' ')[0]}
                            <button 
                              onClick={() => handleAddClientToRoute(`${normalizarParaMatch(p.city)}|${normalizarParaMatch(p.uf)}`, p.coords, c.name)}
                              className="text-red-400 hover:text-red-600"
                            >
                              <X size={8} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button variant="outline" size="sm" className="text-[10px] h-8" onClick={() => { setCurrentRoute([]); setEditingRouteId(null); }}>Limpar</Button>
                <Button size="sm" className="text-[10px] h-8 bg-slate-900" onClick={saveRoute} disabled={currentRoute.length === 0}>
                  {editingRouteId ? "Atualizar" : "Salvar Rota"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CerbrasWeightsByCity;