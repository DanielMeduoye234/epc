'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Attendance, ChatMessage } from '@/lib/types';
import { isDemoMode, DEMO_NEW_BELIEVERS, DEMO_FIRST_TIMERS, DEMO_MEMBERS } from '@/lib/demo-data';
import {
  ArrowLeft, MapPin, Phone, User, Calendar, Users, MessageCircle,
  Camera, Send, Gift, ChevronDown, ChevronUp,
} from 'lucide-react';

interface PersonData {
  id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
  address: string;
  bacenta: string;
  phone_number: string;
  who_brought: string;
  photo_url?: string | null;
  date_saved?: string;
  date_joined?: string;
  membership_date?: string;
  status?: string;
  assigned_shepherd?: string;
  birthday?: string | null;
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [person, setPerson] = useState<PersonData | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const type = params.type as string;
  const id = params.id as string;

  const tableMap: Record<string, string> = {
    'new-believer': 'new_believers',
    'first-timer': 'first_timers',
    'member': 'members',
  };

  const personTypeMap: Record<string, string> = {
    'new-believer': 'new_believer',
    'first-timer': 'first_timer',
    'member': 'member',
  };

  useEffect(() => {
    if (profile && id) {
      if (isDemo) {
        loadDemoPerson();
      } else {
        fetchPerson();
      }
    }
  }, [profile, id, isDemo]);

