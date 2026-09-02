import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DuckDBConnection } from "@duckdb/node-api";
import { GEONAMES_LICENSE_NOTICE, resolveGeoNamesLocation } from "./geoNames";

const OVERTURE_STAC_CATALOG = "https://stac.overturemaps.org/catalog.json";
const OVERTURE_S3_ROOT = "s3://overturemaps-us-west-2/release";
const OVERTURE_ATTRIBUTION_URL = "https://docs.overturemaps.org/attribution/";
const DEFAULT_MIN_CONFIDENCE = 0.65;
const MAX_COMPANIES_PER_RUN = 250;

const NON_COMPANY_WEBSITE_HOSTS = new Set([
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "linktr.ee",
  "maps.apple.com",
  "tiktok.com",
  "tripadvisor.com",
  "twitter.com",
  "x.com",
  "yelp.com",
  "youtube.com"
]);

const MARKET_SYNONYMS: Record<string, string[]> = {
  accountant: ["accountant", "accounting", "bookkeeping", "tax_preparation"],
  attorney: ["attorney", "lawyer", "law_firm", "legal_services"],
  auto_repair: ["auto_repair", "automotive_repair", "car_repair", "mechanic"],
  barber: ["barber", "barbershop", "hair_salon", "hairdresser"],
  construction: ["construction", "general_contractor", "building_contractor"],
  dentist: ["dentist", "dental_clinic", "dental_care"],
  electrician: ["electrician", "electrical_contractor", "electrical_services"],
  gym: ["gym", "fitness_center", "fitness_centre", "personal_trainer"],
  hotel: ["hotel", "motel", "lodging", "accommodation"],
  hvac: ["hvac", "heating", "air_conditioning", "heating_contractor", "air_conditioning_contractor"],
  insurance: ["insurance", "insurance_agency", "insurance_broker"],
  landscaping: ["landscaping", "landscape_contractor", "lawn_care", "gardener"],
  plumber: ["plumber", "plumbing", "plumbing_contractor"],
  real_estate: ["real_estate", "estate_agent", "real_estate_agent", "property_management"],
  restaurant: ["restaurant", "food_and_drink", "cafe", "fast_food"],
  roofer: ["roofer", "roofing", "roofing_contractor"],
  salon: ["salon", "beauty_salon", "hair_salon", "hairdresser"],
  veterinarian: ["veterinarian", "veterinary", "animal_hospital", "veterinary_clinic"]
};

const MARKET_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "business",
  "businesses",
  "commercial",
  "companies",
  "company",
  "contractor",
  "contractors",
  "firm",
  "firms",
  "in",
  "local",
  "near",
  "of",
  "professional",
  "professionals",
  "provider",
  "providers",
  "service",
  "services",
  "the"
]);

const US_STATES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC"
};

const US_STATE_CODES = new Set(Object.values(US_STATES));

const COUNTRY_ALIASES: Record<string, string> = {
  australia: "AU",
  austria: "AT",
  belgium: "BE",
  brazil: "BR",
  canada: "CA",
  denmark: "DK",
  france: "FR",
  germany: "DE",
  india: "IN",
  ireland: "IE",
  italy: "IT",
  japan: "JP",
  mexico: "MX",
  netherlands: "NL",
  "new zealand": "NZ",
  norway: "NO",
  singapore: "SG",
  spain: "ES",
  sweden: "SE",
  switzerland: "CH",
  "united arab emirates": "AE",
  "united kingdom": "GB",
  "united states": "US"
};

export interface OvertureDiscoveryInput {
  market: string;
  location: string;
  companyLimit: number;
  minConfidence: number;
  radiusKm: number;
}

export interface AutonomousOvertureDiscoveryInput {
  location: string;
  companyLimit: number;
  minConfidence: number;
  radiusKm: number;
  rowOffset: number;
}

export interface OvertureCompany {
  providerCompanyId: string;
  sourceProvider: "overture_maps";
  datasetRelease: string;
  name: string;
  domain: string;
  industry: string | null;
  description: string | null;
  employeeCount: null;
  city: string | null;
  state: string | null;
  country: string | null;
  websiteUrl: string;
  publicEmail: string | null;
  phone: string | null;
  streetAddress: string | null;
  confidence: number | null;
  sourceUrls: string[];
  observedAt: Date;
}

