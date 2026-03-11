"use client";

import { useState } from "react";
import { Plus, X, FolderPlus } from "lucide-react";

export type MacroClass = 
  | 'Receita' 
  | 'Custo Variável' 
  | 'Despesa Fixa' 
  | 'Ativo Circulante' 
  | 'Passivo Circulante' 
  | 'Passivo Oneroso';

export interface Bucket {
  id: string;
  name: string;
  macro_class: MacroClass;
  // Transient UI helper to show accounts inside it
  accountCount?: number;
}

const MACRO_CLASSES: MacroClass[] = [
  'Receita', 
  'Custo Variável', 
  'Despesa Fixa', 
  'Ativo Circulante', 
  'Passivo Circulante', 
  'Passivo Oneroso'
];

interface BucketManagerProps {
  onBucketCreated: (bucket: Bucket) => void;
}

export function BucketManager({ onBucketCreated }: BucketManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [bucketName, setBucketName] = useState("");
  const [selectedMacroClass, setSelectedMacroClass] = useState<MacroClass>('Despesa Fixa');

  const handleCreate = () => {
    if (!bucketName.trim()) return;

    // TODO: Subir pro Supabase (POST /api/buckets) em implementações futuras
    const newBucket: Bucket = {
      id: crypto.randomUUID(), // Mock ID for now
      name: bucketName.trim(),
      macro_class: selectedMacroClass,
      accountCount: 0
    };

    onBucketCreated(newBucket);
    
    // Reset form
    setBucketName("");
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="text-sm font-bold text-blue-600 bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Criar Bucket Customizado
      </button>
    );
  }

  return (
    <div className="bg-white border border-slate-200 shadow-xl rounded-xl p-4 w-80 absolute top-16 right-0 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-slate-700 flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-blue-500" />
            Novo Bucket
        </h4>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Nome da Gaveta</label>
          <input 
            type="text" 
            value={bucketName}
            onChange={(e) => setBucketName(e.target.value)}
            placeholder="Ex: Estoque Revenda..."
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Macro-Classe (Motor Lógico)</label>
          <select 
            value={selectedMacroClass}
            onChange={(e) => setSelectedMacroClass(e.target.value as MacroClass)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MACRO_CLASSES.map(mc => (
              <option key={mc} value={mc}>{mc}</option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 mt-1 leading-tight">
            A macro classe define como os saldos Devedores / Credores serão multiplicados internamente pelo motor.
          </p>
        </div>

        <button 
          onClick={handleCreate}
          disabled={!bucketName.trim()}
          className="w-full bg-slate-800 text-white font-bold text-sm py-2 rounded-md hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          Salvar Bucket
        </button>
      </div>
    </div>
  );
}
