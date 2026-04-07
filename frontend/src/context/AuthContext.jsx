import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('auth_token'));
    const [loading, setLoading] = useState(true);

    // Restore session on mount
    useEffect(() => {
        if (token) {
            restoreSession();
        } else {
            setLoading(false);
        }
    }, []);

    const restoreSession = async () => {
        try {
            const res = await api.get('/auth/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(res.data.user);
        } catch (err) {
            console.error('Session restore failed:', err);
            // Token is invalid/expired — clear it
            localStorage.removeItem('auth_token');
            setToken(null);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        const { token: newToken, user: userData } = res.data;

        localStorage.setItem('auth_token', newToken);
        setToken(newToken);
        setUser(userData);

        return userData;
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
        window.location.href = '/login';
    };

    const isAuthenticated = !!user && !!token;

    const value = {
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
