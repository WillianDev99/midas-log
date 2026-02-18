"use client";

import React from 'react';
import { MessageCircle } from 'lucide-react';

const WhatsAppButton = () => {
  const phoneNumber = "558894564446";
  const message = encodeURIComponent("Olá, vim pelo site da Midas Logística.");
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-green-500 text-white p-4 rounded-full shadow-lg hover:bg-green-600 transition-all hover:scale-110 flex items-center justify-center group"
      aria-label="Falar no WhatsApp"
    >
      <MessageCircle size={28} />
      <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 whitespace-nowrap font-medium">
        Falar conosco
      </span>
    </a>
  );
};

export default WhatsAppButton;