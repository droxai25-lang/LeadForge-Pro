import {
  qualificationSignalCatalog,
  type QualificationContract,
  type QualificationSignalRule
} from "../lib/opportunityQualification";

export function createDefaultQualificationContract(
  targetIndustries: string[] = ["HVAC"],
  targetGeography: string[] = ["Dallas, Texas, US"]
): QualificationContract {
  return {
    schemaVersion: 1,
    clientOffer: "Website conversion improvements and AI-assisted after-hours lead intake",
    targetIndustries,
    targetGeography,
    targetCompanyCharacteristics: {
      minEmployees: null,
      maxEmployees: null,
      allowUnknownEmployeeCount: true,
      minSourceConfidence: 0.65,
      requirePublicEmail: false,
      requirePublicPhone: false,
      requiredTechnologies: [],
      excludedTechnologies: []
    },
    desiredBuyerRoles: ["Owner", "General Manager", "Operations Manager"],
    qualifyingSignals: [
      { key: "missing_online_scheduling", weight: 25, required: false },
      { key: "missing_online_estimate", weight: 20, required: false },
      { key: "missing_after_hours_intake", weight: 20, required: false },
      { key: "missing_live_chat", weight: 15, required: false },
      { key: "missing_financing_cta", weight: 10, required: false },
      { key: "missing_local_business_schema", weight: 10, required: false }
    ],
    disqualifyingSignalKeys: [],
    minEvidenceCount: 3,
    minEvidenceQuality: 0.7,
    minOpportunityScore: 50,
    notes: null
  };
}

interface QualificationContractEditorProps {
  value: QualificationContract;
  onChange: (value: QualificationContract) => void;
  showMarketFields?: boolean;
}

function csvValues(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ];
}

export function QualificationContractEditor({
  value,
  onChange,
  showMarketFields = false
}: QualificationContractEditorProps) {
  const signals = qualificationSignalCatalog();
  const ruleByKey = new Map(value.qualifyingSignals.map((rule) => [rule.key, rule]));
  const patch = (next: Partial<QualificationContract>) => onChange({ ...value, ...next });
  const patchCharacteristics = (next: Partial<QualificationContract["targetCompanyCharacteristics"]>) => {
    patch({ targetCompanyCharacteristics: { ...value.targetCompanyCharacteristics, ...next } });
  };
  const updateRule = (key: string, next: Partial<QualificationSignalRule>) => {
    patch({
      qualifyingSignals: value.qualifyingSignals.map((rule) => (rule.key === key ? { ...rule, ...next } : rule))
    });
  };
  const toggleRule = (key: string) => {
    const existing = ruleByKey.get(key);
    patch({
      qualifyingSignals: existing
        ? value.qualifyingSignals.filter((rule) => rule.key !== key)
        : [...value.qualifyingSignals, { key, weight: 10, required: false }]
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-[#263149] bg-[#090d17] p-4">
      <div>
        <h3 className="text-sm font-bold text-white">Qualification contract</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Only candidates meeting these evidence rules can become exportable prospects. Weights determine the score; AI
          does not.
        </p>
      </div>
      <label className="block text-xs font-semibold text-slate-300">
        What the client sells
        <textarea
          value={value.clientOffer}
          onChange={(event) => patch({ clientOffer: event.target.value })}
          required
          maxLength={500}
          rows={2}
          className="mt-1 w-full rounded-lg border border-[#263149] bg-[#0f1523] px-3 py-2 text-sm text-white"
        />
      </label>
      {showMarketFields && (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextListField
            label="Target industries"
            value={value.targetIndustries}
            onChange={(targetIndustries) => patch({ targetIndustries })}
          />
          <TextListField
            label="Target geography"
            value={value.targetGeography}
            onChange={(targetGeography) => patch({ targetGeography })}
          />
        </div>
      )}
      <TextListField
        label="Desired buyer roles, comma separated"
        value={value.desiredBuyerRoles}
        onChange={(desiredBuyerRoles) => patch({ desiredBuyerRoles })}
      />
      <div>
        <p className="text-xs font-semibold text-slate-300">Observable qualifying signals</p>
        <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto pr-1 lg:grid-cols-2">
          {signals.map((signal) => {
            const rule = ruleByKey.get(signal.key);
            return (
              <div
                key={signal.key}
                className={`rounded-lg border p-2 ${rule ? "border-indigo-500/50 bg-indigo-950/20" : "border-[#263149]"}`}
              >
                <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={Boolean(rule)}
                    onChange={() => toggleRule(signal.key)}
                    className="mt-0.5 accent-indigo-500"
                  />
                  <span>
                    <strong className="block">{signal.title}</strong>
                    <span className="text-slate-500">{signal.opportunity}</span>
                  </span>
                </label>
                {rule && (
                  <div className="mt-2 flex items-center gap-3 pl-5">
                    <label className="text-[11px] text-slate-400">
                      Weight{" "}
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={rule.weight}
                        onChange={(event) => updateRule(signal.key, { weight: Number(event.target.value) })}
                        className="ml-1 w-16 rounded border border-[#263149] bg-[#0f1523] px-2 py-1 text-white"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-slate-400">
                      <input
                        type="checkbox"
                        checked={rule.required}
                        onChange={(event) => updateRule(signal.key, { required: event.target.checked })}
                        className="accent-indigo-500"
                      />
                      Required
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberInput
          label="Minimum observations"
          value={value.minEvidenceCount}
          min={1}
          max={20}
          step={1}
          onChange={(minEvidenceCount) => patch({ minEvidenceCount })}
        />
        <NumberInput
          label="Minimum evidence quality"
          value={value.minEvidenceQuality}
          min={0.5}
          max={1}
          step={0.05}
          onChange={(minEvidenceQuality) => patch({ minEvidenceQuality })}
        />
        <NumberInput
          label="Minimum opportunity score"
          value={value.minOpportunityScore}
          min={1}
          max={100}
          step={1}
          onChange={(minOpportunityScore) => patch({ minOpportunityScore })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberInput
          label="Minimum source confidence"
          value={value.targetCompanyCharacteristics.minSourceConfidence}
          min={0.5}
          max={1}
          step={0.05}
          onChange={(minSourceConfidence) => patchCharacteristics({ minSourceConfidence })}
        />
        <label className="flex items-center gap-2 self-end rounded-lg border border-[#263149] px-3 py-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={value.targetCompanyCharacteristics.requirePublicEmail}
            onChange={(event) => patchCharacteristics({ requirePublicEmail: event.target.checked })}
            className="accent-indigo-500"
          />
          Require public email
        </label>
        <label className="flex items-center gap-2 self-end rounded-lg border border-[#263149] px-3 py-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={value.targetCompanyCharacteristics.requirePublicPhone}
            onChange={(event) => patchCharacteristics({ requirePublicPhone: event.target.checked })}
            className="accent-indigo-500"
          />
          Require public phone
        </label>
      </div>
    </div>
  );
}

function TextListField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-300">
      {label}
      <input
        value={value.join(", ")}
        onChange={(event) => onChange(csvValues(event.target.value))}
        required
        className="mt-1 w-full rounded-lg border border-[#263149] bg-[#0f1523] px-3 py-2 text-sm text-white"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-lg border border-[#263149] bg-[#0f1523] px-3 py-2 text-sm text-white"
      />
    </label>
  );
}
