import React, { useEffect, useState, useCallback, useRef } from 'react';
import { initializeGoogleApi, handleAuthClick, handleSignoutClick, fetchData, saveData, updateDayHours, updateMonthYear } from './services/googleSheetsService';
import { exportToPDF } from './services/pdfService';
import { SalaryData, LoadStatus } from './types';
import WorkInputGrid from './components/WorkInputGrid';
import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID } from './services/constants';

// Helper to get storage key for a month/year
const getStorageKey = (month: number, year: number) => `salary_${year}_${month}`;

// Save month data to localStorage
const saveMonthToHistory = (data: SalaryData) => {
  const key = getStorageKey(data.month, data.year);
  localStorage.setItem(key, JSON.stringify(data));
};

// Load month data from localStorage
const loadMonthFromHistory = (month: number, year: number): SalaryData | null => {
  const key = getStorageKey(month, year);
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

const App: React.FC = () => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);
  const [initError, setInitError] = useState<any>(null);
  const [status, setStatus] = useState<LoadStatus>(LoadStatus.IDLE);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Ref to track if initial load has been attempted
  const initialLoadAttempted = useRef(false);

  const [data, setData] = useState<SalaryData>({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    days: Array(31).fill(''),
    weekdays: Array(31).fill(''),
    totalHours: '0',
    totalOvertime: '0',
    totalSalary: '0',
  });

  useEffect(() => {
    initializeGoogleApi((signedIn, error) => {
      if (error) {
        setInitError(error);
        console.error("Google API Initialization failed:", error);
      } else {
        setIsSignedIn(signedIn);
        setIsApiReady(true);
      }
    });
  }, []);

  const handleLoadData = useCallback(async (requireAuth = true) => {
    if (!isApiReady) return;
    setStatus(LoadStatus.LOADING);
    try {
      // Nếu yêu cầu auth và chưa đăng nhập → popup đăng nhập
      if (requireAuth && !isSignedIn) {
        await handleAuthClick(setIsSignedIn);
      }

      // Lấy dữ liệu từ Sheet
      const fetchedData = await fetchData();
      setData(fetchedData);
      // Lưu vào history
      saveMonthToHistory(fetchedData);
      setStatus(LoadStatus.SUCCESS);
    } catch (error) {
      console.error(error);
      setStatus(LoadStatus.ERROR);
      if (!isSignedIn) setStatus(LoadStatus.IDLE);
    }
  }, [isApiReady, isSignedIn]);

  // Auto-login and load data when API is ready
  useEffect(() => {
    if (isApiReady && !initialLoadAttempted.current) {
      initialLoadAttempted.current = true;
      // Prompt login immediately on page load
      handleLoadData(true);
    }
  }, [isApiReady, handleLoadData]);

  const handleSave = async () => {
    if (!isApiReady) return;
    setStatus(LoadStatus.LOADING);
    try {
      if (!isSignedIn) {
        await handleAuthClick(setIsSignedIn);
      }
      await saveData(data);
      // Re-fetch to get updated calculated values from sheets formulas
      const updatedData = await fetchData();
      setData(updatedData);
      // Save to history
      saveMonthToHistory(updatedData);
      setStatus(LoadStatus.SUCCESS);
      setLastSyncTime(new Date());
      alert('Đã lưu thành công! Sheet đã được cập nhật.');
    } catch (error) {
      console.error(error);
      setStatus(LoadStatus.ERROR);
      alert('Lỗi khi lưu dữ liệu hoặc bạn chưa cấp quyền.');
    }
  };

  const handleDayChange = (index: number, value: string) => {
    const newDays = [...data.days];
    newDays[index] = value;
    setData(prev => ({ ...prev, days: newDays }));
  };

  // Real-time sync when user finishes editing a day (onBlur)
  const handleDayBlur = async (index: number, value: string) => {
    if (!isApiReady) return;

    setIsSyncing(true);
    try {
      // Try to sync directly - gapi will use existing token if available
      await updateDayHours(index, value);
      // Re-fetch to get updated totals
      const updatedData = await fetchData();
      setData(updatedData);
      saveMonthToHistory(updatedData);
      setLastSyncTime(new Date());
      // Mark as signed in if sync succeeded
      if (!isSignedIn) setIsSignedIn(true);
    } catch (error: any) {
      console.error('Error syncing day hours:', error);
      // If auth error, try to get auth then retry
      if (error?.status === 401 || error?.result?.error?.code === 401) {
        try {
          await handleAuthClick(setIsSignedIn);
          await updateDayHours(index, value);
          const updatedData = await fetchData();
          setData(updatedData);
          saveMonthToHistory(updatedData);
          setLastSyncTime(new Date());
        } catch (retryError) {
          console.error('Retry failed:', retryError);
          saveMonthToHistory(data);
        }
      } else {
        saveMonthToHistory(data);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle month change - full sync with Sheet
  const handleMonthChange = async (newMonth: number) => {
    // Save current month data to history first
    saveMonthToHistory(data);

    // Check if we have saved data for the new month
    const historyData = loadMonthFromHistory(newMonth, data.year);

    // Prepare new data (either from history or reset to empty)
    const newData: SalaryData = historyData || {
      month: newMonth,
      year: data.year,
      days: Array(31).fill(''),
      weekdays: data.weekdays, // Keep weekdays from Sheet
      totalHours: '0',
      totalOvertime: '0',
      totalSalary: '0',
    };

    // Update UI immediately
    setData(newData);

    // Sync to Sheet
    if (isApiReady) {
      setIsSyncing(true);
      try {
        // Update month in Sheet and save all day values
        await saveData(newData);
        // Fetch updated data (with formulas calculated)
        const updatedData = await fetchData();
        setData(updatedData);
        setLastSyncTime(new Date());
      } catch (error) {
        console.error('Error syncing month change to Sheet:', error);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Handle year change - full sync with Sheet
  const handleYearChange = async (newYear: number) => {
    // Save current data to history first
    saveMonthToHistory(data);

    // Check if we have saved data for the new year
    const historyData = loadMonthFromHistory(data.month, newYear);

    // Prepare new data (either from history or reset to empty)
    const newData: SalaryData = historyData || {
      month: data.month,
      year: newYear,
      days: Array(31).fill(''),
      weekdays: data.weekdays,
      totalHours: '0',
      totalOvertime: '0',
      totalSalary: '0',
    };

    // Update UI immediately
    setData(newData);

    // Sync to Sheet
    if (isApiReady) {
      setIsSyncing(true);
      try {
        await saveData(newData);
        const updatedData = await fetchData();
        setData(updatedData);
        setLastSyncTime(new Date());
      } catch (error) {
        console.error('Error syncing year change to Sheet:', error);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Handle PDF export
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportToPDF(data);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Lỗi khi xuất PDF. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  // Error State: Configuration Needed
  if (initError) {
    const isDefaultKey = GOOGLE_API_KEY.includes('YOUR_GOOGLE_API_KEY') || GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID');
    const isKeyBlocked = initError.result?.error?.status === 'PERMISSION_DENIED' || initError.result?.error?.message?.includes('blocked');

    return (
      <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-lg w-full text-center">
          <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Lỗi Khởi Tạo Google API</h2>

          {isDefaultKey && (
            <p className="text-red-600 font-medium mb-4">Bạn chưa cấu hình API Key và Client ID.</p>
          )}

          {isKeyBlocked && !isDefaultKey && (
            <div className="text-left bg-orange-50 border border-orange-200 p-4 rounded-lg mb-6">
              <p className="font-bold text-orange-800 text-sm mb-2">⚠ API Key bị chặn (Error 403)</p>
              <p className="text-gray-700 text-sm mb-2">API Key của bạn đang bị giới hạn quyền truy cập trên Google Cloud Console.</p>
              <p className="text-gray-700 text-sm font-semibold">Cách khắc phục:</p>
              <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1 mt-1">
                <li>Vào <b>Google Cloud Console</b> &gt; <b>Credentials</b>.</li>
                <li>Chọn API Key bạn đang sử dụng.</li>
                <li>Mục <b>API restrictions</b>: Chọn <b>Don't restrict key</b> để test.</li>
                <li>Hoặc nếu muốn bảo mật, hãy chắc chắn đã chọn <b>Google Sheets API</b> trong danh sách cho phép.</li>
                <li>Lưu lại và tải lại trang này.</li>
              </ol>
            </div>
          )}

          {!isKeyBlocked && !isDefaultKey && (
            <div className="bg-gray-100 p-4 rounded-lg text-left text-sm font-mono text-gray-700 overflow-x-auto mb-6">
              <p>{initError.result?.error?.message || initError.message || JSON.stringify(initError)}</p>
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  // Login Screen - show when API is ready but user not signed in
  if (isApiReady && !isSignedIn && status !== LoadStatus.LOADING) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-600 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
          <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Bảng Chấm Công</h1>
          <p className="text-gray-500 mb-8">Đăng nhập với Google để quản lý bảng chấm công của bạn</p>

          <button
            onClick={() => handleLoadData(true)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Đăng nhập với Google
          </button>

          <p className="text-xs text-gray-400 mt-6">
            Ứng dụng cần quyền truy cập Google Sheets để lưu dữ liệu
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-800 hidden sm:block">Bảng Lương</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500 hidden md:flex items-center space-x-2">
              {!isApiReady && <span>Đang khởi động...</span>}
              {isApiReady && status === LoadStatus.LOADING && <span className="animate-pulse">Đang tải...</span>}
              {isSyncing && (
                <span className="flex items-center text-blue-500">
                  <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang đồng bộ...
                </span>
              )}
              {lastSyncTime && !isSyncing && status !== LoadStatus.LOADING && (
                <span className="text-green-500 text-xs">
                  ✓ Đã lưu {lastSyncTime.toLocaleTimeString('vi-VN')}
                </span>
              )}
            </div>
            {isSignedIn && (
              <button
                onClick={() => handleSignoutClick(setIsSignedIn)}
                className="text-sm text-gray-500 hover:text-red-500 font-medium px-3 py-1 rounded-md hover:bg-red-50 transition-colors"
              >
                Đăng xuất
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {/* Month/Year Selection - Mobile Optimized */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap gap-3 sm:gap-4 items-end">
            <div className="flex-1 min-w-[100px]">
              <label className="block text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 sm:mb-2">Tháng</label>
              <select
                value={data.month}
                onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                className="block w-full pl-2 sm:pl-3 pr-8 py-2.5 sm:py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-lg border bg-white"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>T{m}</option>
                ))}
              </select>
            </div>
            <div className="w-20 sm:w-24">
              <label className="block text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 sm:mb-2">Năm</label>
              <input
                type="number"
                value={data.year}
                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                className="block w-full px-2 sm:px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base"
              />
            </div>
          </div>
          {/* Action Buttons - Stack on mobile */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
            <button
              onClick={handleExportPDF}
              disabled={isExporting || status === LoadStatus.LOADING}
              className="flex-1 sm:flex-none bg-green-500 hover:bg-green-600 text-white px-4 py-3 sm:py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              Xuất PDF
            </button>
            <button
              onClick={() => handleLoadData(true)}
              disabled={!isApiReady || status === LoadStatus.LOADING}
              className="flex-1 sm:flex-none bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 sm:py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {status === LoadStatus.LOADING ? 'Đang tải...' : 'Tải lại dữ liệu'}
            </button>
          </div>
        </div>

        {/* Stats Cards - Horizontal scroll on mobile */}
        <div className="flex overflow-x-auto gap-3 sm:gap-6 pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 scrollbar-hide">
          <div className="flex-shrink-0 w-[140px] sm:w-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 sm:p-6 text-white shadow-lg">
            <p className="text-blue-100 text-xs sm:text-sm font-medium mb-1">Tổng Lương</p>
            <p className="text-xl sm:text-3xl font-bold tracking-tight whitespace-nowrap">{data.totalSalary}</p>
          </div>
          <div className="flex-shrink-0 w-[120px] sm:w-auto bg-white rounded-xl p-4 sm:p-6 border border-gray-100 shadow-sm">
            <p className="text-gray-500 text-xs sm:text-sm font-medium mb-1">Tổng Giờ</p>
            <div className="flex items-baseline">
              <span className="text-xl sm:text-2xl font-bold text-gray-800">{data.totalHours}</span>
              <span className="ml-1 text-xs sm:text-sm text-gray-400">h</span>
            </div>
          </div>
          <div className="flex-shrink-0 w-[120px] sm:w-auto bg-white rounded-xl p-4 sm:p-6 border border-gray-100 shadow-sm">
            <p className="text-gray-500 text-xs sm:text-sm font-medium mb-1">Tăng Ca</p>
            <div className="flex items-baseline">
              <span className="text-xl sm:text-2xl font-bold text-orange-600">{data.totalOvertime}</span>
              <span className="ml-1 text-xs sm:text-sm text-gray-400">h</span>
            </div>
          </div>
        </div>

        {/* Work Inputs */}
        <WorkInputGrid
          days={data.days}
          weekdays={data.weekdays}
          onChange={handleDayChange}
          onBlur={handleDayBlur}
        />

      </main>

      {/* Floating Action Button for Save */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={handleSave}
          disabled={!isApiReady || status === LoadStatus.LOADING || isSyncing}
          className={`flex items-center justify-center space-x-2 bg-black hover:bg-gray-800 text-white px-6 py-4 rounded-full shadow-2xl transition-all transform hover:scale-105 active:scale-95 ${(!isApiReady || status === LoadStatus.LOADING || isSyncing) ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          {status === LoadStatus.LOADING || isSyncing ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          )}
          <span className="font-semibold text-lg">Lưu vào Sheet</span>
        </button>
      </div>
    </div>
  );
};

export default App;