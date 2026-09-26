'use client';

import React, { useState, useRef } from 'react';
import {
  Upload,
  Download,
  X,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { parseCsv, normalizeHeaderKey, downloadCsvTemplate, EntityType } from '@/lib/csv';
import { createClient } from '@/lib/supabase/client';
import { Bacenta } from '@/lib/types';
import { syncNewBelieversToMembers } from '@/lib/sync-believers';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
  entityType: EntityType;
  branchId: string;
  userId: string;
  isDemo: boolean;
  availableBacentas?: Bacenta[];
  userRole?: string;
  assignedShepherdId?: string | null;
}

interface ParsedRecord {
  full_name: string;
  first_name?: string;
  last_name?: string;
  nickname?: string;
  phone_number: string;
  address: string;
  bacenta: string;
  who_brought: string;
  date_saved?: string;
  date_joined?: string;
  membership_date?: string;
  birthday?: string | null;
  status?: string;
  isValid: boolean;
  error?: string;
}

export default function CsvImportModal({
  isOpen,
  onClose,
  onSuccess,
  entityType,
  branchId,
  userId,
  isDemo,
  availableBacentas = [],
  userRole,
  assignedShepherdId,
}: CsvImportModalProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [records, setRecords] = useState<ParsedRecord[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  if (!isOpen) return null;

  const entityTitles: Record<EntityType, string> = {
    new_believers: 'New Believers',
    first_timers: 'First Timers',
    members: 'Members',
  };

  const handleReset = () => {
    setFile(null);
    setRecords([]);
    setParseError(null);
    setImportError(null);
    setImportProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a valid .csv file.');
      return;
    }

    setParsing(true);
    setParseError(null);
    setFile(selectedFile);

    try {
      const text = await selectedFile.text();
      const { headers, rows } = parseCsv(text);

      if (headers.length === 0 || rows.length === 0) {
        setParseError('The uploaded CSV file is empty or missing data rows.');
        setParsing(false);
        return;
      }

      // Map header index to normalized key
      const keyMap: Record<number, string> = {};
      headers.forEach((h, idx) => {
        keyMap[idx] = normalizeHeaderKey(h);
      });

      const today = new Date().toISOString().split('T')[0];
      const parsedList: ParsedRecord[] = [];

      for (const row of rows) {
        const rowData: Record<string, string> = {};
        row.forEach((val, idx) => {
          const key = keyMap[idx];
          if (key) {
            rowData[key] = val.trim();
          }
        });

        // Determine name
        let fullName = rowData.full_name || '';
        const firstName = rowData.first_name || '';
        const lastName = rowData.last_name || '';

        if (!fullName && (firstName || lastName)) {
          fullName = `${firstName} ${lastName}`.trim();
        }

        const phone = rowData.phone_number || '';
        const address = rowData.address || 'To be updated';
        let bacenta = rowData.bacenta || 'Unassigned';

        // Check if bacenta matches available bacentas case-insensitively
        if (availableBacentas.length > 0 && bacenta.toLowerCase() !== 'unassigned') {
          const match = availableBacentas.find(
            b => b.name.toLowerCase() === bacenta.toLowerCase()
          );
          if (match) {
            bacenta = match.name;
          }
        }

        const whoBrought = rowData.who_brought || 'To be updated';
        const birthday = rowData.birthday || null;

        // Validation
        let isValid = true;
        let error = '';

        if (!fullName) {
          isValid = false;
          error = 'Missing name';
        } else if (!phone) {
          isValid = false;
          error = 'Missing phone number';
        }

        let status = rowData.status?.toLowerCase() || 'active';
        if (!['active', 'inactive', 'flagged'].includes(status)) {
          status = 'active';
        }

        const record: ParsedRecord = {
          full_name: fullName,
          first_name: firstName || (fullName ? fullName.split(' ')[0] : undefined),
          last_name: lastName || (fullName ? fullName.split(' ').slice(1).join(' ') : undefined),
          nickname: rowData.nickname || undefined,
          phone_number: phone,
          address,
          bacenta,
          who_brought: whoBrought,
          date_saved: rowData.date_saved || today,
          date_joined: rowData.date_joined || today,
          membership_date: rowData.membership_date || rowData.date_joined || today,
          birthday: birthday || null,
          status,
          isValid,
          error,
        };

        parsedList.push(record);
      }

      setRecords(parsedList);
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse CSV file.');
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleImport = async () => {
    const validRecords = records.filter(r => r.isValid);
    if (validRecords.length === 0) return;

    setImporting(true);
    setImportError(null);
    setImportProgress({ current: 0, total: validRecords.length });

    try {
      if (isDemo) {
        // In demo mode, simulate success after brief delay
        await new Promise(res => setTimeout(res, 600));
        onSuccess(validRecords.length);
        handleReset();
        onClose();
        return;
      }

      // Supabase insertion in batches of 50
      const BATCH_SIZE = 50;
      for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
        const batch = validRecords.slice(i, i + BATCH_SIZE);

        let insertRows: Record<string, unknown>[] = [];

        if (entityType === 'new_believers') {
          insertRows = batch.map(r => ({
            full_name: r.full_name,
            phone_number: r.phone_number,
            address: r.address,
            bacenta: r.bacenta,
            who_brought: r.who_brought,
            date_saved: r.date_saved,
            birthday: r.birthday,
            branch_id: branchId,
            recorded_by: userId,
          }));
        } else if (entityType === 'first_timers') {
          insertRows = batch.map(r => ({
            full_name: r.full_name,
            phone_number: r.phone_number,
            address: r.address,
            bacenta: r.bacenta,
            who_brought: r.who_brought,
            date_joined: r.date_joined,
            birthday: r.birthday,
            branch_id: branchId,
            status: 'first_timer',
            assigned_shepherd: userRole === 'shepherd' ? userId : assignedShepherdId || null,
          }));
        } else if (entityType === 'members') {
          insertRows = batch.map(r => ({
            full_name: r.full_name,
            phone_number: r.phone_number,
            address: r.address,
            bacenta: r.bacenta,
            who_brought: r.who_brought,
            date_joined: r.date_joined,
            membership_date: r.membership_date,
            birthday: r.birthday,
            status: r.status || 'active',
            branch_id: branchId,
            assigned_shepherd: userRole === 'shepherd' ? userId : assignedShepherdId || null,
          }));
        }

        const { error } = await supabase.from(entityType).insert(insertRows);

        if (error) {
          throw new Error(error.message || `Failed to insert batch ${i / BATCH_SIZE + 1}`);
        }

        setImportProgress({
          current: Math.min(i + BATCH_SIZE, validRecords.length),
          total: validRecords.length,
        });
      }

      if (entityType === 'new_believers' && branchId) {
        try {
          await syncNewBelieversToMembers(supabase, branchId);
        } catch (syncErr) {
          console.error('Failed to sync new believers to members after CSV import:', syncErr);
        }
      }

      onSuccess(validRecords.length);
      handleReset();
      onClose();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Error importing records to database.');
    } finally {
      setImporting(false);
    }
  };

  const validCount = records.filter(r => r.isValid).length;
  const invalidCount = records.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-50/50 via-white to-orange-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Upload CSV — {entityTitles[entityType]}
              </h2>
              <p className="text-xs text-gray-500">
                Bulk import records directly into your church database
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Download sample template banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-orange-50/60 border border-orange-100 rounded-xl">
            <div className="flex items-start sm:items-center gap-3">
              <FileSpreadsheet className="text-orange-500 shrink-0 mt-0.5 sm:mt-0" size={20} />
              <div>
                <p className="text-sm font-semibold text-gray-900">Need the CSV format?</p>
                <p className="text-xs text-gray-600">
                  Download our sample pre-formatted template with example rows.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => downloadCsvTemplate(entityType)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-orange-200 text-orange-700 hover:bg-orange-100/50 text-xs font-semibold rounded-lg shadow-2xs transition shrink-0"
            >
              <Download size={14} /> Download Template
            </button>
          </div>

          {/* Upload Dropzone */}
          {!file && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                isDragOver
                  ? 'border-orange-500 bg-orange-50/50 scale-[0.99]'
                  : 'border-gray-200 hover:border-orange-400 bg-gray-50/50 hover:bg-orange-50/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 mx-auto rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
                <Upload size={24} />
              </div>
              <p className="text-sm font-semibold text-gray-800">
                Click to browse or drag and drop your CSV file here
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Supports standard comma-separated (.csv) files up to 10MB
              </p>
            </div>
          )}

          {/* Parsing spinner */}
          {parsing && (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-500">
              <Loader2 className="animate-spin text-orange-500" size={28} />
              <p className="text-sm">Reading and validating CSV rows...</p>
            </div>
          )}

          {/* Parsing Error */}
          {parseError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to process CSV</p>
                <p className="text-xs mt-0.5">{parseError}</p>
              </div>
            </div>
          )}

          {/* Preview of Parsed Rows */}
          {file && !parsing && records.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">{file.name}</span>
                  <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                    <CheckCircle2 size={13} /> {validCount} valid
                  </span>
                  {invalidCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                      <AlertTriangle size={13} /> {invalidCount} with issues
                    </span>
                  )}
                  <button
                    onClick={handleReset}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 transition"
                    title="Remove file"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Table preview */}
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 sticky top-0 font-semibold">
                    <tr>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Name</th>
                      <th className="px-3 py-2.5">Phone</th>
                      <th className="px-3 py-2.5">Bacenta</th>
                      <th className="px-3 py-2.5">Address</th>
                      {entityType === 'members' && <th className="px-3 py-2.5">Member Status</th>}
                      {entityType !== 'members' && <th className="px-3 py-2.5">Who Brought</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {records.map((rec, i) => (
                      <tr
                        key={i}
                        className={rec.isValid ? 'hover:bg-gray-50' : 'bg-red-50/50 hover:bg-red-50'}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          {rec.isValid ? (
                            <span className="text-green-600 inline-flex items-center gap-1 font-medium">
                              <CheckCircle2 size={14} /> Ready
                            </span>
                          ) : (
                            <span
                              className="text-red-600 inline-flex items-center gap-1 font-medium"
                              title={rec.error}
                            >
                              <AlertCircle size={14} /> {rec.error}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900 max-w-[140px] truncate">
                          {rec.full_name || '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                          {rec.phone_number || '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">
                          {rec.bacenta}
                        </td>
                        <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate" title={rec.address}>
                          {rec.address}
                        </td>
                        {entityType === 'members' && (
                          <td className="px-3 py-2 capitalize text-gray-600">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                              {rec.status || 'active'}
                            </span>
                          </td>
                        )}
                        {entityType !== 'members' && (
                          <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">
                            {rec.who_brought}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {invalidCount > 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="shrink-0" />
                  Note: Rows with errors will be skipped during import. You can fix them in your CSV or proceed with the valid rows.
                </p>
              )}
            </div>
          )}

          {/* Import Error */}
          {importError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Import Failed</p>
                <p className="text-xs mt-0.5">{importError}</p>
              </div>
            </div>
          )}

          {/* Import Progress */}
          {importing && importProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Importing records to church database...</span>
                <span>
                  {importProgress.current} / {importProgress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-orange-500 h-full transition-all duration-200"
                  style={{
                    width: `${(importProgress.current / importProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || validCount === 0}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-orange-400 to-orange-600 text-white text-sm font-semibold rounded-lg hover:from-orange-500 hover:to-orange-700 shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Importing...
              </>
            ) : (
              <>
                <Upload size={16} />
                Import {validCount} {validCount === 1 ? 'Record' : 'Records'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
