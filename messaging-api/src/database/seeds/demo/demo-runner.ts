import 'dotenv/config';
import { DataSource } from 'typeorm';
import { validateEnvironment } from '../../../config/environment';
import { databaseOptions } from '../../database.options';
import { DemoCommand } from './demo-data';
import { DemoScenarioError, runDemoScenario } from './demo-scenarios';

async function main() {
  let database: DataSource | undefined;
  try {
    if (process.env.NODE_ENV === 'production')
      throw new DemoScenarioError(
        'Cenários disponíveis somente em ambiente local de demonstração.',
      );
    const command = process.argv[2];
    if (!['pending', 'released', 'failed', 'reset'].includes(command))
      throw new DemoScenarioError(
        'Use demo:pending, demo:released, demo:failed ou demo:reset.',
      );
    database = new DataSource(
      databaseOptions(validateEnvironment(process.env)),
    );
    await database.initialize();
    const result = await runDemoScenario(database, command as DemoCommand);
    console.log(`Cenário: ${result.scenario}\n`);
    if ('patientsCreated' in result) {
      console.log(`Pacientes criados: ${result.patientsCreated}`);
      console.log(`Exames criados: ${result.examsCreated}`);
      console.log(`Registros existentes: ${result.existingRecords}`);
      console.log('\nCenário preparado com sucesso.');
      console.log(
        command === 'pending'
          ? 'Atualize o dashboard: estes exames aguardam liberação e não recebem notificações.'
          : 'Atualize o dashboard e clique em "Processar pendentes".',
      );
      if (command === 'failed')
        console.log(
          'Um exame fictício rejeita o envio no mock; os outros dois podem ser notificados normalmente.',
        );
      console.log(
        'Estados e históricos existentes foram preservados. Para repetir do início, execute demo:reset.',
      );
    } else {
      console.log(`Pacientes removidos: ${result.patientsRemoved}`);
      console.log(
        `Pacientes preservados por vínculos adicionais: ${result.patientsPreserved}`,
      );
      console.log(`Exames removidos: ${result.examsRemoved}`);
      console.log(
        `Mensagens dos cenários removidas: ${result.messagesRemoved}`,
      );
      console.log(
        '\nReset concluído. Seed padrão, templates e dados externos foram preservados. Atualize o dashboard.',
      );
    }
  } catch (error) {
    console.error(
      error instanceof DemoScenarioError
        ? error.message
        : 'Não foi possível preparar o cenário. Verifique a configuração do banco, a conexão e as migrations (npm run setup).',
    );
    process.exitCode = 1;
  } finally {
    if (database?.isInitialized) {
      try {
        await database.destroy();
      } catch {
        console.error('Não foi possível encerrar a conexão com o banco.');
        process.exitCode = 1;
      }
    }
  }
}
void main();
