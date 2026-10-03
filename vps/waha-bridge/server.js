const http = require('http');

const PORT = process.env.PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dnwlqgsftauqsyjwhoza.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const WAHA_URL = process.env.WAHA_URL || 'http://waha:3000';
const WAHA_API_KEY = process.env.WAHA_API_KEY || '';

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_SECRET_KEY,
    'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase error (${res.status}): ${txt}`);
  }
  return await res.json().catch(() => null);
}

async function sendWahaText(session, chatId, text) {
  try {
    const res = await fetch(`${WAHA_URL}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY
      },
      body: JSON.stringify({ session, chatId, text })
    });
    return res.ok;
  } catch (err) {
    console.error(`[Bridge] Error sending text via WAHA (${session}):`, err.message);
    return false;
  }
}

async function handleWebhook(body) {
  const { event, session, payload } = body;
  console.log(`[Bridge] Received event='${event}' session='${session}'`);

  if (!session || session === 'anicet2') {
    return { skipped: true, reason: 'ignored_session' };
  }

  // 1. Session Status Change
  if (event === 'session.status') {
    const status = payload?.status || body?.status;
    const phone = payload?.me?.id ? payload.me.id.split('@')[0] : null;
    console.log(`[Bridge] Session '${session}' status is now '${status}', phone='${phone}'`);

    const updatePayload = {
      status: status === 'WORKING' ? 'connected' : status.toLowerCase(),
      updated_at: new Date().toISOString()
    };
    if (phone) updatePayload.phone_number = phone;
    if (status === 'WORKING') updatePayload.last_seen_at = new Date().toISOString();

    await supabaseFetch(`wa_sessions?session_name=eq.${encodeURIComponent(session)}`, {
      method: 'PATCH',
      body: JSON.stringify(updatePayload)
    });
    return { ok: true, type: 'status_updated' };
  }

  // 2. Incoming or Outgoing Message
  if (event === 'message' || event === 'message.any') {
    if (!payload || !payload.body || payload.from === 'status@broadcast') {
      return { skipped: true, reason: 'empty_or_broadcast' };
    }

    // Resolve user_id from session_name
    const sessions = await supabaseFetch(`wa_sessions?session_name=eq.${encodeURIComponent(session)}&select=user_id`);
    if (!sessions || sessions.length === 0 || !sessions[0].user_id) {
      console.warn(`[Bridge] No user_id found for session '${session}'`);
      return { skipped: true, reason: 'unknown_session_user' };
    }
    const userId = sessions[0].user_id;

    const fromMe = Boolean(payload.fromMe);
    const text = String(payload.body).trim();
    const rawTarget = fromMe ? (payload.to || '') : (payload.from || '');
    const cleanPhone = rawTarget.replace(/[^0-9]/g, '');
    const contactName = payload._data?.notifyName || payload.pushName || 'Client WhatsApp';

    if (!cleanPhone) return { skipped: true, reason: 'no_phone' };

    // Find or create Contact
    let contacts = await supabaseFetch(`contacts?user_id=eq.${userId}&phone=eq.${cleanPhone}&select=id,name`);
    let contactId;
    if (contacts && contacts.length > 0) {
      contactId = contacts[0].id;
      if (contacts[0].name === 'Client WhatsApp' && contactName !== 'Client WhatsApp') {
        await supabaseFetch(`contacts?id=eq.${contactId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: contactName })
        });
      }
    } else {
      const newContacts = await supabaseFetch('contacts', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          name: contactName,
          phone: cleanPhone,
          wa_jid: rawTarget,
          source: 'whatsapp'
        })
      });
      contactId = newContacts?.[0]?.id;
    }

    if (!contactId) {
      console.error(`[Bridge] Could not resolve contact for phone ${cleanPhone}`);
      return { error: 'contact_failed' };
    }

    // Find or create Conversation
    let convs = await supabaseFetch(`conversations?user_id=eq.${userId}&contact_id=eq.${contactId}&select=id,funnel_stage`);
    let convId;
    if (convs && convs.length > 0) {
      convId = convs[0].id;
      await supabaseFetch(`conversations?id=eq.${convId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          summary: text.slice(0, 120),
          last_message_at: new Date().toISOString()
        })
      });
    } else {
      const newConvs = await supabaseFetch('conversations', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          contact_id: contactId,
          funnel_stage: 'new',
          summary: text.slice(0, 120),
          last_message_at: new Date().toISOString()
        })
      });
      convId = newConvs?.[0]?.id;
    }

    // Insert Message
    await supabaseFetch('messages', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        conversation_id: convId,
        role: fromMe ? 'human_agent' : 'user',
        direction: fromMe ? 'outbound' : 'inbound',
        body: text
      })
    });

    console.log(`[Bridge] Recorded message for user ${userId} conv ${convId}`);

    // Check Automation Rules if incoming
    if (!fromMe) {
      const rules = await supabaseFetch(`automation_rules?user_id=eq.${userId}&enabled=eq.true&select=id,trigger_type,trigger_value,text_body`);
      if (rules && rules.length > 0) {
        for (const rule of rules) {
          if (rule.trigger_value && text.toLowerCase().includes(rule.trigger_value.toLowerCase())) {
            console.log(`[Bridge] Triggering automation rule '${rule.id}' for ${cleanPhone}`);
            const sent = await sendWahaText(session, rawTarget, rule.text_body);
            if (sent) {
              await supabaseFetch('messages', {
                method: 'POST',
                body: JSON.stringify({
                  user_id: userId,
                  conversation_id: convId,
                  role: 'assistant',
                  direction: 'outbound',
                  body: rule.text_body
                })
              });
            }
            break;
          }
        }
      }
    }

    return { ok: true, type: 'message_saved' };
  }

  return { ok: true, type: 'unhandled_event' };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
  }

  if (req.method === 'POST' && (req.url === '/webhook' || req.url === '/api/public/waha-webhook')) {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(raw);
        const result = await handleWebhook(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('[Bridge] Error handling webhook:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Bridge] WAHA Bridge running on port ${PORT}`);
});
