import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-gray-800">Política de Privacidade</h1>
            <p className="text-sm text-gray-500">Última atualização: 16 de fevereiro de 2026</p>
          </div>
          <Link to="/login" className="text-sm text-gray-500 underline">
            Voltar para o login
          </Link>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6 text-sm text-gray-600">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">1. Quem somos</h2>
            <p>
              A OneDoctor (OnePay) oferece soluções digitais para gestão de clínicas. Esta Política explica como
              coletamos, usamos e protegemos informações pessoais quando você usa nossa plataforma e serviços.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">2. Dados que coletamos</h2>
            <p>Podemos coletar dados como:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Dados de cadastro: nome, e-mail, telefone, CPF/CNPJ, empresa e endereço.</li>
              <li>Dados operacionais: agendas, serviços, pagamentos, contratos e comunicações.</li>
              <li>Dados técnicos: registros de acesso, IP, dispositivo, navegador e cookies.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">3. Como usamos os dados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Prestar os serviços contratados e operar a plataforma.</li>
              <li>Gerenciar contas, contratos, pagamentos e comunicações.</li>
              <li>Melhorar a experiência, segurança e desempenho do sistema.</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">4. Compartilhamento</h2>
            <p>
              Podemos compartilhar dados com fornecedores essenciais (ex.: meios de pagamento, assinatura digital,
              envio de e-mail) e autoridades, quando exigido por lei. Não vendemos dados pessoais.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">5. Base legal</h2>
            <p>
              O tratamento de dados ocorre com base em execução de contrato, consentimento quando aplicável e
              cumprimento de obrigações legais.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">6. Segurança</h2>
            <p>
              Adotamos medidas técnicas e organizacionais para proteger dados contra acessos não autorizados,
              perda, alteração ou divulgação indevida.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">7. Retenção</h2>
            <p>
              Mantemos os dados pelo tempo necessário para cumprir as finalidades deste documento e exigências
              legais/regulatórias.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">8. Seus direitos</h2>
            <p>
              Você pode solicitar acesso, correção, exclusão, portabilidade e outras ações previstas em lei.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">9. Cookies</h2>
            <p>
              Usamos cookies para autenticação, segurança e melhoria de experiência. Você pode gerenciar cookies
              no seu navegador.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">10. Contato</h2>
            <p>
              Para dúvidas ou solicitações, entre em contato pelo e-mail suporte@onedoctor.com.br.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-800">11. Alterações</h2>
            <p>
              Podemos atualizar esta política periodicamente. A data de atualização será sempre informada no topo.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
