import Dashboard from '@/components/Dashboard';
import { AuthGuard } from '@/components/AuthGuard';

const Index = () => {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
};

export default Index;