interface LocationParts {
  name: string;
  country: string | null;
  region: string | null;
}

interface DivisionRow {
  id: string;
  name: string;
  subtype: string;
  country: string;
  region: string | null;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

interface PlaceRow {
  id: string;
  name: string | null;
  primary_category: string | null;
  taxonomy_category: string | null;
  basic_category: string | null;
  confidence: number | null;
  websites: string[] | null;
  emails: string[] | null;
  phones: string[] | null;
  address: {
    freeform?: string | null;
    locality?: string | null;
    region?: string | null;
    country?: string | null;
  } | null;
}

export class OvertureDiscoveryError extends Error {
  constructor(
    public readonly code:
      | "invalid_input"
      | "location_not_found"
      | "location_ambiguous"
      | "dataset_unavailable"
      | "provider_failed",
    message: string,
    public readonly httpStatus = 502
  ) {
    super(message);
    this.name = "OvertureDiscoveryError";
  }
}

function normalizeBoundedText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new OvertureDiscoveryError("invalid_input", `${field} is required.`, 400);
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < 2 || normalized.length > maxLength) {
    throw new OvertureDiscoveryError("invalid_input", `${field} must contain 2-${maxLength} characters.`, 400);
  }
  return normalized;
}

function normalizeCompanyLimit(value: unknown): number {
  const parsed = Number(value ?? 25);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_COMPANIES_PER_RUN) {
    throw new OvertureDiscoveryError(
      "invalid_input",
      `companyLimit must be an integer between 1 and ${MAX_COMPANIES_PER_RUN}.`,
      400
    );
  }
  return parsed;
}

function normalizeConfidence(value: unknown): number {
  const parsed = Number(value ?? DEFAULT_MIN_CONFIDENCE);
  if (!Number.isFinite(parsed) || parsed < 0.5 || parsed > 1) {
    throw new OvertureDiscoveryError("invalid_input", "minConfidence must be between 0.5 and 1.", 400);
  }
  return Math.round(parsed * 100) / 100;
}

function normalizeRadiusKm(value: unknown): number {
  const parsed = Number(value ?? 35);
  if (!Number.isFinite(parsed) || parsed < 5 || parsed > 100) {
    throw new OvertureDiscoveryError("invalid_input", "radiusKm must be between 5 and 100.", 400);
  }
  return Math.round(parsed);
}

function normalizeRowOffset(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 25_000) {
    throw new OvertureDiscoveryError("invalid_input", "rowOffset must be an integer between 0 and 25000.", 400);
  }
  return parsed;
}

export function normalizeOvertureDiscoveryInput(value: Record<string, unknown>): OvertureDiscoveryInput {
  return {
    market: normalizeBoundedText(value.market, "market", 120),
    location: normalizeBoundedText(value.location, "location", 160),
    companyLimit: normalizeCompanyLimit(value.companyLimit),
    minConfidence: normalizeConfidence(value.minConfidence),
    radiusKm: normalizeRadiusKm(value.radiusKm)
  };
}

export function normalizeAutonomousOvertureDiscoveryInput(
  value: Record<string, unknown>
): AutonomousOvertureDiscoveryInput {
  return {
    location: normalizeBoundedText(value.location, "location", 160),
    companyLimit: normalizeCompanyLimit(value.companyLimit),
    minConfidence: normalizeConfidence(value.minConfidence),
    radiusKm: normalizeRadiusKm(value.radiusKm),
    rowOffset: normalizeRowOffset(value.rowOffset)
  };
}

