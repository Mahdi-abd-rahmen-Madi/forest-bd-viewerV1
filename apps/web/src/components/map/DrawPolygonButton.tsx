'use client';

import { Pencil } from 'lucide-react';

interface DrawPolygonButtonProps {
    isDrawing?: boolean;
    onDrawStart?: () => void;
    className?: string;
}

export function DrawPolygonButton({ 
    isDrawing, 
    onDrawStart,
    className = ""
}: DrawPolygonButtonProps) {
    return (
        <button
            onClick={onDrawStart}
            className={`flex items-center gap-1.5 px-2 py-1 rounded shadow border text-xs font-medium transition-colors ${className} ${
                isDrawing
                    ? 'bg-[#0b4a59] text-white border-[#0b4a59]'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
        >
            <Pencil size={14} />
            {isDrawing ? 'Drawing...' : 'Draw Polygon'}
        </button>
    );
}
