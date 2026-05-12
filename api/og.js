// Vercel Edge Function — generates the Open Graph share image at /api/og.
// 1200x630 PNG.
//
// No query params → generic site card (EC monogram + wordmark + tagline).
// ?title=<article title> → per-article card with smaller monogram and the
// title rendered as the focal element.
//
// Uses @vercel/og's plain-object element syntax (no JSX/React build step).

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const NAVY = '#0f2638';
const ACCENT = '#1a3a52';
const TERRACOTTA = '#b86b34';
const BEIGE_BG = '#f0eee9';
const BEIGE_BORDER = '#e0dcd2';
const SLATE = '#1f2937';

function el(type, style, children) {
  return { type, props: { style, children } };
}

function genericCard() {
  return el(
    'div',
    {
      width: '1200px',
      height: '630px',
      background: BEIGE_BG,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '70px',
      fontFamily: 'Georgia, "Times New Roman", serif',
    },
    [
      el(
        'div',
        {
          width: '220px',
          height: '220px',
          background: '#ffffff',
          border: `2px solid ${BEIGE_BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        el(
          'div',
          {
            fontSize: '170px',
            fontStyle: 'italic',
            fontWeight: 500,
            color: ACCENT,
            letterSpacing: '-4px',
            lineHeight: 1,
            fontFamily: 'Georgia, "Times New Roman", serif',
          },
          'EC',
        ),
      ),
      el(
        'div',
        {
          marginTop: '50px',
          fontSize: '92px',
          fontStyle: 'italic',
          fontWeight: 400,
          color: NAVY,
          letterSpacing: '-2px',
          lineHeight: 1,
          fontFamily: 'Georgia, "Times New Roman", serif',
        },
        'Engage Colorado',
      ),
      el('div', { marginTop: '28px', width: '60px', height: '3px', background: TERRACOTTA }, ''),
      el(
        'div',
        {
          marginTop: '28px',
          fontSize: '34px',
          fontStyle: 'italic',
          fontWeight: 400,
          color: SLATE,
          lineHeight: 1.35,
          textAlign: 'center',
          maxWidth: '960px',
          fontFamily: 'Georgia, "Times New Roman", serif',
        },
        "Colorado's Journey to Become the World's Top Innovation Ecosystem",
      ),
    ],
  );
}

function articleCard(title) {
  // Scale title font with length so long titles still fit on 1200x630.
  const len = title.length;
  let titleFontSize = 78;
  if (len > 50) titleFontSize = 64;
  if (len > 80) titleFontSize = 54;
  if (len > 110) titleFontSize = 46;

  return el(
    'div',
    {
      width: '1200px',
      height: '630px',
      background: BEIGE_BG,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '80px 90px',
      fontFamily: 'Georgia, "Times New Roman", serif',
    },
    [
      // Top: wordmark row
      el(
        'div',
        { display: 'flex', alignItems: 'center', gap: '24px' },
        [
          el(
            'div',
            {
              width: '88px',
              height: '88px',
              background: '#ffffff',
              border: `2px solid ${BEIGE_BORDER}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
            el(
              'div',
              {
                fontSize: '64px',
                fontStyle: 'italic',
                fontWeight: 500,
                color: ACCENT,
                letterSpacing: '-2px',
                lineHeight: 1,
                fontFamily: 'Georgia, "Times New Roman", serif',
              },
              'EC',
            ),
          ),
          el(
            'div',
            {
              fontSize: '38px',
              fontStyle: 'italic',
              fontWeight: 400,
              color: NAVY,
              letterSpacing: '-1px',
              fontFamily: 'Georgia, "Times New Roman", serif',
            },
            'Engage Colorado',
          ),
        ],
      ),
      // Middle: title
      el(
        'div',
        { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', paddingTop: '24px', paddingBottom: '24px' },
        [
          el(
            'div',
            {
              fontSize: `${titleFontSize}px`,
              fontStyle: 'italic',
              fontWeight: 400,
              color: NAVY,
              letterSpacing: '-1.5px',
              lineHeight: 1.15,
              fontFamily: 'Georgia, "Times New Roman", serif',
              maxWidth: '1020px',
              display: 'block',
            },
            title,
          ),
        ],
      ),
      // Bottom: terracotta rule + tag
      el(
        'div',
        { display: 'flex', alignItems: 'center', gap: '20px' },
        [
          el('div', { width: '60px', height: '3px', background: TERRACOTTA }, ''),
          el(
            'div',
            {
              fontSize: '20px',
              fontWeight: 600,
              color: SLATE,
              letterSpacing: '4px',
              textTransform: 'uppercase',
              fontFamily: 'Georgia, "Times New Roman", serif',
            },
            'Newsletter',
          ),
        ],
      ),
    ],
  );
}

export default function handler(req) {
  let title = '';
  try {
    const url = new URL(req.url);
    title = (url.searchParams.get('title') || '').trim().slice(0, 200);
  } catch (_) {
    title = '';
  }

  return new ImageResponse(title ? articleCard(title) : genericCard(), {
    width: 1200,
    height: 630,
    headers: {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
