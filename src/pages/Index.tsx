"use client";

import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ArrowRight, Truck, ShieldCheck, Sparkles, MapPin, FileSpreadsheet, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const Index = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold mb-8 animate-fade-in">
              <Sparkles size={14} className="text-amber-500" />
              SOLUÇÕES LOGÍSTICAS INTELIGENTES
            </div>
            <h1 className="text-5xl lg:text-8xl font-black text-slate-900 leading-none mb-8 tracking-tighter">
              Eficiência em <span className="text-amber-500">cada quilômetro.</span>
            </h1>
            <p className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed">
              Plataforma avançada para gestão de carteiras, roteirização e monitoramento de cargas. Tecnologia de ponta para a Midas Logística.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/admin">
                <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white px-10 h-14 rounded-full text-lg font-bold gap-2">
                  Acessar Painel ADM <ArrowRight size={20} />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-amber-600">
                <FileSpreadsheet size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Gestão de Carteiras</h3>
              <p className="text-slate-500 leading-relaxed">
                Processamento automático de carteiras Hidracor e Cerbras com formatação inteligente.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-amber-600">
                <MapPin size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Roteirização Geográfica</h3>
              <p className="text-slate-500 leading-relaxed">
                Visualização de pesos por cidade e montagem de rotas otimizadas em tempo real.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-amber-600">
                <Truck size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Monitoramento de Cargas</h3>
              <p className="text-slate-500 leading-relaxed">
                Integração com planilhas externas para acompanhamento de cargas disponíveis.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;