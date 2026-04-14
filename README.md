# CVA Dropshipping Panel · Electronics México

Panel de operación dropshipping CVA, desplegado como GitHub Pages.
La lógica de negocio vive en Google Apps Script (GAS) — este repo solo contiene el frontend.

## Estructura

```
index.html   ← UI completa (todo en un solo archivo)
README.md
```

## Deploy

1. Este repo debe tener **GitHub Pages** habilitado desde `Settings → Pages → Deploy from branch: main / root`.
2. La URL queda como: `https://{usuario}.github.io/{repo}/`

## Configuración GAS

La URL del backend está en `index.html` en la constante `GAS_URL`:

```js
const GAS_URL = 'https://script.google.com/macros/s/AKfycby9.../exec';
```

Si redespliegas el GAS con una nueva URL, actualiza esa línea y haz commit.

## Backend GAS

Los archivos `.gs` del backend están en el proyecto de Google Apps Script:
- `Code.gs` — router principal, triggers, config
- `cva.gs` — endpoints CVA API
- `odoo.gs` — integración Odoo XML-RPC

El Web App debe estar desplegado como:
- **Execute as:** Me
- **Who has access:** Anyone
