"use client";

import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Rocket, Layout, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const Index = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      
      <main className="flex-1 flex flex-col items-center justify-center pt-20">
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold mb-8">
            <Rocket size={14} />
            PRONTO PARA COMEÇAR
          </div>
          <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 mb-6 tracking-tight">
            Seu Novo Projeto <br />
            <span className="text-blue-600">Começa Aqui.</span>
          </h1>
          <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            A estrutura está limpa e pronta para receber suas ideias. O que vamos construir hoje?
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white px-8 rounded-full">
              Explorar Recursos
            </Button>
            <Link to="/admin/luzarte-budgets">
              <Button size="lg" variant="outline" className="px-8 rounded-full">
                Acessar Orçamentos
              </Button>
            </Link>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20 border-t border-slate-50">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                <Layout size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Interface Moderna</h3>
              <p className="text-sm text-slate-500">Componentes prontos e design responsivo para qualquer dispositivo.</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto">
                <Shield size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Segurança Nativa</h3>
              <p className="text-sm text-slate-500">Autenticação e proteção de dados integradas com Supabase.</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                <Zap size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Alta Performance</h3>
              <p className="text-sm text-slate-500">Desenvolvido com React e Vite para uma experiência ultra rápida.</p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;