export function getOvertureDiscoveryReadiness(): {
  ready: boolean;
  enabled: boolean;
  configured: boolean;
  reason: string | null;
  license: string;
  attributionUrl: string;
} {
  const enabled = process.env.OVERTURE_DISCOVERY_ENABLED !== "false";
  return {
    ready: enabled,
    enabled,
    configured: true,
    reason: enabled ? null : "OVERTURE_DISCOVERY_ENABLED=false disables keyless public business discovery.",
    license: `Overture Places uses source-dependent CDLA Permissive 2.0, Apache 2.0, and CC0 licensing. ${GEONAMES_LICENSE_NOTICE}`,
    attributionUrl: OVERTURE_ATTRIBUTION_URL
  };
}

function parseLocation(rawLocation: string): LocationParts {
  const pieces = rawLocation
    .split(",")
    .map((piece) => piece.trim())
    .filter(Boolean);
  let name = pieces[0] || rawLocation;
  const qualifiers = pieces.slice(1).join(" ").toLowerCase();
  let region: string | null = null;
  let country: string | null = null;

  for (const [stateName, stateCode] of Object.entries(US_STATES).sort(
    (left, right) => right[0].length - left[0].length
  )) {
    const statePattern = new RegExp(`(?:^|\\s)${stateName.replace(/ /g, "\\s+")}$`, "i");
    const codePattern = new RegExp(`(?:^|\\s)${stateCode}$`, "i");
    if (
      qualifiers === stateName ||
      qualifiers === stateCode.toLowerCase() ||
      statePattern.test(rawLocation) ||
      codePattern.test(rawLocation)
    ) {
      region = `US-${stateCode}`;
      country = "US";
      if (pieces.length === 1) name = rawLocation.replace(statePattern, "").replace(codePattern, "").trim();
      break;
    }
  }

  const upperQualifiers = pieces.slice(1).map((piece) => piece.toUpperCase());
  const explicitRegion = upperQualifiers.find((piece) => /^[A-Z]{2}-[A-Z0-9]{1,8}$/.test(piece));
  if (explicitRegion) {
    region = explicitRegion;
    country = explicitRegion.slice(0, 2);
  }
  const explicitCountryCode = upperQualifiers.find((piece) => /^[A-Z]{2}$/.test(piece));
  if (explicitCountryCode && !country) country = explicitCountryCode;
  const explicitStateCode = upperQualifiers.find((piece) => US_STATE_CODES.has(piece));
  if (explicitStateCode) {
    region = `US-${explicitStateCode}`;
    country = "US";
  }
  if (/\b(united states|united states of america|usa|u\.s\.a\.?|us)\b/i.test(qualifiers)) country = "US";
  if (/\b(canada|ca)\b/i.test(qualifiers) && !country) country = "CA";
  if (/\b(united kingdom|great britain|uk)\b/i.test(qualifiers)) country = "GB";
  for (const [countryName, countryCode] of Object.entries(COUNTRY_ALIASES).sort(
    (left, right) => right[0].length - left[0].length
  )) {
    if (new RegExp(`(?:^|\\s)${countryName.replace(/ /g, "\\s+")}(?:$|\\s)`, "i").test(qualifiers)) {
      country = countryCode;
      break;
    }
  }

  return { name, country, region };
}

function singularizeMarketToken(token: string): string {
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ers") && token.length > 4) return token.slice(0, -1);
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) return token.slice(0, -1);
  return token;
}

export function expandMarketKeywords(market: string): string[] {
  const normalized = market
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const tokens = normalized
    .split(" ")
    .map(singularizeMarketToken)
    .filter((token) => token.length >= 3 && !MARKET_STOP_WORDS.has(token));
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const [canonical, synonyms] of Object.entries(MARKET_SYNONYMS)) {
      if (token === canonical || synonyms.some((synonym) => synonym.includes(token) || token.includes(synonym))) {
        expanded.add(canonical);
        for (const synonym of synonyms) {
          expanded.add(synonym);
        }
      }
    }
  }
  if (expanded.size === 0) {
    throw new OvertureDiscoveryError(
      "invalid_input",
      "market must contain a specific business category, such as roofers, dentists, or HVAC.",
      400
    );
  }
  return [...expanded].slice(0, 20);
}

