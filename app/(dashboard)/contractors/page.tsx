'use client';

import { useEffect, useState } from 'react';

interface Contractor {
  id: string;
  email: string;
  full_name: string;
  state_code: string;
  created_at: string;
}

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContractors = async () => {
      try {
        const response = await fetch('/api/contractors');
        if (response.ok) {
          const data = await response.json();
          setContractors(data.contractors || []);
        }
      } catch (error) {
        console.error('Failed to fetch contractors:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContractors();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Contractors</h1>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition">
          Add Contractor
        </button>
      </div>

      {loading ? (
        <div>Loading contractors...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  State
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {contractors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No contractors found
                  </td>
                </tr>
              ) : (
                contractors.map((contractor) => (
                  <tr key={contractor.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {contractor.full_name}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {contractor.email}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {contractor.state_code}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {new Date(contractor.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button className="text-blue-600 hover:underline">View</button>
                      <button className="text-red-600 hover:underline">Remove</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
