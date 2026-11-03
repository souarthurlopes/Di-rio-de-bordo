# Diário de Bordo — painel multiempresa (versão 0.2)

Sistema web independente, pensado inicialmente para ajudar uma gestora a digitalizar o **Diário de Bordo do Líder VELO BH — Pampulha**. A arquitetura permite múltiplas empresas isoladas; a gestora precisa ter vínculo de administrador com cada empresa que acompanha. **Esta entrega não é ainda um SaaS comercial pronto para produção.**

## Incluído

- Login e cadastro por e-mail com Supabase Auth.
- Criação inicial de uma empresa e sua primeira unidade.
- Alternância entre empresas/unidades vinculadas ao usuário.
- Formulários diários, semanais e mensais fiéis aos **32 itens de verificação** do documento original (11 + 11 + 10).
- Indicadores, observações, ocorrências e campos textuais complementares.
- Salvamento manual de rascunho, retomada e finalização com bloqueio de edição.
- Painel central com empresas acompanhadas, líderes e registros recentes de todas as empresas autorizadas.
- Cadastro de empresas adicionais e suas unidades.
- Convites por link e e-mail, com validade de sete dias, para líderes e gestores.
- Perfis básicos: responsável, gestor e líder; líderes só acessam as unidades atribuídas e seus próprios registros.
- Painel de registros recentes e progresso dos checklists.
- Políticas RLS de isolamento entre empresas e validações de itens/respostas no PostgreSQL.
- Interface responsiva para celular e computador.

## Como rodar

1. Instale Node.js 20 ou superior.
2. Crie um projeto gratuito no [Supabase](https://supabase.com/).
3. Abra o **SQL Editor** e execute, nesta ordem, `supabase/schema.sql`, `supabase/seed_velo.sql` e `supabase/002_gestora_multiempresa.sql`. Se já executou os dois primeiros arquivos antes, execute **somente** a migração `002_gestora_multiempresa.sql`.
4. Em **Authentication > Providers**, habilite e-mail/senha. Para teste, confirme os e-mails via mensagem; caso desative a confirmação, faça isso somente em ambiente de desenvolvimento.
5. Copie `.env.example` para `.env.local`. Insira a URL e a **chave pública anon/publishable** de seu projeto. **Nunca coloque service_role ou secret key no NEXT_PUBLIC_**.
6. Execute `npm install` e `npm run dev`.
7. Abra `http://localhost:3000`, cadastre-se, confirme o e-mail se necessário e crie empresa/unidade.

## Estrutura

- `app/page.tsx`: autenticação, dashboard, acompanhamento e salvamento.
- `app/globals.css`: interface responsiva.
- `lib/supabase.ts`: cliente público Supabase.
- `lib/types.ts`: tipos, períodos e datas.
- `supabase/schema.sql`: tabelas, segurança, funções e regras.
- `supabase/seed_velo.sql`: três modelos VELO completos.

## Limites e próximos passos

**Importante:** o registro é salvo ao clicar no botão; ainda não existe autosave. Os campos de ocorrências e planos de ação são texto livre nesta fase, não listas relacionais. Não há convites/gestão de equipe, construtor de modelos, relatórios em PDF, pagamentos, recuperação administrativa, trilha de auditoria completa ou revisão de acessibilidade.

O painel central agrega no máximo **300 registros recentes** das empresas autorizadas: as contagens de rascunhos/finalizados são apenas dessa amostra, não uma taxa global de adesão. O histórico local mostra até 15 registros da unidade. Cada usuário pode editar apenas os próprios rascunhos, mas membros da mesma empresa podem visualizar os registros da unidade. **Agora há convites por link. O sistema **não envia e-mails automaticamente**: é necessário copiar e encaminhar o link. A conta convidada deve entrar com o e-mail exato do convite.**

Antes de publicar para uso real: testar as políticas RLS com contas de empresas distintas; adicionar gestão/convites de usuários, controle de unidade por usuário, testes de integração, recuperação de senha, proteção contra abuso, política de privacidade e conformidade LGPD. O modelo VELO foi inserido como modelo de referência global; futuramente deve ser copiável/editável por empresa e substituído por modelos genéricos quando necessário.

## Próxima entrega sugerida

Personalização dos modelos por empresa, agendamento e medição de diários esperados versus entregues, envio automatizado de convites e relatórios em PDF.

## Como sua amiga usa o painel

1. Ela se cadastra e cria a primeira empresa. Depois, em **Empresas e unidades**, cadastra outras empresas e unidades.
2. Abre **Líderes**, escolhe uma empresa, informa e-mail, função e unidade e gera o link de convite.
3. Encaminha o link ao líder. Ele se cadastra ou entra com **o mesmo e-mail** e aceita o convite automaticamente.
4. No **Painel da gestora**, consulta os registros de todas as empresas em que tiver papel de responsável ou gestora.
5. Em **Diário de bordo**, os líderes preenchem as verificações do modelo disponível.

**Atenção:** a versão 0.2 ainda usa os modelos VELO como modelos globais de demonstração. Portanto, **não é adequado aplicar esses formulários em outras empresas sem customizá-los**. Os modelos por empresa e o cadastro de verificações são a próxima implementação.

## Segurança e limitações da versão 0.2

- A migração 002 restringe o acesso aos registros e às unidades por perfil. Teste as regras com duas empresas reais fictícias e três contas antes de usar dados pessoais.
- Somente quem tiver acesso administrativo à empresa pode gerar convites. Sua amiga precisará criar as empresas ou receber convites como gestora.
- O cadastro permanece aberto para contas novas; não disponibilize dados sensíveis antes de implementar convites de gestora, logs completos e revisão de segurança.
- Indicadores de atrasos necessitam calendário de obrigatoriedade por líder/unidade; **ainda não foram implementados**, evitando tratar ausência de registro como atraso automaticamente.
- Sem integração de envio de e-mail, sem sistema de cobrança, sem testes automatizados de RLS.
