import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Twitter, Facebook, Instagram, Linkedin } from 'lucide-react';

const History = () => {
    const [posts, setPosts] = useState([]);
    const [filter, setFilter] = useState('posted'); // Default to Published
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [stats, setStats] = useState({ total: 0, posted: 0, rejected: 0 });
    const [hoveredImage, setHoveredImage] = useState(null);

    useEffect(() => {
        fetchHistory();
    }, [filter, selectedDate]);

    useEffect(() => {
        // Calculate total items shown based on the current filter logic
        const newStats = posts.reduce((acc, output) => {
            acc.total++;
            if (output.status === 'posted') acc.posted++;
            if (output.status === 'rejected') acc.rejected++;
            return acc;
        }, { total: 0, posted: 0, rejected: 0 });
        setStats(newStats);
    }, [posts]);

    const fetchHistory = async () => {
        try {
            const params = {};
            if (filter === 'all') {
                params.status = 'posted,rejected'; // Custom multi-status filter
            } else {
                params.status = filter;
            }
            if (selectedDate) params.date = selectedDate;

            const res = await api.get('/posts', { params });
            setPosts(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const tabs = [
        { id: 'posted', label: 'Published' },
        { id: 'rejected', label: 'Rejected' },
        { id: 'all', label: 'All History' },
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row items-end md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">History</h2>
                    <p className="text-neutral-400">View all generated content and their status.</p>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center">
                    {/* Date Filter */}
                    <input
                        type="date"
                        className="bg-neutral-900 border border-neutral-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />

                    {/* Tabs */}
                    <div className="flex bg-neutral-900 p-1 rounded-lg">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filter === tab.id
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 shadow-lg">
                    <p className="text-neutral-400 text-sm">Total Items</p>
                    <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl border border-green-500/30 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/10 rounded-bl-full"></div>
                    <p className="text-green-400 text-sm font-medium">Published</p>
                    <p className="text-2xl font-bold text-white">{stats.posted}</p>
                </div>
                <div className="bg-neutral-900 p-4 rounded-xl border border-red-500/30 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full"></div>
                    <p className="text-red-400 text-sm font-medium">Rejected</p>
                    <p className="text-2xl font-bold text-white">{stats.rejected}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map(post => (
                    <div key={post.id} className={`bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden relative opacity-${post.status === 'rejected' ? '60' : '100'} min-w-0`}>
                        {/* Status Badge */}
                        <div className={`absolute top-3 right-3 px-2 py-1 rounded text-xs font-bold uppercase z-10 
                            ${post.status === 'posted' ? 'bg-green-500/20 text-green-400 border border-green-500/50' :
                                post.status === 'rejected' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
                                    'bg-amber-500/20 text-amber-400 border border-amber-500/50'}`}>
                            {post.status}
                        </div>

                        <img
                            src={post.image_url || 'https://placehold.co/600x400?text=News+Update'}
                            alt="Post visual"
                            className="w-full h-48 object-cover opacity-80 hover:opacity-100 transition-opacity cursor-zoom-in"
                            onMouseEnter={() => setHoveredImage(post.image_url || 'https://placehold.co/600x400?text=News+Update')}
                            onMouseLeave={() => setHoveredImage(null)}
                        />
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-white mb-2 line-clamp-2" title={post.generated_title}>{post.generated_title}</h3>
                            <p className="text-neutral-400 text-sm mb-4 line-clamp-3">{post.generated_content}</p>

                            <div className="flex flex-col gap-2 mt-4 border-t border-neutral-800 pt-4">
                                <span className="text-xs text-neutral-500">
                                    {new Date(post.posted_at || post.created_at).toLocaleString(undefined, {
                                        weekday: 'short',
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>

                                <div className="flex flex-wrap gap-2">
                                    {post.status === 'posted' && (
                                        <>
                                            {post.platform_links?.twitter && (
                                                <a
                                                    href={post.platform_links.twitter}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-white text-xs hover:underline flex items-center gap-1 bg-black/50 border border-white/20 px-2 py-1 rounded hover:bg-black transition-colors"
                                                >
                                                    <Twitter size={12} /> Twitter
                                                </a>
                                            )}
                                            {post.platform_links?.facebook && (
                                                <a
                                                    href={post.platform_links.facebook}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-blue-500 text-xs hover:underline flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded hover:bg-blue-500/20 transition-colors"
                                                >
                                                    <Facebook size={12} /> Facebook
                                                </a>
                                            )}
                                            {post.platform_links?.instagram && (
                                                <a
                                                    href={post.platform_links.instagram}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-pink-500 text-xs hover:underline flex items-center gap-1 bg-pink-500/10 border border-pink-500/20 px-2 py-1 rounded hover:bg-pink-500/20 transition-colors"
                                                >
                                                    <Instagram size={12} /> Instagram
                                                </a>
                                            )}
                                            {post.platform_links?.linkedin && (
                                                <a
                                                    href={post.platform_links.linkedin}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-blue-700 text-xs hover:underline flex items-center gap-1 bg-blue-700/10 border border-blue-700/20 px-2 py-1 rounded hover:bg-blue-700/20 transition-colors"
                                                >
                                                    <Linkedin size={12} /> LinkedIn
                                                </a>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* HOVER PREVIEW OVERLAY */}
            {hoveredImage && (
                <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center p-4">
                    <div className="relative h-[85vh] aspect-[9/16] bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl border-4 border-blue-500/50 shadow-blue-500/20 transform transition-all duration-300">
                        <img
                            src={hoveredImage}
                            alt="Preview"
                            className="w-full h-full object-contain bg-black"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-black/80 p-4 text-center backdrop-blur-sm">
                            <p className="text-blue-300 text-sm">Previewing Full Size</p>
                        </div>
                    </div>
                </div>
            )}

            {posts.length === 0 && (
                <div className="text-center py-20 text-neutral-500">
                    No posts found for this filter.
                </div>
            )}
        </div>
    );
};

export default History;
