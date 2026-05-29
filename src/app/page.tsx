"use client";

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, Check, CheckCheck } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

type Message = {
  id: string;
  sender: 'user' | 'ai' | 'admin';
  content: string;
  created_at?: string;
};

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize session
    let sid = localStorage.getItem('chat_session_id');
    if (!sid) {
      sid = uuidv4();
      localStorage.setItem('chat_session_id', sid);
      // Create session in DB
      supabase.from('sessions').insert({ id: sid }).then();
    }
    setSessionId(sid);

    // Load history
    supabase
      .from('messages')
      .select('*')
      .eq('session_id', sid)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data);
      });

    // Realtime subscription
    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: \`session_id=eq.\${sid}\` }, payload => {
        const newMessage = payload.new as Message;
        setMessages(prev => {
          if (prev.find(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !sessionId) return;
    
    const text = input.trim();
    setInput('');
    setLoading(true);

    const userMsgId = uuidv4();
    const newMsg: Message = { id: userMsgId, sender: 'user', content: text, created_at: new Date().toISOString() };
    
    // Optimistic update
    setMessages(prev => [...prev, newMsg]);

    // Save to DB
    await supabase.from('messages').insert({ id: userMsgId, session_id: sessionId, sender: 'user', content: text });

    // Call API
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text })
      });
      // DB Realtime will handle the incoming AI message insertion.
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-[#efeae2] sm:border sm:border-gray-300 sm:shadow-lg">
      {/* Header */}
      <div className="bg-[#008069] text-white px-4 py-3 flex items-center shadow-md z-10">
        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden mr-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-gray-600"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        </div>
        <div>
          <h1 className="font-semibold text-lg leading-tight">Consultor Performance</h1>
          <p className="text-xs text-green-100">online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-cover">
        {messages.length === 0 && (
          <div className="text-center text-gray-700 text-sm bg-[#ffeecd] bg-opacity-90 p-2 rounded-lg mb-4 shadow-sm inline-block mx-auto max-w-[90%]">
            🔒 As mensagens são protegidas de ponta a ponta. <br/>Envie uma mensagem para iniciar.
          </div>
        )}
        
        {messages.map((m) => (
          <div key={m.id} className={\`flex \${m.sender === 'user' ? 'justify-end' : 'justify-start'}\`}>
            <div className={\`max-w-[85%] rounded-lg p-2 px-3 shadow-sm \${m.sender === 'user' ? 'bg-[#d9fdd3]' : 'bg-white'}\`}>
              <p className="text-sm text-gray-800 break-words whitespace-pre-wrap">{m.content}</p>
              <div className="text-[10px] text-gray-500 text-right mt-1 flex justify-end items-center gap-1">
                <span>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                {m.sender === 'user' && <CheckCheck className="w-3 h-3 text-blue-500" />}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
             <div className="bg-white rounded-lg p-3 shadow-sm flex space-x-1 items-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-[#f0f2f5] p-2 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Mensagem"
          className="flex-1 rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 border border-gray-300 text-black"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-[#008069] text-white p-3 rounded-full hover:bg-[#006b58] disabled:opacity-50 transition-colors flex-shrink-0"
        >
          <Send className="w-5 h-5 ml-0.5" />
        </button>
      </div>
    </div>
  );
}
