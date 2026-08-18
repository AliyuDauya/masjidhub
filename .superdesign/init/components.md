# Components

## Button Primitives (`.btn-primary`, `.btn-secondary`)
Reusable button classes styled globally in `src/app/globals.css`.

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  background-color: var(--primary);
  color: #ffffff;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: var(--transition);
  text-decoration: none;
}

.btn-primary:hover {
  background-color: var(--primary-hover);
  transform: translateY(-1px);
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  background-color: transparent;
  color: var(--primary);
  border: 2px solid var(--primary);
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: var(--transition);
  text-decoration: none;
}

.btn-secondary:hover {
  background-color: var(--primary-light);
  transform: translateY(-1px);
}
```

## Card Primitives (`.card-premium`, `.glass-card`)
Card container primitives.

```css
.card-premium {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--border-radius);
  padding: 2rem;
  box-shadow: var(--shadow);
  transition: var(--transition);
}

.card-premium:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.glass-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--border-radius);
}
```

## Input Fields (`.input-field`)
Input styling for forms and search.

```css
.input-field {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  color: var(--foreground);
  outline: none;
  font-size: 0.95rem;
  transition: var(--transition);
}

.input-field:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}
```

## Eyebrow and Tenant Headers
Typography and branding accents.

```css
.tenant-band {
  border-top: 4px solid var(--tenant-color, var(--primary));
  background: linear-gradient(90deg, color-mix(in srgb, var(--tenant-color, var(--primary)) 10%, white), var(--card-bg) 45%);
}

.eyebrow {
  font: 700 .7rem/1 var(--font-geist-mono), monospace;
  letter-spacing: .13em;
  text-transform: uppercase;
  color: var(--primary);
}
```
