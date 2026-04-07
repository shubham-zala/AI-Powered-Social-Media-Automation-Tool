import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, RefreshCw, Shield, ShieldCheck, User, X, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';

const roleBadge = {
    admin: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', label: 'Admin' },
    approver: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', label: 'Approver' },
    user: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', label: 'User' }
};

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const res = await api.post('/users', form);
            setUsers([res.data, ...users]);
            setModalOpen(false);
            setForm({ name: '', email: '', password: '', role: 'user' });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create user');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggle = async (id) => {
        try {
            const res = await api.put(`/users/${id}/toggle`);
            setUsers(users.map(u => u.id === id ? { ...u, is_active: res.data.is_active } : u));
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to toggle user');
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/users/${id}`);
            setUsers(users.filter(u => u.id !== id));
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete user');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="animate-spin text-blue-400" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">User Management</h2>
                    <p className="text-neutral-400">Manage users and their roles.</p>
                </div>
                <button
                    onClick={() => setModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all"
                >
                    <UserPlus size={18} /> Add User
                </button>
            </div>

            {/* Users Table */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-neutral-800">
                            <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-4">Name</th>
                            <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-4">Email</th>
                            <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-4">Role</th>
                            <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-4">Status</th>
                            <th className="text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-4">Created</th>
                            <th className="text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider px-6 py-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                        {users.map(user => {
                            const badge = roleBadge[user.role] || roleBadge.user;
                            return (
                                <tr key={user.id} className="hover:bg-neutral-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-neutral-700 to-neutral-600 flex items-center justify-center text-xs font-bold border border-neutral-600 text-white">
                                                {user.name?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <span className="text-white font-medium">{user.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-neutral-400 text-sm">{user.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.border} ${badge.text} border`}>
                                            {user.role === 'admin' ? <ShieldCheck size={12} /> : user.role === 'approver' ? <Shield size={12} /> : <User size={12} />}
                                            {badge.label}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggle(user.id)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${user.is_active ? 'bg-green-500' : 'bg-neutral-700'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${user.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-neutral-500 text-sm">
                                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(user.id, user.name)}
                                            className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                                            title="Delete user"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Add User Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
                    <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-neutral-800">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <UserPlus className="text-blue-400" size={24} /> Add New User
                            </h2>
                            <button onClick={() => setModalOpen(false)} className="text-neutral-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    required
                                    className="w-full px-4 py-2.5 bg-black border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                                    placeholder="John Doe"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    required
                                    className="w-full px-4 py-2.5 bg-black border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                                    placeholder="john@example.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={form.password}
                                        onChange={e => setForm({ ...form, password: e.target.value })}
                                        required
                                        minLength={6}
                                        className="w-full px-4 py-2.5 bg-black border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all pr-12"
                                        placeholder="Min 6 characters"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1">Role</label>
                                <select
                                    value={form.role}
                                    onChange={e => setForm({ ...form, role: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-black border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all appearance-none"
                                >
                                    <option value="user">User</option>
                                    <option value="approver">Approver</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div className="flex gap-3 mt-6 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="flex-1 py-2.5 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting ? <RefreshCw className="animate-spin" size={16} /> : <UserPlus size={16} />}
                                    {submitting ? 'Creating...' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
