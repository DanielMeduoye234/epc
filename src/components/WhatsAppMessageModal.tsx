'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Send,
  Copy,
  Check,
  Image as ImageIcon,
  Sparkles,
  FileText,
  Heart,
  Bell,
  Calendar,
  ExternalLink,
  MessageCircle,
  AlertCircle,
  Upload,
  Trash2,
  Edit3,
} from 'lucide-react';
import {
  QUICK_MESSAGE_TEMPLATES,
  QuickMessageTemplate,
  fillMessageTemplate,
  buildWhatsAppUrl,
  cleanWhatsAppNumber,
} from '@/lib/whatsapp-templates';

// Common event flyer presets for quick selection
const FLYER_PRESETS = [
  {
    id: 'sunday_service',
    label: 'Sunday Service',
    url: 'https://images.unsplash.com/photo-1519491058804-d4b967918342?q=80&w=800&auto=format&fit=crop',
    title: 'Sunday Worship Service',
  },
  {
    id: 'midweek_prayer',
    label: 'Midweek Prayer',
    url: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=800&auto=format&fit=crop',
    title: 'Midweek Prayer & Bible Study',
  },
  {
    id: 'special_vigil',
    label: 'All-Night Vigil',
    url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop',
    title: 'Night of Supernatural Encounter',
  },
];

export interface WhatsAppRecipient {
  name: string;
  phoneNumber: string;
  photoUrl?: string | null;
  nickname?: string | null;
  category?: 'new_believer' | 'first_timer' | 'member' | 'shepherd' | string;
  bacenta?: string | null;
  branchName?: string;
}

interface WhatsAppMessageModalProps {
  recipient: WhatsAppRecipient | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function WhatsAppMessageModal({
  recipient,
  isOpen,
  onClose,
}: WhatsAppMessageModalProps) {
  if (!isOpen || !recipient) return null;

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('custom');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [rawMessage, setRawMessage] = useState<string>('');
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [localImageBlob, setLocalImageBlob] = useState<Blob | null>(null);
  const [localImageName, setLocalImageName] = useState<string>('');
  const [includeImageLink, setIncludeImageLink] = useState<boolean>(true);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [copyingImage, setCopyingImage] = useState<boolean>(false);
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-pick best template on initial open based on recipient category
  useEffect(() => {
    if (!recipient) return;
    let initialTemplate = QUICK_MESSAGE_TEMPLATES[0];

    if (recipient.category === 'first_timer') {
      const ftTemplate = QUICK_MESSAGE_TEMPLATES.find((t) => t.id === 'first_timer_appreciation');
      if (ftTemplate) initialTemplate = ftTemplate;
    } else if (recipient.category === 'member') {
      const memberTemplate = QUICK_MESSAGE_TEMPLATES.find((t) => t.id === 'sunday_service_reminder');
      if (memberTemplate) initialTemplate = memberTemplate;
    } else if (recipient.category === 'new_believer') {
      const nbTemplate = QUICK_MESSAGE_TEMPLATES.find((t) => t.id === 'new_believer_welcome');
      if (nbTemplate) initialTemplate = nbTemplate;
    }

    setSelectedTemplateId(initialTemplate.id);
    setRawMessage(initialTemplate.body);
    setCustomImageUrl('');
    setLocalImageBlob(null);
    setLocalImageName('');
    setImageNotice(null);
  }, [recipient]);

  const filteredTemplates = useMemo(() => {
    return QUICK_MESSAGE_TEMPLATES.filter((t) => {
      if (categoryFilter === 'all') return true;
      return t.category === categoryFilter;
    });
  }, [categoryFilter]);

  const handleSelectTemplate = (template: QuickMessageTemplate) => {
    setSelectedTemplateId(template.id);
    setRawMessage(template.body);
    if (template.defaultImageUrl) {
      setCustomImageUrl(template.defaultImageUrl);
      setLocalImageBlob(null);
      setLocalImageName('');
    }
  };

  const handleSetBlankCustomMessage = () => {
    setSelectedTemplateId('custom_blank');
    setRawMessage(`Hello {first_name}! `);
  };

  // Handle local image file selection from user device/computer
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLocalImageBlob(file);
    setLocalImageName(file.name);
    const objectUrl = URL.createObjectURL(file);
    setCustomImageUrl(objectUrl);
    setImageNotice('Photo selected from your device. Click "Copy Photo & Open WhatsApp" to easily paste it into chat!');
  };

  // Generate personalized text preview in real time
  const personalizedMessage = useMemo(() => {
    return fillMessageTemplate(rawMessage, {
      name: recipient.name,
      branchName: recipient.branchName || 'Everything by Prayer Church',
    });
  }, [rawMessage, recipient]);

