import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, roles }) => {
    const { isAuthenticated, user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-black">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-neutral-400 text-sm">Loading...</span>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Check role permissions if specified
    if (roles && !roles.includes(user.role)) {
        return (
            <div className="flex h-screen items-center justify-center bg-black">
                <div className="text-center space-y-4">
                    <div className="text-6xl">🚫</div>
                    <h2 className="text-2xl font-bold text-white">Access Denied</h2>
                    <p className="text-neutral-400">You don't have permission to view this page.</p>
                    <button
                        onClick={() => window.history.back()}
                        className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return children;
};

export default ProtectedRoute;
