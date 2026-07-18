'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Download, Copy, Check } from 'lucide-react';

interface BranchQRCodeProps {
  branchId: string;
  branchName: string;
}

export default function BranchQRCode({ branchId, branchName }: BranchQRCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [registerUrl, setRegisterUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const url = `${window.location.origin}/register/${branchId}`;
    setRegisterUrl(url);
    QRCode.toDataURL(url, {
      width: 640,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#1a1a1a', light: '#ffffff' },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
  }, [branchId]);

  function handleDownload() {
    if (!qrDataUrl) return;
    const safeName = branchName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'branch';
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${safeName}-registration-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(registerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. non-HTTPS) — the link is still visible to copy manually.
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="font-semibold text-black text-sm flex items-center gap-2 mb-1">
        <QrCode size={18} className="text-orange-500" />
        Branch Registration QR Code
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        This QR code is unique to <span className="font-medium text-gray-700">{branchName}</span>.
        Anyone who scans it is taken to a registration page for this branch only.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="shrink-0 p-3 bg-white border border-gray-200 rounded-xl">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`Registration QR code for ${branchName}`} className="w-44 h-44" />
          ) : (
            <div className="w-44 h-44 flex items-center justify-center">
              <div className="w-6 h-6 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="flex-1 w-full space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">Registration link</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={registerUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 outline-none"
              />
              <button
                onClick={handleCopy}
                title="Copy link"
                className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
              >
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          <button
            onClick={handleDownload}
            disabled={!qrDataUrl}
            className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-orange-400 to-orange-600 text-white text-sm font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition disabled:opacity-50"
          >
            <Download size={16} />
            Download QR Code
          </button>
          <p className="text-[11px] text-gray-400">
            Downloads as a high-resolution PNG you can print on flyers, banners or slides.
          </p>
        </div>
      </div>
    </div>
  );
}
