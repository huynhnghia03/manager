import { RANGES, SPREADSHEET_ID, GOOGLE_API_KEY, GOOGLE_CLIENT_ID, SCOPES } from './constants';
import { SalaryData } from '../types';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

// Token persistence helpers
const TOKEN_KEY = 'google_oauth_token';

const saveToken = (token: any) => {
  if (token) {
    const tokenData = {
      ...token,
      savedAt: Date.now()
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
  }
};

const loadToken = (): any | null => {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      const tokenData = JSON.parse(stored);
      // Check if token is expired (tokens typically last 1 hour = 3600000ms)
      const elapsed = Date.now() - (tokenData.savedAt || 0);
      if (elapsed < 3500000) { // 58 minutes (with buffer)
        return tokenData;
      }
      // Token expired, remove it
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (e) {
    console.error('Error loading token:', e);
  }
  return null;
};

const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const initializeGoogleApi = (updateSigninStatus: (isSignedIn: boolean, error: any | null) => void) => {
  const gapiLoaded = () => {
    window.gapi.load('client', async () => {
      try {
        // Step 1: Initialize the client with the API Key
        await window.gapi.client.init({
          apiKey: GOOGLE_API_KEY,
          // We load the discovery doc explicitly below to handle errors better
        });

        // Step 2: Load the Sheets API using the shorthand method
        // This is often more reliable with restricted API keys than passing the raw discovery URL
        await window.gapi.client.load('sheets', 'v4');

        gapiInited = true;
        maybeEnableButtons(updateSigninStatus);
      } catch (error) {
        console.error("Error initializing Google API:", error);
        updateSigninStatus(false, error);
      }
    });
  };

  const gisLoaded = () => {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
      });
      gisInited = true;
      maybeEnableButtons(updateSigninStatus);
    } catch (error) {
      console.error("Error initializing Google Identity Services:", error);
      updateSigninStatus(false, error);
    }
  };

  const script1 = document.createElement('script');
  script1.src = "https://apis.google.com/js/api.js";
  script1.onload = gapiLoaded;
  script1.onerror = (e) => updateSigninStatus(false, new Error("Failed to load gapi script"));
  document.body.appendChild(script1);

  const script2 = document.createElement('script');
  script2.src = "https://accounts.google.com/gsi/client";
  script2.onload = gisLoaded;
  script2.onerror = (e) => updateSigninStatus(false, new Error("Failed to load gsi script"));
  document.body.appendChild(script2);
};

const maybeEnableButtons = (updateSigninStatus: (isSignedIn: boolean, error: any | null) => void) => {
  if (gapiInited && gisInited) {
    // Try to restore token from localStorage
    const savedToken = loadToken();
    if (savedToken && !window.gapi.client.getToken()) {
      window.gapi.client.setToken(savedToken);
    }

    const token = window.gapi.client.getToken();
    updateSigninStatus(!!token, null);
  }
};

export const handleAuthClick = async (updateSigninStatus: (isSignedIn: boolean) => void) => {
  return new Promise<void>((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp.error) {
        reject(resp);
        throw (resp);
      }
      // Save token to localStorage for session persistence
      const token = window.gapi.client.getToken();
      saveToken(token);
      updateSigninStatus(true);
      resolve();
    };

    if (window.gapi.client.getToken() === null) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      // Skip display of account chooser and consent dialog for an existing session.
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

export const handleSignoutClick = (updateSigninStatus: (isSignedIn: boolean) => void) => {
  const token = window.gapi.client.getToken();
  if (token !== null) {
    window.google.accounts.oauth2.revoke(token.access_token);
    window.gapi.client.setToken('');
    clearToken(); // Clear from localStorage
    updateSigninStatus(false);
  }
};

export const fetchData = async (): Promise<SalaryData> => {
  try {
    const response = await window.gapi.client.sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [
        RANGES.MONTH,
        RANGES.YEAR,
        RANGES.DAYS_1_16,
        RANGES.DAYS_17_31,
        RANGES.WEEKDAYS_1_16,
        RANGES.WEEKDAYS_17_31,
        RANGES.TOTAL_HOURS,
        RANGES.TOTAL_OVERTIME,
        RANGES.TOTAL_SALARY
      ],
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const valueRanges = response.result.valueRanges;

    const month = parseInt(valueRanges[0].values?.[0]?.[0] || '1');
    const year = parseInt(valueRanges[1].values?.[0]?.[0] || new Date().getFullYear().toString());

    // Process days 1-16
    const part1 = valueRanges[2].values ? valueRanges[2].values.map((row: any[]) => row[0] || '') : [];
    // Process days 17-31
    const part2 = valueRanges[3].values ? valueRanges[3].values.map((row: any[]) => row[0] || '') : [];

    // Process weekdays 1-16
    const weekdays1to16 = valueRanges[4].values ? valueRanges[4].values.map((row: any[]) => row[0] || '') : [];
    // Process weekdays 17-31
    const weekdays17to31 = valueRanges[5].values ? valueRanges[5].values.map((row: any[]) => row[0] || '') : [];

    // Pad arrays to ensure we cover empty cells
    const days1to16 = [...part1];
    while (days1to16.length < 16) days1to16.push('');

    const days17to31 = [...part2];
    while (days17to31.length < 15) days17to31.push('');

    const days = [...days1to16, ...days17to31];

    // Pad weekdays arrays
    while (weekdays1to16.length < 16) weekdays1to16.push('');
    while (weekdays17to31.length < 15) weekdays17to31.push('');
    const weekdays = [...weekdays1to16, ...weekdays17to31];

    const totalHours = valueRanges[6].values?.[0]?.[0] || '0';
    const totalOvertime = valueRanges[7].values?.[0]?.[0] || '0';
    const totalSalary = valueRanges[8].values?.[0]?.[0] || '0';

    return {
      month,
      year,
      days,
      weekdays,
      totalHours,
      totalOvertime,
      totalSalary
    };
  } catch (error) {
    console.error("Error fetching data", error);
    throw error;
  }
};

// Update a single day's work hours
export const updateDayHours = async (dayIndex: number, value: string): Promise<void> => {
  let range: string;
  let rowOffset: number;

  if (dayIndex < 16) {
    // Days 1-16 are in C3:C18
    rowOffset = dayIndex + 3; // Row 3 is index 0
    range = `ChamCong!C${rowOffset}`;
  } else {
    // Days 17-31 are in I3:I17
    rowOffset = (dayIndex - 16) + 3;
    range = `ChamCong!I${rowOffset}`;
  }

  await window.gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: range,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[value]]
    }
  });
};

// Update month and year
export const updateMonthYear = async (month: number, year: number): Promise<void> => {
  const body = {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: RANGES.MONTH, values: [[month]] },
      { range: RANGES.YEAR, values: [[year]] },
    ]
  };

  await window.gapi.client.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: body
  });
};

export const saveData = async (data: SalaryData): Promise<void> => {
  const days1to16 = data.days.slice(0, 16).map(d => [d]);
  const days17to31 = data.days.slice(16, 31).map(d => [d]);

  const body = {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: RANGES.MONTH, values: [[data.month]] },
      { range: RANGES.YEAR, values: [[data.year]] },
      { range: RANGES.DAYS_1_16, values: days1to16 },
      { range: RANGES.DAYS_17_31, values: days17to31 },
    ]
  };

  await window.gapi.client.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: body
  });
};