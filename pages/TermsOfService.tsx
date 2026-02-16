import React from 'react';
import { Link } from 'react-router-dom';

const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-gray-800">Termos de Serviço</h1>
            <p className="text-sm text-gray-500">Última atualização: 16 de fevereiro de 2026</p>
          </div>
          <Link to="/login" className="text-sm text-gray-500 underline">
            Voltar para o login
          </Link>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6 text-sm text-gray-600">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">1. Aceitação</h2>
            <p>
              Ao acessar ou usar a plataforma OneDoctor (OnePay), você concorda com estes Termos e com a Política
              de Privacidade.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">2. Uso da plataforma</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Você é responsável pelas informações inseridas e pela segurança da sua conta.</li>
              <li>É proibido uso indevido, fraude, engenharia reversa ou tentativa de acesso não autorizado.</li>
              <li>O uso deve respeitar leis e normas aplicáveis.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">3. Conta e acesso</h2>
            <p>
              Sua conta pode ser suspensa em caso de violação destes Termos ou por motivos legais. Você deve manter
              seus dados atualizados.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">4. Planos, pagamentos e cancelamento</h2>
            <p>
              Planos, preços e condições podem variar. Cancelamentos ou suspensões seguem as regras do seu contrato
              comercial com a OneDoctor.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">5. Propriedade intelectual</h2>
            <p>
              Todo o conteúdo, marca e tecnologia da plataforma são de propriedade da OneDoctor ou licenciados.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">6. Limitação de responsabilidade</h2>
            <p>
              A plataforma é fornecida “como está”. Não nos responsabilizamos por perdas indiretas decorrentes de
              uso inadequado, falhas de terceiros ou indisponibilidades fora do nosso controle.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">7. Atualizações</h2>
            <p>
              Podemos atualizar estes Termos periodicamente. O uso contínuo da plataforma indica concordância com a
              versão vigente.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">8. Contato</h2>
            <p>
              Dúvidas sobre estes Termos podem ser enviadas para suporte@onedoctor.com.br.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
