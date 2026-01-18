export interface SalaryData {
  month: number;
  year: number;
  days: string[]; // Array of 31 strings representing work hours for each day
  weekdays: string[]; // Array of 31 strings representing weekday names (Thứ 2, Thứ 3, etc.)
  totalHours: string;
  totalOvertime: string;
  totalSalary: string;
}

export enum LoadStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface SheetRanges {
  month: string;      // G1
  year: string;       // I1
  part1: string;      // C3:C18 (Days 1-16)
  part2: string;      // I3:I17 (Days 17-31)
  totalHours: string; // G22
  overtime: string;   // F27
  salary: string;     // F28
}