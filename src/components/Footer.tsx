"use client";

import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
      <div className="container mx-auto px-4 lg:pr-24">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-white font-bold text-lg mb-2">Midas Logística</h3>
            <p className="text-sm max-w-xs">Soluções inteligentes em transporte e gestão de dados logísticos.</p>
          </div>
          
          <div className="text-center md:text-right">
            <p className="text-sm">Desenvolvido por:</p>
            <p className="text-white font-medium">Willian de Oliveira Cardoso</p>
            <p className="text-xs mt-2">© {new Date().getFullYear()} Midas Logística. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;