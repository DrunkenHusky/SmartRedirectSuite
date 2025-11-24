import packageJson from "../package.json" assert { type: "json" };

type ApplicationMetadata = {
  /** Raw package name for tooling */
  name: string;
  /** Semantic version, kept in sync with package.json */
  version: string;
  /** Human friendly application label */
  displayName: string;
};

const normalizeName = (name: unknown): string => {
  if (typeof name !== "string") {
    return "SmartRedirectSuite";
  }
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "SmartRedirectSuite";
};

const normalizeVersion = (version: unknown): string => {
  if (typeof version !== "string") {
    return "0.0.0";
  }
  const trimmed = version.trim();
  return trimmed.length > 0 ? trimmed : "0.0.0";
};

const formatDisplayName = (name: string): string => {
  const spaced = name
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return spaced.length > 0 ? spaced : "Smart Redirect Suite";
};

const normalizedName = normalizeName(packageJson.name);
const normalizedVersion = normalizeVersion(packageJson.version);

export const APPLICATION_METADATA: ApplicationMetadata = Object.freeze({
  name: normalizedName,
  version: normalizedVersion,
  displayName: formatDisplayName(normalizedName),
});

export default APPLICATION_METADATA;
