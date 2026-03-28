'use client';

import { useEffect, useState } from 'react';

interface DashboardData {
  customers: number;
  projects: number;
  totalRevenue: number;
  contractorsActive: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<Partial<DashboardData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Customers Card */}
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Customers</p>
              <p className="text-3xl font-bold text-gray-900">
                {data.customers || 0}
              </p>
            </div>
            <div className="text-4xl opacity-20">👥</div>
          </div>
        </div>

        {/* Projects Card */}
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active Projects</p>
              <p className="text-3xl font-bold text-gray-900">
                {data.projects || 0}
              </p>
            </div>
            <div className="text-4xl opacity-20">📋</div>
          </div>
        </div>

        {/* Revenue Card */}
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Revenue</p>
              <p className="text-3xl font-bold text-green-600">
                ${(data.totalRevenue || 0).toLocaleString()}
              </p>
            </div>
            <div className="text-4xl opacity-20">💰</div>
          </div>
        </div>

        {/* Contractors Card */}
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active Contractors</p>
              <p className="text-3xl font-bold text-gray-900">
                {data.contractorsActive || 0}
              </p>
            </div>
            <div className="text-4xl opacity-20">⚙️</div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <p className="text-gray-600">No recent activity</p>
      </div>
    </div>
  );
}
