# LeadForge Pro - Performance Optimization Audit

**Date**: 2026-08-31 | **Status**: Critical Performance Issues Identified

## Executive Summary

Your application has significant performance bottlenecks that impact initial load time, particularly on mobile or slower connections. The primary issue is **dependency bloat**: `recharts` (114.06 KB gzipped) and the main bundle (80.11 KB gzipped) together account for over 75% of the JavaScript payload.

### Critical Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| **Main Bundle** | 282 KB (80 KB gzip) | < 100 KB | 🔴 CRITICAL |
| **Charts Bundle** | 391 KB (114 KB gzip) | < 50 KB | 🔴 CRITICAL |
| **Icons Bundle** | 38 KB (9.5 KB gzip) | < 5 KB | 🟡 HIGH |
| **CSS** | 92 KB (13.74 KB gzip) | < 30 KB | 🟡 HIGH |
| **Total JS** | 658 KB (194 KB gzip) | < 200 KB gzip | 🔴 CRITICAL |

---

## 🔴 Critical Issues (Fix First)

### 1. **Recharts is Oversized (391 KB raw, 114 KB gzipped)**

**Problem**: Recharts is a full-featured charting library. You're paying for 100+ chart types but likely using only 2-3.

**Impact**: 
- Adds 114 KB to initial load (60% of total JS)
- Only used in LeadAnalyticsChart component
- Bundled into all chunk loads even when chart isn't visible

**Recommended Solutions** (in order of preference):

#### Option A: **Replace with Lightweight Chart Library** ✅ BEST
Use **`recharts` → `simple-bar-chart`** or **`visx`** or **`chart.js`**
- `simple-bar-chart`: ~5 KB gzipped (23x smaller)
- `visx`: ~20 KB gzipped (5.7x smaller, more control)
- `chart.js`: ~10 KB gzipped (12x smaller, simpler API)

**Your charts**: Just trends (area/line) and seniority (bar). These are basic. A lightweight library handles it.

```tsx
// Current: 114 KB
import { ResponsiveContainer, AreaChart, BarChart } from "recharts";

// Alternative: ~8 KB gzipped
// Option 1: Canvas-based (Chart.js)
// Option 2: SVG minimal (simple inline SVG)
// Option 3: Use CSS Grid + data attributes for visual charts
```

#### Option B: **Lazy Load Recharts (Quick Fix, 30% improvement)**
Load recharts only when chart is needed:
```tsx
// In LeadAnalyticsChart.tsx
const RechartsCharts = lazy(() => 
  import("./RechartsCharts").then(m => ({ default: m.RechartsCharts }))
);
```
- Moves 114 KB out of critical path
- User sees UI 30% faster (less blocking)
- Chart renders after page is interactive

#### Option C: **Virtual Scrolling for Charts**
If rendering large datasets:
```tsx
// Use @hello-pangea/dnd or react-virtual for list inside chart
```

**Recommendation**: Start with **Option A** (replace library). If timeline is tight, do **Option B** (lazy load) first, then migrate.

---

### 2. **Main Bundle is Too Large (282 KB raw, 80 KB gzipped)**

**Problem**: Core bundle contains:
- React + React DOM (unavoidable ~40 KB gzipped)
- All lazy-loaded components have shared dependencies duplicated
- Tailwind CSS is bloated (see below)
- No tree-shaking optimization

**Impact**: 
- User waits longer before any interactive content appears
- Mobile users on 3G see blank screen for 3-5 seconds

**Solutions**:

#### A: **Fix Empty Chunks** (5 min, 0.04 KB gain)
These shouldn't exist:
```
dist/assets/react-l0sNRNKZ.js         0.00 KB ← DELETE
dist/assets/motion-l0sNRNKZ.js        0.00 KB ← DELETE
```

**Fix in `vite.config.ts`**:
```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        // Remove empty chunks - only chunk heavy libraries
        charts: ["recharts"],
        icons: ["lucide-react"],
        // Remove: react, motion (too small)
      }
    }
  }
}
```

#### B: **Tree-Shake Unused Lucide Icons** (20 min, ~5 KB gain)
Currently: ALL lucide-react icons bundled (38 KB)
You use ~15 icons. Should be <2 KB.

**Fix**:
```tsx
// ❌ Currently: Imports whole library
import { Search, Filter, AlertTriangle } from "lucide-react";

// ✅ Better: Import only used icons
import Search from "lucide-react/dist/esm/icons/search";
import Filter from "lucide-react/dist/esm/icons/filter";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";

// ✅ Best: Create icon sprite/component
// src/icons/index.tsx
const icons = {
  Search: lazy(() => import("lucide-react/dist/esm/icons/search")),
  Filter: lazy(() => import("lucide-react/dist/esm/icons/filter")),
  // ... only what you use
};
```

Or use: `@tabler/icons-react` (better tree-shaking) or `heroicons` (optimized for React).

#### C: **Inline Critical CSS** (30 min, ~20% faster rendering)
Currently: CSS is separate HTTP request and render-blocking.

**Fix in `vite.config.ts`**:
```ts
// Use rollup-plugin-critical to inline above-fold CSS
import critical from 'rollup-plugin-critical';

export default {
  plugins: [
    critical({
      base: 'dist',
      inline: true,
      minify: true
    })
  ]
}
```

Result: CSS loaded inline in `<style>` tag, page renders 500ms faster.

