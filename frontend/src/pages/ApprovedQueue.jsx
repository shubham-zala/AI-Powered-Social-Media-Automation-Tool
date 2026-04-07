import React, { useEffect, useState } from 'react';
import { Check, X, RefreshCw, LayoutTemplate, Edit2, Save, Sparkles, Share2, Send, User } from 'lucide-react';
import api from '../services/api';
import RegenerateModal from '../components/RegenerateModal';

const ApprovedQueue = () => {
    const [posts, setPosts] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [templates, setTemplates] = useState([]);
    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [regenerateModalOpen, setRegenerateModalOpen] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [regenerationSuccess, setRegenerationSuccess] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState(null);
    const [switchingTemplateId, setSwitchingTemplateId] = useState(null);
    const [hoveredImage, setHoveredImage] = useState(null);
    const [fullViewImage, setFullViewImage] = useState(null);

    const [selectedPlatforms, setSelectedPlatforms] = useState({
        facebook: true,
        instagram: true,
        twitter: true
    });
    const [postModalOpen, setPostModalOpen] = useState(false);
    const [processingPost, setProcessingPost] = useState(false);

    useEffect(() => {
        fetchApproved();
        fetchTemplates();
    }, []);

    const fetchApproved = async () => {
        try {
            const res = await api.get('/posts?status=approved');
            setPosts(res.data || []);
        } catch (error) {
            console.error(error);
            setPosts([]);
        }
    };

    const fetchTemplates = async () => {
        try {
            const res = await api.getTemplates();
            setTemplates(res.data || []);
        } catch (error) {
            console.error("Failed to load templates", error);
            setTemplates([]);
        }
    };

    const handlePost = (id) => {
        const post = posts.find(p => p.id === id);
        if (!post?.image_url) {
            alert('Please generate a template first using the "Change Style" button before publishing.');
            return;
        }
        setSelectedPostId(id);
        setPostModalOpen(true);
    };

    const confirmPost = async () => {
        if (!selectedPostId) return;
        setProcessingPost(true);
        try {
            const platforms = Object.keys(selectedPlatforms).filter(k => selectedPlatforms[k]);
            const res = await api.put(`/posts/${selectedPostId}`, {
                status: 'posted',
                platforms: platforms
            });

            setPostModalOpen(false);
            setPosts(posts.filter(p => p.id !== selectedPostId));
            setSelectedPostId(null);

            const results = res.data.details || {};
            let msg = "Post Processed:\n";
            if (platforms.includes('facebook')) msg += `Facebook: ${results.facebook?.success ? '✅' : '❌'}\n`;
            if (platforms.includes('instagram')) msg += `Instagram: ${results.instagram?.success ? '✅' : '❌'}\n`;
            if (platforms.includes('twitter')) msg += `Twitter (X): ${results.twitter?.success ? '✅' : '❌'}\n`;

            alert(msg);
        } catch (error) {
            console.error("Posting failed", error);
            alert("Failed to post content. Check console/logs.");
        } finally {
            setProcessingPost(false);
        }
    };

    const openTemplateModal = (postId) => {
        setSelectedPostId(postId);
        setTemplateModalOpen(true);
    };

    const handleTemplateSelect = (templateId) => {
        if (selectedPostId) {
            handleSwitchTemplate(selectedPostId, templateId);
            setTemplateModalOpen(false);
            setSelectedPostId(null);
        }
    };

    const handleSwitchTemplate = async (id, templateId) => {
        if (!templateId) return;
        setSwitchingTemplateId(id);
        try {
            const res = await api.switchTemplate(id, templateId);
            setPosts(posts.map(p => p.id === id ? { ...p, image_url: res.data.imageUrl } : p));
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.error || "Failed to switch template";
            alert(msg);
        } finally {
            setSwitchingTemplateId(null);
        }
    };

    const startEdit = (post) => {
        setEditingId(post.id);
        setEditForm({
            generated_title: post.generated_title,
            generated_content: post.generated_content,
            generated_description: post.generated_description || "",
            hashtags: post.hashtags || ""
        });
    };

    const saveEdit = async (id) => {
        try {
            await api.put(`/posts/${id}`, editForm);
            setPosts(posts.map(p => p.id === id ? { ...p, ...editForm } : p));
            setEditingId(null);
        } catch (error) {
            console.error(error);
        }
    };

    const openRegenerateModal = (post) => {
        if (editingId !== post.id) startEdit(post);
        setRegenerateModalOpen(true);
    };

    const handleRegenerate = async (fields) => {
        if (!editingId) return;
        setRegenerating(true);
        try {
            const res = await api.regeneratePostFields(editingId, fields);
            const newData = res.data;
            setEditForm(prev => ({
                ...prev,
                generated_title: newData.generated_title || prev.generated_title,
                generated_description: newData.generated_description || prev.generated_description,
                generated_content: newData.generated_content || prev.generated_content,
                hashtags: newData.hashtags || prev.hashtags
            }));
            setPosts(posts.map(p => p.id === editingId ? { ...p, ...newData } : p));
            setRegenerateModalOpen(false);
            setRegenerationSuccess(true);
            setTimeout(() => setRegenerationSuccess(false), 3000);
        } catch (error) {
            console.error("Regeneration failed", error);
            alert("Failed to regenerate content.");
        } finally {
            setRegenerating(false);
        }
    };

    if (posts.length === 0) {
        return (
            <div className="text-center py-20">
                <p className="text-slate-500 text-lg">No approved posts ready to publish.</p>
                <div className="mt-4">
                    <button onClick={fetchApproved} className="text-blue-400 hover:underline flex items-center justify-center gap-2 w-full">
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-white">Approved</h2>
                    <p className="text-slate-400">Approved posts ready for publishing to social media.</p>
                </div>
                <span className="text-neutral-500 text-sm">{posts.length} post{posts.length !== 1 ? 's' : ''} ready</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map(post => (
                    <div key={post.id} className="bg-black rounded-xl border border-neutral-800 overflow-hidden flex flex-col shadow-lg shadow-black/50 min-w-0">
                        {/* Image Preview */}
                        <div className="w-full relative group bg-neutral-900 aspect-video flex items-center justify-center overflow-hidden">
                            {(() => {
                                const PLACEHOLDER = 'https://placehold.co/600x400?text=News+Update';
                                const displayUrl = post.image_url || PLACEHOLDER;
                                return (
                                    <>
                                        <img
                                            src={displayUrl}
                                            alt="Post visual"
                                            className={`w-full h-full object-cover cursor-zoom-in transition-opacity hover:opacity-100 opacity-90 ${switchingTemplateId === post.id ? 'opacity-50 blur-sm' : ''}`}
                                            onMouseEnter={() => setHoveredImage(displayUrl)}
                                            onMouseLeave={() => setHoveredImage(null)}
                                            onClick={() => setFullViewImage(displayUrl)}
                                        />
                                        {switchingTemplateId === post.id && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
                                                <div className="flex flex-col items-center gap-2">
                                                    <RefreshCw className="animate-spin text-blue-400" size={32} />
                                                    <span className="text-white font-medium text-sm bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">Generating New Design...</span>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 items-end">
                                <button
                                    onClick={() => openTemplateModal(post.id)}
                                    disabled={switchingTemplateId === post.id}
                                    className="bg-black/70 hover:bg-blue-600 text-white pl-3 pr-4 py-2 rounded-lg text-sm backdrop-blur border border-slate-600 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <LayoutTemplate size={16} />
                                    <span>{switchingTemplateId === post.id ? 'Generating...' : 'Change Style'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 flex-1 flex flex-col">
                            {/* Approved Badge */}
                            <div className="mb-3 flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-full text-xs font-medium">
                                    <Check size={12} /> Approved
                                </span>
                            </div>

                            {/* AI Analysis Badge */}
                            <div className="mb-4 p-3 bg-neutral-900 rounded-lg border border-neutral-800 text-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`font-bold ${post.relevance_score >= 8 ? 'text-green-400' : 'text-amber-400'}`}>
                                        AI Score: {post.relevance_score || 'N/A'}/10
                                    </span>
                                    <a href={post.original_link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs">
                                        View Source
                                    </a>
                                </div>
                                <p className="text-slate-400 text-xs italic">"{post.ai_summary || 'No summary available'}"</p>
                            </div>

                            {editingId === post.id ? (
                                <div className="space-y-4 flex-1">
                                    {regenerationSuccess && (
                                        <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm flex items-center gap-2 animate-pulse">
                                            <Check size={16} /> Content Regenerated Successfully!
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Creative Headline</label>
                                        <input
                                            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-white font-bold text-sm focus:border-blue-500 outline-none"
                                            value={editForm.generated_title}
                                            onChange={e => setEditForm({ ...editForm, generated_title: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Creative Description</label>
                                        <textarea
                                            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-slate-300 min-h-[80px] text-sm focus:border-blue-500 outline-none"
                                            value={editForm.generated_description}
                                            onChange={e => setEditForm({ ...editForm, generated_description: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Social Media Post Description</label>
                                        <textarea
                                            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-slate-300 min-h-[100px] text-sm focus:border-blue-500 outline-none"
                                            value={editForm.generated_content}
                                            onChange={e => setEditForm({ ...editForm, generated_content: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Social Media Hashtags</label>
                                        <input
                                            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-blue-400 text-sm focus:border-blue-500 outline-none"
                                            value={editForm.hashtags}
                                            onChange={e => setEditForm({ ...editForm, hashtags: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex gap-3 mt-4 pt-2 border-t border-slate-700">
                                        <button onClick={() => saveEdit(post.id)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                                            <Save size={16} /> Save Changes
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 flex-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-xl font-bold text-white leading-tight">{post.generated_title}</h3>
                                            {post.generated_description && (
                                                <p className="text-slate-400 text-sm mt-1 border-l-2 border-slate-700 pl-3 italic">
                                                    "{post.generated_description}"
                                                </p>
                                            )}
                                        </div>
                                        <button onClick={() => startEdit(post)} className="text-slate-500 hover:text-blue-400">
                                            <Edit2 size={16} />
                                        </button>
                                    </div>
                                    <p className="text-slate-300 whitespace-pre-line text-sm leading-relaxed">{post.generated_content}</p>
                                    <div className="text-blue-400 text-sm">{post.hashtags}</div>
                                </div>
                            )}

                            {/* Actions - Post to platforms */}
                            <div className="mt-8 pt-6 border-t border-neutral-800 flex items-center gap-3">
                                <button onClick={() => openRegenerateModal(post)} className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-slate-300 border border-neutral-700 px-2 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                                    <Sparkles size={16} /> Rewrite
                                </button>
                                <button onClick={() => handlePost(post.id)} className="flex-1 bg-green-600 hover:bg-green-500 text-white px-2 py-2 rounded-lg font-medium flex items-center justify-center gap-2 shadow-lg shadow-green-900/20">
                                    <Send size={18} /> Publish
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Regenerate Modal */}
            {regenerateModalOpen && (
                <RegenerateModal
                    onClose={() => setRegenerateModalOpen(false)}
                    onConfirm={handleRegenerate}
                    loading={regenerating}
                />
            )}

            {/* Template Selection Modal */}
            {templateModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setTemplateModalOpen(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-slate-800">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <LayoutTemplate className="text-blue-400" size={24} /> Select Template Style
                            </h2>
                            <button onClick={() => setTemplateModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {templates.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleTemplateSelect(t.id)}
                                        className="group relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800 hover:border-blue-500 transition-all text-left flex flex-col hover:shadow-xl hover:shadow-blue-500/10"
                                    >
                                        <div className="aspect-[9/16] w-full bg-slate-800 relative">
                                            <img
                                                src={t.preview || `https://placehold.co/600x400/${t.bg_color || '000000'}/ffffff?text=${encodeURIComponent(t.name)}`}
                                                alt={t.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                                                <span className="text-white font-bold">{t.name}</span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Full Screen Image Modal */}
            {fullViewImage && (
                <div className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setFullViewImage(null)}>
                    <button onClick={() => setFullViewImage(null)} className="absolute top-4 right-4 text-white/50 hover:text-white z-50 p-2 bg-black/50 rounded-full transition-colors">
                        <X size={32} />
                    </button>
                    <img
                        src={fullViewImage}
                        alt="Full Screen Preview"
                        className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Hover Preview */}
            {hoveredImage && (
                <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center p-4">
                    <div className="relative h-[85vh] aspect-[9/16] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-4 border-blue-500/50 shadow-blue-500/20 transform transition-all duration-300">
                        <img src={hoveredImage} alt="Preview" className="w-full h-full object-contain bg-black" />
                        <div className="absolute bottom-0 inset-x-0 bg-black/80 p-4 text-center backdrop-blur-sm">
                            <p className="text-blue-300 text-sm">Previewing Full Size</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Platform Selection Modal */}
            {postModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setPostModalOpen(false)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-slate-800">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Share2 className="text-green-400" size={24} /> Post to...
                            </h2>
                            <button onClick={() => setPostModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-slate-400 text-sm">Select the platforms you want to publish this content to:</p>

                            <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors border border-slate-700">
                                <input
                                    type="checkbox"
                                    checked={selectedPlatforms.facebook}
                                    onChange={e => setSelectedPlatforms({ ...selectedPlatforms, facebook: e.target.checked })}
                                    className="w-5 h-5 rounded border-slate-600 text-blue-600 focus:ring-blue-500 bg-slate-900"
                                />
                                <div className="flex items-center gap-2 text-white">
                                    <span className="font-bold">Facebook</span>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors border border-slate-700">
                                <input
                                    type="checkbox"
                                    checked={selectedPlatforms.instagram}
                                    onChange={e => setSelectedPlatforms({ ...selectedPlatforms, instagram: e.target.checked })}
                                    className="w-5 h-5 rounded border-slate-600 text-pink-600 focus:ring-pink-500 bg-slate-900"
                                />
                                <div className="flex items-center gap-2 text-white">
                                    <span className="font-bold">Instagram</span>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors border border-slate-700">
                                <input
                                    type="checkbox"
                                    checked={selectedPlatforms.twitter}
                                    onChange={e => setSelectedPlatforms({ ...selectedPlatforms, twitter: e.target.checked })}
                                    className="w-5 h-5 rounded border-slate-600 text-blue-400 focus:ring-blue-400 bg-slate-900"
                                />
                                <div className="flex items-center gap-2 text-white">
                                    <span className="font-bold">Twitter (X)</span>
                                </div>
                            </label>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setPostModalOpen(false)} className="flex-1 py-3 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 transition-colors font-medium border border-transparent">
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmPost}
                                    disabled={processingPost}
                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold shadow-lg shadow-green-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {processingPost ? (
                                        <>
                                            <RefreshCw className="animate-spin" size={20} /> Publishing...
                                        </>
                                    ) : (
                                        <>
                                            <Send size={20} /> Publish Now
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApprovedQueue;