function isNonCompanyHost(hostname: string): boolean {
  return [...NON_COMPANY_WEBSITE_HOSTS].some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`));
}

export function normalizeCompanyWebsite(websites: unknown): { domain: string; websiteUrl: string } | null {
  if (!Array.isArray(websites)) return null;
  for (const value of websites) {
    if (typeof value !== "string") continue;
    try {
      const parsed = new URL(value);
      if (!["http:", "https:"].includes(parsed.protocol)) continue;
      const domain = parsed.hostname
        .toLowerCase()
        .replace(/^www\./, "")
        .replace(/\.$/, "");
      if (!domain.includes(".") || isNonCompanyHost(domain)) continue;
      return { domain, websiteUrl: `https://${domain}/` };
    } catch {}
  }
  return null;
}

function normalizePublicEmail(emails: unknown): string | null {
  if (!Array.isArray(emails)) return null;
  for (const value of emails) {
    if (typeof value !== "string") continue;
    const email = value.trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) && !/^(example|test)@/.test(email)) return email;
  }
  return null;
}

function normalizePhone(phones: unknown): string | null {
  if (!Array.isArray(phones)) return null;
  const phone = phones.find(
    (value): value is string => typeof value === "string" && /\d{7}/.test(value.replace(/\D/g, ""))
  );
  return phone?.trim().slice(0, 64) || null;
}

function duckDbExtensionDirectory(): string {
  return path.resolve(
    process.env.OVERTURE_DUCKDB_EXTENSION_DIR || path.join(process.cwd(), ".runtime", "duckdb_extensions")
  );
}

function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function validateRelease(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(value)) {
    throw new OvertureDiscoveryError(
      "dataset_unavailable",
      "Overture's STAC catalog did not return a valid current release."
    );
  }
  return value;
}

async function fetchOvertureJson(url: string): Promise<Record<string, unknown>> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "stac.overturemaps.org") {
    throw new OvertureDiscoveryError("dataset_unavailable", "Overture returned an unexpected catalog URL.");
  }
  const response = await fetch(parsed, {
    headers: { Accept: "application/json", "User-Agent": "LeadForge-Pro/1.0 (+https://droxaillc.com)" },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) {
    throw new OvertureDiscoveryError("dataset_unavailable", `Overture catalog returned HTTP ${response.status}.`);
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > 2 * 1024 * 1024) {
    throw new OvertureDiscoveryError(
      "dataset_unavailable",
      "Overture catalog response exceeded the 2 MiB safety limit."
    );
  }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > 2 * 1024 * 1024) {
    throw new OvertureDiscoveryError(
      "dataset_unavailable",
      "Overture catalog response exceeded the 2 MiB safety limit."
    );
  }
  const value = JSON.parse(text) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OvertureDiscoveryError("dataset_unavailable", "Overture returned an invalid catalog document.");
  }
  return value as Record<string, unknown>;
}

async function getLatestRelease(): Promise<string> {
  const catalog = await fetchOvertureJson(OVERTURE_STAC_CATALOG);
  return validateRelease(catalog.latest);
}

function bboxesIntersect(left: number[], right: DivisionRow): boolean {
  return (
    left.length === 4 &&
    left.every(Number.isFinite) &&
    left[0] <= right.xmax &&
    left[2] >= right.xmin &&
    left[1] <= right.ymax &&
    left[3] >= right.ymin
  );
}

