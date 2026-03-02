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
  RotateCcw
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
  peso: number;
  pedido: string;
  chave: string;
}

interface RoutePoint {
  city: string;
  coords: [number, number];
  selectedClients: string[];
  weight: number;
}

// Componente para controlar o zoom e centralização do mapa
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
  const [cityCoords, setCityCoords] = useState<Record<string, [number, number]>>({});
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<RoutePoint[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      await loadCityCoords();
      const savedData = localStorage.getItem('cerbras_map_data');
      if (savedData) setDeliveries(JSON.parse(savedData));
      await fetchSavedRoutes();
      setLoading(false);
    };
    init();
  }, []);

  // Função de normalização idêntica ao Python (limpar_texto)
  const limparTexto = (txt: any) => {
    if (!txt) return "";
    // Remove acentos, converte para maiúsculo e remove sufixos de estado (ex: - CE)
    return String(txt)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .split('-')[0] // Pega apenas o nome da cidade antes do hífen
      .trim()
      .replace(/\s+/g, ' ');
  };

  // Função de conversão de peso robusta (conv_peso)
  const converterPeso = (v: any): number => {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === 'number') return v;
    
    let s = String(v).trim();
    try {
      if (s.includes('.') && s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else if (s.includes(',')) {
        s = s.replace(',', '.');
      }
      return parseFloat(s) || 0;
    } catch {
      return 0;
    }
  };

  const loadCityCoords = async () => {
    try {
      const response = await fetch('/CIDADES.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      const coords: Record<string, [number, number]> = {};
      data.forEach((row) => {
        const name = limparTexto(row[0]);
        const lat = parseFloat(row[2]);
        const lng = parseFloat(row[3]);
        if (name && !isNaN(lat) && !isNaN(lng)) {
          coords[name] = [lat, lng];
        }
      });
      setCityCoords(coords);
    } catch (error) {
      console.error("Erro ao carregar coordenadas:", error);
    }
  };

  const fetchSavedRoutes = async () => {
    const { data, error } = await supabase
      .from('cerbras_map_routes')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setSavedRoutes(data || []);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetName = wb.SheetNames.find(n => n.toUpperCase().includes("CARTEIRA")) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rawData.length < 2) throw new Error("Arquivo vazio ou sem dados.");

        const headers = rawData[0].map(h => String(h).toUpperCase().trim());
        const getIdx = (name: string) => headers.indexOf(name);

        const idxCli = getIdx('CLIENTE');
        const idxCid = getIdx('CIDADE');
        const idxPeso = getIdx('PESO');
        const idxPed = getIdx('PEDIDO');

        if (idxCid === -1 || idxPeso === -1) {
          throw new Error("Colunas 'CIDADE' ou 'PESO' não encontradas.");
        }

        const items: DeliveryItem[] = rawData.slice(1)
          .filter(row => row[idxCid] && !String(row[idxCid]).toUpperCase().includes("TOTAL"))
          .map(row => {
            const cidade = String(row[idxCid]).trim();
            return {
              cliente: String(row[idxCli] || 'NÃO INFORMADO').toUpperCase(),
              cidade: cidade,
              chave: limparTexto(cidade),
              peso: converterPeso(row[idxPeso]),
              pedido: String(row[idxPed] || '')
            };
          });

        setDeliveries(items);
        localStorage.setItem('cerbras_map_data', JSON.stringify(items));
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

  const citySummary = useMemo(() => {
    const summary: Record<string, { totalWeight: number, clients: Record<string, number>, originalName: string }> = {};
    deliveries.forEach(d => {
      if (!summary[d.chave]) summary[d.chave] = { totalWeight: 0, clients: {}, originalName: d.cidade };
      summary[d.chave].totalWeight += d.peso;
      summary[d.chave].clients[d.cliente] = (summary[d.chave].clients[d.cliente] || 0) + d.peso;
    });
    return summary;
  }, [deliveries]);

  const stats = useMemo(() => {
    const totalWeight = deliveries.reduce((acc, d) => acc + d.peso, 0);
    const totalDeliveries = new Set(deliveries.map(d => d.cliente)).size;
    const totalCities = Object.keys(citySummary).length;
    return { totalWeight, totalDeliveries, totalCities };
  }, [deliveries, citySummary]);

  const activeMarkersCoords = useMemo(() => {
    return Object.keys(citySummary)
      .map(chave => cityCoords[chave])
      .filter((coords): coords is [number, number] => !!coords);
  }, [citySummary, cityCoords]);

  const handleAddPointToRoute = (chave: string, coords: [number, number], clients: Record<string, number>) => {
    if (!isRouteMode) return;
    const cityName = citySummary[chave].originalName;
    const weight = citySummary[chave].totalWeight;
    setCurrentRoute([...currentRoute, { 
      city: cityName, 
      coords, 
      selectedClients: Object.keys(clients),
      weight: weight
    }]);
    showSuccess(`${cityName} adicionada.`);
  };

  const saveRoute = async () => {
    const name = prompt("Nome para esta rota:");
    if (!name || currentRoute.length === 0) return;
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
  };

  const deleteRoute = async (id: string) => {
    if (!confirm("Excluir rota?")) return;
    const { error } = await supabase.from('cerbras_map_routes').delete().eq('id', id);
    if (!error) fetchSavedRoutes();
  };

  const totalRouteWeight = useMemo(() => {
    return currentRoute.reduce((acc, p) => acc + p.weight, 0);
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

          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 border-amber-200 text-amber-700"
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
          >
            {processing ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
            Upload Base
          </Button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />

          <Button 
            variant={isRouteMode ? "destructive" : "default"} 
            size="sm" 
            onClick={() => {
              setIsRouteMode(!isRouteMode);
              if (!isRouteMode) setCurrentRoute([]);
            }}
            className="gap-2"
          >
            {isRouteMode ? <X size={16} /> : <RouteIcon size={16} />}
            {isRouteMode ? "Cancelar Rota" : "Montar Rota"}
          </Button>

          {isRouteMode && currentRoute.length > 0 && (
            <Button size="sm" onClick={saveRoute} className="bg-green-600 hover:bg-green-700 gap-2">
              <Save size={16} /> Salvar Rota
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
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => deleteRoute(route.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
                <div className="space-y-1">
                  {route.route_data.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span className="uppercase">{p.city}</span>
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
              const coords = cityCoords[chave];
              if (!coords) return null;
              const isSelectedInCurrentRoute = currentRoute.some(p => limparTexto(p.city) === chave);

              return (
                <Marker key={chave} position={coords} icon={L.divIcon({
                  className: 'custom-div-icon',
                  html: `<div style="background-color: ${isSelectedInCurrentRoute ? '#16a34a' : '#f59e0b'}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8]
                })}>
                  <Popup className="custom-popup">
                    <div className="p-2 min-w-[200px]">
                      <h3 className="font-bold text-lg border-b pb-1 mb-2 uppercase">{data.originalName}</h3>
                      <div className="flex justify-between items-center mb-3 bg-amber-50 p-2 rounded">
                        <span className="text-xs font-bold text-amber-700">PESO TOTAL:</span>
                        <span className="font-bold text-amber-900">{data.totalWeight.toLocaleString('pt-BR')} kg</span>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {Object.entries(data.clients).map(([client, weight]) => (
                          <div key={client} className="flex justify-between items-center text-[10px] border-b border-slate-100 pb-1">
                            <span className="font-medium text-slate-600 truncate max-w-[120px]">{client}</span>
                            <span className="font-bold text-slate-900">{weight.toLocaleString('pt-BR')} kg</span>
                          </div>
                        ))}
                      </div>
                      {isRouteMode && (
                        <Button size="sm" className="w-full mt-4 bg-amber-600 hover:bg-amber-700 h-8 text-[10px]" onClick={() => handleAddPointToRoute(chave, coords, data.clients)}>
                          <Plus size={12} className="mr-1" /> Incluir na Rota
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
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Cidades Selecionadas:</span>
                  <span className="font-bold">{currentRoute.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Peso Total da Rota:</span>
                  <span className="font-bold text-amber-700">{totalRouteWeight.toLocaleString('pt-BR')} kg</span>
                </div>
                <div className="border-t pt-3 mt-3 max-h-40 overflow-y-auto space-y-2">
                  <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                    <div className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[8px]">0</div>
                    MARACANAÚ
                  </div>
                  {currentRoute.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 text-[10px] group">
                      <div className="w-4 h-4 rounded-full bg-green-600 text-white flex items-center justify-center text-[8px]">{i + 1}</div>
                      <span className="uppercase font-bold flex-1 truncate">{p.city}</span>
                      <span className="text-slate-400">{(p.weight/1000).toFixed(1)}t</span>
                      <button onClick={() => setCurrentRoute(currentRoute.filter((_, idx) => idx !== i))} className="text-red-400 opacity-0 group-hover:opacity-100"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button variant="outline" size="sm" className="text-[10px] h-8" onClick={() => setCurrentRoute([])}>Limpar</Button>
                <Button size="sm" className="text-[10px] h-8 bg-slate-900" onClick={saveRoute} disabled={currentRoute.length === 0}>Salvar Rota</Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CerbrasWeightsByCity;