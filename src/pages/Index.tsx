"use client";

import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import { Truck, Shield, BarChart3, Clock, ArrowRight, MapPin, Instagram, Globe } from 'lucide-react';
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
                Midas <span className="text-amber-600">Logística</span>: Sua Carga em Boas Mãos.
              </h1>
              <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto lg:mx-0">
                Soluções inteligentes de transporte cobrindo Ceará, Piauí e Maranhão, com expansão contínua para novos horizontes.
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                <a href="#servicos">
                  <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white px-8">
                    Nossos Serviços
                  </Button>
                </a>
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
                    <p className="font-bold text-slate-900">Excelência em Entregas</p>
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
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Nossa História</h2>
              <div className="w-20 h-1.5 bg-amber-500 mx-auto rounded-full mb-8" />
            </div>
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6 text-slate-600 leading-relaxed">
                <p>
                  A <strong>Midas Logística</strong> nasceu como uma solução estratégica para os desafios de entrega da Midas Representações. Percebemos que para garantir a satisfação total dos nossos clientes, precisávamos assumir o controle da operação logística.
                </p>
                <p>
                  Iniciamos nossas operações focadas no Ceará, Piauí e Maranhão, transportando produtos das renomadas fábricas <strong>Cerbras e Hidracor</strong>. Nossa dedicação à excelência nos permitiu expandir rapidamente.
                </p>
                <p>
                  Desde outubro de 2025, devido ao nosso alto padrão de serviço, passamos a gerenciar cargas extras da Hidracor para outros representantes, expandindo nossas fronteiras e fortalecendo laços entre fábricas, lojistas e motoristas.
                </p>
              </div>
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Globe className="text-amber-600" /> Nossa Atuação
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="mt-1 bg-amber-100 p-1 rounded-full"><ArrowRight size={14} className="text-amber-700" /></div>
                    <span>Gestão de cargas Cerbras e Hidracor.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 bg-amber-100 p-1 rounded-full"><ArrowRight size={14} className="text-amber-700" /></div>
                    <span>Cobertura completa em CE, PI e MA.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 bg-amber-100 p-1 rounded-full"><ArrowRight size={14} className="text-amber-700" /></div>
                    <span>Relacionamento próximo com motoristas parceiros.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 bg-amber-100 p-1 rounded-full"><ArrowRight size={14} className="text-amber-700" /></div>
                    <span>Foco em pontualidade e integridade da carga.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Serviços Section */}
      <section id="servicos" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Serviços Especializados</h2>
            <p className="text-slate-500">Conectando fábricas e lojistas com inteligência e agilidade.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Truck className="text-amber-600" size={32} />,
                title: "Transporte Interestadual",
                desc: "Operação robusta nos estados do Ceará, Piauí e Maranhão, com foco em materiais de construção e acabamentos."
              },
              {
                icon: <BarChart3 className="text-amber-600" size={32} />,
                title: "Gestão de Cargas Extras",
                desc: "Capacidade operacional para absorver demandas excedentes de outros representantes com a mesma qualidade Midas."
              },
              {
                icon: <Users className="text-amber-600" size={32} />,
                title: "Rede de Parceiros",
                desc: "Seleção rigorosa de motoristas contratados para garantir que sua mercadoria chegue ao destino final com segurança."
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
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Localização e Social */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Onde Estamos</h2>
              <p className="text-slate-400 mb-8">
                Visite nossa base operacional ou entre em contato pelas nossas redes sociais.
              </p>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="bg-amber-600 p-3 rounded-full"><MapPin size={24} /></div>
                  <div>
                    <p className="font-bold">Endereço</p>
                    <p className="text-slate-400">R. Cel. Diogo Lopes, 100 - Centro, Sobral - CE</p>
                  </div>
                </div>
                <a 
                  href="https://www.instagram.com/midaslogistica/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 hover:text-amber-500 transition-colors"
                >
                  <div className="bg-amber-600 p-3 rounded-full"><Instagram size={24} /></div>
                  <div>
                    <p className="font-bold">Instagram</p>
                    <p className="text-slate-400">@midaslogistica</p>
                  </div>
                </a>
              </div>
            </div>
            <div className="h-[400px] rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800">
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3979.86456789!2d-40.35!3d-3.68!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zM8KwNDAnNDguMCJTIDQwwrAyMScwMC4wIlc!5e0!3m2!1spt-BR!2sbr!4v1600000000000!5m2!1spt-BR!2sbr" 
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                allowFullScreen 
                loading="lazy"
              ></iframe>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Index;