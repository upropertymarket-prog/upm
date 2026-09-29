"use client";

import { useEffect, useState } from "react";
import { Button, Tabs, type TabItem } from "@upm/ui";
import type {
  CharacteristicsStepInput,
  IdentificationStepInput,
  LocationStepInput,
  PriceStepInput,
} from "@upm/db/properties";

import type { PropertyDraft, PropertyFormActions, PropertyMediaItem } from "./PropertyFormActions";
import { IdentificationStep } from "./steps/IdentificationStep";
import { CharacteristicsStep } from "./steps/CharacteristicsStep";
import { LocationStep } from "./steps/LocationStep";
import { PriceStep } from "./steps/PriceStep";
import { PhotosStep } from "./steps/PhotosStep";

const STEP_ITEMS: TabItem[] = [
  { id: "identificacao", label: "Identificação" },
  { id: "caracteristicas", label: "Características" },
  { id: "localizacao", label: "Localização" },
  { id: "preco", label: "Preço" },
  { id: "fotografias", label: "Fotografias" },
];

const EMPTY_IDENTIFICATION: IdentificationStepInput = {
  title: "",
  deal: "sale",
  property_type: "Apartamento",
  typology: "T1",
  condition: "Usado — bom estado",
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
      setStepError("Rascunho ainda não foi criado. Aguarda um instante e tenta novamente.");
      return false;
    }

    setSaving(true);
    setStepError(undefined);
    setNotice(undefined);

    let result: { error?: string };
    switch (STEP_ITEMS[currentStep]?.id) {
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
      if (STEP_ITEMS[currentStep]?.id === "localizacao") {
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
    if (ok && currentStep < STEP_ITEMS.length - 1) {
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
    setNotice("Imóvel enviado para revisão.");
  }

  const isLastStep = currentStep === STEP_ITEMS.length - 1;

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        label="Passos do formulário de imóvel"
        items={STEP_ITEMS}
        value={STEP_ITEMS[currentStep]?.id ?? STEP_ITEMS[0]!.id}
        onValueChange={(id) => {
          const index = STEP_ITEMS.findIndex((item) => item.id === id);
          if (index >= 0) setCurrentStep(index);
        }}
      />

      {creating ? <p>A criar rascunho…</p> : null}
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
          Guardar rascunho
        </Button>
        {!isLastStep ? (
          <Button onClick={() => void handleNext()} disabled={saving}>
            Seguinte
          </Button>
        ) : (
          <Button onClick={() => void handlePublish()} disabled={saving}>
            Publicar
          </Button>
        )}
      </div>
    </div>
  );
}
