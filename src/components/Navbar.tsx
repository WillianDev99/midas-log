"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Truck, MapPin, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from './AuthProvider';
import UserNav from './UserNav';

const Navbar = () => {
  const { user } = useAuth();

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="Midas Log" className="h-8 w-auto" />
          <span className="text-xl font-black tracking-tighter text-slate-900 hidden sm:block">MIDAS LOG</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
          <Link to="/" className="hover:text-amber-600 transition-colors">Início</Link>
          <Link to="/admin" className="hover:text-amber-600 transition-colors">Painel ADM</Link>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <UserNav />
          ) : (
            <Link to="/login">
              <Button variant="default" className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-6">
                Acessar Sistema
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;