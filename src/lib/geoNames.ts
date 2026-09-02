import { readFile, rename, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";

const GEONAMES_ARCHIVE_URL = "https://download.geonames.org/export/dump/cities5000.zip";
const GEONAMES_ATTRIBUTION_URL = "https://www.geonames.org/";
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 40 * 1024 * 1024;

export interface GeoNamesLocationQuery {
  name: string;
  country: string | null;
  region: string | null;
  radiusKm: number;
}

export interface ResolvedGeoNamesLocation {
  id: string;
  name: string;
  country: string;
  region: string | null;
  latitude: number;
  longitude: number;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  attributionUrl: string;
}

interface GeoNamesCity {
  id: string;
  name: string;
  asciiName: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1: string;
  population: number;
}

let cityIndexPromise: Promise<GeoNamesCity[]> | null = null;
let autonomousLocationIndexPromise: Promise<AutonomousGeoNamesLocation[]> | null = null;

export interface AutonomousGeoNamesLocation {
  id: string;
  name: string;
  country: string;
  region: string | null;
  population: number;
  query: string;
}

function runtimeDirectory(): string {
  return path.resolve(process.env.GEONAMES_DATA_DIR || path.join(process.cwd(), ".runtime", "geonames"));
}

function normalizedName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fetchBoundedArchive(): Promise<Uint8Array> {
  const response = await fetch(GEONAMES_ARCHIVE_URL, {
    headers: { Accept: "application/zip", "User-Agent": "LeadForge-Pro/1.0 (+https://droxaillc.com)" },
    signal: AbortSignal.timeout(45_000)
  });
  if (!response.ok) throw new Error(`GeoNames archive returned HTTP ${response.status}.`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_ARCHIVE_BYTES) throw new Error("GeoNames archive exceeded the 8 MiB safety limit.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error("GeoNames archive exceeded the 8 MiB safety limit.");
  return bytes;
}

async function ensureCityFile(): Promise<string> {
  const directory = runtimeDirectory();
  const target = path.join(directory, "cities5000.txt");
  try {
    await readFile(target, { encoding: "utf8" });
    return target;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  await mkdir(directory, { recursive: true });
  const archive = await fetchBoundedArchive();
  const entries = unzipSync(archive, {
    filter: (file) => file.name === "cities5000.txt" && file.originalSize <= MAX_EXTRACTED_BYTES
  });
  const cityBytes = entries["cities5000.txt"];
  if (!cityBytes || cityBytes.byteLength === 0 || cityBytes.byteLength > MAX_EXTRACTED_BYTES) {
    throw new Error("GeoNames archive did not contain a bounded cities5000.txt dataset.");
  }
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, cityBytes, { flag: "wx" });
  try {
    await rename(temporary, target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return target;
}

function parseCities(text: string): GeoNamesCity[] {
  const cities: GeoNamesCity[] = [];
  for (const line of text.split("\n")) {
    if (!line) continue;
    const fields = line.split("\t");
    if (fields.length < 15) continue;
    const latitude = Number(fields[4]);
    const longitude = Number(fields[5]);
    const population = Number(fields[14] || 0);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    cities.push({
      id: fields[0],
      name: fields[1],
      asciiName: fields[2],
      latitude,
      longitude,
      country: fields[8].toUpperCase(),
      admin1: fields[10].toUpperCase(),
      population: Number.isFinite(population) ? population : 0
    });
  }
  if (cities.length < 10_000) throw new Error("GeoNames city dataset was incomplete.");
  return cities;
}

async function loadCities(): Promise<GeoNamesCity[]> {
  if (!cityIndexPromise) {
    cityIndexPromise = (async () => {
      const file = await ensureCityFile();
      return parseCities(await readFile(file, "utf8"));
    })().catch((error) => {
      cityIndexPromise = null;
      throw error;
    });
  }
  return cityIndexPromise;
}

export async function loadAutonomousGeoNamesLocations(): Promise<AutonomousGeoNamesLocation[]> {
  if (!autonomousLocationIndexPromise) {
    autonomousLocationIndexPromise = loadCities()
      .then((cities) => {
        const seen = new Set<string>();
        const locations: AutonomousGeoNamesLocation[] = [];
        const commerciallyReachableCountryOrder = new Map([
          ["US", 0],
          ["CA", 1],
          ["GB", 2],
          ["AU", 3],
          ["NZ", 4],
          ["IE", 5]
        ]);
        for (const city of [...cities].sort((left, right) => {
          const leftCountryOrder = commerciallyReachableCountryOrder.get(left.country) ?? 6;
          const rightCountryOrder = commerciallyReachableCountryOrder.get(right.country) ?? 6;
          return (
            leftCountryOrder - rightCountryOrder ||
            right.population - left.population ||
            left.id.localeCompare(right.id)
          );
        })) {
          const key = `${normalizedName(city.asciiName)}|${city.country}|${city.admin1}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const region = city.admin1 ? `${city.country}-${city.admin1}` : null;
          locations.push({
            id: city.id,
            name: city.name,
            country: city.country,
            region,
            population: city.population,
            query: region ? `${city.asciiName}, ${region}` : `${city.asciiName}, ${city.country}`
          });
        }
        if (locations.length < 10_000) throw new Error("GeoNames did not produce a complete autonomous city frontier.");
        return locations;
      })
      .catch((error) => {
        autonomousLocationIndexPromise = null;
        throw error;
      });
  }
  return autonomousLocationIndexPromise;
}

function toBoundingBox(
  latitude: number,
  longitude: number,
  radiusKm: number
): Pick<ResolvedGeoNamesLocation, "xmin" | "ymin" | "xmax" | "ymax"> {
  const latitudeDelta = radiusKm / 111.32;
  const longitudeScale = Math.max(0.1, Math.cos((latitude * Math.PI) / 180));
  const longitudeDelta = radiusKm / (111.32 * longitudeScale);
  return {
    xmin: Math.max(-180, longitude - longitudeDelta),
    ymin: Math.max(-90, latitude - latitudeDelta),
    xmax: Math.min(180, longitude + longitudeDelta),
    ymax: Math.min(90, latitude + latitudeDelta)
  };
}

export async function resolveGeoNamesLocation(query: GeoNamesLocationQuery): Promise<ResolvedGeoNamesLocation> {
  const cities = await loadCities();
  const wantedName = normalizedName(query.name);
  const wantedAdmin1 = query.region?.split("-").pop()?.toUpperCase() || null;
  const matches = cities
    .filter((city) => normalizedName(city.name) === wantedName || normalizedName(city.asciiName) === wantedName)
    .filter((city) => !query.country || city.country === query.country)
    .filter((city) => !wantedAdmin1 || city.admin1 === wantedAdmin1)
    .sort((left, right) => right.population - left.population);

  if (matches.length === 0) {
    throw new Error(`GeoNames could not resolve ${query.name} with the supplied state/province and country.`);
  }
  if (!query.country && !wantedAdmin1 && matches.length > 1 && matches[0].country !== matches[1].country) {
    const options = matches
      .slice(0, 3)
      .map((city) => `${city.name} (${city.admin1 || city.country}, ${city.country})`)
      .join(", ");
    throw new Error(`${query.name} is ambiguous. Add a state/province or country. Matches include: ${options}.`);
  }

  const city = matches[0];
  return {
    id: city.id,
    name: city.name,
    country: city.country,
    region: city.admin1 ? `${city.country}-${city.admin1}` : null,
    latitude: city.latitude,
    longitude: city.longitude,
    ...toBoundingBox(city.latitude, city.longitude, query.radiusKm),
    attributionUrl: `${GEONAMES_ATTRIBUTION_URL}${city.id}/`
  };
}

export const GEONAMES_LICENSE_NOTICE = "Location coordinates from GeoNames, licensed under CC BY 4.0.";
