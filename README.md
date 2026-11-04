# Diário de Bordo

## Escopo atual

Painel, cadastro unificado de Clientes e suas pessoas responsáveis, registros, ocorrências e construtor de questionários. Os formulários originais diário, semanal e mensal são a base de perguntas e podem ser copiados no construtor para personalização. Não há associação visual ou textual com marca de empresa. A demonstração permanece sem banco, login ou acesso privado real; os dados ficam somente na memória da aba.

# Diário de Bordo — v0.3

## Modo demonstração sem banco (padrão)

A página inicial agora abre diretamente a demonstração, sem conta, login, variáveis de ambiente ou Supabase. Ela permite navegar, preencher os três formulários de diário de bordo, criar modelos temporários, simular empresas/unidades/líderes/ocorrências e consultar rascunhos ou registros finalizados da sessão.

**Os dados ficam apenas em memória e desaparecem ao atualizar ou fechar a aba.** Não há localStorage, gravação no servidor, envio de convites, autenticação ou compartilhamento entre aparelhos. Use somente informações de teste. A interface identifica claramente esse modo.

Para publicar a demonstração na Vercel: importe este repositório como Next.js, raiz do repositório, Node 24, npm ci e npm run build. Nenhuma variável é necessária. A página inicial não exige nenhuma variável de ambiente.

O código anterior com banco e suas migrations foi preservado em components/connected-app.tsx como referência. A página inicial usa a demonstração sem banco. As seções de configuração de banco abaixo são opcionais e não se aplicam à demonstração.



Continuação do projeto enviado em diario-de-bordo-saas-v02.zip. Este repositório contém o sistema completo. Use sua raiz como Root Directory na Vercel. O README original está em README-v02-original.md.

Plataforma independente de acompanhamento de líderes.

## Stack e execução

Next.js 15 App Router, React 19, TypeScript, Tailwind 4, CSS da identidade original, Supabase Auth/PostgreSQL/RLS, Recharts e Lucide. Node.js **24** é recomendado (necessário para executar os testes TypeScript nativos sem transpiler).

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Preencha URL e chave pública anon/publishable do Supabase em .env.local. Nunca use a chave service_role no navegador ou nas variáveis NEXT_PUBLIC. Dados comerciais ficam no PostgreSQL. A persistência de sessão é gerenciada pelo SDK Supabase; localStorage não é usado como banco da aplicação.

## Instalação do banco

Em um projeto Supabase **novo**, execute no SQL Editor, nesta ordem:

1. supabase/schema.sql
2. supabase/seed_diarios.sql (uma vez; o seed original não é idempotente)
3. supabase/002_gestora_multiempresa.sql
4. supabase/003_versions_security.sql

Se a v0.2 já estiver instalada, faça backup e aplique **somente 003_versions_security.sql** em homologação antes de produção. Não execute novamente schema.sql ou seed_diarios.sql. A migration 003 é transacional e deve ser aplicada uma única vez.

Ela preserva empresas, vínculos, unidades, modelos e respostas existentes. As respostas antigas são copiadas de details/entry_answers para entries.responses e ligadas à primeira versão imutável. Os dados de origem são mantidos para conferência. Históricos sem prazo permanecem sem prazo — não recebem atraso fictício. O cliente v0.2 deixa de salvar após 003, pois as gravações passam exclusivamente pelas RPCs; publique o cliente v0.3 junto com a migration.

### Autorizar a gestora

Crie e confirme a conta por Supabase Auth ou pela tela de cadastro. Depois, no SQL Editor:

```sql
insert into public.platform_managers(user_id)
values ('UUID_DA_GESTORA')
on conflict do nothing;
```

Os owners existentes da v0.2 são preservados como gestoras autorizadas. Em uma instalação nova, ninguém pode se promover usando a interface. Estar em platform_managers permite criar empresas, mas não permite consultar empresas de terceiros: o acesso exige membership em cada empresa.

Perfis preservados do banco original:

- owner: gestora vinculada à empresa.
- manager: administrador daquela empresa.
- member: líder, com unidades explicitamente autorizadas.

