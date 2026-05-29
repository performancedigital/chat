import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres:Isr@el2026**@@@db.gxdzjmxpmuwjcawollep.supabase.co:5432/postgres';

const client = new Client({
  connectionString,
});

const sql = `
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    phone TEXT,
    email TEXT,
    profession TEXT,
    status TEXT DEFAULT 'pending',
    human_takeover BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and create policies
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow anon to insert/select their own sessions
DROP POLICY IF EXISTS "Anon can create sessions" ON sessions;
CREATE POLICY "Anon can create sessions" ON sessions FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can select own sessions" ON sessions;
CREATE POLICY "Anon can select own sessions" ON sessions FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Anon can update own sessions" ON sessions;
CREATE POLICY "Anon can update own sessions" ON sessions FOR UPDATE TO anon USING (true);

-- Allow anon to insert/select their own messages
DROP POLICY IF EXISTS "Anon can create messages" ON messages;
CREATE POLICY "Anon can create messages" ON messages FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can select messages" ON messages;
CREATE POLICY "Anon can select messages" ON messages FOR SELECT TO anon USING (true);

-- Create publication for realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;
  CREATE PUBLICATION supabase_realtime FOR TABLE sessions, messages;
COMMIT;
`;

async function run() {
  await client.connect();
  console.log('Connected to DB');
  try {
    await client.query(sql);
    console.log('Schema created successfully');
  } catch (err) {
    console.error('Error creating schema:', err);
  } finally {
    await client.end();
  }
}

run();
