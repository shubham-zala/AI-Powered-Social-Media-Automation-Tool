import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { FetchProvider } from './context/FetchContext';

// Pages
import Dashboard from './pages/Dashboard';
import Sources from './pages/Sources';
import Approval from './pages/Approval';
import ShortlistedQueue from './pages/ShortlistedQueue';
import ApprovedQueue from './pages/ApprovedQueue';
import History from './pages/History';
import Templates from './pages/Templates';
import UserManagement from './pages/UserManagement';
import Login from './pages/Login';

function App() {
  return (
    <AuthProvider>
      <FetchProvider>
        <Router>
          <Routes>
            {/* Public Route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Routes - wrapped in Layout */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/sources" element={
              <ProtectedRoute roles={['admin', 'user']}>
                <Layout>
                  <Sources />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/pending" element={
              <ProtectedRoute roles={['admin', 'user']}>
                <Layout>
                  <Approval />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/approval" element={<Navigate to="/pending" replace />} />
            <Route path="/shortlisted" element={
              <ProtectedRoute roles={['admin', 'approver']}>
                <Layout>
                  <ShortlistedQueue />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/approved" element={
              <ProtectedRoute roles={['admin', 'user']}>
                <Layout>
                  <ApprovedQueue />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/history" element={
              <ProtectedRoute roles={['admin', 'approver', 'user']}>
                <Layout>
                  <History />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/templates" element={
              <ProtectedRoute roles={['admin', 'user']}>
                <Layout>
                  <Templates />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute roles={['admin']}>
                <Layout>
                  <UserManagement />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </FetchProvider>
    </AuthProvider>
  );
}

export default App;
