import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, X, Send, Trash2, ArrowLeft, Building2, User, 
  ChevronRight, Circle, HelpCircle, ShieldAlert, Loader2,
  Paperclip, Smile, FileText, Download, Image
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';

interface UserChatWidgetProps {
  userId: string;
}

export default function UserChatWidget({ userId }: UserChatWidgetProps) {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Navigation: 'menu' | 'chat'
  const [view, setView] = useState<'menu' | 'chat'>('menu');
  
  // Menu selection states
  const [parentPartner, setParentPartner] = useState<any>(null);
  const [subUsers, setSubUsers] = useState<any[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  
  // Active Chat State
  const [currentThread, setCurrentThread] = useState<any>(null);
  const [chatTarget, setChatTarget] = useState<any>({ name: 'Admin Support', id: 'admin', role: 'admin' });
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const EMOJIS = ['👍', '❤️', '😊', '😂', '🙏', '👏', '✔️', '❓', '🔥'];
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to sort participants alphabetically
  const getThreadParticipants = (id1: string, id2: string) => {
    return id1 < id2 ? { a: id1, b: id2 } : { a: id2, b: id1 };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (view === 'chat' && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, view]);

  // Fetch logged in user profile & parent relations
  useEffect(() => {
    const loadProfileAndRelations = async () => {
      try {
        const { data: profile } = await supabase
          .from('users_profiles')
          .select('*, distributor:distributor_id(id, name, firm_name, role), super_distributor:super_distributor_id(id, name, firm_name, role)')
          .eq('id', userId)
          .single();

        if (profile) {
          setUserProfile(profile);
          
          // Set parent partner if exists
          if (profile.role === 'user' && profile.distributor) {
            setParentPartner(profile.distributor);
          } else if (profile.role === 'distributor' && profile.super_distributor) {
            setParentPartner(profile.super_distributor);
          }

          // Fetch managed sub-users (Distributors for SD, Users for Dist)
          if (profile.role === 'super_distributor' || profile.role === 'distributor') {
            const { data: subData } = await supabase
              .from('users_profiles')
              .select('id, name, firm_name, role, mobile_number')
              .eq(profile.role === 'super_distributor' ? 'super_distributor_id' : 'distributor_id', userId)
              .eq('status', 'Active');
            
            if (subData) {
              setSubUsers(subData);
            }
          }
        }
      } catch (err) {
        console.error('Error loading profile relations:', err);
      }
    };

    if (userId) {
      loadProfileAndRelations();
    }
  }, [userId]);

  // Fetch all threads involving this user
  const fetchThreads = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_threads')
        .select('*')
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .order('updated_at', { ascending: false });

      if (!error && data) {
        setThreads(data);
      }
    } catch (err) {
      console.error('Error fetching threads:', err);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchThreads();

      // Subscribe to thread updates in real-time
      const threadChannel = supabase
        .channel(`user_threads_${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'chat_threads'
        }, () => {
          fetchThreads();
        })
        .subscribe();

      // Subscribe to message inserts to double-insure realtime badge updates
      const messagesChannel = supabase
        .channel(`user_messages_global_${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        }, () => {
          fetchThreads();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(threadChannel);
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [userId]);

  // Keep currentThread state updated with latest unread counts from threads list
  useEffect(() => {
    if (currentThread && threads.length > 0) {
      const updated = threads.find(t => t.id === currentThread.id);
      if (updated) {
        if (
          updated.user_a_unread !== currentThread.user_a_unread ||
          updated.user_b_unread !== currentThread.user_b_unread ||
          updated.last_message !== currentThread.last_message
        ) {
          setCurrentThread(updated);
        }
      }
    }
  }, [threads, currentThread]);

  // Open or Create a chat thread
  const handleOpenChat = async (targetId: string, targetName: string, targetFirm: string, targetRole: string) => {
    setLoading(true);
    setChatTarget({ id: targetId, name: targetName, firm_name: targetFirm, role: targetRole });
    
    const { a, b } = getThreadParticipants(userId, targetId);
    
    try {
      // Check if thread exists
      let { data: thread } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('user_a_id', a)
        .eq('user_b_id', b)
        .maybeSingle();

      if (!thread) {
        // Create new thread
        const { data: newThread, error } = await supabase
          .from('chat_threads')
          .insert([{
            user_a_id: a,
            user_b_id: b,
            updated_at: new Date().toISOString()
          }])
          .select('*')
          .single();

        if (error) throw error;
        thread = newThread;
      }

      setCurrentThread(thread);
      setView('chat');
      
      // Clear unread count on open
      const isUserA = userId === thread.user_a_id;
      if ((isUserA && thread.user_a_unread > 0) || (!isUserA && thread.user_b_unread > 0)) {
        await supabase
          .from('chat_threads')
          .update({
            user_a_unread: isUserA ? 0 : thread.user_a_unread,
            user_b_unread: isUserA ? thread.user_b_unread : 0
          })
          .eq('id', thread.id);
      }

      // Fetch messages
      const { data: msgData } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true });

      setMessages(msgData || []);

    } catch (err) {
      console.error('Error starting chat:', err);
      toast.error('Failed to open chat.');
    } finally {
      setLoading(false);
    }
  };

  // Listen for real-time messages in the active thread
  useEffect(() => {
    if (currentThread && view === 'chat') {
      const msgChannel = supabase
        .channel(`chat_messages_${currentThread.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        }, (payload) => {
          if (payload.new.thread_id !== currentThread.id) return;
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          
          // Mark as read immediately if chat is open
          const isUserA = userId === currentThread.user_a_id;
          supabase
            .from('chat_threads')
            .update({
              user_a_unread: isUserA ? 0 : currentThread.user_a_unread,
              user_b_unread: isUserA ? currentThread.user_b_unread : 0
            })
            .eq('id', currentThread.id)
            .then(() => {});
        })
        .subscribe();

      return () => {
        supabase.removeChannel(msgChannel);
      };
    }
  }, [currentThread, view, userId]);

  // Send a new message (handles text only or text + file upload together)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageText.trim();
    if ((!text && !selectedFile) || !currentThread) return;

    setSending(true);

    try {
      const isUserA = userId === currentThread.user_a_id;
      let fileUrl = '';
      let fileType: 'image' | 'file' | null = null;
      let finalMessage = text;

      if (selectedFile) {
        setFileUploading(true);
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${userId}_chat_${Date.now()}.${fileExt}`;
        const filePath = `chat_attachments/${fileName}`;

        // 1. Upload to Supabase Storage in 'payment_proofs' bucket
        const { error: uploadError } = await supabase.storage
          .from('payment_proofs')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('payment_proofs')
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
        const isImage = selectedFile.type.startsWith('image/');
        fileType = isImage ? 'image' : 'file';

        if (!finalMessage) {
          finalMessage = selectedFile.name || `Sent a ${fileType}`;
        }
      }

      // 2. Insert message
      const { error: insertErr } = await supabase
        .from('chat_messages')
        .insert([{
          thread_id: currentThread.id,
          sender_id: userId,
          sender_role: 'user', // Clients are roles: user/distributor/sd
          message: finalMessage,
          file_url: fileUrl || null,
          file_type: fileType || null
        }]);

      if (insertErr) throw insertErr;

      // 3. Update thread last message and unread count for other party
      const lastMsgText = fileUrl ? `[${fileType}] ${finalMessage}` : finalMessage;
      await supabase
        .from('chat_threads')
        .update({
          last_message: lastMsgText.substring(0, 100),
          user_a_unread: isUserA ? currentThread.user_a_unread : currentThread.user_a_unread + 1,
          user_b_unread: isUserA ? currentThread.user_b_unread + 1 : currentThread.user_b_unread,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentThread.id);

      // Reset states
      setMessageText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Refresh threads list
      fetchThreads();

    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Message failed to send.');
    } finally {
      setSending(false);
      setFileUploading(false);
    }
  };

  // Select file and hold in state for preview
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Remove selected file preview
  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle emoji click
  const handleEmojiClick = (emoji: string) => {
    setMessageText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Clear Chat History
  const handleClearChat = async () => {
    if (!currentThread) return;
    if (!window.confirm('Are you sure you want to clear this chat history?')) return;

    try {
      // Delete all messages matching thread_id
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('thread_id', currentThread.id);

      if (error) throw error;

      // Reset last message in thread
      await supabase
        .from('chat_threads')
        .update({
          last_message: null,
          user_a_unread: 0,
          user_b_unread: 0
        })
        .eq('id', currentThread.id);

      setMessages([]);
      toast.success('Chat history cleared.');
    } catch (err) {
      console.error('Error clearing chat:', err);
      toast.error('Failed to clear chat.');
    }
  };

  // Helper to count unread messages globally for widget notification badge
  const totalUnreadCount = threads.reduce((acc, curr) => {
    const isUserA = userId === curr.user_a_id;
    return acc + (isUserA ? curr.user_a_unread : curr.user_b_unread);
  }, 0);

  // Helper to check unread status of specific targets
  const getTargetUnreadCount = (targetId: string) => {
    const { a, b } = getThreadParticipants(userId, targetId);
    const thread = threads.find(t => t.user_a_id === a && t.user_b_id === b);
    if (!thread) return 0;
    return userId === thread.user_a_id ? thread.user_a_unread : thread.user_b_unread;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="w-80 h-[450px] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {view === 'chat' && (
                  <button 
                    onClick={() => { setView('menu'); setCurrentThread(null); }}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-300"
                  >
                    <ArrowLeft size={16} />
                  </button>
                )}
                <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-sm leading-none">
                    {view === 'chat' ? chatTarget.firm_name || chatTarget.name : 'Help & Chat Support'}
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mt-1 block">
                    {view === 'chat' ? (chatTarget.role === 'admin' ? 'Admin' : 'Partner') : 'Active Session'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {view === 'chat' && messages.length > 0 && (
                  <button 
                    onClick={handleClearChat}
                    title="Clear Chat"
                    className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* View Switching */}
            <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col no-scrollbar">
              {view === 'menu' ? (
                /* Conversations Menu View */
                <div className="p-4 space-y-4">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Available Contacts</span>
                  
                  {/* Admin Support Option */}
                  <button
                    onClick={() => handleOpenChat('admin', 'Admin Support', 'Admin Support', 'admin')}
                    className="w-full bg-white p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all text-left shadow-sm flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <HelpCircle size={20} />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Support desk</span>
                        <h5 className="font-bold text-sm text-slate-800 mt-0.5">Admin Chat</h5>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getTargetUnreadCount('admin') > 0 && (
                        <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                          {getTargetUnreadCount('admin')}
                        </span>
                      )}
                      <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>

                  {/* Parent Partner Option (Distributor for User, Super Distributor for Distributor) */}
                  {parentPartner && (
                    <button
                      onClick={() => handleOpenChat(parentPartner.id, parentPartner.name, parentPartner.firm_name, parentPartner.role)}
                      className="w-full bg-white p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all text-left shadow-sm flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                          <Building2 size={20} />
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">
                            My {parentPartner.role === 'distributor' ? 'Distributor' : 'Super Distributor'}
                          </span>
                          <h5 className="font-bold text-sm text-slate-800 mt-0.5 leading-tight">{parentPartner.firm_name || parentPartner.name}</h5>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTargetUnreadCount(parentPartner.id) > 0 && (
                          <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                            {getTargetUnreadCount(parentPartner.id)}
                          </span>
                        )}
                        <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                  )}

                  {/* Managed Sub-Users List (Only for SD and Distributors) */}
                  {subUsers.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mt-2">
                        My Managed {userProfile?.role === 'super_distributor' ? 'Distributors' : 'Users'}
                      </span>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                        {subUsers.map((sub) => {
                          const unread = getTargetUnreadCount(sub.id);
                          return (
                            <button
                              key={sub.id}
                              onClick={() => handleOpenChat(sub.id, sub.name, sub.firm_name, sub.role)}
                              className="w-full bg-white p-3 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all text-left shadow-sm flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
                                  <User size={16} />
                                </div>
                                <div className="min-w-0">
                                  <h6 className="font-bold text-xs text-slate-800 truncate leading-none mb-1">
                                    {sub.firm_name || sub.name}
                                  </h6>
                                  <span className="text-[8px] font-mono text-slate-400 block">{sub.id}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {unread > 0 && (
                                  <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full">
                                    {unread}
                                  </span>
                                )}
                                <ChevronRight size={12} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Active Conversation View */
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  <div className="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col no-scrollbar">
                    {loading ? (
                      <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="animate-spin text-indigo-600" size={24} />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                        <MessageSquare className="text-slate-200 mb-2" size={36} />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Send a message to start chatting</p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMe = msg.sender_id === userId;
                        return (
                          <div 
                            key={msg.id}
                            className={`flex flex-col max-w-[75%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                          >
                            <div className={`p-3 rounded-2xl text-xs font-medium leading-relaxed ${
                              isMe 
                                ? 'bg-indigo-600 text-white rounded-br-none' 
                                : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none shadow-sm'
                            }`}>
                              {msg.file_url ? (
                                msg.file_type === 'image' ? (
                                  <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="block max-w-xs overflow-hidden rounded-xl border border-slate-100 hover:opacity-95 transition-opacity">
                                    <img src={msg.file_url} alt="Attachment" className="max-w-full h-auto object-cover max-h-40" />
                                  </a>
                                ) : (
                                  <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-indigo-500 font-bold hover:underline py-1">
                                    <FileText size={16} />
                                    <span className="truncate max-w-[150px]">{msg.message || 'Download File'}</span>
                                    <Download size={14} className="shrink-0" />
                                  </a>
                                )
                              ) : (
                                msg.message
                              )}
                            </div>
                            <span className="text-[8px] text-slate-400 font-bold mt-1 uppercase px-1">
                              {msg.sender_role === 'admin' ? `${msg.admin_name || 'Admin'} • ` : ''}
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                   {/* Emoji selection popup */}
                  {showEmojiPicker && (
                    <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                      {EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleEmojiClick(emoji)}
                          className="text-base hover:scale-125 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected File Preview Bar (WhatsApp-style) */}
                  {selectedFile && (
                    <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {selectedFile.type.startsWith('image/') ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-white">
                            <img 
                              src={URL.createObjectURL(selectedFile)} 
                              alt="Preview" 
                              className="w-full h-full object-cover" 
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shrink-0">
                            <FileText size={18} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-slate-700 truncate leading-tight">
                            {selectedFile.name}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition-colors shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Input Form */}
                  <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 flex gap-2 items-center">
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                    />
                    <button
                      type="button"
                      disabled={fileUploading || sending}
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                    >
                      {fileUploading ? <Loader2 className="animate-spin text-indigo-600" size={18} /> : <Paperclip size={18} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                    >
                      <Smile size={18} />
                    </button>
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="Type a message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                    />
                    <button
                      type="submit"
                      disabled={sending || fileUploading || (!messageText.trim() && !selectedFile)}
                      className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition-colors active:scale-95 cursor-pointer shrink-0"
                    >
                      {sending || fileUploading ? (
                        <Loader2 className="animate-spin text-white" size={16} />
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all relative border border-slate-800 cursor-pointer"
      >
        <MessageSquare size={24} />
        {totalUnreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full border-2 border-slate-900 shadow-md">
            {totalUnreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