async function selectPlacesAssets(release: string, division: DivisionRow): Promise<string[]> {
  const collectionUrl = `https://stac.overturemaps.org/${release}/places/place/collection.json`;
  const collection = await fetchOvertureJson(collectionUrl);
  const itemLinks = Array.isArray(collection.links)
    ? collection.links.filter(
        (link): link is { rel: "item"; href: string } =>
          Boolean(link) &&
          typeof link === "object" &&
          "rel" in link &&
          link.rel === "item" &&
          "href" in link &&
          typeof link.href === "string"
      )
    : [];
  const extent = collection.extent;
  const extents =
    extent && typeof extent === "object" && !Array.isArray(extent) && "spatial" in extent
      ? (extent.spatial as { bbox?: unknown } | null)?.bbox
      : undefined;
  if (!Array.isArray(extents) || itemLinks.length !== extents.length) {
    throw new OvertureDiscoveryError(
      "dataset_unavailable",
      "Overture's Places manifest did not contain aligned spatial partitions."
    );
  }
  const selectedLinks = itemLinks.filter((_link, index) => bboxesIntersect(extents[index], division));
  if (selectedLinks.length === 0 || selectedLinks.length > 4) {
    throw new OvertureDiscoveryError(
      "dataset_unavailable",
      "Overture's Places manifest could not select a bounded partition for this location."
    );
  }
  const items = await Promise.all(selectedLinks.map((link) => fetchOvertureJson(link.href)));
  return items.map((item) => {
    const assets = item.assets;
    const aws =
      assets && typeof assets === "object" && !Array.isArray(assets) && "aws" in assets
        ? (assets.aws as { href?: unknown; alternate?: { s3?: { href?: unknown } } })
        : undefined;
    const href = aws?.href || aws?.alternate?.s3?.href;
    const validPrefix =
      typeof href === "string" &&
      (href.startsWith(`${OVERTURE_S3_ROOT}/${release}/theme=places/type=place/`) ||
        href.startsWith(
          `https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/${release}/theme=places/type=place/`
        ));
    if (!validPrefix || !href.endsWith(".parquet")) {
      throw new OvertureDiscoveryError(
        "dataset_unavailable",
        "Overture's Places item did not contain an expected Parquet asset."
      );
    }
    return href;
  });
}

async function createOvertureConnection(): Promise<DuckDBConnection> {
  const extensionDirectory = duckDbExtensionDirectory();
  await mkdir(extensionDirectory, { recursive: true });
  const connection = await DuckDBConnection.create();
  await connection.run(`SET extension_directory=${sqlStringLiteral(extensionDirectory.replace(/\\/g, "/"))}`);
  await connection.run("SET threads=2");
  await connection.run("SET memory_limit='768MB'");
  await connection.run("SET s3_region='us-west-2'");
  for (const extension of ["httpfs"] as const) {
    try {
      await connection.run(`LOAD ${extension}`);
    } catch {
      await connection.run(`INSTALL ${extension}`);
      await connection.run(`LOAD ${extension}`);
    }
  }
  return connection;
}

