# Extractable Components

## Layout Components

### HeaderNav
- Source: `frontend/src/app/page.tsx`
- Category: layout
- Description: Global header with branding, search, and action triggers
- Extractable props: searchQuery (string, default: ""), showRegisterModal (boolean, default: false)
- Hardcoded: Navigation links, SVG icons, base classes

### MosqueHeaderBand
- Source: `frontend/src/app/mosque/[slug]/page.tsx`
- Category: layout
- Description: Mosque tenant header band with brand dynamic color
- Extractable props: slug (string), mosqueName (string), address (string), brandColor (string)
- Hardcoded: Navigation links, action buttons, layout grid

## Basic Components

### PrayerTimetableCard
- Source: `frontend/src/app/mosque/[slug]/page.tsx`
- Category: basic
- Description: Today's iqamah prayer time list card
- Extractable props: timezone (string), prayerTimes (array)
- Hardcoded: Prayer names, layout classes

### NoticeboardCard
- Source: `frontend/src/app/mosque/[slug]/page.tsx`
- Category: basic
- Description: Announcements feed list card
- Extractable props: announcements (array)
- Hardcoded: Card layout, category badge styling
