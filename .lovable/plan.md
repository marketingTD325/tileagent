

# Complete SEO Audit Tool Recommendations for tegeldepot.nl

## Analysis Summary

Based on the sitemap analysis, tegeldepot.nl has approximately **15,000+ URLs** with the following structure:

### URL Types Identified
| Type | Pattern | Example | Estimated Count |
|------|---------|---------|-----------------|
| **Product Pages** | `/product-name-slug` | `/bette-labette-plaatstalen-bad-124x71x42-cm-wit` | ~12,000 |
| **Category Pages** | `/category/subcategory` | `/bad/whirlpool-bad/bubbelbad` | ~500 |
| **Filter Pages** | `/category/.../filter/value` | `/badkamer-radiator/designradiator/radiator-breedte-reeks/40---to--50-cm` | ~800 |
| **Accessory Subcats** | `/category/subcategory/item-type` | `/badkamer-accessoires/badkamer-opbergers/tandenborstel-houders` | ~200 |
| **Homepage** | `/` | `https://www.tegeldepot.nl` | 1 |
| **Sitemaps** | `/sitemap.xml`, `/sitemap/...` | Technical files | ~10 |

---

## Phase 1: Intelligent Page Type Detection

### Problem
The current tool treats all pages identically, but product pages, category pages, and filter pages have different SEO requirements.

### Solution
Add automatic page type detection based on URL patterns:

```text
Detection Logic:
1. Homepage: path === "/"
2. Category Page: path matches /^\/[a-z-]+\/[a-z-]+$/ (max 2 segments, no product suffix)
3. Filter Page: path contains /filter-name/filter-value or /radiator-breedte-reeks/
4. Product Page: path has long product slug with dimensions/specs (e.g., "124x71x42-cm")
```

### Implementation
**File: `supabase/functions/scrape-page/index.ts`**
- Add `detectPageType(url: string)` function
- Return `pageType: 'homepage' | 'category' | 'filter' | 'product' | 'other'`
- Include in response alongside other metadata

**File: `supabase/functions/seo-analyze/index.ts`**
- Use page type to apply different scoring criteria
- Category pages: require 700-1000 words, FAQ, internal links
- Product pages: require schema.org Product, price, images with alt
- Filter pages: require unique meta description per filter combination

---

## Phase 2: Page Type-Specific Scoring Criteria

### Different Requirements per Page Type

| Criterion | Category Page | Product Page | Filter Page |
|-----------|--------------|--------------|-------------|
| Word Count | 700-1000 | 150-300 | 200-400 |
| Schema.org | BreadcrumbList, FAQPage | Product, Offer | BreadcrumbList |
| Internal Links | 5-6 for 800+ words | 2-3 related products | 3-4 parent/sibling |
| Meta Description | Required, unique | Required, with price | Required, filter-specific |
| H1 | Category name | Product name | Filter + Category |
| FAQ | Recommended | Optional | Not needed |

### Implementation
**File: `supabase/functions/seo-analyze/index.ts`**
- Create scoring functions per page type
- Adjust issue severity based on page type
- Add page type-specific recommendations

---

## Phase 3: Bulk Audit Queue System

### Problem
Auditing 15,000+ pages one-by-one is impractical.

### Solution
Add a bulk audit queue that processes URLs from sitemap in batches.

### New Features
1. **Sitemap URL Picker**: Select URLs from sitemap to queue for audit
2. **Batch Processing**: Process 10-20 URLs per batch with rate limiting
3. **Progress Dashboard**: Show completion status and summary
4. **Priority Scoring**: Sort pages by SEO urgency (missing meta, low word count)

### Implementation
**New database table: `seo_audit_queue`**
```sql
- id: uuid
- user_id: uuid
- url: text
- page_type: text (category, product, filter)
- status: text (pending, processing, completed, failed)
- priority: integer (1-100 based on initial quick check)
- result_id: uuid (references seo_audits)
- created_at, processed_at
```

**New UI Components:**
- Sitemap browser with URL filter/search
- Queue management panel
- Bulk audit progress tracker

---

## Phase 4: Sitemap Health Dashboard

### Overview Metrics
Display aggregate health for the entire site:

```text
+------------------+------------------+------------------+
| Categories       | Products         | Filter Pages     |
| 500 total        | 12,000 total     | 800 total        |
| 68% healthy      | 45% healthy      | 23% healthy      |
+------------------+------------------+------------------+

Top Issues (Site-wide):
1. 4,200 product pages missing alt tags
2. 890 filter pages with duplicate meta descriptions
3. 120 categories under 400 words
4. 2,100 pages without schema.org
```

### Implementation
**New page: `src/pages/SitemapHealth.tsx`**
- Aggregate view of all audited pages
- Filter by page type, score range, issue type
- Export problematic URLs as CSV for Magento import

