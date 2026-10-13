# Cobros con Stripe

Una **suscripción por cliente** con uno o varios planes (servicios sueltos o packs). El primer cobro incluye los
pagos iniciales y la primera cuota; después Stripe cobra solo cada mes (o cada año, con un 15 % de descuento).
Tarjeta o domiciliación SEPA. La baja es al **final del periodo pagado**. Las **facturas las emite la gestoría**:
Stripe solo cobra y el panel guarda cada cobro con los datos fiscales (CSV exportable).

## Cómo funciona

| Paso | Qué pasa |
|---|---|
| Ficha del cliente → **Cobros** → elegir planes → **Crear enlace de pago** | Stripe Checkout (modo suscripción) con tarjeta + SEPA, NIF/CIF y dirección fiscal |
| `checkout.session.completed` (tarjeta, `paid`) | Suscripción activa, se activan las automatizaciones del plan y se avisa por WhatsApp (n8n) |
| `checkout.session.completed` (SEPA, `unpaid`) | Estado *Pendiente de cobro*; no se activa nada todavía |
| `checkout.session.async_payment_succeeded` / `_failed` | Se activa como con tarjeta / el enlace queda *Fallido* |
| `invoice.paid` | Cobro apuntado (la factura del alta sustituye al apunte del checkout con los importes reales) |
| `invoice.payment_failed` | Estado *Cobro fallido*; Stripe reintenta |
| `customer.subscription.updated` | Baja programada, fecha de renovación |
| `customer.subscription.deleted` | Fin: se desactivan las automatizaciones del plan y se avisa por WhatsApp |

- Webhook: `POST /api/webhooks/stripe` (sin sesión; firma `Stripe-Signature` con `STRIPE_WEBHOOK_SECRET`). Cada evento se
  procesa una sola vez (`stripe_events`).
- Planes y precios: tabla `billing_plans` (céntimos, **sin IVA**). `automation_keys` = automatizaciones que activa.
  No se pueden combinar planes que repitan automatizaciones, ni multicanal con "solo Google".
- Exportación para la gestoría: `GET /api/billing/payments?from=AAAA-MM-DD&to=AAAA-MM-DD&format=csv` (botón en Cobros).
- Tablas: `prisma/proposed-migrations/007_stripe_billing.sql`.

## Fase 1 · local con el emulador (hecha)

```bash
docker run -d --name zihkon-stripe-dev ... (o docker compose -f docker-compose.dev.yml up -d, ya monta 005-007)
npx emulate@0.12.1 start -s stripe -p 4000 --seed dev/stripe-emulator.yaml
node --env-file=.env.stripe-dev scripts/stripe-sync-catalog.mjs   # crea productos y precios
set -a; . ./.env.stripe-dev; set +a; pnpm next dev -p 3100        # .env.stripe-dev: valores de prueba
```

El emulador cubre clientes, productos, precios, Checkout y el webhook `checkout.session.completed`. **No** tiene
suscripciones, facturas, SEPA ni portal: esos eventos se probaron enviando eventos firmados al webhook.

## Fase 2 · Stripe en modo test (pendiente)

1. En el panel de Stripe (modo test): activar **tarjeta** y **SEPA Direct Debit**; configurar el **portal de cliente**
   (cambiar forma de pago, cancelar al final del periodo, ver recibos); desactivar los emails de factura al cliente.
2. `.env` local con `STRIPE_SECRET_KEY=sk_test_…` (mejor una clave restringida) y sin `STRIPE_API_BASE`.
3. `node --env-file=.env scripts/stripe-sync-catalog.mjs --tax-rate` → copiar `STRIPE_TAX_RATE_ID`.
4. `stripe listen --forward-to localhost:3000/api/webhooks/stripe` → copiar el `whsec_…` a `STRIPE_WEBHOOK_SECRET`.
5. Probar con tarjetas de prueba (4242…, 4000 0000 0000 0341 para fallo) y el IBAN de prueba SEPA, y con **test
   clocks** la renovación, el impago, la baja al final del periodo y el cambio de plan.
6. Pendiente de implementar en fase 2: añadir/quitar un plan en una suscripción existente (con prorrateo), aviso por
   WhatsApp del enlace de pago y del cobro fallido (workflow de n8n), forma de pago exacta de cada cuota.

## Fase 3 · producción
Migración 007 en `auditorias`, variables en Coolify (`sk_live_…`, `whsec_…`, `STRIPE_TAX_RATE_ID`), endpoint de webhook
en el panel de Stripe con los eventos de la tabla, sincronizar el catálogo live y un primer cobro real pequeño.