  // Insert variable tokens into text
  const insertToken = (token: string) => {
    setRawMessage((prev) => prev + ` ${token} `);
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(personalizedMessage);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleSendWhatsApp = () => {
    // Only append link if it's a web URL (not a local blob URL)
    const isWebUrl = customImageUrl.startsWith('http://') || customImageUrl.startsWith('https://');
    const finalUrl = buildWhatsAppUrl(
      recipient.phoneNumber,
      personalizedMessage,
      includeImageLink && isWebUrl ? customImageUrl : undefined
    );
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyImageAndOpen = async () => {
    if (!customImageUrl) {
      handleSendWhatsApp();
      return;
    }

    setCopyingImage(true);
    setImageNotice(null);

    try {
      let blobToUse = localImageBlob;

      if (!blobToUse) {
        // Fetch web URL image
        const response = await fetch(customImageUrl, { mode: 'cors' });
        blobToUse = await response.blob();
      }

      // Convert to image/png blob for universal clipboard support using HTML5 Canvas
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = URL.createObjectURL(blobToUse);

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 600;
      canvas.height = img.naturalHeight || 600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(async (pngBlob) => {
          if (pngBlob && navigator.clipboard && window.ClipboardItem) {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': pngBlob }),
              ]);
              setImageNotice('✅ Photo copied to clipboard! Switch to WhatsApp and press Ctrl+V (or Paste) to send it with your message.');
            } catch (err) {
              console.warn('Clipboard write failed:', err);
              setImageNotice('Opening WhatsApp... (You can attach the photo using WhatsApp’s paperclip button).');
            }
          }
          // Launch WhatsApp
          handleSendWhatsApp();
          setCopyingImage(false);
        }, 'image/png');
      } else {
        handleSendWhatsApp();
        setCopyingImage(false);
      }
    } catch (err) {
      console.warn('Image process error:', err);
      setImageNotice('Opening WhatsApp...');
      handleSendWhatsApp();
      setCopyingImage(false);
    }
  };

  const categoryBadgeColors: Record<string, string> = {
    new_believer: 'bg-orange-100 text-orange-700 border-orange-200',
    first_timer: 'bg-blue-100 text-blue-700 border-blue-200',
    member: 'bg-green-100 text-green-700 border-green-200',
    shepherd: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  const categoryLabel: Record<string, string> = {
    new_believer: 'New Believer',
    first_timer: 'First Timer',
    member: 'Regular Member',
    shepherd: 'Shepherd',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-3xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-3 sm:px-6 sm:py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50/80 via-white to-green-50/80 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366] shrink-0">
              <MessageCircle size={22} className="fill-[#25D366]/20" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-sm sm:text-lg font-bold text-gray-900 truncate">
                  Send WhatsApp Message
                </h2>
                <span className="text-[10px] sm:text-xs font-normal px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-mono shrink-0">
                  wa.me
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 truncate sm:whitespace-normal">
                Write a custom message or pick a template, attach photos, and send
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition shrink-0 -mr-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3.5 sm:space-y-5">
          {/* Recipient Profile Bar */}
          <div className="bg-gray-50 rounded-xl p-3 sm:p-3.5 border border-gray-200/80">
            <div className="flex items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm overflow-hidden shrink-0 shadow-xs">
                  {recipient.photoUrl ? (
                    <img
                      src={recipient.photoUrl}
                      alt={recipient.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    recipient.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-semibold text-gray-900 text-sm truncate">{recipient.name}</h4>
                    {recipient.nickname && (
                      <span className="text-xs text-gray-400 shrink-0">({recipient.nickname})</span>
                    )}
                    {recipient.category && (
                      <span
                        className={`text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${
                          categoryBadgeColors[recipient.category] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {categoryLabel[recipient.category] || recipient.category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    Phone: <span className="font-medium text-gray-700">{recipient.phoneNumber}</span>
                    {recipient.bacenta && (
                      <span className="hidden sm:inline"> • Bacenta: {recipient.bacenta}</span>
                    )}
                  </p>
                  {recipient.bacenta && (
                    <p className="text-[11px] text-gray-500 sm:hidden truncate">
                      Bacenta: {recipient.bacenta}
                    </p>
                  )}
                </div>
              </div>

              {/* Desktop direct link indicator */}
              <div className="hidden sm:block text-right shrink-0">
                <span className="text-xs text-gray-400 block">Recipient wa.me</span>
                <p className="text-xs font-mono text-green-600 font-semibold">
                  +{cleanWhatsAppNumber(recipient.phoneNumber)}
                </p>
              </div>
            </div>

            {/* Mobile direct link indicator */}
            <div className="sm:hidden mt-2 pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs">
              <span className="text-gray-500 text-[11px]">Direct WhatsApp Link:</span>
              <span className="font-mono text-green-700 font-semibold text-[11px] bg-green-50 px-2 py-0.5 rounded border border-green-200/80">
                +{cleanWhatsAppNumber(recipient.phoneNumber)}
              </span>
            </div>
          </div>

          {/* Template Categories & Selector */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 mb-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <Sparkles size={14} className="text-orange-500 shrink-0" />
                Templates & Presets
              </label>
              {/* Category tabs: horizontal scroll with no ugly scrollbars */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 no-scrollbar">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'welcome', label: 'Welcome' },
                  { id: 'reminder', label: 'Reminders' },
                  { id: 'care', label: 'Care' },
                  { id: 'event', label: 'Events' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategoryFilter(tab.id)}
                    className={`text-xs px-2.5 py-1 rounded-md transition shrink-0 whitespace-nowrap active:scale-95 ${
                      categoryFilter === tab.id
                        ? 'bg-orange-500 text-white font-medium shadow-xs'
                        : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Custom Blank Option */}
              <button
                type="button"
                onClick={handleSetBlankCustomMessage}
                className={`text-left p-2 sm:p-2.5 rounded-xl border text-xs transition relative flex flex-col justify-between min-h-[58px] sm:min-h-[66px] active:scale-[0.98] ${
                  selectedTemplateId === 'custom_blank'
                    ? 'border-orange-500 bg-orange-50/70 text-orange-950 font-medium shadow-xs ring-1 ring-orange-500'
                    : 'border-dashed border-gray-300 bg-white hover:border-orange-400 text-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="font-semibold flex items-center gap-1 truncate">
                    <Edit3 size={13} className="text-orange-500 shrink-0" /> Custom
                  </span>
                  {selectedTemplateId === 'custom_blank' && (
                    <Check size={14} className="text-orange-600 shrink-0 mt-0.5" />
                  )}
                </div>
                <span className="text-[11px] text-gray-400 line-clamp-1 mt-1">
                  Write from scratch
                </span>
              </button>

              {filteredTemplates.map((template) => {
                const isSelected = selectedTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelectTemplate(template)}
                    className={`text-left p-2 sm:p-2.5 rounded-xl border text-xs transition relative flex flex-col justify-between min-h-[58px] sm:min-h-[66px] active:scale-[0.98] ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/50 text-orange-950 font-medium shadow-xs ring-1 ring-orange-500'
                        : 'border-gray-200 bg-white hover:border-orange-300 text-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-semibold truncate">{template.title}</span>
                      {isSelected && <Check size={14} className="text-orange-600 shrink-0 mt-0.5" />}
                    </div>
                    <span className="text-[11px] text-gray-400 line-clamp-1 mt-1">
                      {template.subject}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Variable Insertion Tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider truncate">
                Personalization Tags
              </label>
              <span className="text-[11px] text-gray-400 shrink-0">Tap to insert</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { tag: '{first_name}', label: 'First Name' },
                { tag: '{name}', label: 'Full Name' },
                { tag: '{church}', label: 'Church Name' },
                { tag: '{shepherd}', label: 'Shepherd Name' },
              ].map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => insertToken(item.tag)}
                  className="text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 bg-gray-100 hover:bg-orange-100 hover:text-orange-700 text-gray-700 rounded-md border border-gray-200 transition font-mono active:scale-95"
                >
                  +{item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Text Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider truncate">
                Your Message <span className="hidden sm:inline font-normal text-gray-400 normal-case">(Editable)</span>
              </label>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setRawMessage('')}
                  className="text-xs text-gray-400 hover:text-red-500 transition"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="text-xs text-gray-500 hover:text-orange-600 flex items-center gap-1"
                >
                  {copiedText ? (
                    <>
                      <Check size={12} className="text-green-600" />
                      <span className="text-green-600 font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy text</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] text-gray-400">
                  {personalizedMessage.length} chars
                </span>
              </div>
            </div>
            <textarea
              rows={4}
              value={rawMessage}
              onChange={(e) => {
                setRawMessage(e.target.value);
                setSelectedTemplateId('custom');
              }}
              placeholder="Type your personalized custom message here... (e.g. Hello {first_name}, hope you are doing well!...)"
              className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm text-black focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none font-sans leading-relaxed shadow-xs"
            />
          </div>

          {/* Event Flyer / Photo Attachment Section */}
          <div className="bg-orange-50/40 rounded-xl p-3 sm:p-4 border border-orange-100/80 space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <ImageIcon size={16} className="text-orange-600 shrink-0" />
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider truncate">
                  Attach Photo / Event Flyer
                </span>
              </div>
              {customImageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomImageUrl('');
                    setLocalImageBlob(null);
                    setLocalImageName('');
                    setImageNotice(null);
                  }}
                  className="text-xs text-red-500 hover:underline flex items-center gap-1 shrink-0"
                >
                  <Trash2 size={12} /> Remove
                </button>
              )}
            </div>

            {/* Choose from Computer / Device OR Presets */}
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-orange-300 text-orange-700 hover:bg-orange-50 rounded-lg text-xs font-medium transition shadow-xs active:scale-[0.98]"
                >
                  <Upload size={14} />
                  Upload from Device
                </button>

                <span className="text-[11px] text-gray-400 text-center sm:text-left shrink-0">
                  or presets:
                </span>

                <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5 flex-1">
                  {FLYER_PRESETS.map((flyer) => (
                    <button
                      key={flyer.id}
                      type="button"
                      onClick={() => {
                        setCustomImageUrl(flyer.url);
                        setLocalImageBlob(null);
                        setLocalImageName('');
                        setImageNotice(null);
                      }}
                      className={`text-xs px-2 py-1.5 rounded-md border transition text-center truncate ${
                        customImageUrl === flyer.url
                          ? 'bg-orange-600 text-white border-orange-600 font-medium'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
                      }`}
                    >
                      {flyer.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom URL Input */}
              <input
                type="url"
                placeholder="Or paste public flyer image URL (https://...)"
                value={customImageUrl.startsWith('blob:') ? '' : customImageUrl}
                onChange={(e) => {
                  setCustomImageUrl(e.target.value);
                  setLocalImageBlob(null);
                  setLocalImageName('');
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-orange-500 text-black"
              />
            </div>

            {/* Flyer Preview Thumbnail */}
            {customImageUrl && (
              <div className="flex items-start gap-3 bg-white p-2.5 sm:p-3 rounded-lg border border-orange-200 shadow-xs">
                <img
                  src={customImageUrl}
                  alt="Flyer Preview"
                  className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-md border border-gray-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">
                    {localImageName ? `Photo: ${localImageName}` : 'Flyer Image Selected'}
                  </p>
                  {!localImageName && (
                    <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeImageLink}
                        onChange={(e) => setIncludeImageLink(e.target.checked)}
                        className="rounded text-orange-600 focus:ring-orange-500 shrink-0"
                      />
                      <span className="text-[11px] sm:text-xs text-gray-600 leading-tight">
                        Include link in text (for auto WhatsApp link preview)
                      </span>
                    </label>
                  )}
                  {localImageName && (
                    <p className="text-[11px] text-green-700 mt-1 leading-snug">
                      Ready to send! Click <strong>Copy Photo & Open WhatsApp</strong> below to paste it directly.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Live Preview Box */}
          <div className="bg-[#EFEAE2] p-3 sm:p-4 rounded-xl border border-[#D1D7DB] relative shadow-inner">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Live WhatsApp Preview
            </div>
            <div className="bg-white p-3 sm:p-3.5 rounded-lg rounded-tl-none shadow-xs max-w-md text-xs text-gray-900 whitespace-pre-wrap leading-relaxed relative">
              {customImageUrl && (
                <div className="mb-2 p-1.5 bg-gray-50 rounded border border-gray-200 flex items-center gap-2">
                  <ImageIcon size={14} className="text-orange-500 shrink-0" />
                  <span className="text-[11px] text-gray-600 truncate font-medium">
                    {localImageName ? `[Attached Photo: ${localImageName}]` : `[Attached Flyer URL]`}
                  </span>
                </div>
              )}
              {personalizedMessage}
              <div className="text-[10px] text-gray-400 text-right mt-1.5">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
              </div>
            </div>
          </div>

          {/* Instruction / Notice Alert */}
          {imageNotice && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
              <AlertCircle size={16} className="shrink-0 text-blue-600" />
              <span>{imageNotice}</span>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-3.5 py-3 sm:px-6 sm:py-4 bg-gray-50 border-t border-gray-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-200/80 rounded-lg transition text-center"
          >
            Cancel
          </button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {customImageUrl && (
              <button
                type="button"
                onClick={handleCopyImageAndOpen}
                disabled={copyingImage}
                title="Copies photo to clipboard and opens WhatsApp so you can paste (Ctrl+V) directly"
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50 active:scale-[0.98]"
              >
                {copyingImage ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <ImageIcon size={14} className="shrink-0" />
                )}
                <span>Copy Photo & Open WhatsApp</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-[#25D366] hover:bg-[#20ba59] active:bg-[#1eb054] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition active:scale-[0.98]"
            >
              <MessageCircle size={16} className="fill-white shrink-0" />
              <span>Send via WhatsApp</span>
              <span className="hidden sm:inline font-mono font-medium text-xs opacity-90">
                ({cleanWhatsAppNumber(recipient.phoneNumber)})
              </span>
              <ExternalLink size={13} className="opacity-80 shrink-0 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
