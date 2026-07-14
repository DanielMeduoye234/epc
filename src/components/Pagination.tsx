'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

// Builds a compact page list like: 1 … 4 5 [6] 7 8 … 20
function getPageWindow(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  if (start > 2) pages.push('ellipsis');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < totalPages - 1) pages.push('ellipsis');
  pages.push(totalPages);
  return pages;
}

export default function Pagination({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange }: PaginationProps) {
  if (totalItems <= 0) return null;

  const from = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
  const to = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border border-gray-100 rounded-xl bg-white shadow-sm mt-4">
      <div className="text-sm text-gray-500 text-center sm:text-left">
        Showing <span className="font-semibold text-black">{from}</span> to{' '}
        <span className="font-semibold text-black">{to}</span> of{' '}
        <span className="font-semibold text-black">{totalItems}</span> entries
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <button
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Previous
        </button>
        <div className="hidden sm:flex items-center gap-1">
          {getPageWindow(currentPage, totalPages).map((page, i) =>
            page === 'ellipsis' ? (
              <span key={`e-${i}`} className="px-2 text-sm text-gray-400 select-none">…</span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                  currentPage === page
                    ? 'bg-orange-500 text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            )
          )}
        </div>
        <span className="sm:hidden text-sm text-gray-500">
          Page {currentPage} of {Math.max(totalPages, 1)}
        </span>
        <button
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage >= totalPages}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Next
        </button>
      </div>
    </div>
  );
}
