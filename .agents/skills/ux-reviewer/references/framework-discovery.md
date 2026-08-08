# Framework Discovery Patterns

When exploring a codebase for UX review, use these patterns to find all UI-related files. Detect the framework first (check for `package.json`, `requirements.txt`, `Gemfile`, `Cargo.toml`, or similar), then use the matching patterns below.

## Django / Python Web
- Templates: `**/templates/**/*.html`
- Views: `**/views.py`, `**/views/**/*.py`
- URLs: `**/urls.py`
- Static assets: `**/static/**/*.{css,js}`
- Models: `**/models.py`, `**/models/**/*.py`
- Forms: `**/forms.py`
- Middleware: `**/middleware.py`
- Settings (for installed apps, auth backends): `**/settings*.py`

## React / Next.js
- Components: `src/components/**/*.{jsx,tsx}`, `components/**/*.{jsx,tsx}`
- Pages/routes: `src/pages/**/*`, `app/**/{page,layout,loading,error}.{jsx,tsx}`
- API routes: `src/pages/api/**/*`, `app/api/**/route.{js,ts}`
- Styles: `**/*.{css,scss,module.css}`, `tailwind.config.*`
- State management: `**/store/**/*`, `**/context/**/*`, `**/hooks/**/*`
- Navigation config: look for React Router setup, Next.js middleware, or layout files

## Vue / Nuxt
- Components: `src/components/**/*.vue`, `components/**/*.vue`
- Pages: `src/views/**/*.vue`, `pages/**/*.vue`
- Router: `src/router/**/*`, `router/**/*`
- Stores: `src/stores/**/*`, `src/store/**/*`
- Layouts: `layouts/**/*.vue`
- Styles: `**/*.{css,scss}`, `assets/css/**/*`

## Svelte / SvelteKit
- Components: `src/lib/**/*.svelte`, `src/components/**/*.svelte`
- Routes: `src/routes/**/*.svelte`, `src/routes/**/+page.svelte`
- Layouts: `src/routes/**/+layout.svelte`
- Styles: `**/*.css`, `src/app.css`

## Rails
- Views: `app/views/**/*.{erb,haml,slim}`
- Controllers: `app/controllers/**/*.rb`
- Routes: `config/routes.rb`
- Assets: `app/assets/**/*`, `app/javascript/**/*`
- Models: `app/models/**/*.rb`
- Helpers: `app/helpers/**/*.rb`
- Layouts: `app/views/layouts/**/*`

## Laravel / PHP
- Views: `resources/views/**/*.blade.php`
- Controllers: `app/Http/Controllers/**/*.php`
- Routes: `routes/web.php`, `routes/api.php`
- Assets: `resources/css/**/*`, `resources/js/**/*`
- Models: `app/Models/**/*.php`
- Middleware: `app/Http/Middleware/**/*.php`

## Flutter / Mobile
- Screens: `lib/screens/**/*.dart`, `lib/pages/**/*.dart`
- Widgets: `lib/widgets/**/*.dart`
- Routes: look for `MaterialApp` router config, `go_router` setup
- State: `lib/providers/**/*`, `lib/bloc/**/*`, `lib/cubit/**/*`
- Theme: look for `ThemeData` definitions

## General (framework-agnostic)

If you can't identify the framework or it's something unusual:

1. **Find the entry point**: `index.html`, `main.*`, `app.*`, `server.*`
2. **Find the layout/shell**: the outermost template that wraps all pages
3. **Find route config**: search for URL patterns, path definitions, route maps
4. **Find auth/middleware**: search for login, permission, role-related code
5. **Find CSS/design tokens**: search for CSS custom properties, theme files, design system
6. **Find form handling**: search for `<form`, `onSubmit`, POST handlers
7. **Find AJAX/fetch calls**: search for `fetch(`, `axios`, `XMLHttpRequest`, WebSocket

## What to Ask the Explore Agent

When dispatching the Explore agent, include these in the prompt:

> Read the FULL content of every template/component file — not just file names.
> Read all view/controller files that serve these templates.
> Read the route/URL configuration completely.
> Read the base layout/shell and all CSS/style files.
> Read any client-side JavaScript/TypeScript that handles user interactions.
> Read data model definitions to understand the shapes behind the screens.
> For each screen, identify: URL, role access, available actions, navigation targets.
> Map which templates are served by which views at which URLs.
> Identify role-based differences in what different users see.
> Note the design system: colors, typography, spacing, component patterns.
