"use client";

import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ArrowRight, FileText, ShieldCheck, Sparkles, Package, Calculator } from 'lucide-react';
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold mb-8 animate-fade-in">
              <Sparkles size={14} className="text-amber-500" />
              SISTEMA DE GESTÃO DE ORÇAMENTOS
            </div>
            <h1 className="text-5xl lg:text-8xl font-black text-slate-900 leading-none mb-8 tracking-tighter">
              Design e Precisão em <span className="text-slate-400">cada detalhe.</span>
            </h1>
            <p className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed">
              Plataforma exclusiva para emissão de orçamentos técnicos Luzarte. Agilidade, precisão e profissionalismo para seus projetos.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/admin/luzarte-budgets/new">
                <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white px-10 h-14 rounded-full text-lg font-bold gap-2">
                  Criar Orçamento <ArrowRight size={20} />
                </Button>
              </Link>
              <Link to="/admin/luzarte-budgets">
                <Button size="lg" variant="outline" className="px-10 h-14 rounded-full text-lg font-bold border-slate-200">
                  Ver Histórico
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
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-900">
                <Calculator size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Cálculo Automático</h3>
              <p className="text-slate-500 leading-relaxed">
                Preços atualizados e cálculos instantâneos baseados na tabela técnica oficial.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-900">
                <FileText size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">PDF Profissional</h3>
              <p className="text-slate-500 leading-relaxed">
                Gere documentos prontos para envio ao cliente com layout limpo e organizado.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-900">
                <Package size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Base de Produtos</h3>
              <p className="text-slate-500 leading-relaxed">
                Acesso completo ao catálogo de louças sanitárias com códigos e descrições.
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