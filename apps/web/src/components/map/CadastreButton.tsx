'use client';

import { Map } from 'lucide-react';

interface CadastreButtonProps {
    showCadastre?: boolean;
    onToggleCadastre?: () => void;
    className?: string;
}

export function CadastreButton({ 
    showCadastre, 
    onToggleCadastre,
    className = ""
}: CadastreButtonProps) {
    return (
        <button
            onClick={onToggleCadastre}
            className={`flex items-center gap-1.5 px-2 py-1 rounded shadow border text-xs font-medium transition-colors ${className} ${
                showCadastre
                    ? 'bg-[#D82626] text-white border-[#D82626]'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
        >
            <Map size={14} />
            Cadastre
        </button>
    );
}