async function resolveLocation(
  rawLocation: string,
  radiusKm: number
): Promise<DivisionRow & { attributionUrl: string }> {
  const location = parseLocation(rawLocation);
  try {
    const resolved = await resolveGeoNamesLocation({ ...location, radiusKm });
    return { ...resolved, subtype: "locality" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.includes("ambiguous") ? "location_ambiguous" : "location_not_found";
    throw new OvertureDiscoveryError(
      code,
      `${message} Use a city with its state/province and country, for example "Dallas, Texas, US".`,
      400
    );
  }
}

async function queryPlaces(
  connection: DuckDBConnection,
  release: string,
  division: DivisionRow,
  input: AutonomousOvertureDiscoveryInput & { market?: string | null }
): Promise<PlaceRow[]> {
  const keywords = input.market ? expandMarketKeywords(input.market) : [];
  const placesAssets = await selectPlacesAssets(release, division);
  const placesInput = `[${placesAssets.map(sqlStringLiteral).join(", ")}]`;
  const keywordConditions = keywords
    .map(
      (_, index) => `(
    lower(coalesce(p.categories.primary, '')) LIKE $keyword${index}
    OR lower(coalesce(p.basic_category, '')) LIKE $keyword${index}
    OR lower(coalesce(p.taxonomy.primary, '')) LIKE $keyword${index}
    OR lower(coalesce(array_to_string(p.taxonomy.hierarchy, ' '), '')) LIKE $keyword${index}
    OR lower(coalesce(array_to_string(p.categories.alternate, ' '), '')) LIKE $keyword${index}
  )`
    )
    .join(" OR ");
  const parameters: Record<string, string | number | null> = {
    minConfidence: input.minConfidence,
    rowLimit: Math.min(input.companyLimit * 5, 1000),
    rowOffset: input.rowOffset
  };
  keywords.forEach((keyword, index) => {
    parameters[`keyword${index}`] = `%${keyword.replace(/\s+/g, "_")}%`;
  });

  const reader = await connection.runAndReadAll(
    `SELECT p.id,
            p.names.primary AS name,
            p.categories.primary AS primary_category,
            p.taxonomy.primary AS taxonomy_category,
            p.basic_category,
            p.confidence,
            p.websites,
            p.emails,
            p.phones,
            p.addresses[1] AS address
      FROM read_parquet(${placesInput}, filename=true, hive_partitioning=true) p
      WHERE p.bbox.xmin BETWEEN $xmin AND $xmax
        AND p.bbox.ymin BETWEEN $ymin AND $ymax
        AND coalesce(p.operating_status, 'open') <> 'permanently_closed'
        AND coalesce(p.confidence, 0) >= $minConfidence
        AND p.websites IS NOT NULL
        AND len(p.websites) > 0
        ${keywordConditions ? `AND (${keywordConditions})` : ""}
      ORDER BY p.confidence DESC NULLS LAST, p.names.primary ASC
      LIMIT $rowLimit
      OFFSET $rowOffset`,
    { ...parameters, xmin: division.xmin, ymin: division.ymin, xmax: division.xmax, ymax: division.ymax }
  );
  return reader.getRowObjectsJson() as unknown as PlaceRow[];
}

export class OvertureDiscoveryClient {
  async discoverCompanies(input: OvertureDiscoveryInput): Promise<OvertureCompany[]> {
    return this.discover({ ...input, rowOffset: 0 });
  }

  async discoverAutonomousCompanies(input: AutonomousOvertureDiscoveryInput): Promise<OvertureCompany[]> {
    return this.discover(input);
  }

  private async discover(
    input: AutonomousOvertureDiscoveryInput & { market?: string | null }
  ): Promise<OvertureCompany[]> {
    const readiness = getOvertureDiscoveryReadiness();
    if (!readiness.ready) {
      throw new OvertureDiscoveryError(
        "dataset_unavailable",
        readiness.reason || "Overture discovery is disabled.",
        503
      );
    }

    let connection: DuckDBConnection | null = null;
    try {
      connection = await createOvertureConnection();
      const release = await getLatestRelease();
      const division = await resolveLocation(input.location, input.radiusKm);
      const places = await queryPlaces(connection, release, division, input);
      const observedAt = new Date();
      const companies = new Map<string, OvertureCompany>();

      for (const place of places) {
        const website = normalizeCompanyWebsite(place.websites);
        const name = typeof place.name === "string" ? place.name.replace(/\s+/g, " ").trim().slice(0, 200) : "";
        if (!website || !name || companies.has(website.domain)) continue;
        const address = place.address && typeof place.address === "object" ? place.address : null;
        companies.set(website.domain, {
          providerCompanyId: place.id,
          sourceProvider: "overture_maps",
          datasetRelease: release,
          name,
          domain: website.domain,
          industry: place.taxonomy_category || place.primary_category || place.basic_category || null,
          description: null,
          employeeCount: null,
          city: address?.locality?.slice(0, 120) || division.name,
          state: address?.region?.slice(0, 120) || division.region,
          country: address?.country?.slice(0, 2).toUpperCase() || division.country,
          websiteUrl: website.websiteUrl,
          publicEmail: normalizePublicEmail(place.emails),
          phone: normalizePhone(place.phones),
          streetAddress: address?.freeform?.replace(/\s+/g, " ").trim().slice(0, 300) || null,
          confidence: typeof place.confidence === "number" ? place.confidence : null,
          sourceUrls: [OVERTURE_ATTRIBUTION_URL, division.attributionUrl, website.websiteUrl],
          observedAt
        });
        if (companies.size >= input.companyLimit) break;
      }
      return [...companies.values()];
    } catch (error) {
      if (error instanceof OvertureDiscoveryError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new OvertureDiscoveryError("provider_failed", `Overture discovery failed: ${message.slice(0, 800)}`);
    } finally {
      connection?.closeSync();
    }
  }
}
