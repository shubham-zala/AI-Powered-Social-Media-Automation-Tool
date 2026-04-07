import React, { useState } from 'react';
import { X, Sparkles, CheckSquare, Square } from 'lucide-react';

const RegenerateModal = ({ onClose, onConfirm, loading }) => {
    const [selectedFields, setSelectedFields] = useState({
        title: false,
        description: false,
        content: false,
        hashtags: false
    });

    const toggleField = (field) => {
        setSelectedFields(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const handleConfirm = () => {
        const fields = Object.keys(selectedFields).filter(k => selectedFields[k]);
        if (fields.length > 0) {
            onConfirm(fields);
        }
    };

    const hasSelection = Object.values(selectedFields).some(Boolean);

    const FieldOption = ({ field, label }) => (
        <div
            onClick={() => toggleField(field)}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedFields[field]
                    ? "bg-blue-600/10 border-blue-500 text-blue-400"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
        >
            {selectedFields[field] ? <CheckSquare size={20} /> : <Square size={20} />}
            <span className="font-medium">{label}</span>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Sparkles className="text-blue-400" size={20} /> Regenerate Content
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-400">
                        Select the fields you want to rewrite. The AI will make them professional, neutral, and emoji-free.
                    </p>

                    <div className="grid grid-cols-1 gap-3">
                        <FieldOption field="title" label="Headline / Title" />
                        <FieldOption field="description" label="Image Text (Description)" />
                        <FieldOption field="content" label="Post Body (LinkedIn/Twitter)" />
                        <FieldOption field="hashtags" label="Hashtags" />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!hasSelection || loading}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? 'Regenerating...' : <><Sparkles size={18} /> Regenerate Selected</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegenerateModal;
