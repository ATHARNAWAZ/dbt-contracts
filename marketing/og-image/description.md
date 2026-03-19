# OG Image Design Brief

## Dimensions
1200 x 630px (standard OG image)

## Background
#0A0A0A (full bleed)

## Layout
Two-column layout:

LEFT COLUMN (600px wide, centered vertically, left padding 64px):
- Logo mark: ShieldCheck icon in #7C3AED, 40x40px
- Heading (line 1): "dbt-contracts" in Inter Bold 52px, #FAFAFA
- Subheading: "Data contracts for dbt." in Inter Regular 24px, #A1A1AA
- Tagline: "Upload manifest.json. Get contracts." in Inter Regular 18px, #52525B
- Bottom bar: Three stat pills:
  - "Free" — #10B981 text, dark green bg
  - "Open source" — #7C3AED text, dark purple bg
  - "No install" — #A1A1AA text, dark surface bg

RIGHT COLUMN (500px wide, right padding 48px):
- Code block (rounded 12px, #111111 background, 1px #1F1F1F border):
  - Padding 24px
  - Font: JetBrains Mono, 13px
  - Content: Syntax-highlighted contract YAML:
    ```
    version: 1
    model: orders
    owner: analytics
    freshness:
      warn_after_hours: 24
    columns:
      order_id:
        not_null: true
        unique: true
      status:
        accepted_values:
          - completed
          - pending
    ```
  - Purple syntax highlights for keys (#7C3AED)
  - Green for boolean true (#10B981)
  - Yellow/warm for string values (#F59E0B)

## Subtle background elements
- Very faint radial gradient at top-left: rgba(124, 58, 237, 0.08)
- 1px border at very bottom: #1F1F1F (feels like a card edge)

## Typography
- All text: Inter
- Code: JetBrains Mono
- Text rendering: antialiased

## File output
- /marketing/og-image/og-image.png (production)
- /marketing/og-image/og-image@2x.png (retina)
- /public/og-image.png (copy for frontend build)
