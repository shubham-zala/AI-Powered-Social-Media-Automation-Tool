import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle, BookmarkCheck, CheckSquare } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 flex flex-col items-center gap-4 text-center">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-opacity-20 ${color.bg}`}>
            <Icon size={20} className={color.text} />
        </div>
        <div>
            <p className="text-neutral-400 text-sm font-medium">{title}</p>
            <h3 className="text-3xl font-bold text-white mt-1">{value}</h3>
        </div>
    </div>
);


const Dashboard = () => {
    const [stats, setStats] = useState({
        pending: 0,
        shortlisted: 0,
        approved: 0,
        posted: 0,
        rejected: 0,
        total: 0
    });

    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await api.get('/posts');
            const posts = res.data;

            const pending = posts.filter(p => p.status === 'pending').length;
            const shortlisted = posts.filter(p => p.status === 'shortlisted').length;
            const approved = posts.filter(p => p.status === 'approved').length;
            const posted = posts.filter(p => p.status === 'posted').length;
            const rejected = posts.filter(p => p.status === 'rejected').length;

            setStats({
                pending,
                shortlisted,
                approved,
                posted,
                rejected,
                total: posts.length
            });
        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
        } finally {
            setLoading(false);
        }
    };



    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Dashboard</h2>
                    <p className="text-neutral-400">Welcome back, {user?.name || 'User'}.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                <StatCard
                    title="Pending"
                    value={stats.pending}
                    icon={Clock}
                    color={{ bg: 'bg-amber-500', text: 'text-amber-500' }}
                />
                <StatCard
                    title="Shortlisted"
                    value={stats.shortlisted}
                    icon={BookmarkCheck}
                    color={{ bg: 'bg-orange-500', text: 'text-orange-500' }}
                />
                <StatCard
                    title="Approved"
                    value={stats.approved}
                    icon={CheckSquare}
                    color={{ bg: 'bg-blue-500', text: 'text-blue-500' }}
                />
                <StatCard
                    title="Posted"
                    value={stats.posted}
                    icon={CheckCircle}
                    color={{ bg: 'bg-green-500', text: 'text-green-500' }}
                />
                <StatCard
                    title="Rejected"
                    value={stats.rejected}
                    icon={XCircle}
                    color={{ bg: 'bg-red-500', text: 'text-red-500' }}
                />
                <StatCard
                    title="Total"
                    value={stats.total}
                    icon={AlertCircle}
                    color={{ bg: 'bg-neutral-500', text: 'text-neutral-500' }}
                />
            </div>

        </div>
    );
};

export default Dashboard;
