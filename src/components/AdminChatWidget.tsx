import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, X, Send, Trash2, Building2, User, ChevronRight, Loader2,
  Paperclip, Smile, FileText, Download, Image 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

export default function AdminChatWidget() {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // List of active conversations/threads
  const [threads, setThreads] = useState<any[]>([]);
  
  // Active Chat State
  const [currentThread, setCurrentThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [fileUploading, setFileUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const EMOJIS = ['👍', '❤️', '😊', '😂', '🙏', '👏', '✔️', '❓', '🔥'];
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load logged in admin's profile name
  useEffect(() => {
    const fetchAdminProfile = async () => {
      try {
        const mobile = localStorage.getItem('userId');
        if (!mobile) return;
        
        const { data, error } = await supabase
          .from('admin_profiles')
          .select('name')
          .eq('mobile_number', mobile)
          .maybeSingle();
          
        if (!error && data?.name) {
          setAdminName(data.name);
        }
      } catch (err) {
        console.error('Error fetching admin profile name:', err);
      }
    };
    fetchAdminProfile();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (currentThread && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, currentThread]);

  // Fetch all threads destined for Admin (user_a_id = 'admin')
  const fetchThreads = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_threads')
        .select('*, user:user_b_id(id, name, firm_name, mobile_number, role)')
        .eq('user_a_id', 'admin')
        .order('updated_at', { ascending: false });

      if (!error && data) {
        setThreads(data);
      }
    } catch (err) {
      console.error('Error fetching admin threads:', err);
    }
  };

  // Initial thread loading and realtime subscription
  useEffect(() => {
    fetchThreads();

    // Subscribe to thread updates globally without filters
    const threadChannel = supabase
      .channel('admin_threads')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_threads'
      }, () => {
        fetchThreads();
      })
      .subscribe();

    // Subscribe to all message inserts as a fallback trigger
    const messagesChannel = supabase
      .channel('admin_messages_global')
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
  }, []);

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

  // Select and load a chat thread
  const handleSelectThread = async (thread: any) => {
    setLoading(true);
    setCurrentThread(thread);

    try {
      // Clear admin unread count (user_a_unread is Admin)
      if (thread.user_a_unread > 0) {
        await supabase
          .from('chat_threads')
          .update({ user_a_unread: 0 })
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
      console.error('Error loading chat messages:', err);
      toast.error('Failed to load messages.');
    } finally {
      setLoading(false);
    }
  };

  // Listen for real-time messages in the active thread
  useEffect(() => {
    if (currentThread) {
      const msgChannel = supabase
        .channel(`admin_chat_messages_${currentThread.id}`)
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
          
          // Clear admin unread count immediately if active
          supabase
            .from('chat_threads')
            .update({ user_a_unread: 0 })
            .eq('id', currentThread.id)
            .then(() => {});
        })
        .subscribe();

      return () => {
        supabase.removeChannel(msgChannel);
      };
    }
  }, [currentThread]);

  // Send a response message (handles text only or text + file upload together)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageText.trim();
    if ((!text && !selectedFile) || !currentThread) return;

    setSending(true);

    try {
      let fileUrl = '';
      let fileType: 'image' | 'file' | null = null;
      let finalMessage = text;

      if (selectedFile) {
        setFileUploading(true);
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `admin_chat_${Date.now()}.${fileExt}`;
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
          sender_id: 'admin',
          sender_role: 'admin',
          message: finalMessage,
          file_url: fileUrl || null,
          file_type: fileType || null,
          admin_name: adminName
        }]);

      if (insertErr) throw insertErr;

      // 3. Update thread last message and increment user_b_unread (User's unread counter)
      const lastMsgText = fileUrl ? `[${fileType}] ${finalMessage}` : finalMessage;
      await supabase
        .from('chat_threads')
        .update({
          last_message: lastMsgText.substring(0, 100),
          user_a_unread: 0,
          user_b_unread: currentThread.user_b_unread + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentThread.id);

      // Reset states
      setMessageText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      fetchThreads();

    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send response.');
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

  // Clear and Close Conversation
  const handleClearChat = async () => {
    if (!currentThread) return;
    if (!window.confirm('Are you sure you want to close and clear this conversation?')) return;

    try {
      const { error } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', currentThread.id);

      if (error) throw error;

      setCurrentThread(null);
      setMessages([]);
      fetchThreads();
      toast.success('Conversation closed and cleared.');
    } catch (err) {
      console.error('Error closing chat:', err);
      toast.error('Failed to close chat.');
    }
  };

  // Count unread message threads for the floating icon badge
  const totalUnreadCount = threads.reduce((acc, curr) => acc + (curr.user_a_unread || 0), 0);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="w-[500px] h-[500px] bg-white rounded-[2rem] shadow-2xl border border-slate-100 flex overflow-hidden mb-4"
          >
            {/* Left Tabs Bar (Conversations list grouped by Firm Name) */}
            <div className="w-1/3 bg-slate-50 border-r border-slate-100 flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-white">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest leading-none mb-1">Conversations</h4>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-1">Active Support</span>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar py-2 space-y-1">
                {threads.length === 0 ? (
                  <div className="p-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">No active chats</div>
                ) : (
                  threads.map((thread) => {
                    const isSelected = currentThread?.id === thread.id;
                    const userName = thread.user?.firm_name || thread.user?.name || thread.user_b_id;
                    const unread = thread.user_a_unread || 0;
                    
                    return (
                      <button
                        key={thread.id}
                        onClick={() => handleSelectThread(thread)}
                        className={`w-full px-4 py-3 text-left transition-colors border-l-4 flex items-center justify-between group ${
                          isSelected 
                            ? 'bg-white border-indigo-600 text-slate-900 shadow-sm' 
                            : 'border-transparent text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="min-w-0">
                          <h5 className="font-bold text-xs truncate leading-none mb-1">{userName}</h5>
                          <p className="text-[9px] text-slate-400 font-mono truncate">{thread.user_b_id}</p>
                        </div>
                        {unread > 0 && !isSelected && (
                          <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full shrink-0">
                            {unread}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Chat History Panel */}
            <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
              {/* Header */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-bold">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm leading-none">
                      {currentThread ? currentThread.user?.firm_name || currentThread.user?.name || currentThread.user_b_id : 'Select Chat'}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 block">
                      {currentThread ? `Role: ${currentThread.user?.role || 'User'}` : 'Click thread to respond'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentThread && (
                    <button 
                      onClick={handleClearChat}
                      title="Close & Clear Conversation"
                      className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
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

              {/* Message History area */}
              <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-3 flex flex-col no-scrollbar">
                {!currentThread ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                    <MessageSquare className="text-slate-200 mb-2" size={48} />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select a user thread to chat</p>
                  </div>
                ) : loading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="animate-spin text-indigo-600" size={24} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                    <MessageSquare className="text-slate-200 mb-2" size={36} />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No message history</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === 'admin';
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
                          {isMe ? `${msg.admin_name || 'Admin'} • ` : ''}
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

              {/* Send message form */}
              {currentThread && (
                <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 flex gap-2 items-center shrink-0">
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
                    placeholder="Type a response..."
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
