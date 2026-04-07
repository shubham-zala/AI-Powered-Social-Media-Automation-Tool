import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Radio, FileText, Settings, Rocket, LayoutTemplate, Loader2, CheckSquare, CheckCircle, Users, LogOut } from 'lucide-react';
import { getQuota, checkHealth } from '../services/api';
import { cn } from '../lib/utils';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useFetch } from '../context/FetchContext';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const [quota, setQuota] = useState(null);
    const [isBackendOnline, setIsBackendOnline] = useState(false);
    const { isFetching, fetchMessage } = useFetch();

    useEffect(() => {
        getQuota().then(res => setQuota(res.data)).catch(console.error);

        // Health Check Polling
        const checkStatus = () => {
            checkHealth()
                .then(() => setIsBackendOnline(true))
                .catch(() => setIsBackendOnline(false));
        };

        checkStatus(); // Initial check
        const interval = setInterval(checkStatus, 30000); // Check every 30s

        return () => clearInterval(interval);
    }, []);

    const allNavItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['admin', 'approver', 'user'] },
        { label: 'Sources', icon: Radio, path: '/sources', roles: ['admin', 'user'] },
        { label: 'Pending', icon: FileText, path: '/pending', roles: ['admin', 'user'] },
        { label: 'Shortlisted', icon: CheckSquare, path: '/shortlisted', roles: ['admin', 'approver'] },
        { label: 'Approved', icon: CheckCircle, path: '/approved', roles: ['admin', 'user'] },
        { label: 'History', icon: Rocket, path: '/history', roles: ['admin', 'approver', 'user'] },
        { label: 'Templates', icon: LayoutTemplate, path: '/templates', roles: ['admin', 'user'] },
        { label: 'Users', icon: Users, path: '/users', roles: ['admin'] },
    ];

    const navItems = allNavItems.filter(item => item.roles.includes(user?.role || 'user'));

    return (
        <div className="flex h-screen bg-black text-white font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-black border-r border-neutral-800 flex flex-col">
                <div className="p-6">
                    <img src="/logo.svg" alt="AI Social Publisher" className="h-14 w-auto mb-2" />
                </div>

                <div className="px-6 mb-4">
                    <div className={cn("flex items-center gap-2 px-3 py-2 rounded border transition-colors duration-300",
                        isBackendOnline ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-red-500/10 border-red-500/20 text-red-500"
                    )}>
                        <div className={cn("w-2 h-2 rounded-full animate-pulse", isBackendOnline ? "bg-emerald-500" : "bg-red-500")}></div>
                        <span className="text-xs font-bold uppercase tracking-wider">{isBackendOnline ? "Connected" : "Disconnected"}</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                                    isActive
                                        ? "bg-neutral-900 text-white border border-neutral-800 shadow-sm"
                                        : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                                )}
                            >
                                <Icon size={20} />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-900">
                    {/* Quota Display */}
                    <div className="mb-4 px-4">
                        <div className="text-xs text-neutral-500 mb-1 flex justify-between">
                            <span>API Usage</span>
                            <span>{quota ? `${quota.used.toLocaleString()} / ${quota.limit.toLocaleString()}` : 'Loading...'}</span>
                        </div>
                        <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="bg-blue-500 h-full rounded-full transition-all duration-500"
                                style={{ width: quota ? `${Math.min(100, (quota.used / quota.limit) * 100)}%` : '0%' }}
                            ></div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 px-4 py-2 border-t border-neutral-900 mt-2 pt-4">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-neutral-700 to-neutral-600 flex items-center justify-center text-xs font-bold border border-neutral-600">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                            <p className="text-xs text-neutral-500 capitalize">{user?.role || 'user'}</p>
                        </div>
                        <button
                            onClick={logout}
                            className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                            title="Logout"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-black flex flex-col">

                {/* Global Fetch Banner */}
                {isFetching && (
                    <div className="w-full bg-gradient-to-r from-blue-600/90 via-indigo-600/90 to-blue-600/90 text-white flex items-center justify-center gap-3 py-2.5 px-6 text-sm font-medium shadow-lg animate-pulse z-50">
                        <Loader2 size={16} className="animate-spin flex-shrink-0" />
                        <span>{fetchMessage}</span>
                        <span className="text-blue-200 text-xs">— Stay on any page, we'll notify you when done.</span>
                    </div>
                )}
                <div className="p-8">
                    {children}
                </div>
            </main>

        </div>
    );
};

export default Layout;
