import { publicProcedure, router } from '../init';
import { exportDiagnosticZip } from '../../services/diagnostic';

export const diagnosticRouter = router({
  export: publicProcedure.mutation(() => exportDiagnosticZip()),
});
