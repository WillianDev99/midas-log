"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { 
  User, 
  Settings, 
  LogOut, 
  LayoutDashboard 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from './AuthProvider';

const UserNav = () => {
  const { user, signOut } = useAuth();
  
  if (!user) return null;

  const fullName = user.user_metadata?.full_name || "Usuário";
  const avatarUrl = user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;
  const isAdmin = user.user_metadata?.account_type === 'admin';

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-amber-100 hover:border-amber-500 transition-all">
            <Avatar className="h-9 w-9">
              <AvatarImage src={avatarUrl} alt={fullName} />
              <AvatarFallback className="bg-amber-100 text-amber-700">
                {fullName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{fullName}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {isAdmin && (
              <Link to="/admin">
                <DropdownMenuItem className="cursor-pointer">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>Painel ADM</span>
                </DropdownMenuItem>
              </Link>
            )}
            <Link to="/settings">
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
            </Link>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600 cursor-pointer" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sair</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
        {fullName.split(' ')[0]}
      </span>
    </div>
  );
};

export default UserNav;