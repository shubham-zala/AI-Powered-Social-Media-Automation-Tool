import React, { useState } from 'react';
import { X, Save, Sparkles } from 'lucide-react';
import api from '../services/api';

const NewPostModal = ({ onClose, onCreated }) => {
    const [form, setForm] = useState({ title: '', content: '', link: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.createPost(form);
            onCreated();
            onClose();
        } catch (error) {
            console.error(error);
            alert("Failed to create post");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Sparkles className="text-blue-400" size={20} /> New Post
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Headline / Topic</label>
                        <input
                            required
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="e.g. Market crashes as inflation rises"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Content / Context</label>
                        <textarea
                            required
                            rows={4}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Paste a snippet or write your thoughts here..."
                            value={form.content}
                            onChange={e => setForm({ ...form, content: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Source Link <span className="text-red-400">*</span></label>
                        <input
                            required
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="https://..."
                            value={form.link}
                            onChange={e => setForm({ ...form, link: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? 'Generating...' : <><Save size={18} /> Create & AI Generate</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewPostModal;
