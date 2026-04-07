import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, LayoutTemplate, Trash2, Check, AlertCircle, Edit2 } from 'lucide-react';

const Templates = () => {
    const [templates, setTemplates] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    // Removed hoveredTemplate state

    const [formData, setFormData] = useState({
        name: '',
        templated_id: '',
        headline_layer: '',
        summary_layer: '',
        source_layer: '',
        preview_url: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        try {
            const res = await api.getTemplates();
            setTemplates(res.data);
        } catch (err) {
            console.error("Failed to load templates", err);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this template?")) return;
        try {
            await api.deleteTemplate(id);
            setSuccess("Template deleted.");
            loadTemplates();
        } catch (err) {
            console.error(err);
            setError("Failed to delete template.");
        }
    };

    const handleEdit = (tpl) => {
        setFormData({
            name: tpl.name,
            templated_id: tpl.templated_id,
            headline_layer: tpl.layer_map?.headline || '',
            summary_layer: tpl.layer_map?.summary || '',
            source_layer: tpl.layer_map?.source || '',
            preview_url: tpl.preview || ''
        });
        setEditingId(tpl.id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.name || !formData.templated_id) {
            setError("Name and Templated ID are required.");
            return;
        }

        const templateData = {
            id: editingId || `tpl_${Date.now()} `,
            name: formData.name,
            color: 'slate-800',
            text_color: 'slate-200',
            bg_color: 'slate-900',
            templated_id: formData.templated_id,
            preview: formData.preview_url || 'https://via.placeholder.com/300x400?text=No+Preview',
            layer_map: {
                headline: formData.headline_layer || 'title',
                summary: formData.summary_layer || 'description',
                source: formData.source_layer || 'source'
            }
        };

        try {
            if (editingId) {
                await api.updateTemplate(editingId, templateData);
                setSuccess("Template updated successfully!");
            } else {
                await api.addTemplate(templateData);
                setSuccess("Template added successfully!");
            }
            setShowForm(false);
            setEditingId(null);
            setFormData({ name: '', templated_id: '', headline_layer: '', summary_layer: '', source_layer: '', preview_url: '' });
            loadTemplates();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || "Failed to save template.");
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Template Manager</h2>
                    <p className="text-neutral-400">Manage your Templated.io templates.</p>
                </div>
                <button
                    onClick={() => {
                        setShowForm(!showForm);
                        setEditingId(null);
                        setFormData({ name: '', templated_id: '', headline_layer: '', summary_layer: '', source_layer: '', preview_url: '' });
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus size={18} /> {showForm && !editingId ? 'Close Form' : 'Add Template'}
                </button>
            </div>

            {/* Notification Messages */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg flex items-center gap-2">
                    <AlertCircle size={18} /> {error}
                </div>
            )}
            {success && (
                <div className="bg-green-500/10 border border-green-500/50 text-green-500 p-4 rounded-lg flex items-center gap-2">
                    <Check size={18} /> {success}
                </div>
            )}

            {/* Add/Edit Template Form */}
            {showForm && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-xl animate-fade-in">
                    <h3 className="text-lg font-bold text-white mb-4">{editingId ? 'Edit Template' : 'Add New Template'}</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-neutral-400 mb-1">Template Name</label>
                                <input
                                    type="text"
                                    className="w-full bg-black border border-neutral-800 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"
                                    placeholder="e.g. Breaking News (Red)"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-neutral-400 mb-1">Templated.io ID</label>
                                <input
                                    type="text"
                                    className="w-full bg-black border border-neutral-800 rounded px-3 py-2 text-white font-mono text-sm focus:border-blue-500 outline-none"
                                    placeholder="e.g. 99b9e2b1-..."
                                    value={formData.templated_id}
                                    onChange={e => setFormData({ ...formData, templated_id: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-neutral-400 mb-1">Preview Image URL (Optional)</label>
                                <input
                                    type="text"
                                    className="w-full bg-black border border-neutral-800 rounded px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                                    placeholder="https://..."
                                    value={formData.preview_url}
                                    onChange={e => setFormData({ ...formData, preview_url: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                                <h4 className="text-sm font-semibold text-slate-300 mb-3">Layer Mapping</h4>
                                <p className="text-xs text-slate-500 mb-4">Tell us which layer in the template corresponds to which data.</p>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-neutral-400 mb-1">Headline Layer Name</label>
                                        <input
                                            type="text"
                                            className="w-full bg-black border border-neutral-800 rounded px-3 py-2 text-white text-sm"
                                            placeholder="default: title"
                                            value={formData.headline_layer}
                                            onChange={e => setFormData({ ...formData, headline_layer: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-neutral-400 mb-1">Summary/Body Layer Name</label>
                                        <input
                                            type="text"
                                            className="w-full bg-black border border-neutral-800 rounded px-3 py-2 text-white text-sm"
                                            placeholder="default: description"
                                            value={formData.summary_layer}
                                            onChange={e => setFormData({ ...formData, summary_layer: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-neutral-400 mb-1">Source/Footer Layer Name</label>
                                        <input
                                            type="text"
                                            className="w-full bg-black border border-neutral-800 rounded px-3 py-2 text-white text-sm"
                                            placeholder="default: source"
                                            value={formData.source_layer}
                                            onChange={e => setFormData({ ...formData, source_layer: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-neutral-800">
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); setEditingId(null); }}
                                className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-blue-900/20 transition-all"
                            >
                                {editingId ? 'Update Template' : 'Save Template'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Templates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map(tpl => (
                    <div key={tpl.id} className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden group">
                        {/* Preview - Hover zoom removed */}
                        <div className="relative aspect-video bg-black overflow-hidden">
                            <img
                                src={tpl.preview}
                                alt={tpl.name}
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur px-2 py-1 rounded text-start font-mono text-xs text-neutral-300 pointer-events-none">
                                {tpl.templated_id.substring(0, 8)}...
                            </div>
                        </div>

                        <div className="p-4">
                            <div className="flex items-start justify-between mb-2">
                                <h3 className="font-bold text-white truncate pr-2" title={tpl.name}>{tpl.name}</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(tpl)}
                                        className="text-neutral-400 hover:text-blue-400 transition-colors bg-neutral-800 hover:bg-neutral-700 p-1.5 rounded"
                                        title="Edit"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(tpl.id)}
                                        className="text-neutral-400 hover:text-red-400 transition-colors bg-neutral-800 hover:bg-neutral-700 p-1.5 rounded"
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="text-xs text-neutral-400 space-y-1">
                                <p><span className="text-neutral-600">ID:</span> <span className="font-mono text-neutral-500">{tpl.templated_id.substring(0, 12)}...</span></p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {/* Lightbox / Overlay removed */}
        </div>
    );
};

export default Templates;
