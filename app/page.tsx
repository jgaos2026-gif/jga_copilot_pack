// Copyright (c) 2026 Jay's Graphic Arts LLC. All rights reserved.
// Proprietary and confidential. Unauthorized use, reproduction, or distribution
// of this software is strictly prohibited. See LICENSE for details.

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-r from-blue-600 to-blue-800 text-white">
      <div className="text-center max-w-2xl mx-auto px-4">
        <h1 className="text-5xl font-bold mb-6">JGA Enterprise OS</h1>
        <p className="text-xl mb-8 opacity-90">
          Enterprise Operating System with 8 System Laws for secure, compliant business operations
        </p>
        
        <div className="flex flex-col md:flex-row gap-4 justify-center mb-12">
          <a
            href="/login"
            className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            Sign In
          </a>
          <a
            href="/register"
            className="bg-blue-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-400 transition border-2 border-white"
          >
            Get Started
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="bg-blue-700 p-6 rounded-lg">
            <h3 className="text-lg font-bold mb-2">Secure</h3>
            <p className="opacity-90">End-to-end encryption, mTLS, MFA enforcement</p>
          </div>
          <div className="bg-blue-700 p-6 rounded-lg">
            <h3 className="text-lg font-bold mb-2">Compliant</h3>
            <p className="opacity-90">8 system laws, dual-auth, audit trail</p>
          </div>
          <div className="bg-blue-700 p-6 rounded-lg">
            <h3 className="text-lg font-bold mb-2">Scalable</h3>
            <p className="opacity-90">State-isolated BRICs, event-driven architecture</p>
          </div>
        </div>
      </div>
    </main>
  );
}
