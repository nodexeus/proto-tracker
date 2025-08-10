/**
 * Release notes parser for detecting hard forks and extracting relevant information
 */

export interface ParsedRelease {
  hasHardFork: boolean;
  forkDate?: Date;
  confidence: 'high' | 'medium' | 'low';
  indicators: string[];
  extractedDates: Date[];
  releaseType: 'major' | 'minor' | 'patch' | 'unknown';
}

export class ReleaseNotesParser {
  // Hard fork indicators in order of confidence - made more conservative
  private static readonly HARD_FORK_INDICATORS = {
    high: [
      /hard\s*fork/i,
      /hardfork/i,
      /mandatory\s*upgrade/i,
    ],
    medium: [
      /fork\s*height/i,
      /activation\s*block/i,
      /upgrade\s*block/i,
      /consensus\s*upgrade/i,
      /backwards?\s*incompatible/i,
      /breaking\s*protocol/i,
      /mandatory\s*network/i,
      /emergency\s*upgrade/i,
      /critical\s*network/i,
    ],
    low: [
      // Removed overly broad patterns like /upgrade/i, /fork/i
      /protocol\s*fork/i,
      /chain\s*upgrade/i,
      /network\s*activation/i,
      /consensus\s*fork/i,
    ]
  };

  // Date pattern matchers
  private static readonly DATE_PATTERNS = [
    // ISO dates (2024-01-15, 2024/01/15)
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g,
    // US dates (01/15/2024, 01-15-2024)
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g,
    // Named months (January 15, 2024 or Jan 15 2024)
    /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2}),?\s+(\d{4})/gi,
    // Block numbers with context (block 123456, at block 123456)
    /(?:at\s+)?block\s+(\d+)/gi,
    // Epoch numbers
    /epoch\s+(\d+)/gi,
  ];

  // Block height patterns (for converting to approximate dates)
  private static readonly BLOCK_PATTERNS = [
    /block\s+(?:height\s+)?(\d+)/gi,
    /at\s+block\s+(\d+)/gi,
    /activation\s+block[:\s]+(\d+)/gi,
  ];

  /**
   * Parse release notes to detect hard forks and extract information
   */
  static parseReleaseNotes(
    title: string, 
    body: string, 
    tagName: string,
    publishedAt: Date
  ): ParsedRelease {
    const fullText = `${title} ${body}`.toLowerCase();
    const indicators: string[] = [];
    let hasHardFork = false;
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Check for hard fork indicators
    for (const [level, patterns] of Object.entries(this.HARD_FORK_INDICATORS)) {
      for (const pattern of patterns) {
        if (pattern.test(fullText)) {
          hasHardFork = true;
          indicators.push(pattern.source);
          
          if (level === 'high' && confidence !== 'high') {
            confidence = 'high';
          } else if (level === 'medium' && confidence === 'low') {
            confidence = 'medium';
          }
        }
      }
    }

    // Extract dates from the text
    const extractedDates = this.extractDates(body);
    
    // Try to find the most likely fork date
    let forkDate: Date | undefined;
    if (hasHardFork && extractedDates.length > 0) {
      // Prefer dates that are after the release date
      const futureDates = extractedDates.filter(date => date > publishedAt);
      forkDate = futureDates.length > 0 ? futureDates[0] : extractedDates[0];
    }

    // Determine release type from version tag
    const releaseType = this.determineReleaseType(tagName);

    return {
      hasHardFork,
      forkDate,
      confidence,
      indicators,
      extractedDates,
      releaseType,
    };
  }

  /**
   * Extract dates from text
   */
  private static extractDates(text: string): Date[] {
    const dates: Date[] = [];
    const seenDates = new Set<string>();

    for (const pattern of this.DATE_PATTERNS) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let date: Date | null = null;

        if (pattern === this.DATE_PATTERNS[0]) {
          // ISO format: YYYY-MM-DD or YYYY/MM/DD
          date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        } else if (pattern === this.DATE_PATTERNS[1]) {
          // US format: MM/DD/YYYY or MM-DD-YYYY
          date = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
        } else if (pattern === this.DATE_PATTERNS[2]) {
          // Named months
          const monthName = match[1].toLowerCase();
          const monthMap: Record<string, number> = {
            january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2,
            april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
            august: 7, aug: 7, september: 8, sep: 8, october: 9, oct: 9,
            november: 10, nov: 10, december: 11, dec: 11
          };
          const month = monthMap[monthName];
          if (month !== undefined) {
            date = new Date(parseInt(match[3]), month, parseInt(match[2]));
          }
        }

        if (date && !isNaN(date.getTime())) {
          const dateStr = date.toISOString().split('T')[0];
          if (!seenDates.has(dateStr)) {
            seenDates.add(dateStr);
            dates.push(date);
          }
        }
      }
    }

    // Sort dates chronologically
    return dates.sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Determine release type from version tag
   */
  private static determineReleaseType(tagName: string): 'major' | 'minor' | 'patch' | 'unknown' {
    // Remove common prefixes
    const cleanTag = tagName.replace(/^(v|version|release)\.?/i, '');
    
    // Try to match semantic versioning pattern
    const semverMatch = cleanTag.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (semverMatch) {
      const [, major, minor, patch] = semverMatch;
      
      // Simple heuristic: if it's x.0.0, it's major; if x.y.0, it's minor
      if (minor === '0' && patch === '0') {
        return 'major';
      } else if (patch === '0') {
        return 'minor';
      } else {
        return 'patch';
      }
    }

    // Check for major version patterns
    if (/^v?\d+\.0(\.0)?$/.test(cleanTag)) {
      return 'major';
    }

    return 'unknown';
  }

  /**
   * Calculate confidence score based on multiple factors
   */
  static calculateConfidenceScore(parsed: ParsedRelease, tagName: string): number {
    let score = 0;

    // Base score from indicators
    if (parsed.confidence === 'high') score += 0.8;
    else if (parsed.confidence === 'medium') score += 0.5;
    else if (parsed.confidence === 'low') score += 0.2;

    // Bonus for having dates
    if (parsed.extractedDates.length > 0) score += 0.1;

    // Bonus for fork date
    if (parsed.forkDate) score += 0.1;

    // Major version releases are more likely to be hard forks
    if (parsed.releaseType === 'major') score += 0.2;

    // Multiple indicators increase confidence
    if (parsed.indicators.length > 2) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Extract block numbers from text (for chains where this is relevant)
   */
  static extractBlockNumbers(text: string): number[] {
    const blockNumbers: number[] = [];
    
    for (const pattern of this.BLOCK_PATTERNS) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const blockNumber = parseInt(match[1]);
        if (!isNaN(blockNumber) && blockNumber > 0) {
          blockNumbers.push(blockNumber);
        }
      }
    }

    return [...new Set(blockNumbers)]; // Remove duplicates
  }
}