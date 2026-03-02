"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
  Route as RouteIcon
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

interface CityCoord {
  city: string;
  lat: number;
  lng: number;
}

interface DeliveryItem {
  cliente: string;
  cidade: string;
  peso: number;
  pedido: string;
}

interface RoutePoint {
  city: string;
  coords: [number, number];
  selectedClients: string[];
}

const CerbrasWeightsByCity = () => {
  const { user } = useAuth();
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

  const loadCityCoords = async () => {
    try {
      const response = await fetch('/CIDADES.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data: any[] = XLSX.utils.sheet_to_json(sheet);
      
      const coords: Record<string, [number, number]> = {};
      data.forEach(row => {
        const name = String(row['CIDADE'] || '').toUpperCase().trim();
        const lat = parseFloat(row['LATITUDE']);
        const lng = parseFloat(row['LONGITUDE']);
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
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rawData.length < 2) throw new Error("Arquivo vazio.");

        // Mapeamento de colunas baseado no arquivo BASE.xlsx
        // Coluna A: Cliente, Coluna D: Cidade, Coluna P: Peso (Paletes * Peso Unitário)
        // Como o arquivo BASE já vem formatado pelo sistema, vamos usar as colunas do preview
        const headers = rawData[0].map(h => String(h).toUpperCase());
        const getIdx = (name: string) => headers.indexOf(name);

        const idxCli = getIdx('CLIENTE');
        const idxCid = getIdx('CIDADE');
        const idxPeso = getIdx('PESO');
        const idxPed = getIdx('PEDIDO');

        const items: DeliveryItem[] = rawData.slice(1)
          .filter(row => row[idxCid])
          .map(row => ({
            cliente: String(row[idxCli] || '').toUpperCase(),
            cidade: String(row[idxCid] || '').toUpperCase().trim(),
            peso: parseFloat(String(row[idxPeso] || '0').replace(',', '.')),
            pedido: String(row[idxPed] || '')
          }));

        setDeliveries(items);
        localStorage.setItem('cerbras_map_data', JSON.stringify(items));
        showSuccess("Dados carregados com sucesso!");
      } catch (error: any) {
        showError("Erro ao processar: " + error.message);
      } finally {
        setProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const citySummary = useMemo(() => {
    const summary: Record<string, { totalWeight: number, clients: Record<string, number> }> = {};
    deliveries.forEach(d => {
      if (!summary[d.cidade]) summary[d.cidade] = { totalWeight: 0, clients: {} };
      summary[d.cidade].totalWeight += d.peso;
      summary[d.cidade].clients[d.cliente] = (summary[d.cidade].clients[d.cliente] || 0) + d.peso;
    });
    return summary;
  }, [deliveries]);

  const stats = useMemo(() => {
    const totalWeight = deliveries.reduce((acc, d) => acc + d.peso, 0);
    const totalDeliveries = new Set(deliveries.map(d => d.cliente)).size;
    const totalCities = Object.keys(citySummary).length;
    return { totalWeight, totalDeliveries, totalCities };
  }, [deliveries, citySummary]);

  const handleAddPointToRoute = (cityName: string, coords: [number, number], selectedClients: string[]) => {
    if (!isRouteMode) return;
    
    // Se a cidade já está na rota, removemos ou atualizamos? Vamos permitir adicionar sequencialmente
    setCurrentRoute([...currentRoute, { city: cityName, coords, selectedClients }]);
    showSuccess(`${cityName} adicionada à rota.`);
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

          <label className="cursor-pointer">
            <Button variant="outline" size="sm" className="gap-2 border-amber-200 text-amber-700 pointer-events-none">
              <Upload size={16} /> Upload Base
            </Button>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
          </label>

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
              <Save size={16} /> Salvar Rota ({currentRoute.length})
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {/* Sidebar de Rotas Salvas */}
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
            {savedRoutes.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <RouteIcon size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs">Nenhuma rota salva.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Mapa */}
        <div className="flex-1 relative z-10">
          <MapContainer 
            center={MARACANAU_COORDS} 
            zoom={7} 
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {/* Ponto Inicial: Maracanaú */}
            <Marker position={MARACANAU_COORDS} icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: #1e293b; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            })}>
              <Popup><strong>PONTO INICIAL: MARACANAÚ-CE</strong></Popup>
            </Marker>

            {/* Cidades com Peso */}
            {Object.entries(citySummary).map(([cityName, data]) => {
              const coords = cityCoords[cityName];
              if (!coords) return null;

              const isSelectedInCurrentRoute = currentRoute.some(p => p.city === cityName);

              return (
                <Marker 
                  key={cityName} 
                  position={coords}
                  icon={L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div style="background-color: ${isSelectedInCurrentRoute ? '#16a34a' : '#f59e0b'}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                  })}
                >
                  <Popup className="custom-popup">
                    <div className="p-2 min-w-[200px]">
                      <h3 className="font-bold text-lg border-b pb-1 mb-2 uppercase">{cityName}</h3>
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
                        <Button 
                          size="sm" 
                          className="w-full mt-4 bg-amber-600 hover:bg-amber-700 h-8 text-[10px]"
                          onClick={() => handleAddPointToRoute(cityName, coords, Object.keys(data.clients))}
                        >
                          <Plus size={12} className="mr-1" /> Incluir na Rota
                        </Button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Linha da Rota Atual */}
            {isRouteMode && currentRoute.length > 0 && (
              <Polyline 
                positions={[MARACANAU_COORDS, ...currentRoute.map(p => p.coords)]} 
                color="#16a34a" 
                weight={3} 
                dashArray="5, 10"
              />
            )}

            {/* Linhas das Rotas Salvas */}
            {savedRoutes.map((route, idx) => (
              <Polyline 
                key={route.id}
                positions={[MARACANAU_COORDS, ...route.route_data.map((p: any) => p.coords)]} 
                color={['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'][idx % 4]} 
                weight={2}
                opacity={0.6}
              />
            ))}
          </MapContainer>

          {/* Overlay de Rota Atual */}
          {isRouteMode && currentRoute.length > 0 && (
            <div className="absolute bottom-6 left-6 z-[1000] bg-white p-4 rounded-xl shadow-2xl border border-slate-200 w-64">
              <h4 className="font-bold text-xs uppercase text-slate-400 mb-3 flex items-center gap-2">
                <Truck size={14} /> Sequência da Rota
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                <div className="flex items-center gap-3 text-xs font-bold text-slate-900">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">0</div>
                  MARACANAÚ
                </div>
                {currentRoute.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs group">
                    <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px]">{i + 1}</div>
                    <span className="uppercase font-medium flex-1">{p.city}</span>
                    <button onClick={() => setCurrentRoute(currentRoute.filter((_, idx) => idx !== i))} className="text-red-400 opacity-0 group-hover:opacity-100">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CerbrasWeightsByCity;