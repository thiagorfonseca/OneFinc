import { json, methodNotAllowed } from '../_utils/http.js';
import { supabaseAdmin } from '../_utils/supabase.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const { data, error } = await supabaseAdmin
    .from('content_packages')
    .select('id, name, description, price_cents, created_at')
    .eq('show_on_public', true)
    .order('created_at', { ascending: false });

  if (error) {
    return json(res, 200, { packages: [] });
  }

  return json(res, 200, { packages: data || [] });
}
