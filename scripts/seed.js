import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const USERS = [
  { email: 'dr.smith@example.com', password: 'password123', role: 'doctor', patients: ['Liam Smith', 'Olivia Smith'] },
  { email: 'dr.jones@example.com', password: 'password123', role: 'doctor', patients: ['Noah Jones', 'Emma Jones'] },
  { email: 'parent.alice@example.com', password: 'password123', role: 'parent' },
  { email: 'parent.bob@example.com', password: 'password123', role: 'parent' }
];

async function seed() {
  console.log("Starting seed process...");

  for (const u of USERS) {
    console.log(`Creating user: ${u.email}...`);
    // Create the user in Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: u.email,
      password: u.password
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log(`User ${u.email} already exists. Skipping auth creation.`);
      } else {
        console.error(`Failed to create auth for ${u.email}:`, authError.message);
        continue;
      }
    }

    // Since RLS is enabled, we need to log in as them to insert their own profile 
    // unless there is a trigger doing it. Our SQL schema doesn't have a trigger.
    await supabase.auth.signInWithPassword({ email: u.email, password: u.password });
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (!userId) {
      console.log(`Could not get session for ${u.email}`);
      continue;
    }

    // Insert profile
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      email: u.email,
      role: u.role
    });

    if (profileError) {
       console.error(`Failed to create profile for ${u.email}:`, profileError.message);
    } else {
       console.log(`Profile created for ${u.email} as ${u.role}`);
    }

    // Create patients if they are a doctor
    if (u.role === 'doctor' && u.patients) {
      for (const pName of u.patients) {
         const { error: patientError } = await supabase.from('patients').insert({
           name: pName,
           doctor_id: userId
         });
         if (patientError) {
           console.error(`Failed to create patient ${pName}:`, patientError.message);
         } else {
           console.log(`Created patient ${pName} for doctor ${u.email}`);
         }
      }
    }
    
    // Sign out to clean up session
    await supabase.auth.signOut();
  }

  console.log("Seeding complete!");
}

seed();
