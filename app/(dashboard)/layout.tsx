'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'GET' });
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-blue-900 text-white p-6 shadow-lg">
        <h1 className="text-2xl font-bold mb-8">JGA OS</h1>
        
        <nav className="space-y-4">
          <Link
            href="/dashboard"
            className="block px-4 py-2 rounded hover:bg-blue-800 transition"
          >
            Overview
          </Link>
          <Link
            href="/dashboard/projects"
            className="block px-4 py-2 rounded hover:bg-blue-800 transition"
          >
            Projects
          </Link>
          <Link
            href="/dashboard/contractors"
            className="block px-4 py-2 rounded hover:bg-blue-800 transition"
          >
            Contractors
          </Link>
          <Link
            href="/dashboard/transactions"
            className="block px-4 py-2 rounded hover:bg-blue-800 transition"
          >
            Transactions
          </Link>
          <Link
            href="/dashboard/settings"
            className="block px-4 py-2 rounded hover:bg-blue-800 transition"
          >
            Settings
          </Link>
        </nav>

        <button
          onClick={handleLogout}
          className="w-full mt-8 bg-red-600 hover:bg-red-700 text-white py-2 rounded transition"
        >
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
