import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  BookOpen, 
  FileText, 
  AlertCircle,
  Clock,
  ArrowLeft,
  Phone,
  Mail
} from 'lucide-react';
import { LogoLoader } from './shared/LoadingSpinner';
import { motion } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Policy {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export default function PublicPolicies() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || '';

  const fetchPolicies = async () => {
    try {
      const { data, error } = await supabase
        .from('app_policies')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPolicies(data || []);
    } catch (err) {
      console.error('Error fetching policies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  // Check if a policy matches the requested tab parameter
  const isHighlighted = (title: string) => {
    if (!tabParam) return false;
    const cleanTitle = title.toLowerCase();
    if (tabParam === 'privacy' && cleanTitle.includes('privacy')) return true;
    if (tabParam === 'terms' && (cleanTitle.includes('terms') || cleanTitle.includes('condition'))) return true;
    if (tabParam === 'refund' && cleanTitle.includes('refund')) return true;
    if (tabParam === 'cancellation' && cleanTitle.includes('cancellation')) return true;
    return false;
  };

  const icons = [BookOpen, ShieldCheck, FileText];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 h-20 flex items-center shrink-0">
        <div className="max-w-5xl mx-auto px-6 w-full flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </button>
          <img src="/logo.png" alt="UsePay Logo" className="h-10 w-auto" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 w-full space-y-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 leading-tight">Legal Policies & Compliance</h1>
          <p className="text-slate-500 text-sm mt-1">Please read our data privacy, terms of use, refund, and cancellation policies below.</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {loading ? (
            <div className="py-20 text-center">
              <LogoLoader size="md" className="mx-auto" />
            </div>
          ) : policies.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
                <FileText size={32} />
              </div>
              <p className="text-slate-500 font-bold">No policies available</p>
              <p className="text-slate-400 text-sm mt-1">Check back later for updates.</p>
            </div>
          ) : (
            policies.map((policy, index) => {
              const Icon = icons[index % icons.length];
              const active = isHighlighted(policy.title);
              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={policy.id}
                  id={`policy-${policy.id}`}
                  className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-all duration-300 ${
                    active 
                      ? 'border-indigo-500 ring-4 ring-indigo-50' 
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="p-8">
                    <div className="flex items-start gap-6">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                        active 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-indigo-50 text-indigo-600'
                      }`}>
                        <Icon size={24} />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                          <h3 className="text-xl font-bold text-slate-900">{policy.title}</h3>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-full w-fit">
                            <Clock size={10} />
                            Updated {new Date(policy.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="prose prose-slate max-w-none">
                          <p className="text-slate-600 leading-relaxed whitespace-pre-wrap text-sm">
                            {policy.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Support Section */}
        <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="relative z-10 space-y-2">
            <h3 className="text-xl font-bold">Have Questions About Our Policies?</h3>
            <p className="text-indigo-100 text-sm max-w-md">
              For any legal questions, data deletion requests, or compliance complaints, reach out to our team.
            </p>
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row gap-4 w-full md:w-auto shrink-0">
            <a 
              href="mailto:usepay.in@gmail.com"
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-white/20"
            >
              <Mail size={16} />
              <span>usepay.in@gmail.com</span>
            </a>
            <a 
              href="tel:+919512180909"
              className="bg-white text-indigo-600 px-6 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
            >
              <Phone size={16} />
              <span>+91 9512180909</span>
            </a>
          </div>
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none">
            <ShieldCheck size={200} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 py-8 px-6 mt-12 shrink-0">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
            © {new Date().getFullYear()} UsePay Fintech Solution Pvt Ltd. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
