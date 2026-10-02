/**
 * Tipos partilhados do step-up — P8-07
 * =========================================================================
 * Vivem num ficheiro à parte e não na Server Action porque o modal corre no
 * cliente **e no canvas**: importar o módulo da action arrastaria `next/headers`
 * para dentro do bundle do canvas e quebrava a renderização de todos os
 * storyboards do Admin, não só os do step-up.
 */

export type StepUpState = { ok?: boolean; error?: string; retryAfterSeconds?: number };

/** A assinatura que o modal espera — a mesma de uma Server Action de formulário. */
export type VerifyPinAction = (prev: StepUpState, formData: FormData) => Promise<StepUpState>;
