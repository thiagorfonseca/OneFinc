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

// Simple OFX Parser implementation
export const parseOFX = (ofxContent: string) => {
  const transactions: any[] = [];

  // Basic regex to find STMTTRN blocks
  const transactionBlockRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  const matches = [...ofxContent.matchAll(transactionBlockRegex)];

  matches.forEach((match) => {
    const block = match[1];

    // Extract fields
    const dateMatch = block.match(/<DTPOSTED>(.*)/);
    const amountMatch = block.match(/<TRNAMT>(.*)/);
    const fitidMatch = block.match(/<FITID>(.*)/);
    const memoMatch = block.match(/<MEMO>(.*)/);

    if (amountMatch && dateMatch && fitidMatch) {
      const rawDate = dateMatch[1].trim().substring(0, 8); // YYYYMMDD
      const formattedDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;

      const amount = parseFloat(amountMatch[1].replace(',', '.'));
      const fitid = fitidMatch[1].trim();
      const description = memoMatch ? memoMatch[1].trim() : 'Sem descrição';

      transactions.push({
        fitid: fitid,
        date: formattedDate,
        amount: amount,
        description: description,
        type: amount < 0 ? 'DEBIT' : 'CREDIT',
        hash: generateTransactionHash(formattedDate, amount, description, fitid)
      });
    }
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
