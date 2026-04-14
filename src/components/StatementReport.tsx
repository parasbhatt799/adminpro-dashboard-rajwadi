import React, { useState } from 'react';
import { FileBarChart, Search, IndianRupee, RotateCcw, Download } from 'lucide-react';

export default function StatementReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Statement Report</h2>
        <p className="text-slate-500 mt-1">Generate and export overall transaction statements.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Start Date</span>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs font-bold text-slate-700 outline-none bg-transparent"
                  />
                </div>
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">End Date</span>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs font-bold text-slate-700 outline-none bg-transparent"
                  />
                </div>
              </div>
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); setSearchQuery(''); }}
                className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 bg-white"
                title="Reset Filters"
              >
                <RotateCcw size={18} />
              </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none w-64"
              />
            </div>
            <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all">
              <Download size={18} />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-12 text-center text-slate-400">
        <FileBarChart className="mx-auto mb-4 opacity-10" size={64} />
        <p className="font-medium">No report data to display for the selected range.</p>
        <p className="text-sm mt-1">Select a date range and click export to generate a report.</p>
      </div>
    </div>
  );
}
