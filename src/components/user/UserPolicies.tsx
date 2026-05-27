import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  BookOpen, 
  FileText, 
  Loader2, 
  AlertCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { LogoLoader } from '../shared/LoadingSpinner';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Policy {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export default function UserPolicies({ userId }: { userId: string }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const icons = [BookOpen, ShieldCheck, FileText];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Terms & Conditions</h2>
          <p className="text-slate-500 text-sm mt-1">Please read our terms and conditions carefully.</p>
        </div>
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
          <ShieldCheck size={24} />
        </div>
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
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                key={policy.id}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden group hover:border-indigo-100 hover:shadow-md transition-all"
              >
                <div className="p-8">
                  <div className="flex items-start gap-6">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Icon size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xl font-bold text-slate-900">{policy.title}</h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-full">
                          <Clock size={10} />
                          Updated {new Date(policy.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="prose prose-slate max-w-none">
                        <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
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

      <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-100">
        <div className="relative z-10">
          <h3 className="text-xl font-bold mb-2">Need Help?</h3>
          <p className="text-indigo-100 text-sm mb-6 max-w-md">
            If you have questions regarding any of our policies, please contact our support team.
          </p>
          <button 
            onClick={() => navigate('/user/complaints')}
            className="bg-white text-indigo-600 px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors"
          >
            Support Center
            <ExternalLink size={16} />
          </button>
        </div>
        <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
          <ShieldCheck size={200} />
        </div>
      </div>
    </div>
  );
}
