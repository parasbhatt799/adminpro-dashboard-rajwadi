import React from 'react';
import { Search, Receipt } from 'lucide-react';

export default function DistributorBillPayments({ userId }: { userId: string }) {
  console.log('Distributor ID:', userId);
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Users Bill Payment</h2>
        <p className="text-slate-500 mt-1">Manage and track bill payment requests from your users.</p>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by customer mobile or card..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All Status</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col items-center justify-center p-12 text-center">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-6 shadow-inner">
          <Receipt size={40} />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">No Bill Payments Found</h3>
        <p className="text-slate-500 max-w-sm mx-auto">
          When your users submit bill payment requests, they will appear here for you to track.
        </p>
      </div>
    </div>
  );
}