## Fluxo de uso

1. Entre como gestora provisionada. Cadastre empresas e unidades.
2. Em Líderes, gere convite para o e-mail e perfil desejados. Para líderes, selecione a unidade.
3. Copie o link e envie manualmente. Não há envio automático de e-mail implementado.
4. O convidado cria sua conta, confirma o e-mail e abre o link autenticado com o mesmo endereço. O convite expira em sete dias e só pode ser aceito uma vez.
5. Em Modelos de diário, crie perguntas/categorias ou carregue uma versão. Modelos de referência são copiadas para a empresa, sem modificar o original.
6. Publique a versão. Tipos: texto/observações, Sim/Não, número, data, seleção e checklist; obrigatoriedade e ordenação por pergunta.
7. Em Ocorrências e ações, atribua um modelo/versão a um líder autorizado na unidade, com período e prazo.
8. O líder abre Diário de bordo, continua uma atribuição ou inicia um registro espontâneo, salva rascunho ou finaliza.
9. A gestora consulta pelo painel ou pela lista de líderes. Cada finalizado usa a versão original, inclusive nome, frequência e perguntas.

A edição de empresa/unidade está em Empresas e unidades. Autorizações de líderes por unidade e revogação de convites ficam em Líderes. Revogar uma unidade impede futuras consultas e gravações do líder nela; o histórico permanece disponível para a gestão.

## Periodicidade, prazo e indicadores

Diário usa a data selecionada; semanal inicia na segunda-feira; mensal no primeiro dia; personalizado usa a data explicitamente escolhida. A normalização é aplicada também no servidor. A restrição de unicidade impede duplicação por empresa/unidade/modelo/autor/período, inclusive entre versões diferentes.

Atribuições são explícitas nesta versão; não há scheduler gerando diários automaticamente. Seus prazos usam Brasília (UTC−03). Registros espontâneos e históricos sem prazo não são classificados como atrasados. Futuramente, o fuso será configurável por empresa.

Situação: concluído tem precedência sobre vencimento; atraso ocorre somente com prazo passado; rascunhos com respostas ficam em andamento; atribuições sem respostas ficam pendentes. Respostas zero e false contam como preenchidas.

O dashboard filtra empresa, unidade, líder, período, situação e modelo. A tabela mostra o último registro por líder/unidade dentro dos filtros. Os relatórios usam até 1.000 registros recentes autorizados; o limite é informado na interface. Empresas, unidades e líderes acompanham o filtro de empresa. Totais de ocorrências e planos representam todo o escopo autorizado. Não há indicadores fictícios.

Taxa de conclusão é calculada sobre registros existentes, incluindo atribuições. Não representa obrigações de períodos que ainda não foram atribuídos. A lista de diários mostra até 500 registros por empresa; paginação será uma próxima melhoria. Indicadores cadastrados têm histórico e gráfico por nome/unidade em Ocorrências e ações.

## Segurança

- RLS em todas as tabelas de negócio e em platform_managers.
- Gestoras e administradores só acessam empresas com vínculo.
- Líderes consultam somente seus registros e unidades autorizadas.
- Ações críticas usam funções PostgreSQL com verificações de auth.uid, vínculo, perfil, unidade e versão, sem confiar na interface.
- save_diary salva todas as respostas e o status na mesma transação.
- Atribuição, publicação e convites também são validados pelo servidor.
- Campos obrigatórios, tipos, datas e opções são validados no banco.
- Registros finalizados são imutáveis, e versões antigas não têm políticas de alteração.
- Audit log registra alterações de diários, publicação, ocorrências e mudanças de acesso por unidade.
- Acesso direto de escrita em entries e entry_answers foi removido. Todas as gravações de diário passam pelas RPCs.
- O serviço não precisa de service_role.

## Testes

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Testes de domínio cobrem vencimento, conclusão histórica, zero/false e períodos. Testes de banco executam os quatro SQLs em PostgreSQL local via PGlite, com schema Auth mínimo e papéis authenticated/anon simulados. O harness omite apenas CREATE EXTENSION pgcrypto: gen_random_uuid já existe no PostgreSQL local.

