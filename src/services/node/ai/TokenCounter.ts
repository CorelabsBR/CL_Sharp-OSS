/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class TokenCounter {
  estimate(text: string): number {
    if (!text) return 0;
    const words = text.trim().split(/\s+/u).filter(Boolean).length;
    const punctuation = (text.match(/[^\p{L}\p{N}\s]/gu) ?? []).length;
    return Math.max(1, Math.ceil(words * 1.25 + punctuation * 0.25));
  }

  truncateToTokens(text: string, maximum: number): { text: string; truncated: boolean } {
    if (this.estimate(text) <= maximum) return { text, truncated: false };
    const ratio = maximum / Math.max(1, this.estimate(text));
    const length = Math.max(0, Math.floor(text.length * ratio * 0.95));
    return { text: `${text.slice(0, length)}\n…[context truncated by NPSharp]`, truncated: true };
  }
}

