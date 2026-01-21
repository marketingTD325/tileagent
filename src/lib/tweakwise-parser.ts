/**
 * Tweakwise URL Parser
 * Parses URL paths to extract search attributes for Tweakwise integration
 * 
 * Examples:
 * - "kleur/chroom" → { attribute: "kleur", value: "Chroom" }
 * - "diameter-regendouche/30-cm" → { attribute: "diameter regendouche", value: "30 cm" }
 */

export interface TweakwiseAttribute {
  attribute: string;
  value: string;
}

export interface ParsedFilterUrl {
  basePath: string;
  categoryPath: string;
  attributes: TweakwiseAttribute[];
  searchAttributesString: string;
}

/**
 * Parses a filter URL path and extracts Tweakwise attributes
 * URL format: category/subcategory/attribute/value
 * Example: kranen/regendouche/kleur/chroom
 */
export function parseFilterUrl(urlPath: string): ParsedFilterUrl {
  const segments = urlPath.split('/').filter(Boolean);
  
  // Find where attributes start (after category path)
  // Attributes are typically in pairs: attribute/value
  // Common attributes: kleur, materiaal, diameter, afmeting, merk, etc.
  const knownAttributes = [
    'kleur', 'materiaal', 'merk', 'afmeting', 'diameter', 'diameter-regendouche',
    'breedte', 'hoogte', 'diepte', 'stijl', 'vorm', 'oppervlak', 'type',
    'serie', 'lengte', 'uitvoering', 'model', 'functie'
  ];
  
  let attributeStartIndex = -1;
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i].toLowerCase();
    if (knownAttributes.includes(segment)) {
      attributeStartIndex = i;
      break;
    }
  }
  
  if (attributeStartIndex === -1 || attributeStartIndex >= segments.length - 1) {
    // No attributes found, entire path is category
    return {
      basePath: urlPath,
      categoryPath: segments.join('/'),
      attributes: [],
      searchAttributesString: ''
    };
  }
  
  const categoryPath = segments.slice(0, attributeStartIndex).join('/');
  const attributeSegments = segments.slice(attributeStartIndex);
  const attributes: TweakwiseAttribute[] = [];
  
  // Process attribute/value pairs
  for (let i = 0; i < attributeSegments.length; i += 2) {
    if (i + 1 < attributeSegments.length) {
      const rawAttribute = attributeSegments[i];
      const rawValue = attributeSegments[i + 1];
      
      attributes.push({
        attribute: formatAttribute(rawAttribute),
        value: formatValue(rawValue)
      });
    }
  }
  
  return {
    basePath: urlPath,
    categoryPath,
    attributes,
    searchAttributesString: attributes
      .map(a => `${a.attribute}:${a.value}`)
      .join('|')
  };
}

/**
 * Format attribute name (lowercase, dashes to spaces)
 * Example: "diameter-regendouche" → "diameter regendouche"
 */
function formatAttribute(raw: string): string {
  return raw.toLowerCase().replace(/-/g, ' ');
}

/**
 * Format value (capitalize first letter, dashes to spaces)
 * Example: "30-cm" → "30 cm"
 * Example: "chroom" → "Chroom"
 */
function formatValue(raw: string): string {
  const formatted = raw.replace(/-/g, ' ');
  // Capitalize first letter if it's a letter
  if (/^[a-z]/.test(formatted)) {
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
  return formatted;
}

/**
 * Tweakwise Template mapping based on category
 * Maps parent categories to their Tweakwise template names
 */
export const TWEAKWISE_TEMPLATES: Record<string, string> = {
  'kranen': 'TEMPLATE_KRANEN',
  'tegels': 'TEMPLATE_TEGELS',
  'wandtegels': 'TEMPLATE_TEGELS',
  'vloertegels': 'TEMPLATE_TEGELS',
  'badkamermeubels': 'TEMPLATE_MEUBELS',
  'toiletten': 'TEMPLATE_TOILETTEN',
  'douchewanden': 'TEMPLATE_DOUCHE',
  'radiator': 'TEMPLATE_RADIATOR',
  'accessoires': 'TEMPLATE_ACCESSOIRES',
  'baden': 'TEMPLATE_BADEN',
  'spiegels': 'TEMPLATE_SPIEGELS',
};

/**
 * Get Tweakwise template for a category path
 */
export function getTweakwiseTemplate(categoryPath: string): string | null {
  const firstSegment = categoryPath.split('/')[0]?.toLowerCase();
  return TWEAKWISE_TEMPLATES[firstSegment] || null;
}

/**
 * Generate export data for a filter page
 */
export interface FilterPageExportData {
  store_ids: string;
  active: string;
  url_path: string;
  category_id: string;
  type: string;
  search_attributes: string;
  hide_selected_filter_group: string;
  tweakwise_template: string | null;
  name: string;
  meta_title: string;
  meta_description: string;
  description: string;
}

export function generateFilterPageExportData(
  urlPath: string,
  categoryId: string,
  name: string,
  metaTitle: string,
  metaDescription: string,
  description: string
): FilterPageExportData {
  const parsed = parseFilterUrl(urlPath);
  
  return {
    store_ids: '1,3', // Default: NL + Zeewolde
    active: '1',
    url_path: urlPath,
    category_id: categoryId,
    type: 'filter API 2026',
    search_attributes: parsed.searchAttributesString,
    hide_selected_filter_group: '1',
    tweakwise_template: getTweakwiseTemplate(parsed.categoryPath),
    name,
    meta_title: metaTitle,
    meta_description: metaDescription,
    description
  };
}
