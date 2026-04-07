import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Rss, Globe, Play, Power, Loader2, Check, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import api from '../services/api';

const Sources = () => {
    const [sources, setSources] = useState([]);
    const [newSource, setNewSource] = useState({ name: '', url: '', type: 'rss' });
    const [saving, setSaving] = useState(false);
    const [fetchingId, setFetchingId] = useState(null);
    const [health, setHealth] = useState({}); // { [sourceId]: { status, message } }
    const [healthLoading, setHealthLoading] = useState(false);

    useEffect(() => {
        fetchSources();
        checkHealth();
    }, []);

    const fetchSources = async () => {
        try {
            const res = await api.get('/sources');
            const sorted = res.data.sort((a, b) => {
                if (a.is_active === b.is_active) return b.id - a.id;
                return a.is_active ? -1 : 1;
            });
            setSources(sorted);
        } catch (error) {
            console.error(error);
        }
    };

    const checkHealth = async () => {
        setHealthLoading(true);
        try {
            const res = await api.get('/sources/health');
            const map = {};
            res.data.forEach(h => { map[h.id] = h; });
            setHealth(map);
        } catch (err) {
            console.error('Health check failed:', err);
        } finally {
            setHealthLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/sources', newSource);
            setNewSource({ name: '', url: '', type: 'rss' }); // Reset
            fetchSources();
        } catch (error) {
            console.error(error);
            alert('Failed to add source');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this source? All requests/posts from this source will also be removed.')) return;
        try {
            await api.deleteSource(id);
            fetchSources();
        } catch (error) {
            console.error(error);
            alert("Failed to delete source");
        }
    };

    const handleToggle = async (id) => {
        try {
            await api.toggleSource(id);
            // Optimistic update
            setSources(sources.map(s => s.id === id ? { ...s, is_active: !s.is_active } : s));
        } catch (error) {
            console.error(error);
        }
    };

    const handleFetchSingle = async (id) => {
        setFetchingId(id);
        try {
            const res = await api.fetchSource(id);
            alert(res.data.message || "Fetch complete!");
        } catch (error) {
            console.error(error);
            alert("Failed to fetch content from this source.");
        } finally {
            setFetchingId(null);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Sources</h2>
                    <p className="text-neutral-400">Manage your RSS feeds. Toggle 'Active' to control what gets fetched globally.</p>
                </div>
                <button
                    onClick={checkHealth}
                    disabled={healthLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-sm font-medium border border-neutral-700 transition-all disabled:opacity-50"
                >
                    <RefreshCw size={14} className={healthLoading ? 'animate-spin' : ''} />
                    {healthLoading ? 'Checking...' : 'Check Feed Health'}
                </button>
            </div>

            {/* Add Source Form */}
            <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg">
                <h3 className="text-lg font-semibold text-white mb-4">Add New Source</h3>
                <form onSubmit={handleAdd} className="flex gap-4 items-end flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm text-neutral-400 mb-1">Name</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            placeholder="e.g. TechCrunch"
                            value={newSource.name}
                            onChange={e => setNewSource({ ...newSource, name: e.target.value })}
                        />
                    </div>
                    <div className="flex-[2] min-w-[300px]">
                        <label className="block text-sm text-neutral-400 mb-1">Url</label>
                        <input
                            type="url"
                            required
                            className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            placeholder="https://techcrunch.com/feed"
                            value={newSource.url}
                            onChange={e => setNewSource({ ...newSource, url: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-neutral-400 mb-1">Type</label>
                        <select
                            className="bg-black border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            value={newSource.type}
                            onChange={e => setNewSource({ ...newSource, type: e.target.value })}
                        >
                            <option value="rss">RSS Feed</option>
                            <option value="manual" disabled>Manual (Coming Soon)</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 shadow-md shadow-blue-900/20"
                    >
                        <Plus size={18} /> Add
                    </button>
                </form>
            </div>

            {/* Sources List */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden shadow-lg">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-black/50 text-neutral-400 border-b border-neutral-800">
                        <tr>
                            <th className="px-6 py-4 font-medium">Source Name</th>
                            <th className="px-6 py-4 font-medium">URL</th>
                            <th className="px-6 py-4 font-medium text-center">Active</th>
                            <th className="px-6 py-4 font-medium text-center">Status</th>
                            <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                        {sources.map(source => (
                            <tr key={source.id} className={`group hover:bg-neutral-800/30 transition-colors ${!source.is_active ? 'opacity-60' : ''}`}>
                                <td className="px-6 py-4 text-white font-medium flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${source.is_active ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'bg-neutral-600'}`}></div>
                                    {source.name}
                                </td>
                                <td className="px-6 py-4 text-neutral-400 text-sm max-w-xs truncate" title={source.url}>
                                    {source.url}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button
                                        onClick={() => handleToggle(source.id)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${source.is_active ? 'bg-blue-600' : 'bg-neutral-600'}`}
                                        title={source.is_active ? "Disable Source" : "Enable Source"}
                                    >
                                        <span
                                            className={`${source.is_active ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                                        />
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {health[source.id] ? (
                                        health[source.id].status === 'ok' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Feed is working">
                                                <CheckCircle2 size={12} /> OK
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20" title={health[source.id].message}>
                                                <AlertTriangle size={12} /> Error
                                            </span>
                                        )
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-800 text-neutral-500 border border-neutral-700">
                                            {source.type === 'rss' ? <Rss size={12} /> : <Globe size={12} />}
                                            {source.type.toUpperCase()}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleFetchSingle(source.id)}
                                            disabled={fetchingId === source.id || !source.is_active}
                                            className={`
                                                flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-all
                                                ${fetchingId === source.id
                                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/50 cursor-wait'
                                                    : source.is_active
                                                        ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                                                        : 'bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed'}
                                            `}
                                            title="Fetch only this source"
                                        >
                                            {fetchingId === source.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                                            {fetchingId === source.id ? 'Fetching...' : 'Fetch Now'}
                                        </button>

                                        <button
                                            onClick={() => handleDelete(source.id)}
                                            className="text-neutral-500 hover:text-red-400 hover:bg-red-400/10 p-1.5 rounded transition-colors"
                                            title="Delete Source"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {sources.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <Rss size={32} className="text-neutral-600" />
                                        <p>No sources added yet.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Sources;
