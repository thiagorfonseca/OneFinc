export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  // Lidar com datas que vem com T (ISO) ou sem
  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
};

export const formatMonthYear = (value: string) => {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!match) return value;
  const year = match[1];
  const monthIndex = Number(match[2]) - 1;
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return value;
  return `${months[monthIndex]}/${year}`;
};

export const getPublicSiteUrl = () => {
  const envUrl = (import.meta as any).env?.VITE_PUBLIC_SITE_URL || (import.meta as any).env?.VITE_SITE_URL || '';
  const fallback = typeof window !== 'undefined' ? window.location.origin : '';
  const raw = (envUrl || fallback || '').trim();
  return raw ? raw.replace(/\/+$/, '') : '';
};

export const getAppUrl = () => {
  const envUrl =
    (import.meta as any).env?.VITE_APP_URL ||
    (import.meta as any).env?.VITE_APP_BASE_URL ||
    (import.meta as any).env?.VITE_APP_SITE_URL ||
    '';
  const fallback = typeof window !== 'undefined' ? window.location.origin : '';
  const raw = (envUrl || '').trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const base = isLocalhost && fallback ? fallback : 'https://app.controleclinic.com.br';
  return base.replace(/\/+$/, '');
};

export const buildPublicUrl = (path: string) => {
  const base = getPublicSiteUrl();
  if (!base) return '';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
};

// Gera um hash simples baseado nos dados da transação para evitar duplicidade
export const generateTransactionHash = (date: string, amount: number, description: string, fitid: string): string => {
  const data = `${date}-${amount}-${description}-${fitid}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
};

// Simple OFX Parser implementation (compatível com OFX SGML sem tags de fechamento)
export const parseOFX = (ofxContent: string) => {
  const transactions: any[] = [];
  if (!ofxContent) return transactions;

  const content = ofxContent.replace(/\r\n/g, '\n');

  const stmtRegex = /<STMTTRN>/gi;
  const positions: Array<{ start: number; len: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = stmtRegex.exec(content)) !== null) {
    positions.push({ start: match.index, len: match[0].length });
  }
  if (!positions.length) return transactions;

  const getTagValue = (block: string, tag: string) => {
    const regex = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
    const m = block.match(regex);
    return m ? m[1].trim() : '';
  };

  const parseAmount = (raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned) return NaN;
    if (cleaned.includes(',') && cleaned.includes('.')) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    }
    return parseFloat(cleaned.replace(',', '.'));
  };

  positions.forEach((pos, idx) => {
    const start = pos.start + pos.len;
    const nextStart = positions[idx + 1]?.start ?? content.length;
    const closeRel = content.slice(start, nextStart).search(/<\/STMTTRN>/i);
    const end = closeRel >= 0 ? start + closeRel : nextStart;
    const block = content.slice(start, end);

    const rawDate = getTagValue(block, 'DTPOSTED');
    const dateDigits = rawDate.match(/\d{8}/)?.[0] || '';
    if (!dateDigits) return;
    const formattedDate = `${dateDigits.substring(0, 4)}-${dateDigits.substring(4, 6)}-${dateDigits.substring(6, 8)}`;

    const amountRaw = getTagValue(block, 'TRNAMT');
    const amount = parseAmount(amountRaw);
    if (!Number.isFinite(amount)) return;

    const fitidRaw = getTagValue(block, 'FITID');
    const memo = getTagValue(block, 'MEMO') || getTagValue(block, 'NAME') || 'Sem descrição';
    const trnType = getTagValue(block, 'TRNTYPE').toUpperCase();
    const inferredType = trnType === 'DEBIT' || trnType === 'CREDIT' ? trnType : (amount < 0 ? 'DEBIT' : 'CREDIT');
    const fitid = fitidRaw || `${dateDigits}-${amount}-${memo}`;

    transactions.push({
      fitid,
      date: formattedDate,
      amount,
      description: memo,
      type: inferredType,
      hash: generateTransactionHash(formattedDate, amount, memo, fitid),
    });
  });

  return transactions;
};

export const getStatusColor = (status: string) => {
  return status === 'paid'
    ? 'bg-green-100 text-green-700'
    : 'bg-yellow-100 text-yellow-700';
};

export const getStatusLabel = (status: string) => {
  return status === 'paid' ? 'Realizado' : 'Pendente';
};
