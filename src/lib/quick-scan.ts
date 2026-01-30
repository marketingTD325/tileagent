// Quick Scan - Non-AI SEO analysis based solely on scraped data
// This provides a free, fast pre-scan without consuming AI credits

export type PageType = 'homepage' | 'category' | 'filter' | 'product' | 'other';

export interface QuickScanIssue {
  type: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface QuickScanResult {
  score: number;
  pageType: PageType;
  issues: QuickScanIssue[];
  metrics: {
    titleLength: number;
    titleValid: boolean;
    metaDescriptionLength: number;
    metaDescriptionValid: boolean;
    metaDescriptionMissing: boolean;
    h1Count: number;
    h1Valid: boolean;
    wordCount: number;
    wordCountValid: boolean;
    imagesWithoutAlt: number;
    schemaTypesCount: number;
    internalLinksCount: number;
    contentLinksCount: number;
  };
  requirements: PageTypeRequirements;
}

export interface PageTypeRequirements {
  minWordCount: number;
  maxWordCount: number;
  requiredSchema: string[];
  recommendedSchema: string[];
  minInternalLinks: number;
  requiresFaq: boolean;
}

interface ScrapedData {
  metadata?: {
    title?: string;
    description?: string | null;
  };
  contentMetrics?: {
    wordCount?: number;
    headingStructure?: {
      h1: number;
      h2: number;
      h3: number;
      h4: number;
      h5: number;
      h6: number;
    };
  };
  linkAnalysis?: {
    internal?: number;
    contentLinks?: number;
  };
  imageIssues?: Array<{ src: string; alt: string | null }>;
  schemaTypes?: string[];
  pageType?: PageType;
  pageTypeRequirements?: PageTypeRequirements;
}

// Get default requirements if not provided by scraper
function getDefaultRequirements(pageType: PageType): PageTypeRequirements {
  switch (pageType) {
    case 'homepage':
      return { minWordCount: 300, maxWordCount: 800, requiredSchema: ['Organization'], recommendedSchema: ['WebSite'], minInternalLinks: 10, requiresFaq: false };
    case 'category':
      return { minWordCount: 700, maxWordCount: 1000, requiredSchema: ['BreadcrumbList'], recommendedSchema: ['FAQPage'], minInternalLinks: 5, requiresFaq: true };
    case 'filter':
      return { minWordCount: 200, maxWordCount: 400, requiredSchema: ['BreadcrumbList'], recommendedSchema: [], minInternalLinks: 3, requiresFaq: false };
    case 'product':
      return { minWordCount: 150, maxWordCount: 300, requiredSchema: ['Product', 'Offer'], recommendedSchema: ['BreadcrumbList'], minInternalLinks: 2, requiresFaq: false };
    default:
      return { minWordCount: 300, maxWordCount: 800, requiredSchema: [], recommendedSchema: [], minInternalLinks: 3, requiresFaq: false };
  }
}

export function computeQuickScan(scrapedData: ScrapedData): QuickScanResult {
  const issues: QuickScanIssue[] = [];
  let score = 100;

  // Extract data with defaults
  const title = scrapedData.metadata?.title || '';
  const description = scrapedData.metadata?.description || null;
  const wordCount = scrapedData.contentMetrics?.wordCount || 0;
  const h1Count = scrapedData.contentMetrics?.headingStructure?.h1 || 0;
  const internalLinks = scrapedData.linkAnalysis?.internal || 0;
  const contentLinks = scrapedData.linkAnalysis?.contentLinks || 0;
  const imagesWithoutAlt = scrapedData.imageIssues?.length || 0;
  const schemaTypes = scrapedData.schemaTypes || [];
  const pageType = scrapedData.pageType || 'other';
  const requirements = scrapedData.pageTypeRequirements || getDefaultRequirements(pageType);

  // === TITLE CHECKS ===
  const titleLength = title.length;
  const titleValid = titleLength >= 50 && titleLength <= 60;
  
  if (titleLength === 0) {
    issues.push({ type: 'error', category: 'Meta', message: 'Title tag ontbreekt', priority: 'high' });
    score -= 15;
  } else if (titleLength < 50) {
    issues.push({ type: 'warning', category: 'Meta', message: `Title te kort (${titleLength} karakters, aanbevolen: 50-60)`, priority: 'medium' });
    score -= 5;
  } else if (titleLength > 60) {
    issues.push({ type: 'warning', category: 'Meta', message: `Title te lang (${titleLength} karakters, max: 60)`, priority: 'medium' });
    score -= 5;
  }

  // YouTube branding check
  if (title.includes('- YouTube')) {
    issues.push({ type: 'error', category: 'Branding', message: 'Title bevat "- YouTube" (copy-paste fout)', priority: 'high' });
    score -= 15;
  }

  // === META DESCRIPTION CHECKS ===
  const metaDescriptionMissing = !description;
  const metaDescriptionLength = description?.length || 0;
  const metaDescriptionValid = metaDescriptionLength >= 150 && metaDescriptionLength <= 160;

  if (metaDescriptionMissing) {
    issues.push({ type: 'error', category: 'Meta', message: 'Meta description ontbreekt', priority: 'high' });
    score -= 15;
  } else if (metaDescriptionLength < 150) {
    issues.push({ type: 'warning', category: 'Meta', message: `Meta description te kort (${metaDescriptionLength} karakters)`, priority: 'medium' });
    score -= 5;
  } else if (metaDescriptionLength > 160) {
    issues.push({ type: 'warning', category: 'Meta', message: `Meta description te lang (${metaDescriptionLength} karakters)`, priority: 'low' });
    score -= 3;
  }

  // === H1 CHECKS ===
  const h1Valid = h1Count === 1;

  if (h1Count === 0) {
    issues.push({ type: 'error', category: 'Headings', message: 'H1 ontbreekt', priority: 'high' });
    score -= 10;
  } else if (h1Count > 1) {
    issues.push({ type: 'warning', category: 'Headings', message: `Meerdere H1 tags gevonden (${h1Count})`, priority: 'medium' });
    score -= 5;
  }

  // === WORD COUNT CHECKS (page type specific) ===
  const wordCountValid = wordCount >= requirements.minWordCount;

  if (wordCount < requirements.minWordCount) {
    issues.push({ 
      type: 'warning', 
      category: 'Content', 
      message: `Te weinig woorden voor ${pageType} pagina (${wordCount}, min: ${requirements.minWordCount})`, 
      priority: 'medium' 
    });
    score -= 10;
  } else if (wordCount > requirements.maxWordCount * 1.5) {
    issues.push({ 
      type: 'info', 
      category: 'Content', 
      message: `Veel content (${wordCount} woorden) - controleer of alles relevant is`, 
      priority: 'low' 
    });
  }

  // === IMAGE ALT CHECKS ===
  if (imagesWithoutAlt > 0) {
    if (imagesWithoutAlt > 10) {
      issues.push({ type: 'error', category: 'Afbeeldingen', message: `${imagesWithoutAlt} afbeeldingen zonder alt-tekst`, priority: 'high' });
      score -= 10;
    } else if (imagesWithoutAlt > 3) {
      issues.push({ type: 'warning', category: 'Afbeeldingen', message: `${imagesWithoutAlt} afbeeldingen zonder alt-tekst`, priority: 'medium' });
      score -= 5;
    } else {
      issues.push({ type: 'info', category: 'Afbeeldingen', message: `${imagesWithoutAlt} afbeeldingen zonder alt-tekst`, priority: 'low' });
      score -= 2;
    }
  }

  // === SCHEMA.ORG CHECKS (page type specific) ===
  const hasRequiredSchema = requirements.requiredSchema.every(
    schema => schemaTypes.some(s => s.toLowerCase() === schema.toLowerCase())
  );

  if (!hasRequiredSchema && requirements.requiredSchema.length > 0) {
    issues.push({ 
      type: 'warning', 
      category: 'Schema', 
      message: `Ontbrekende verplichte schema: ${requirements.requiredSchema.join(', ')}`, 
      priority: 'medium' 
    });
    score -= 8;
  }

  if (schemaTypes.length === 0) {
    issues.push({ type: 'info', category: 'Schema', message: 'Geen structured data gevonden', priority: 'low' });
    score -= 3;
  }

  // === INTERNAL LINKS CHECKS ===
  if (contentLinks < requirements.minInternalLinks) {
    issues.push({ 
      type: 'warning', 
      category: 'Links', 
      message: `Te weinig content links (${contentLinks}, aanbevolen: ${requirements.minInternalLinks}+)`, 
      priority: 'medium' 
    });
    score -= 5;
  }

  // Ensure score stays within bounds
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    pageType,
    issues,
    metrics: {
      titleLength,
      titleValid,
      metaDescriptionLength,
      metaDescriptionValid,
      metaDescriptionMissing,
      h1Count,
      h1Valid,
      wordCount,
      wordCountValid,
      imagesWithoutAlt,
      schemaTypesCount: schemaTypes.length,
      internalLinksCount: internalLinks,
      contentLinksCount: contentLinks,
    },
    requirements,
  };
}

// Helper to get page type label in Dutch
export function getPageTypeLabel(pageType: PageType): string {
  switch (pageType) {
    case 'homepage': return 'Homepage';
    case 'category': return 'Categoriepagina';
    case 'filter': return 'Filterpagina';
    case 'product': return 'Productpagina';
    default: return 'Overig';
  }
}

// Helper to get page type color for badge
export function getPageTypeColor(pageType: PageType): 'default' | 'secondary' | 'outline' {
  switch (pageType) {
    case 'category': return 'default';
    case 'product': return 'secondary';
    case 'filter': return 'outline';
    default: return 'outline';
  }
}
