
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth';
import { AppLayout } from './components/layout';
import { ErrorBoundary } from './components/ui';
import { ProtocolForm } from './components/forms';
import { Dashboard, Protocols, Clients, Updates, ProtocolDetail, Settings, /* Admin, */ Debug, Profile } from './pages';
import { useProtocolForm } from './hooks';
import type { Protocol } from './types';

function AppContent() {
  const {
    isModalOpen,
    editingProtocol,
    mode,
    openCreateModal,
    openEditModal,
    closeModal,
    handleSubmit,
    handleDelete,
    isLoading,
  } = useProtocolForm();

  const handleCreateProtocol = () => {
    openCreateModal();
  };

  const handleEditProtocol = (protocol: Protocol) => {
    openEditModal(protocol);
  };

  const handleDeleteProtocol = async (protocol: Protocol) => {
    if (window.confirm(`Are you sure you want to delete "${protocol.name}"?`)) {
      await handleDelete(protocol.id);
    }
  };

  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard 
                  onCreateProtocol={handleCreateProtocol}
                  onEditProtocol={handleEditProtocol}
                  onViewProtocol={(protocol) => window.location.href = `/protocols/${protocol.id}`}
                  onViewAllProtocols={() => window.location.href = '/protocols'}
                />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/protocols" 
            element={
              <ProtectedRoute>
                <Protocols 
                  onCreateProtocol={handleCreateProtocol}
                  onEditProtocol={handleEditProtocol}
                  onDeleteProtocol={handleDeleteProtocol}
                />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/protocols/:id" 
            element={
              <ProtectedRoute>
                <ProtocolDetail />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/clients" 
            element={
              <ProtectedRoute>
                <Clients />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/updates" 
            element={
              <ProtectedRoute>
                <Updates />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          {/* <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            } 
          /> */}
          <Route path="/debug" element={<Debug />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        {/* Protocol Form Modal */}
        <ProtocolForm
          opened={isModalOpen}
          onClose={closeModal}
          onSubmit={handleSubmit}
          protocol={editingProtocol}
          loading={isLoading}
          mode={mode}
        />
      </AppLayout>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