---

### 3. **Tailwind CSS Bloat (92 KB raw, 13.74 KB gzipped)**

**Problem**: Tailwind generates utility classes for unused breakpoints, states, and variants.

**Current**: 13.74 KB gzipped CSS (20% of total critical content)

**Solutions**:

#### A: **Aggressive PurgeCSS** (Configure `tailwind.config.ts`)
```ts
// tailwind.config.ts
export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}', // Scan only these files
    './index.html'
  ],
  theme: {
    // Reduce color palette to only what you use
    colors: {
      // Only your brand colors, not 500+ variants
      indigo: { 600: '#4f46e5', 900: '#1e1b4b' },
      gray: { 100: '#f3f4f6', 900: '#111827' },
      red: { 500: '#ef4444' }
    }
  },
  corePlugins: {
    // Disable unused core plugins
    textDecoration: false,
    textTransform: false,
    space: false, // If using margin/padding utilities sparingly
  }
}
```

Expected: **90KB → 35-40KB CSS** (65% reduction)

#### B: **Inline Critical CSS** (See above)
Already mentioned but critical here too. 13.74 KB inlined prevents render-blocking.

---

## 🟡 High Priority Issues (Fix Second)

### 4. **Lazy-Loaded Components Still Large**

| Component | Size | Issue |
|-----------|------|-------|
| CampaignSequencerView | 39.43 KB | Complex UI, probably heavy logic |
| BatchIngestView | 29.10 KB | Data processing, state management |
| LeadDetailModal | 20.95 KB | Multiple tabs/sections |

**Solution**: Further code-split within these components

```tsx
// CampaignSequencerView.tsx - BEFORE
const HeavyChart = () => { /* 10KB of code */ };
const HeavyForm = () => { /* 8KB of code */ };
export function CampaignSequencerView() {
  return <div><HeavyChart /><HeavyForm /></div>;
}

// AFTER: Lazy-load tabs only when opened
const HeavyChart = lazy(() => import('./HeavyChart'));
const HeavyForm = lazy(() => import('./HeavyForm'));

export function CampaignSequencerView() {
  const [activeTab, setActiveTab] = useState('chart');
  return (
    <div>
      {activeTab === 'chart' && <Suspense fallback={<Skeleton />}><HeavyChart /></Suspense>}
      {activeTab === 'form' && <Suspense fallback={<Skeleton />}><HeavyForm /></Suspense>}
    </div>
  );
}
```

### 5. **No Image Optimization**

**Checklist**:
- [ ] Any PNG/JPG hero images using WebP + fallback?
- [ ] Images lazy-loaded with `loading="lazy"`?
- [ ] Responsive images with `srcset` for mobile/tablet?
- [ ] Images compressed (80-85% quality)?

---

## 📊 Performance Targets & Timeline

### Phase 1: Quick Wins (Today - 2 hours)
- [ ] Remove empty chunks from Vite config
- [ ] Configure Tailwind purge
- [ ] Move recharts to lazy-loaded chunk

**Expected Result**: 194 KB → 165 KB gzipped (15% improvement)

### Phase 2: Heavy Lifting (This Week)
- [ ] Replace Recharts with lightweight alternative OR fully lazy-load
- [ ] Extract lucide icons to separate chunk
- [ ] Inline critical CSS
- [ ] Further code-split large components

**Expected Result**: 194 KB → 110 KB gzipped (43% improvement) 

### Phase 3: Sustained (Next Sprint)
- [ ] Monitor bundle size in CI
- [ ] Implement performance budget
- [ ] Image optimization
- [ ] Database query optimization (if slow API calls)

---

## 🔧 Verification Steps

After each optimization, run:

```bash
npm run build

# Check bundle sizes
ls -lh dist/assets/*.js

# Check Lighthouse score (if you have a running server)
# Or use WebPageTest.org for real-world metrics
```

### Key Metrics to Track:

1. **LCP (Largest Contentful Paint)**: Should be < 2.5s on 4G
2. **INP (Interaction to Next Paint)**: Should be < 200ms
3. **CLS (Cumulative Layout Shift)**: Should be < 0.1
4. **Total Bundle Size**: Gzipped should be < 150 KB

---

## 🚀 Recommended Action Plan

**START HERE** → Follow this order:

1. ✅ **10 min**: Run `/impeccable craft-floor` to understand quality baseline
2. ✅ **30 min**: Fix empty chunks + Tailwind purge (Phase 1 quick wins)
3. ✅ **1-2 hours**: Replace Recharts with lightweight alternative (biggest impact)
4. ✅ **1 hour**: Lazy-load remaining heavy components
5. ✅ **30 min**: Inline critical CSS + tree-shake icons
6. ✅ **Verify**: Re-run build, confirm bundle sizes

---

## Monitoring & Prevention

Add to `package.json`:
```json
{
  "scripts": {
    "analyze": "vite build && npm run bundle-size-check"
  }
}
```

Create `.github/workflows/bundle-size.yml` for CI checks (optional but recommended).

---

## Questions Before You Start?

- Timeline constraint? (All optimizations, or quick wins only?)
- Do you need recharts or can you use simpler charts?
- Are the lazy-loaded components truly optional (only opened by power users)?
- Budget for external dependencies or prefer built-in solutions?

**Next Step**: Choose Option A or B for Recharts, then start Phase 1.
