import { supabase } from '@/lib/supabase';

// Returns the YYYY-MM string for a given date string (e.g., "2026-06-03" -> "2026-06")
export const getYearMonthFromDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    const ym = `${parts[0]}-${parts[1]}`;
    if (/^\d{4}-\d{2}$/.test(ym)) {
      return ym;
    }
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
  } catch (e) {}
  return '';
};

const fetchClosedMonthsLocal = (): string[] => {
  try {
    const local = localStorage.getItem('midas_closed_months');
    if (local) {
      return JSON.parse(local);
    }
    const cache = localStorage.getItem('midas_closed_months_cache');
    if (cache) {
      return JSON.parse(cache);
    }
  } catch (e) {
    console.error("[ClosedMonths] Error reading local storage:", e);
  }
  return [];
};

// Fetches the list of closed months from Supabase, falling back to localStorage if table doesn't exist or on error
export const fetchClosedMonths = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('midas_closed_months')
      .select('year_month')
      .eq('closed', true);

    if (error) {
      console.warn("[ClosedMonths] Error fetching from DB, falling back to local storage:", error.message);
      return fetchClosedMonthsLocal();
    }

    const months = (data || []).map(row => row.year_month);
    localStorage.setItem('midas_closed_months_cache', JSON.stringify(months));
    return months;
  } catch (e) {
    console.error("[ClosedMonths] Exception fetching closed months:", e);
    return fetchClosedMonthsLocal();
  }
};

// Checks if a date belongs to a closed month
export const isMonthClosed = (dateStr: string | undefined | null, closedMonths: string[]): boolean => {
  const ym = getYearMonthFromDate(dateStr);
  if (!ym) return false;
  return closedMonths.includes(ym);
};

// Closes a month in the DB and local storage
export const closeMonth = async (yearMonth: string, userId?: string): Promise<boolean> => {
  try {
    const local = fetchClosedMonthsLocal();
    if (!local.includes(yearMonth)) {
      local.push(yearMonth);
      localStorage.setItem('midas_closed_months', JSON.stringify(local));
    }

    const { error } = await supabase
      .from('midas_closed_months')
      .upsert([{ year_month: yearMonth, closed: true, user_id: userId }], { onConflict: 'year_month' });

    if (error) {
      console.warn("[ClosedMonths] Could not save to DB (table might not exist):", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[ClosedMonths] Exception closing month:", e);
    return false;
  }
};

// Reopens a closed month in the DB and local storage
export const reopenMonth = async (yearMonth: string): Promise<boolean> => {
  try {
    let local = fetchClosedMonthsLocal();
    local = local.filter(ym => ym !== yearMonth);
    localStorage.setItem('midas_closed_months', JSON.stringify(local));

    const { error } = await supabase
      .from('midas_closed_months')
      .delete()
      .eq('year_month', yearMonth);

    if (error) {
      console.warn("[ClosedMonths] Could not delete from DB (table might not exist):", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[ClosedMonths] Exception reopening month:", e);
    return false;
  }
};
