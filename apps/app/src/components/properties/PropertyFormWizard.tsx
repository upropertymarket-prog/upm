"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Tabs, type TabItem } from "@upm/ui";
import {
  PROPERTY_CONDITIONS,
  type CharacteristicsStepInput,
  type IdentificationStepInput,
  type LocationStepInput,
  type PriceStepInput,
} from "@upm/db/properties";

import type { PropertyDraft, PropertyFormActions, PropertyMediaItem } from "./PropertyFormActions";
import { IdentificationStep } from "./steps/IdentificationStep";
import { CharacteristicsStep } from "./steps/CharacteristicsStep";
import { LocationStep } from "./steps/LocationStep";
import { PriceStep } from "./steps/PriceStep";
import { PhotosStep } from "./steps/PhotosStep";

/**
 * Só os ids dos passos, pela ordem do wizard. Os rótulos saíram daqui a 20 out
 * 2026 (D72) — uma constante de módulo é avaliada no arranque e ficava presa ao
 * idioma em que foi escrita. Os ids continuam aqui porque são eles que a lógica
 * usa: decidem qual a Server Action que grava cada passo.
 */
const STEP_IDS = [
  "identificacao",
  "caracteristicas",
  "localizacao",
  "preco",
  "fotografias",
] as const;

/**
 * `property_type`, `typology` e `condition` são `text` na base de dados, com os
 * valores em português fechados em `@upm/db/properties` (07 §17.2). O default
 * da condição vem da própria lista em vez de repetir o literal: são dados, não
 * um rótulo, e uma segunda cópia divergia da validação do `zod` em silêncio.
 */
const EMPTY_IDENTIFICATION: IdentificationStepInput = {
  title: "",
  deal: "sale",
  property_type: "Apartamento",
  typology: "T1",
  condition: PROPERTY_CONDITIONS[1],
  description: "",
};

const EMPTY_CHARACTERISTICS: CharacteristicsStepInput = {
  gross_area: null,
  net_area: null,
  bedrooms: null,
  bathrooms: null,
  floor: null,
  year_built: null,
  energy_cert: null,
  amenities: [],
};

const EMPTY_LOCATION: LocationStepInput = {
  address_line: "",
  postal_code: "",
  city: "",
  parish: "",
  district: "",
  show_exact: false,
};

const EMPTY_PRICE: PriceStepInput = {
  price_cents: null,
  rent_cents: null,
  condo_fee_cents: null,
  imi_cents: null,
  accepts_offers: false,
};

function draftToIdentification(draft: PropertyDraft): IdentificationStepInput {
  return {
    title: draft.title,
    deal: draft.deal,
    property_type: draft.property_type as IdentificationStepInput["property_type"],
    typology: draft.typology as IdentificationStepInput["typology"],
    condition: draft.condition as IdentificationStepInput["condition"],
    description: draft.description,
  };
}

function draftToCharacteristics(draft: PropertyDraft): CharacteristicsStepInput {
  return {
    gross_area: draft.gross_area,
    net_area: draft.net_area,
    bedrooms: draft.bedrooms,
    bathrooms: draft.bathrooms,
    floor: draft.floor,
    year_built: draft.year_built,
    energy_cert: draft.energy_cert,
    amenities: draft.amenities,
  };
}

function draftToLocation(draft: PropertyDraft): LocationStepInput {
  return {
    address_line: draft.address_line ?? "",
    postal_code: draft.postal_code ?? "",
    city: draft.city ?? "",
    parish: draft.parish ?? "",
    district: draft.district ?? "",
    show_exact: draft.show_exact,
  };
}

function draftToPrice(draft: PropertyDraft): PriceStepInput {
  return {
    price_cents: draft.price_cents,
    rent_cents: draft.rent_cents,
    condo_fee_cents: draft.condo_fee_cents,
    imi_cents: draft.imi_cents,
    accepts_offers: draft.accepts_offers,
  };
}

export type PropertyFormWizardProps = {
  actions: PropertyFormActions;
  initialValue?: PropertyDraft;
  initialMedia?: PropertyMediaItem[];
};

/**
 * Wizard de 5 passos do formulário "Nova propriedade" (P4-02).
 * =========================================================================
 * Recebe as Server Actions por prop (nunca as importa diretamente — regra da
 * Fase 3, 08 §7.3). Sem `initialValue`, cria um rascunho assim que monta, para
 * ter um `propertyId` estável desde o primeiro passo (os uploads de
 * fotografias/documentos precisam dele).
 */