---

## Phase 5: Quick Scan Mode (No AI Credits)

### Problem
Full AI analysis costs credits; users need a fast, free pre-scan.

### Solution
Add "Quick Scan" that only uses scraper data (no AI):

```text
Quick Scan Checks (FREE):
- Title present and length (50-60 chars)
- Meta description present and length (150-160 chars)
- H1 count (exactly 1)
- Word count (meets minimum for page type)
- Images without alt tags (count)
- Schema.org types present
- Internal links count
```

### Implementation
**File: `src/pages/SeoAudit.tsx`**
- Add "Quick Scan" button next to "Analyseer"
- Skip AI call, compute score locally
- Show limited results (no tone-of-voice, no AI recommendations)
- Estimated score based on technical checks only

**New function in `SeoAudit.tsx`:**
```typescript
function computeQuickScore(scrapedData): { score: number; issues: Issue[] } {
  // All checks based on scraped data, no AI
}
```

---

## Phase 6: Category-Specific Analysis Templates

### Problem
Tegeldepot has specific categories with different expectations.

### Solution
Create templates for main categories:

| Category | Focus Keywords | Expected Schema | Content Focus |
|----------|---------------|-----------------|---------------|
| /tegels/ | vloertegels, wandtegels | Product, BreadcrumbList | Material, sizes, styling |
| /bad/ | ligbad, whirlpool | Product, FAQPage | Installation, dimensions |
| /kranen/ | badkraan, keukenkraan | Product | Finish, compatibility |
| /badkamer-radiator/ | designradiator | Product | Wattage, dimensions |

### Implementation
**File: `supabase/functions/seo-analyze/index.ts`**
- Detect root category from URL path
- Apply category-specific expectations
- Generate category-aware recommendations

---

## Phase 7: Competitor Benchmark Integration

### Problem
Scores are absolute, but relative performance matters.

### Solution
Compare page against competitor equivalent:

```text
Your Category Page: /tegels/vloertegels
Score: 72/100 | Words: 650

Competitor Benchmark (x2o.nl):
Avg Score: 85 | Avg Words: 920

Gap Analysis:
- Add 270 more words to match competitor average
- Competitor uses FAQPage schema (you don't)
- Competitor has 8 internal links (you have 4)
```

### Implementation
**Store competitor benchmark data in `competitor_analyses` table**
- Link to SEO audit for comparison
- Show delta in audit results

---

## Phase 8: Historical Trend Tracking

### Problem
Can't see if pages are improving over time.

### Solution
Add trend visualization for re-audited pages:

```text
Page: /tegels/vloertegels

Score History:
Jan 2: 58 → Jan 15: 65 → Jan 28: 72 (+14 in 26 days)

Improvements Made:
- Meta description added (+5)
- Word count 420 → 650 (+4)
- Internal links 2 → 5 (+3)
```

### Implementation
**Database query:**
- Group `seo_audits` by URL
- Calculate score delta over time
- Show trend sparkline in UI

---

## Implementation Priority

| Phase | Effort | Impact | Priority |
|-------|--------|--------|----------|
| Phase 1: Page Type Detection | Medium | High | 1 |
| Phase 5: Quick Scan Mode | Low | High | 2 |
| Phase 2: Page Type Scoring | Medium | High | 3 |
| Phase 3: Bulk Audit Queue | High | High | 4 |
| Phase 4: Sitemap Dashboard | Medium | Medium | 5 |
| Phase 8: Historical Trends | Low | Medium | 6 |
| Phase 6: Category Templates | Medium | Medium | 7 |
| Phase 7: Competitor Benchmark | Medium | Low | 8 |

---

## Files to Modify/Create

| File | Changes |
|------|---------|
| `supabase/functions/scrape-page/index.ts` | Add `detectPageType()` function |
| `supabase/functions/seo-analyze/index.ts` | Add page-type specific scoring logic |
| `src/pages/SeoAudit.tsx` | Add Quick Scan mode, page type badge, trend display |
| `src/pages/SitemapHealth.tsx` (NEW) | Sitemap overview dashboard |
| `src/components/audit/AuditQueue.tsx` (NEW) | Bulk audit queue management |
| `src/components/audit/QuickScanResult.tsx` (NEW) | Non-AI scan results display |
| Database migration | Add `seo_audit_queue` table, add `page_type` column to `seo_audits` |

---

## Summary

This plan transforms the SEO Audit from a single-page analyzer into a comprehensive site-wide SEO management system tailored for tegeldepot.nl's 15,000+ page catalog. The priority order starts with high-impact, low-effort improvements (page type detection, quick scan) and progresses to the full bulk audit system.

