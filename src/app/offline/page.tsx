export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 18.364a9 9 0 010-12.728M8.464 15.536a5 5 0 010-7.072M12 12h.01" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">You&apos;re offline</h1>
        <p className="text-gray-500">Please check your internet connection and try again.</p>
      </div>
    </div>
  );
}
