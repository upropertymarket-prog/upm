"use client";

import { useRouter } from "next/navigation";

import { ContractEditor, type ContractEditorProps } from "./ContractEditor";

/**
 * O editor precisa de saber voltar à lista, e "voltar" é navegação — uma
 * função que um Server Component não pode passar por prop. Este invólucro
 * existe só para isso: dar-lhe o `router`. Tudo o resto atravessa-o inteiro.
 */
export function ContractEditorClient(props: Omit<ContractEditorProps, "onBack">) {
  const router = useRouter();
  return <ContractEditor {...props} onBack={() => router.push("/contratos")} />;
}