export function PropertyFormWizard({
  actions,
  initialValue,
  initialMedia,
}: PropertyFormWizardProps) {
  const t = useTranslations("newProperty");
  const stepItems: TabItem[] = STEP_IDS.map((id) => ({ id, label: t(`steps.${id}`) }));

  const [propertyId, setPropertyId] = useState<string | null>(initialValue?.id ?? null);
  const [currentStep, setCurrentStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stepError, setStepError] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);

  const [identification, setIdentification] = useState<IdentificationStepInput>(
    initialValue ? draftToIdentification(initialValue) : EMPTY_IDENTIFICATION,
  );
  const [characteristics, setCharacteristics] = useState<CharacteristicsStepInput>(
    initialValue ? draftToCharacteristics(initialValue) : EMPTY_CHARACTERISTICS,
  );
  const [location, setLocation] = useState<LocationStepInput>(
    initialValue ? draftToLocation(initialValue) : EMPTY_LOCATION,
  );
  const [price, setPrice] = useState<PriceStepInput>(
    initialValue ? draftToPrice(initialValue) : EMPTY_PRICE,
  );
  const [media, setMedia] = useState<PropertyMediaItem[]>(initialMedia ?? []);

  useEffect(() => {
    if (initialValue || propertyId || creating) return;
    setCreating(true);
    void actions.createDraft().then((result) => {
      setCreating(false);
      if ("error" in result) {
        setStepError(result.error);
        return;
      }
      setPropertyId(result.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só corre uma vez, ao montar sem initialValue
  }, []);

  async function saveCurrentStep(): Promise<boolean> {
    if (!propertyId) {
      setStepError(t("draftNotReady"));
      return false;
    }

    setSaving(true);
    setStepError(undefined);
    setNotice(undefined);

    let result: { error?: string };
    switch (STEP_IDS[currentStep]) {
      case "identificacao":
        result = await actions.saveIdentification(propertyId, identification);
        break;
      case "caracteristicas":
        result = await actions.saveCharacteristics(propertyId, characteristics);
        break;
      case "localizacao":
        result = await actions.saveLocation(propertyId, location);
        break;
      case "preco":
        result = await actions.savePrice(propertyId, price);
        break;
      default:
        result = {};
    }

    setSaving(false);

    if (result.error) {
      // O passo de localização pode gravar com sucesso e ainda assim avisar
      // que o geocoding falhou — mostra-se como aviso, não bloqueia o avanço.
      if (STEP_IDS[currentStep] === "localizacao") {
        setNotice(result.error);
        return true;
      }
      setStepError(result.error);
      return false;
    }
    return true;
  }

  async function handleNext() {
    const ok = await saveCurrentStep();
    if (ok && currentStep < STEP_IDS.length - 1) {
      setCurrentStep((step) => step + 1);
    }
  }

  async function handleSaveDraft() {
    await saveCurrentStep();
  }

  async function handlePublish() {
    if (!propertyId) return;
    setSaving(true);
    setStepError(undefined);
    const result = await actions.publish(propertyId);
    setSaving(false);
    if (result.error) {
      setStepError(result.error);
      return;
    }
    setNotice(t("sentForReview"));
  }

  const isLastStep = currentStep === STEP_IDS.length - 1;

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        label={t("tabsLabel")}
        items={stepItems}
        value={STEP_IDS[currentStep] ?? STEP_IDS[0]}
        onValueChange={(id) => {
          const index = STEP_IDS.indexOf(id as (typeof STEP_IDS)[number]);
          if (index >= 0) setCurrentStep(index);
        }}
      />

      {creating ? <p>{t("creatingDraft")}</p> : null}
      {stepError ? (
        <p className="upm-field__error" role="alert">
          {stepError}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}

      <div className="flex flex-col gap-4">
        {currentStep === 0 ? (
          <IdentificationStep value={identification} onChange={setIdentification} />
        ) : null}
        {currentStep === 1 ? (
          <CharacteristicsStep value={characteristics} onChange={setCharacteristics} />
        ) : null}
        {currentStep === 2 ? <LocationStep value={location} onChange={setLocation} /> : null}
        {currentStep === 3 ? <PriceStep value={price} onChange={setPrice} /> : null}
        {currentStep === 4 && propertyId ? (
          <PhotosStep
            propertyId={propertyId}
            media={media}
            onMediaChange={setMedia}
            actions={{
              uploadMedia: actions.uploadMedia,
              reorderMedia: actions.reorderMedia,
              setCoverMedia: actions.setCoverMedia,
              deleteMedia: actions.deleteMedia,
            }}
          />
        ) : null}
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => void handleSaveDraft()} disabled={saving}>
          {t("saveDraft")}
        </Button>
        {!isLastStep ? (
          <Button onClick={() => void handleNext()} disabled={saving}>
            {t("next")}
          </Button>
        ) : (
          <Button onClick={() => void handlePublish()} disabled={saving}>
            {t("publish")}
          </Button>
        )}
      </div>
    </div>
  );
}
