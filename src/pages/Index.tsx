"use client";

import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import { Truck, Shield, BarChart3, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const Index = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute top-0 right-0 -z-10 w-1/2 h-full bg-amber-50 rounded-bl-[100px]" />
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left">
              <span className="inline-block py-1 px-3 rounded-full bg-amber-100 text-amber-700 text-sm font-bold mb-6">
                EFICIÊNCIA EM MOVIMENTO
              </span>
              <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 leading-tight mb-6">
                Transformando a <span className="text-amber-600">Logística</span> com Inteligência.
              </h1>
              <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto lg:mx-0">
                A Midas Logística oferece soluções completas de transporte e gestão de dados para otimizar sua cadeia de suprimentos.
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white px-8">
                  Nossos Serviços
                </Button>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="px-8">
                    Área Restrita
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex-1 relative">
              <img 
                src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=800" 
                alt="Logística" 
                className="rounded-2xl shadow-2xl"
              />
              <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-xl shadow-xl hidden md:block">
                <div className="flex items-center gap-4">
                  <div className="bg-green-100 p-3 rounded-full">
                    <Shield className="text-green-600" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Segurança Garantida</p>
                    <p className="font-bold text-slate-900">100% de Rastreabilidade</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* História Section */}
      <section id="historia" className="py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Nossa História</h2>
            <div className="w-20 h-1.5 bg-amber-500 mx-auto rounded-full mb-8" />
            <p className="text-lg text-slate-600 leading-relaxed">
              Fundada com o propósito de revolucionar o setor de transportes, a Midas Logística nasceu da necessidade de integrar tecnologia e eficiência operacional. Ao longo dos anos, nos tornamos referência em gestão logística, focando não apenas no transporte físico, mas na inteligência de dados que move o mercado.
            </p>
          </div>
        </div>
      </section>

      {/* Serviços Section */}
      <section id="servicos" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Serviços Especializados</h2>
            <p className="text-slate-500">Soluções sob medida para cada necessidade do seu negócio.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Truck className="text-amber-600" size={32} />,
                title: "Transporte Rodoviário",
                desc: "Frota moderna e monitorada para garantir que sua carga chegue ao destino com segurança."
              },
              {
                icon: <BarChart3 className="text-amber-600" size={32} />,
                title: "Gestão de Dados",
                desc: "Análise avançada de planilhas e indicadores para otimização de rotas e custos."
              },
              {
                icon: <Clock className="text-amber-600" size={32} />,
                title: "Logística Just-in-Time",
                desc: "Planejamento rigoroso para atender prazos críticos com máxima eficiência."
              }
            ].map((service, i) => (
              <div key={i} className="p-8 rounded-2xl border border-slate-100 hover:border-amber-200 hover:shadow-xl transition-all group">
                <div className="mb-6 bg-amber-50 w-16 h-16 rounded-xl flex items-center justify-center group-hover:bg-amber-600 transition-colors">
                  <div className="group-hover:text-white transition-colors">
                    {service.icon}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{service.title}</h3>
                <p className="text-slate-600 mb-6">{service.desc}</p>
                <Button variant="ghost" className="p-0 hover:bg-transparent text-amber-600 font-bold flex items-center gap-2">
                  Saiba mais <ArrowRight size={16} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Index;