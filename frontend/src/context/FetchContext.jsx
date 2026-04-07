import { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../services/api';

const FetchContext = createContext(null);

export const FetchProvider = ({ children }) => {
    const [isFetching, setIsFetching] = useState(false);
    const [fetchMessage, setFetchMessage] = useState('Fetching new content...');
    const pollingRef = useRef(null);

    const checkStatus = async () => {
        try {
            const res = await api.getFetchStatus();
            const { isFetching: backendBusy, message } = res.data;

            setIsFetching(backendBusy);
            if (message) setFetchMessage(message);

            if (!backendBusy && pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            } else if (backendBusy && !pollingRef.current) {
                startPolling();
            }
        } catch (err) {
            console.error('Failed to poll fetch status:', err);
        }
    };

    const startPolling = () => {
        if (pollingRef.current) return;
        pollingRef.current = setInterval(checkStatus, 2000);
    };

    useEffect(() => {
        checkStatus(); // Initial check on mount
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    // Also start polling when a fetch is triggered from UI
    useEffect(() => {
        if (isFetching && !pollingRef.current) {
            startPolling();
        }
    }, [isFetching]);

    return (
        <FetchContext.Provider value={{ isFetching, setIsFetching, fetchMessage, setFetchMessage }}>
            {children}
        </FetchContext.Provider>
    );
};

export const useFetch = () => useContext(FetchContext);
