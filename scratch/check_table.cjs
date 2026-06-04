const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://cmxqgvhxmxhkfnzatpny.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNteHFndmh4bXhoa2ZuemF0cG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDQ4ODQsImV4cCI6MjA4NzAyMDg4NH0.S8Xreva2mecx0EIV7APcTuwXEE7F_OisBEvNUBF6--g";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function check() {
  const { data, error } = await supabase.from('midas_closed_months').select('*');
  if (error) {
    console.log("Error:", error.code, error.message);
  } else {
    console.log("Success! Data:", data);
  }
}

check();
