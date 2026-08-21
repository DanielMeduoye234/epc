'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { suggestionsForRole } from '@/lib/assistant/suggestions';
import type { AssistantLink } from '@/lib/assistant/knowledge';

type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  links?: AssistantLink[];
};

function renderRichText(text: string) {
  return text.split('\n').map((line, index) => {
    if (line.trim() === '') {
      return <div key={index} className="h-2" />;
    }
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={index} className="text-sm leading-relaxed">
        {parts.map((part, partIndex) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
          }
          return <span key={partIndex}>{part}</span>;
        })}
      </p>
    );
  });
}

export default function AssistantWidget() {
  const { profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chips = useMemo(
    () => (profile ? suggestionsForRole(profile.role) : []),
    [profile]
  );

  useEffect(() => {
    if (!profile || messages.length > 0) return;
    const roleLabel =
      profile.role === 'recorder' ? 'New Believer Officer' : profile.role.replace('_', ' ');
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hi ${profile.full_name.split(' ')[0] || 'there'}. I am Fold Assistant, here to make The Fold easier for a ${roleLabel}.\n\nAsk how to record someone, mark Sunday attendance, or look up who needs follow-up. I can also pull live numbers for ${profile.branch?.name || 'your branch'}.`,
        links: [{ href: '/dashboard', label: 'Dashboard home' }],
      },
    ]);
  }, [profile, messages.length]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    inputRef.current?.focus();
  }, [open, messages, pending]);

  if (loading || !profile) return null;

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;

    const userMessage: UiMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: question,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setPending(true);
    setError(null);

    try {
      const history = [...messages, userMessage]
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, history, path: pathname }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not reach Fold Assistant.');
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          links: data.links,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-white transition hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
        aria-label={open ? 'Close Fold Assistant' : 'Open Fold Assistant'}
        aria-expanded={open}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {open && (
        <section
          className="fixed bottom-24 right-5 z-[60] flex w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white"
          role="dialog"
          aria-modal="false"
          aria-labelledby="fold-assistant-title"
        >
          <header className="flex items-start gap-3 border-b border-gray-100 bg-orange-50 px-4 py-3">
            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-white">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0">
              <h2 id="fold-assistant-title" className="text-sm font-semibold text-black">
                Fold Assistant
              </h2>
              <p className="text-xs text-gray-600">Ask how to use The Fold, or look up live branch data.</p>
            </div>
          </header>

          <div ref={listRef} className="max-h-[min(60vh,420px)] space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === 'user' ? 'ml-8' : 'mr-4'}
              >
                <div
                  className={`rounded-lg px-3 py-2 ${
                    message.role === 'user'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-50 text-gray-900'
                  }`}
                >
                  {message.role === 'assistant' ? renderRichText(message.content) : (
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  )}
                </div>
                {message.links && message.links.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.links.map((link) => (
                      <button
                        key={link.href + link.label}
                        type="button"
                        onClick={() => {
                          router.push(link.href);
                          setOpen(false);
                        }}
                        className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-50"
                      >
                        {link.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {pending && (
              <p className="text-xs text-gray-500">Looking that up…</p>
            )}
            {error && (
              <p className="text-xs text-red-600" role="alert">{error}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-gray-100 px-4 py-2">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => void send(chip)}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700"
              >
                {chip}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-gray-100 p-3">
            <label htmlFor="fold-assistant-input" className="sr-only">
              Ask Fold Assistant
            </label>
            <textarea
              id="fold-assistant-input"
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Ask anything about this dashboard"
              className="max-h-24 min-h-10 flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-black placeholder:text-gray-500 focus:border-orange-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-600 text-white disabled:opacity-40"
              aria-label="Send question"
            >
              <Send size={16} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
