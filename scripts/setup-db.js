
/**
 * SCRIPT DE CONFIGURAÇÃO AUTOMÁTICA DO BANCO DE DADOS
 * 
 * Atualizado para ES Modules (import/export) para compatibilidade com "type": "module".
 */

import pg from 'pg';
const { Client } = pg;
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import util from 'util';
import { fileURLToPath } from 'url';

// Configuração para __dirname em ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Credenciais fornecidas
const dbConfig = {
  host: 'db.kevzqjffwbcjxvoebfll.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'bFojujJZZaHunsHq',
  ssl: { rejectUnauthorized: false }
};

// Função auxiliar para forçar a descoberta do IP v4
async function getIPv4(host) {
  try {
    const resolve4 = util.promisify(dns.resolve4);
    const addresses = await resolve4(host);
    if (addresses && addresses.length > 0) {
      return addresses[0];
    }
  } catch (err) {
    // Silently fail to fallback
  }
  return host; // Fallback para o hostname original se falhar
}

async function setupDatabase() {
  console.log('🔌 Inicializando conexão...');

  // Resolve o IP antes de conectar para evitar IPv6 timeout
  const hostIP = await getIPv4(dbConfig.host);

  if (hostIP !== dbConfig.host) {
    console.log(`📡 DNS Resolvido: Usando IPv4 ${hostIP} para evitar timeout.`);
    dbConfig.host = hostIP;
  }

  const client = new Client(dbConfig);

  try {
    console.log('⏳ Conectando ao banco de dados Supabase...');
    await client.connect();
    console.log('✅ Conectado com sucesso!');

    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📝 Executando script SQL de criação de tabelas...');
    await client.query(schemaSql);

    console.log('🎉 Tabelas criadas com sucesso!');
    console.log('🔒 Políticas RLS configuradas.');
    console.log('------------------------------------------------');
    console.log('👉 Agora você pode rodar "npm start" para abrir o site.');

  } catch (err) {
    console.error('❌ Erro ao configurar o banco de dados:', err);

    // @ts-ignore
    if (err.code === 'ETIMEDOUT') {
      console.log('\n💡 DICA: Verifique se sua internet está ativa. O firewall da empresa pode estar bloqueando a porta 5432.');
    }
  } finally {
    await client.end();
  }
}

setupDatabase();
