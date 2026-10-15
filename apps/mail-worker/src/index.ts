import { purgeExpiredAttachments } from "./attachments.ts";
import { drainCampaigns } from "./campaigns.ts";
import { readEnv } from "./env.ts";
import { drainOutbox } from "./outbox.ts";
import { createWorkerServer } from "./server.ts";
import { createServiceClient } from "./supabase.ts";
import { syncAllMailboxes } from "./sync.ts";

/**
 * O arranque do mail-worker (P10-03 · 02 §3.2)
 * =========================================================================
 * Um processo, cinco trabalhos: servir os pedidos do Admin, sincronizar as
 * caixas de tempos a tempos, drenar a fila de saída, entregar as campanhas e
 * apagar os anexos que passaram o prazo de reteção.
 *
 * **Os ciclos não se sobrepõem a si próprios.** Cada um só volta a agendar-se
 * quando o anterior acabou (`setTimeout` encadeado, nunca `setInterval`): uma
 * sincronização que demore seis minutos com um intervalo de cinco daria duas
 * passagens a disputar a mesma caixa, e a Amen a recusar a segunda ligação.
 *
 * **Um erro de ciclo não derruba o processo.** Cada passagem apanha o seu
 * próprio erro e escreve-o; o worker continua vivo para a próxima. Um worker
 * que morre à primeira caixa mal configurada deixa as outras sem correio.
 *
 * ## Porque é que este processo deixou de correr com `node src/index.ts`
 *
 * Até P10-08 corria em TypeScript direto, com o `strip-types` do Node — que
 * apaga os tipos e mais nada. As campanhas trouxeram
 * `@upm/db/campaign-render`, que é **React Email** e portanto `.tsx`, e JSX não
 * é um tipo: é sintaxe que precisa de ser transformada. O `strip-types` não a
 * sabe ler e o processo morria no `import`.
 *
 * Duas mudanças, as duas pequenas: `tsx` em desenvolvimento e `esbuild` em
 * produção, que empacota o worker e o `@upm/db` num ficheiro e deixa as
 * dependências de `npm` de fora. A alternativa era reescrever o renderizador
 * sem JSX — 400 linhas de `createElement` — ou ter dois renderizadores, que é
 * precisamente o que P10-08 passou a tarefa toda a evitar.
 */

const env = readEnv();
const client = createServiceClient(env);

const server = createWorkerServer(client, env);
server.listen(env.PORT, () => {
  log("info", `mail-worker à escuta na porta ${env.PORT}`);
  log(
    "info",
    env.RESEND_API_KEY
      ? "Resend configurado — a fila de saída vai ser drenada."
      : "Sem RESEND_API_KEY: a fila de saída fica por drenar (D27).",
  );
});

loop("sync", env.SYNC_INTERVAL_MINUTES, async () => {
  const reports = await syncAllMailboxes(client, { batch: env.SYNC_BATCH });
  for (const report of reports) {
    if (report.error) {
      log("error", `caixa ${report.address}: ${report.error}`);
    } else if (report.inserted > 0) {
      log("info", `caixa ${report.address}: ${report.inserted} mensagem(ns) nova(s)`);
    }
  }
});

loop("outbox", env.OUTBOX_INTERVAL_MINUTES, async () => {
  const report = await drainOutbox(client, env, { batch: env.OUTBOX_BATCH });
  if (report.reason) return;
  if (report.sent > 0 || report.failed > 0) {
    log("info", `fila de saída: ${report.sent} enviado(s), ${report.failed} falhado(s)`);
  }
});

/**
 * As campanhas (P10-08). Ciclo próprio e não dentro do da fila de saída: são
 * duas filas com ritmos diferentes — uma notificação transacional é urgente e
 * pequena, uma campanha é um lote grande que pode levar horas a sair. Um lote
 * de campanha a atrasar um aviso de visita era o pior dos dois mundos.
 */
loop("campaigns", env.CAMPAIGN_INTERVAL_MINUTES, async () => {
  const report = await drainCampaigns(client, env, { batch: env.CAMPAIGN_BATCH });

  // Os agendamentos disparam mesmo sem Resend configurado (põem a campanha em
  // envio e materializam destinatários), por isso dizem-se mesmo quando o resto
  // da passagem parou por falta de chave.
  if (report.fired > 0) {
    log("info", `agendamentos: ${report.fired} campanha(s) posta(s) em envio`);
  }

  if (report.reason) return;
  if (report.sent > 0 || report.failed > 0 || report.advanced > 0) {
    log(
      "info",
      `campanhas: ${report.sent} enviado(s), ${report.failed} falhado(s)` +
        (report.advanced > 0 ? `, ${report.advanced} na sequência seguinte` : ""),
    );
  }
});

/**
 * A purga dos anexos (D66). De seis em seis horas por omissão: a reteção
 * mede-se em dias e uma passagem por turno é mais do que suficiente. Corre no
 * worker e não em `pg_cron` porque apagar uma linha de `storage.objects` não
 * apaga os bytes — ver `attachments.ts`.
 */
loop("attachments", env.PURGE_INTERVAL_MINUTES, async () => {
  const report = await purgeExpiredAttachments(client, { batch: env.PURGE_BATCH });
  if (report.error) {
    log("error", `purga de anexos: ${report.error}`);
    return;
  }
  if (report.objects > 0) {
    log(
      "info",
      `purga de anexos: ${report.objects} ficheiro(s) de ${report.messages} mensagem(ns)`,
    );
  }
});

function loop(name: string, minutes: number, work: () => Promise<void>): void {
  const run = async () => {
    try {
      await work();
    } catch (error) {
      log("error", `ciclo ${name} falhou: ${error instanceof Error ? error.message : error}`);
    } finally {
      setTimeout(run, minutes * 60_000).unref();
    }
  };
  void run();
}

function log(level: "info" | "error", message: string): void {
  // Uma linha JSON por evento: é o que os agregadores de logs do Fly/Railway
  // leem sem configuração. Nunca inclui credenciais — ver `describe()`.
  const line = JSON.stringify({ at: new Date().toISOString(), level, message });
  if (level === "error") console.error(line);
  else console.log(line);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    log("info", `${signal} recebido — a fechar.`);
    server.close(() => process.exit(0));
  });
}
