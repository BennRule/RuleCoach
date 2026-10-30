// Rule Coach push server. The app tells it when a rest ends; a Durable Object
// alarm fires at that moment and sends a Web Push to every stored subscription,
// so the phone buzzes even when the app is frozen in the background.
import { buildPushPayload } from '@block65/webcrypto-web-push';

const ALLOWED_ORIGINS = ['https://bennrule.github.io', 'http://localhost:8090', 'http://127.0.0.1:8090'];

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const h = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(request.url);
    if (request.headers.get('X-Token') !== env.TOKEN) return json({ error: 'unauthorised' }, 401, h);

    if (url.pathname === '/vapid' && request.method === 'GET') return json({ publicKey: env.VAPID_PUBLIC }, 200, h);

    // Everything stateful lives in one Durable Object (single user)
    const stub = env.REST_ALARMS.get(env.REST_ALARMS.idFromName('benn'));
    const res = await stub.fetch(new Request('https://do' + url.pathname, { method: request.method, headers: { 'Content-Type': 'application/json' }, body: request.method === 'POST' ? await request.text() : undefined }));
    const body = await res.text();
    return new Response(body, { status: res.status, headers: { 'Content-Type': 'application/json', ...h } });
  }
};

export class RestAlarm {
  constructor(state, env) { this.state = state; this.env = env; }

  async fetch(request) {
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

    if (url.pathname === '/subscribe') {
      const sub = body.subscription;
      if (!sub || !sub.endpoint || !sub.keys) return json({ error: 'bad subscription' }, 400);
      const subs = (await this.state.storage.get('subs')) || {};
      subs[sub.endpoint] = sub;
      await this.state.storage.put('subs', subs);
      return json({ ok: true, subscriptions: Object.keys(subs).length }, 200);
    }
    if (url.pathname === '/unsubscribe') {
      const subs = (await this.state.storage.get('subs')) || {};
      delete subs[body.endpoint];
      await this.state.storage.put('subs', subs);
      return json({ ok: true, subscriptions: Object.keys(subs).length }, 200);
    }
    if (url.pathname === '/rest') {
      const endsAt = Number(body.endsAt);
      if (!endsAt || endsAt < Date.now() - 1000) return json({ error: 'bad endsAt' }, 400);
      await this.state.storage.put('pending', { endsAt, exercise: String(body.exercise || 'Rest').slice(0, 80) });
      await this.state.storage.setAlarm(endsAt);
      return json({ ok: true, firesIn: Math.round((endsAt - Date.now()) / 1000) }, 200);
    }
    if (url.pathname === '/cancel') {
      await this.state.storage.delete('pending');
      await this.state.storage.deleteAlarm();
      return json({ ok: true }, 200);
    }
    if (url.pathname === '/status') {
      const subs = (await this.state.storage.get('subs')) || {};
      return json({ subscriptions: Object.keys(subs).length, pending: (await this.state.storage.get('pending')) || null, alarm: await this.state.storage.getAlarm(), lastSend: (await this.state.storage.get('lastSend')) || null }, 200);
    }
    if (url.pathname === '/test') {
      // Send immediately, for checking a fresh subscription
      const result = await this.send('Rule Coach', 'Background alerts are working.');
      return json(result, 200);
    }
    return json({ error: 'not found' }, 404);
  }

  async alarm() {
    const pending = await this.state.storage.get('pending');
    await this.state.storage.delete('pending');
    if (!pending) return;
    await this.send('Rest complete', pending.exercise + ' — time for the next set');
  }

  async send(title, body) {
    const subs = (await this.state.storage.get('subs')) || {};
    const vapid = { subject: 'mailto:benn@rule.org.uk', publicKey: this.env.VAPID_PUBLIC, privateKey: this.env.VAPID_PRIVATE };
    const message = { data: JSON.stringify({ title, body, tag: 'rulecoach-rest' }), options: { ttl: 60, urgency: 'high' } };
    const results = [];
    for (const [endpoint, sub] of Object.entries(subs)) {
      try {
        const payload = await buildPushPayload(message, sub, vapid);
        const res = await fetch(endpoint, payload);
        results.push({ endpoint: endpoint.slice(0, 40), status: res.status });
        if (res.status === 404 || res.status === 410) { delete subs[endpoint]; await this.state.storage.put('subs', subs); }
      } catch (e) {
        results.push({ endpoint: endpoint.slice(0, 40), error: e.message });
      }
    }
    await this.state.storage.put('lastSend', { at: new Date().toISOString(), title, results });
    return { sent: results.length, results };
  }
}