  useEffect(() => {
    if (messagesEndRef.current && showChat) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

  function loadDemoPerson() {
    let found;
    if (type === 'new-believer') {
      found = DEMO_NEW_BELIEVERS.find(p => p.id === id);
    } else if (type === 'first-timer') {
      found = DEMO_FIRST_TIMERS.find(p => p.id === id);
    } else {
      found = DEMO_MEMBERS.find(p => p.id === id);
    }
    setPerson(found ? { ...found, photo_url: found.photo_url ?? undefined } as PersonData : null);
    setAttendance([]);
    setMessages([]);
    setLoading(false);
  }

  async function fetchPerson() {
    const table = tableMap[type];
    if (!table) return;

    const { data } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    if (data) {
      setPerson(data);
      const [{ data: attendanceData }, { data: chatData }] = await Promise.all([
        supabase
          .from('attendance')
          .select('*')
          .eq('person_id', id)
          .eq('person_type', personTypeMap[type])
          .order('date', { ascending: false }),
        supabase
          .from('chat_messages')
          .select('*')
          .eq('person_id', id)
          .order('created_at', { ascending: true })
          .limit(50),
      ]);
      setAttendance(attendanceData || []);
      setMessages(chatData || []);
    }
    setLoading(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !person) return;

    if (isDemo) {
      const url = URL.createObjectURL(file);
      setPerson({ ...person, photo_url: url });
      return;
    }

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `photos/${type}/${id}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(filePath, file, { upsert: true });

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      const table = tableMap[type];
      await supabase.from(table).update({ photo_url: publicUrl }).eq('id', id);
      setPerson({ ...person, photo_url: publicUrl });
    }
    setUploading(false);
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !person || sending) return;

    const msg = chatInput.trim();
    setChatInput('');
    setSending(true);

    if (isDemo) {
      const demoMsg: ChatMessage = {
        id: `demo-${Date.now()}`,
        person_id: id,
        person_type: personTypeMap[type] as ChatMessage['person_type'],
        phone_number: person.phone_number,
        direction: 'outbound',
        message: msg,
        wa_message_id: null,
        status: 'sent',
        branch_id: profile!.branch_id,
        sent_by: profile!.id,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, demoMsg]);
      setSending(false);
      return;
    }

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: id,
          person_type: personTypeMap[type],
          phone_number: person.phone_number,
          message: msg,
          branch_id: profile!.branch_id,
        }),
      });
      const result = await res.json();
      if (result.chatMessage) {
        setMessages(prev => [...prev, result.chatMessage]);
      }
    } catch {
      // silently ignore — message will show in next refresh
    }
    setSending(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Person not found</p>
      </div>
    );
  }

  const statusLabel =
    type === 'new-believer'
      ? 'New Believer'
      : type === 'first-timer'
      ? 'First Timer'
      : 'Member';

  const statusColor =
    type === 'new-believer'
      ? 'bg-orange-100 text-orange-700'
      : type === 'first-timer'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-green-100 text-green-700';

  const phoneClean = person.phone_number.replace(/\D/g, '');
  const recentMessages = messages.slice(-3);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-black transition"
      >
        <ArrowLeft size={20} />
        <span className="text-sm font-medium">Back</span>
      </button>

      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-orange-400 to-orange-600" />

        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-12">
            {/* Large Avatar with upload */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 overflow-hidden border-4 border-white shadow-lg">
                {person.photo_url ? (
                  <img
                    src={person.photo_url}
                    alt={person.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-3xl font-bold">
                    {person.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </span>
                )}
              </div>
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition cursor-pointer border-4 border-transparent">
                <Camera size={22} className="text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full border-4 border-transparent">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 pt-2 sm:pt-0">
              <h1 className="text-2xl font-bold text-black">{person.full_name}</h1>
              {person.nickname && (
                <p className="text-sm text-gray-500 mt-0.5">Known as: <span className="font-medium text-gray-700">{person.nickname}</span></p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                  {statusLabel}
                </span>
                {person.status && type === 'member' && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                      person.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : person.status === 'flagged'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {person.status}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowChat(v => !v)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-400 to-orange-600 text-white rounded-lg hover:from-orange-500 hover:to-orange-700 transition font-medium shadow-sm"
            >
              <MessageCircle size={18} />
              {showChat ? 'Hide Chat' : 'Chat'}
            </button>
            <a
              href={`https://wa.me/${phoneClean}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium shadow-sm"
            >
              <MessageCircle size={18} />
              WhatsApp
            </a>
            <a
              href={`tel:${phoneClean}`}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium shadow-sm"
            >
              <Phone size={18} />
              Call
            </a>
          </div>
        </div>
      </div>

      {/* In-App Chat Widget */}
      {showChat && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-orange-100">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-orange-500" />
              <h3 className="font-semibold text-black">Chat with {person.full_name.split(' ')[0]}</h3>
            </div>
            <span className="text-xs text-gray-500">Messages sent via WhatsApp</span>
          </div>

          {/* Messages area */}
          <div className="h-72 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <MessageCircle size={32} className="mb-2 opacity-40" />
                <p className="text-sm">No messages yet. Start a conversation!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                      msg.direction === 'outbound'
                        ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white rounded-tr-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                    }`}
                  >
                    <p>{msg.message}</p>
                    <p className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-orange-100' : 'text-gray-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.direction === 'outbound' && (
                        <span className="ml-1">
                          {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="flex items-center gap-3 px-4 py-3 border-t border-gray-100 bg-white">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={`Message ${person.full_name.split(' ')[0]}...`}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm text-black"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || sending}
              className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 text-white rounded-full flex items-center justify-center hover:from-orange-500 hover:to-orange-700 disabled:opacity-50 transition flex-shrink-0"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </form>
        </div>
      )}

      {/* Chat Preview (collapsed) */}
      {!showChat && recentMessages.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <button
            onClick={() => setShowChat(true)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <MessageCircle size={16} className="text-orange-500" />
              <span className="text-sm font-medium text-gray-700">Recent messages ({messages.length})</span>
            </div>
            <ChevronDown size={16} className="text-gray-400" />
          </button>
          <div className="mt-3 space-y-1.5">
            {recentMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                <span className={`text-xs px-3 py-1.5 rounded-full max-w-[80%] truncate ${
                  msg.direction === 'outbound' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {msg.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-black mb-4">Personal Information</h3>
          <div className="space-y-4">
            {(person.first_name || person.last_name) && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Full Name</p>
                  <p className="text-sm font-medium text-black">
                    {person.first_name} {person.last_name}
                    {person.nickname && <span className="text-gray-400 ml-1">({person.nickname})</span>}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <MapPin size={16} className="text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Address</p>
                <p className="text-sm font-medium text-black">{person.address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <Phone size={16} className="text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Phone Number</p>
                <p className="text-sm font-medium text-black">{person.phone_number}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <Users size={16} className="text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Bacenta</p>
                <p className="text-sm font-medium text-black">{person.bacenta}</p>
              </div>
            </div>
            {person.birthday && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <Gift size={16} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Birthday</p>
                  <p className="text-sm font-medium text-black">
                    {new Date(person.birthday).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Church Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-black mb-4">Church Information</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Who Brought Them</p>
                <p className="text-sm font-medium text-black">{person.who_brought}</p>
              </div>
            </div>
            {person.date_saved && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <Calendar size={16} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Date Saved</p>
                  <p className="text-sm font-medium text-black">{new Date(person.date_saved).toLocaleDateString()}</p>
                </div>
              </div>
            )}
            {person.date_joined && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <Calendar size={16} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Date Joined</p>
                  <p className="text-sm font-medium text-black">{new Date(person.date_joined).toLocaleDateString()}</p>
                </div>
              </div>
            )}
            {person.membership_date && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <Calendar size={16} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Member Since</p>
                  <p className="text-sm font-medium text-black">{new Date(person.membership_date).toLocaleDateString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attendance History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-black mb-4">Attendance History</h3>
        {attendance.length === 0 ? (
          <p className="text-gray-400 text-sm">No attendance records yet</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {attendance.map((a) => (
              <div
                key={a.id}
                className={`p-2 rounded-lg text-center ${
                  a.is_present ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}
                title={`${new Date(a.date).toLocaleDateString()} - ${a.is_present ? 'Present' : 'Absent'}`}
              >
                <p className="text-xs font-medium text-gray-700">
                  {new Date(a.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                </p>
                <p className={`text-sm font-bold ${a.is_present ? 'text-green-600' : 'text-red-600'}`}>
                  {a.is_present ? '✓' : '✗'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
