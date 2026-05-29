"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Session = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  profession: string | null;
  status: string;
  human_takeover: boolean;
  created_at: string;
};

type Message = {
  id: string;
  session_id: string;
  sender: 'user' | 'ai' | 'admin';
  content: string;
  created_at: string;
};

export default function AdminPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  // Authentication state placeholder - In a real app, wrap with Supabase Auth
  // We'll skip strict auth UI for now to focus on the chat panel functionality,
  // since RLS currently allows anonymous reads (based on setupDb.mjs for demo).

  useEffect(() => {
    // Load sessions
    const fetchSessions = async () => {
      const { data } = await supabase.from('sessions').select('*').order('created_at', { ascending: false });
      if (data) setSessions(data);
    };
    fetchSessions();

    // Subscribe to new sessions
    const sessionChannel = supabase
      .channel('public:sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, (payload) => {
        fetchSessions(); // Refresh list on change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
    };
  }, []);

  useEffect(() => {
    if (!selectedSession) return;

    // Load messages for selected session
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', selectedSession.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
    };
    fetchMessages();

    // Subscribe to new messages for this session
    const messageChannel = supabase
      .channel(\`public:messages:\${selectedSession.id}\`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: \`session_id=eq.\${selectedSession.id}\` }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [selectedSession]);

  const toggleHumanTakeover = async () => {
    if (!selectedSession) return;
    const newState = !selectedSession.human_takeover;
    await supabase.from('sessions').update({ human_takeover: newState }).eq('id', selectedSession.id);
    setSelectedSession({ ...selectedSession, human_takeover: newState });
  };

  const sendAdminMessage = async () => {
    if (!input.trim() || !selectedSession) return;

    const text = input.trim();
    setInput('');

    await supabase.from('messages').insert({
      session_id: selectedSession.id,
      sender: 'admin',
      content: text
    });
  };

  return (
    <div className="flex h-screen bg-gray-100 text-black">
      {/* Sidebar: Leads List */}
      <div className="w-1/3 bg-white border-r border-gray-300 flex flex-col">
        <div className="p-4 bg-gray-800 text-white font-bold text-lg">
          Painel de Leads
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map(s => (
            <div 
              key={s.id} 
              onClick={() => setSelectedSession(s)}
              className={\`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 \${selectedSession?.id === s.id ? 'bg-blue-50' : ''}\`}
            >
              <div className="font-semibold">{s.name || 'Lead Anônimo'}</div>
              <div className="text-sm text-gray-500 truncate">ID: {s.id.split('-')[0]}...</div>
              <div className="flex justify-between items-center mt-2">
                <span className={\`text-xs px-2 py-1 rounded \${s.status === 'qualified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}\`}>
                  {s.status === 'qualified' ? 'Qualificado' : 'Conversando'}
                </span>
                {s.human_takeover && <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Humano</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="w-2/3 flex flex-col">
        {selectedSession ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-300 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-lg">{selectedSession.name || 'Lead Anônimo'}</h2>
                <div className="text-sm text-gray-600 flex gap-4">
                  <span>📱 {selectedSession.phone || 'N/A'}</span>
                  <span>📧 {selectedSession.email || 'N/A'}</span>
                  <span>💼 {selectedSession.profession || 'N/A'}</span>
                </div>
              </div>
              <button 
                onClick={toggleHumanTakeover}
                className={\`px-4 py-2 rounded font-medium text-sm transition-colors \${selectedSession.human_takeover ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-blue-500 text-white hover:bg-blue-600'}\`}
              >
                {selectedSession.human_takeover ? 'Devolver para IA' : 'Assumir Conversa'}
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map(m => (
                <div key={m.id} className={\`flex \${m.sender === 'user' ? 'justify-start' : 'justify-end'}\`}>
                  <div className={\`max-w-[70%] p-3 rounded-lg shadow-sm \${m.sender === 'user' ? 'bg-white border border-gray-200' : m.sender === 'admin' ? 'bg-blue-100' : 'bg-green-100'}\`}>
                    <div className="text-xs text-gray-500 mb-1 font-semibold uppercase">{m.sender === 'ai' ? 'IA' : m.sender}</div>
                    <div className="text-gray-800 whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            {selectedSession.human_takeover ? (
              <div className="p-4 bg-white border-t border-gray-300 flex gap-2">
                <input 
                  type="text" 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendAdminMessage()}
                  placeholder="Digite sua mensagem como humano..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  onClick={sendAdminMessage}
                  className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium"
                >
                  Enviar
                </button>
              </div>
            ) : (
              <div className="p-4 bg-gray-200 text-center text-gray-600 text-sm">
                A IA está no controle desta conversa. Clique em "Assumir Conversa" para enviar mensagens.
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Selecione um lead na lateral para visualizar a conversa.
          </div>
        )}
      </div>
    </div>
  );
}
