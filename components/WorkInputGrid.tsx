import React from 'react';

interface WorkInputGridProps {
  days: string[];
  weekdays: string[];
  onChange: (index: number, value: string) => void;
  onBlur: (index: number, value: string) => void;
}

const WorkInputGrid: React.FC<WorkInputGridProps> = ({ days, weekdays, onChange, onBlur }) => {
  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Nhập Ngày Công
      </h3>

      {/* Mobile: 4 columns, Tablet: 6 columns, Desktop: 8 columns */}
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
        {days.map((val, index) => {
          const hasValue = val !== '';
          const weekday = weekdays[index] || '';

          return (
            <div key={index} className="flex flex-col">
              {/* Day number + weekday combined for mobile */}
              <label className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1 text-center font-medium leading-tight">
                <span className="block">{index + 1}</span>
                {weekday && (
                  <span className="text-blue-500 text-[9px] sm:text-[10px]">{weekday}</span>
                )}
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="-"
                value={val}
                onChange={(e) => onChange(index, e.target.value)}
                onBlur={(e) => onBlur(index, e.target.value)}
                className={`w-full text-center border rounded-lg p-1.5 sm:p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm sm:text-base font-semibold
                  ${hasValue
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
              />
            </div>
          );
        })}
      </div>
      <p className="text-[10px] sm:text-xs text-gray-400 mt-3 sm:mt-4 italic text-right">* Ô xanh = đã nhập</p>
    </div>
  );
};

export default WorkInputGrid;