A suíte testa upgrade com dados legados, duas empresas, convites por e-mail confirmado, negação de autopromoção, isolamento de leitura, submissão, campos obrigatórios/tipos, preservação de versão, imutabilidade após finalizar, revogação de unidade e convite e bloqueio de escrita direta.

PGlite não substitui homologação com Supabase Auth e PostgREST reais. Nenhum banco externo foi alterado e nenhum deploy foi realizado.

## Publicação na Vercel

1. Envie **este diretório** para seu repositório Git.
2. Importe na Vercel como Next.js. Se publicar o workspace inteiro, configure Root Directory como diario-de-bordo-saas.
3. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para o ambiente desejado.
4. Configure Site URL e Redirect URLs em Supabase Auth para o domínio da aplicação. Mantenha confirmação de e-mail habilitada.
5. Aplique as migrations e provisione a gestora antes da homologação.
6. Execute os quatro comandos de validação e publique.
7. Homologue com gestora, administrador e líderes de duas empresas: cadastro, convite, preenchimento, finalização, consulta e tentativa de acesso cruzado.

## Próximas etapas e limites

- Homologação no Supabase/Vercel reais, incluindo entrega de e-mail de confirmação.
- PDF e relatórios exportáveis.
- Scheduler de recorrência e calendário/fuso por empresa.
- Paginação completa e relatórios sobre todo o histórico.
- Ordenação de categorias como blocos: hoje a sequência acompanha a ordem das perguntas; use Subir para organizar.
- Planos de ação têm descrição, prazo e conclusão nesta versão; vínculo com ocorrência e responsável são evolução posterior.
- Recuperação de senha e envio automático de convites.
- Auditoria de todos os cadastros e métricas de atividades por tipo de pergunta.

Os três modelos de diário de bordo e seus campos específicos foram preservados. As categorias de indicadores dos formulários semanais e mensais foram incorporadas às versões sem inventar novos itens.

## Resultado nesta entrega

Instalação, lint sem avisos, TypeScript, seis testes de domínio, 30 verificações de banco e build de produção passaram. O servidor iniciou e a rota / respondeu HTTP 200. O fluxo autenticado real ainda depende das credenciais do Supabase. Evidências e limites em VALIDACAO.md.

## GitHub e deploy automático

Repositório do sistema completo: https://github.com/souarthurlopes/Di-rio-de-bordo

Importe esse repositório na Vercel, com framework Next.js e Root Directory na raiz (deixe vazio). Node.js 24.x, instalação npm ci e build npm run build. O projeto não contém .openai/hosting.json nem depende de Sites.

Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em Settings → Environment Variables para Production e Preview. Depois faça Redeploy para incorporar as variáveis públicas ao bundle. Sem essas variáveis, o site exibe Configuração pendente; o deploy não cria banco ou contas automaticamente.

Mantenha as variáveis .env.local fora do Git. Mudanças enviadas à branch main poderão gerar deploys automáticos pela integração Git da Vercel.

## Interface e preenchimento por etapas

A demonstração usa organização visual inspirada no Trilha Apostólica, mantendo identidade e conteúdo próprios. O preenchimento segue seleção de modelo → categorias → revisão → finalização. Respostas Sim/Não usam botões; rascunhos e modelos personalizados continuam temporários. Registros finalizados permanecem somente para consulta na sessão.

## Cadastro unificado de clientes

A demonstração reúne empresas e pessoas na tela Clientes. Ao cadastrar um cliente, adicione líderes e funcionários no mesmo formulário, com nome, e-mail obrigatório, função e unidade/equipe opcional. O cadastro pode ser editado e não aceita e-mails repetidos dentro do mesmo cliente.

Antes do preenchimento, selecione o cliente e a pessoa responsável. O registro guarda uma cópia do nome e e-mail da pessoa para manter sua identificação mesmo após edições cadastrais. Na demonstração, esses vínculos não criam usuários, convites ou acesso privado. Autenticação real continua fora do escopo desta versão sem banco.
