/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

const VERSION_PATTERN = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseSemanticVersion(value: string): SemanticVersion | undefined {
  const match = value.trim().match(VERSION_PATTERN);
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split(".") ?? []
  };
}

export function compareSemanticVersions(left: string, right: string): number {
  const parsedLeft = parseSemanticVersion(left);
  const parsedRight = parseSemanticVersion(right);
  if (!parsedLeft || !parsedRight) throw new Error(`Versão SemVer inválida: ${!parsedLeft ? left : right}`);
  for (const key of ["major", "minor", "patch"] as const) {
    if (parsedLeft[key] !== parsedRight[key]) return parsedLeft[key] > parsedRight[key] ? 1 : -1;
  }
  return comparePrerelease(parsedLeft.prerelease, parsedRight.prerelease);
}

export function isNewerStableVersion(installed: string, candidate: string): boolean {
  const parsedCandidate = parseSemanticVersion(candidate);
  return Boolean(parsedCandidate && parsedCandidate.prerelease.length === 0 && compareSemanticVersions(candidate, installed) > 0);
}

function comparePrerelease(left: string[], right: string[]): number {
  if (!left.length || !right.length) return left.length === right.length ? 0 : left.length ? -1 : 1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined || rightPart === undefined) return leftPart === undefined ? -1 : 1;
    if (leftPart === rightPart) continue;
    const leftNumber = /^\d+$/.test(leftPart);
    const rightNumber = /^\d+$/.test(rightPart);
    if (leftNumber && rightNumber) return Number(leftPart) > Number(rightPart) ? 1 : -1;
    if (leftNumber !== rightNumber) return leftNumber ? -1 : 1;
    return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}
