"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ShoppingBag, User, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from './AuthProvider';
import UserNav from './UserNav';

const Navbar = () => {
  const { user } = useAuth();

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-tighter text-slate-900">LUZARTE</span>
          <span className="text-[10px] font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded">OFFICIAL</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-10 text-sm font-semibold text-slate-600">
          <Link to="/" className="hover:text-slate-900 transition-colors">Início</Link>
          <Link to="/admin/luzarte-budgets" className="hover:text-slate-900 transition-colors">Orçamentos</Link>
          <Link to="/admin/luzarte-base" className="hover:text-slate-900 transition-colors">Base Técnica</Link>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <UserNav />
          ) : (
            <Link to="/login">
              <Button variant="default" className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-6">
                Acessar
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;