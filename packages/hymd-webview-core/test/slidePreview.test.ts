import { describe, expect, it } from 'vitest';
import { renderSlideThumbnail } from '../src/slidePreview.js';

describe('slidePreview', () => {
  it('renderSlideThumbnail produces html and css', () => {
    const md = `---
marp: true
---
# Hello Slide

---

## Second (hidden in thumb)
`;
    const { html, css } = renderSlideThumbnail(md);
    expect(html).toContain('Hello Slide');
    expect(css).toContain('section:not(:first-of-type)');
  });
});
