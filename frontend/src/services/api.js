import axios from 'axios';

const getBaseUrl = () => {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3000/api`;
};

const api = axios.create({
    baseURL: getBaseUrl(),
});

// Auth interceptors
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('auth_token');
            // Only redirect if not already on login page
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export const getSources = () => api.get('/sources');
export const addSource = (data) => api.post('/sources', data);
export const deleteSource = (id) => api.delete(`/sources/${id}`);

export const fetchNewPosts = () => api.post('/fetch');
export const getFetchStatus = () => api.get('/fetch/status');

export const getPosts = (status) => api.get('/posts', { params: status ? { status } : {} });
export const createPost = (data) => api.post('/posts', data);
export const updatePost = (id, data) => api.put(`/posts/${id}`, data);
export const regeneratePost = (id) => api.post(`/posts/${id}/regenerate`); // Legacy full regen
export const regeneratePostFields = (id, fields) => api.post(`/posts/${id}/regenerate`, { fields });
api.regeneratePostFields = regeneratePostFields;
export const switchTemplate = (id, templateId) => api.post(`/posts/${id}/template`, { templateId });
export const getTemplates = () => api.get('/templates');
export const addTemplate = (data) => api.post('/templates', data);
export const deleteTemplate = (id) => api.delete(`/templates/${id}`);
export const updateTemplate = (id, data) => api.put(`/templates/${id}`, data);

// Attach methods to default export
api.getSources = getSources;
api.addSource = addSource;
api.deleteSource = deleteSource;
api.fetchNewPosts = fetchNewPosts;
api.getFetchStatus = getFetchStatus;
api.getPosts = getPosts;
api.createPost = createPost;
api.updatePost = updatePost;
api.regeneratePost = regeneratePost;
api.switchTemplate = switchTemplate;
api.getTemplates = getTemplates;
api.addTemplate = addTemplate;
api.deleteTemplate = deleteTemplate;
api.deleteTemplate = deleteTemplate;
api.updateTemplate = updateTemplate;

export const fetchSource = (id) => api.post('/fetch', { sourceId: id });
api.fetchSource = fetchSource;

export const toggleSource = (id) => api.put(`/sources/${id}/toggle`);
api.toggleSource = toggleSource;

export const getQuota = () => api.get('/quota');
api.getQuota = getQuota;

export const rejectAllPosts = () => api.post('/posts/reject-all');
api.rejectAllPosts = rejectAllPosts;

export const checkHealth = () => axios.get(`${window.location.protocol}//${window.location.hostname}:3000/health`);
api.checkHealth = checkHealth;

export default api;
