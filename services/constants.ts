// Environment variables - loaded from .env.local
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
export const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID || '';
export const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

export const RANGES = {
  MONTH: 'ChamCong!G1',
  YEAR: 'ChamCong!I1',
  DAYS_1_16: 'ChamCong!C3:C18',
  DAYS_17_31: 'ChamCong!I3:I17',
  WEEKDAYS_1_16: 'ChamCong!B3:B18',
  WEEKDAYS_17_31: 'ChamCong!H3:H17',
  TOTAL_HOURS: 'ChamCong!G22',
  TOTAL_OVERTIME: 'ChamCong!F27',
  TOTAL_SALARY: 'ChamCong!F28',
};