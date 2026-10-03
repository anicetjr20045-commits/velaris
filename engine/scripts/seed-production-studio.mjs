import { Client } from 'pg';

const client = new Client({
  host: 'aws-1-eu-west-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.dnwlqgsftauqsyjwhoza',
  password: '47796397Anicet$',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

const USER_ID = '043a33b4-429c-4056-b333-ee61d4c0a515';

async function main() {
  await client.connect();
  console.log('Connected to Supabase Postgres.');

  await client.query('BEGIN');

  // 1. Link Test session to user and set engine_owner
  await client.query(`
    UPDATE public.wa_sessions
       SET user_id = $1,
           engine_owner = 'velaris_engine',
           phone_number = '+22656240533',
           updated_at = now()
     WHERE session_name = 'Test';
  `, [USER_ID]);

  await client.query(`
    UPDATE public.wa_sessions
       SET user_id = $1,
           engine_owner = 'velaris_engine',
           updated_at = now()
     WHERE session_name = 'studio_043a33b4';
  `, [USER_ID]);

  // 2. Insert or update studio_personas
  await client.query(`
    INSERT INTO public.studio_personas (
      user_id,
      agent_enabled,
      studio_name,
      agent_name,
      manager_first_name,
      tone,
      formal_address,
      emoji_policy,
      timezone,
      agent_hours,
      manager_hours,
      followup_hours,
      payment_window_hours,
      alert_phone,
      agent_session_name,
      cap_reception,
      cap_procedure_voice,
      cap_lyrics_followup,
      cap_payment,
      cap_lyrics_draft,
      cap_auto_production,
      cap_video,
      delivery_mode,
      relay_mode,
      payment_methods
    ) VALUES (
      $1,
      true,
      'Velaris Studio',
      'Alex',
      'Anicet',
      'chaleureux',
      true,
      'none',
      'Africa/Ouagadougou',
      '{"all":["00:00","24:00"]}'::jsonb,
      '{"mon":["07:30","22:00"],"tue":["07:30","22:00"],"wed":["07:30","22:00"],"thu":["07:30","22:00"],"fri":["07:30","22:00"],"sat":["08:00","22:00"],"sun":["09:00","21:00"]}'::jsonb,
      '{"all":["08:00","20:30"]}'::jsonb,
      '{"all":["07:00","21:00"]}'::jsonb,
      '22656240533',
      'Test',
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      'live',
      'safe_templates',
      '[{"provider":"Orange Money","number":"+22656240533","holder":"Anicet","country":"BF"},{"provider":"Wave","number":"+22656240533","holder":"Anicet","country":"BF"}]'::jsonb
    )
    ON CONFLICT (user_id) DO UPDATE SET
      agent_enabled = EXCLUDED.agent_enabled,
      studio_name = EXCLUDED.studio_name,
      agent_name = EXCLUDED.agent_name,
      manager_first_name = EXCLUDED.manager_first_name,
      tone = EXCLUDED.tone,
      formal_address = EXCLUDED.formal_address,
      emoji_policy = EXCLUDED.emoji_policy,
      cap_reception = EXCLUDED.cap_reception,
      cap_procedure_voice = EXCLUDED.cap_procedure_voice,
      cap_lyrics_followup = EXCLUDED.cap_lyrics_followup,
      cap_payment = EXCLUDED.cap_payment,
      delivery_mode = EXCLUDED.delivery_mode,
      payment_methods = EXCLUDED.payment_methods,
      agent_session_name = EXCLUDED.agent_session_name,
      updated_at = now();
  `, [USER_ID]);

  // 3. Insert or update studio_catalogues
  const catalogue = [
    { code: 'essentiel', label: 'Essentiel', desc: 'Chanson personnalisée 1 couplet 1 refrain, livrée en audio haute qualité.', price: 1200, del: 'audio', sort: 1 },
    { code: 'signature', label: 'Signature', desc: 'Chanson personnalisée complète 2 couplets 1 refrain, arrangements riches.', price: 3000, del: 'audio', sort: 2 },
    { code: 'prestige', label: 'Prestige', desc: 'Chanson complète personnalisée + clip vidéo diaporama photos souvenir.', price: 5000, del: 'audio_video', sort: 3 }
  ];

  for (const item of catalogue) {
    await client.query(`
      INSERT INTO public.studio_catalogues (
        user_id, code, label, description, price_xof, deliverable, payment_policy, required_fields, is_active, sort_order
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'after_lyrics_validation', ARRAY['occasion','recipient_name'], true, $7
      )
      ON CONFLICT (user_id, code) DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        price_xof = EXCLUDED.price_xof,
        deliverable = EXCLUDED.deliverable,
        payment_policy = EXCLUDED.payment_policy,
        is_active = true,
        sort_order = EXCLUDED.sort_order,
        updated_at = now();
    `, [USER_ID, item.code, item.label, item.desc, item.price, item.del, item.sort]);
  }

  await client.query('COMMIT');
  console.log('Seeded studio persona and catalogues successfully!');

  // Check results
  const resP = await client.query('SELECT user_id, studio_name, agent_name, agent_enabled, delivery_mode FROM studio_personas WHERE user_id = $1', [USER_ID]);
  console.log('Persona:', resP.rows[0]);

  const resC = await client.query('SELECT code, label, price_xof, deliverable FROM studio_catalogues WHERE user_id = $1 ORDER BY sort_order', [USER_ID]);
  console.log('Catalogues:', resC.rows);

  const resS = await client.query("SELECT session_name, user_id, engine_owner, status FROM wa_sessions WHERE session_name IN ('Test', 'studio_043a33b4')");
  console.log('Sessions:', resS.rows);

  await client.query("SELECT pg_notify('pgrst', 'reload schema')");

  await client.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
