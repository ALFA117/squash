# Continuación

Documento de entrega. Aquí está dónde quedó el proyecto, hasta dónde tiene que
llegar, y todo lo que necesitas para no adivinar nada.

**Deadline: domingo 13 de septiembre, 10:00.** El check-in #2 del evento vence
el jueves 10 a las 21:59 y lo cierra Alfa, no tú.

---

## 1. Qué es Squash

Un motor de compensación multilateral. Le das N deudas cruzadas entre N
personas y devuelve el plan de liquidación con el **mínimo demostrable** de
transferencias. Después las liquida en una sola transacción que no se ejecuta
hasta que todos firmaron.

> `git squash`, pero para dinero.

La app de gastos compartidos es la demo. **El producto es el motor**, y se
cobra por uso: cualquier app o agente lo llama y paga por obligación vía x402
sobre Hedera. Sin llave de API, sin suscripción, sin cuenta.

```
15 deudas entre 6 personas  →  3 transferencias  ·  80% menos comisiones
```

Es para el hackathon **ETHOnline 2026**, track *Building from Scratch*. El
premio que perseguimos es el de Hedera (**$6,000**, hasta 3 equipos de $2,000)
y ya cumplimos sus dos requisitos duros.

---

## 2. Dónde quedó

Todo esto corre hoy y se puede verificar en el explorador:

| Pieza | Estado |
|---|---|
| Solver de mínimo demostrable | listo, 15 tests |
| `POST /api/v1/net` cobrado por obligación | listo, en vivo |
| Puerta x402 (esquema `exact` de Hedera vía Blocky402) | listo |
| Un agente que descubre, paga y recibe | listo, pagó en cadena |
| La app pagándole al motor por el navegador | listo |
| Prueba de cada corrida publicada en HCS | listo |
| Liquidación atómica con Scheduled Transactions | listo, ejecuta con la última firma |
| Portada + 6 pantallas | listo, en vivo |

**Pruebas en cadena, ábrelas:**

- Pago del agente al motor —
  [`0.0.7162784@1789008230.889484170`](https://hashscan.io/testnet/transaction/0.0.7162784-1789008230-889484170).
  Fíjate en la tercera línea: el facilitador pagó la comisión de red. El agente
  gastó 0.00525 ℏ en el servicio y **cero en gas**.
- Prueba de las corridas — [topic `0.0.10452145`](https://hashscan.io/testnet/topic/0.0.10452145)
- Liquidación ejecutada — [schedule `0.0.10453459`](https://hashscan.io/testnet/schedule/0.0.10453459)

**En vivo:** <https://squash-pay.vercel.app>

---

## 3. Hasta dónde tiene que llegar

Tres cosas, en este orden. Si algo se atrasa, se corta de abajo hacia arriba.

### 3.1 Privy — $2,500 · lo más importante

Es lo único que sigue teniendo forma de demo: **la app tiene las llaves de las
seis personas**. Eso está bien para enseñar el mecanismo y está mal para un
producto. Privy lo reemplaza con carteras por usuario que la app nunca ve.

Qué pide el track *Best financial flow*: integrar Privy como parte central,
crear o usar al menos una cartera Privy, completar un flujo financiero real, y
entregar demo + código.

Dónde va:

- `src/lib/sample.ts` define a las seis personas con `id`, `name`, `initial`.
  Hoy sus cuentas de Hedera viven en `src/lib/demoAccounts.ts` leídas de
  `DEMO_ACCOUNTS_JSON`. Ahí es donde entra Privy: cada persona deja de ser un
  registro fijo y pasa a ser un usuario con su cartera embebida.
- `src/app/api/settle/sign/route.ts` firma en nombre de alguien porque tiene su
  llave. Con Privy, quien firma es el usuario desde su dispositivo.
- `src/app/join/page.tsx` es la pantalla de entrada — ahí va el login social.

**Regla de producto que no se rompe:** el usuario final nunca ve las palabras
*wallet*, *blockchain*, *cripto*, *gas* ni *frase semilla*. En ninguna de las
seis pantallas. La comisión se muestra en pesos, no en HBAR. La cara técnica
existe, pero es para el juez, no para la señora que dividió la casa de Valle.

Necesitas un **App ID** de dashboard.privy.io. Es gratis y el App ID es
público; el App Secret no se necesita del lado del cliente.

### 3.2 World Selfie Check — $3,500, tres ganadores

Solo si el acceso al sandbox llega. **Es un formulario externo con latencia
desconocida en el camino crítico** — el mismo tipo de trampa por la que
sacamos Chainlink del plan. Si no llegó para el viernes en la noche, se
entrega con dos SDKs y ya. El evento permite *hasta* tres, no exige tres.

`src/app/join/page.tsx` ya está escrita como el lugar donde va, y con el
argumento correcto: un conjunto de compensación es tan honesto como sus
miembros. Quien pueda inventarse contrapartes inyecta deudas fantasma al grafo
y sale neto positivo. **Una persona, un nodo.** Eso es resistencia a sybil
sobre el grafo, que es literal lo que World pide.

El track también exige un **documento de feedback** sobre la integración. La
mitad de los equipos lo omite por prisa; son puntos regalados.

### 3.3 Entregables de la submission

- **Video de máximo 5 minutos.** Sin esto es cero en todos los tracks.
- Descripción del proyecto en inglés.
- Diagrama de arquitectura (Hedera lo pide; hoy está en prosa en el README).

**El mejor momento para el video es `/sign`:** se ve a Diego firmar, a Luis
firmar, y con la tercera firma la transacción se ejecuta sola. Son firmas
reales cayendo una por una, no un temporizador. Los primeros 15 segundos
deberían ser el grafo enredado colapsando a tres flechas.

---

## 4. Especificaciones técnicas

### 4.1 Stack

Next.js 16.3 (App Router, Turbopack) · React 19 · TypeScript estricto ·
vitest · `@hashgraph/sdk` · `@x402/fetch` + `@x402/hedera` + `@x402/core`.
CSS plano con tokens, sin framework. Desplegado en Vercel.

### 4.2 El solver — `src/lib/netting.ts`

Es el producto. Todo el dinero son **centavos enteros**; ningún float toca
dinero. Cuatro pasos:

1. **Expandir** — cada gasto compartido se vuelve obligaciones. Los centavos
   que no dividen exacto se reparten uno por uno, así que las partes siempre
   suman el total exacto.
2. **Netear por par** — dos que se deben mutuamente solo se deben la
   diferencia. Lo que queda es el "antes" honesto.
3. **Netear global** — la posición neta de cada quien. Siempre suma cero.
4. **Resolver.**

**Por qué es el mínimo y no solo poquito.** Todo plan se descompone en grupos
que suman cero, y un grupo de *k* personas cuesta *k−1* transferencias.
Entonces:

```
mínimo de transferencias = n − máx(subconjuntos disjuntos que suman cero)
```

Ese máximo se calcula exacto con un DP sobre máscaras de bits, forzando que
cada grupo candidato contenga el elemento más bajo que queda para no contar
la misma partición dos veces. Arriba de 15 saldos distintos de cero el DP se
vuelve lento y cae a greedy — la respuesta lo declara en el campo `optimal`.

Greedy también resuelve el viaje de ejemplo en 3, pero **no siempre acierta**:
con `{a:−100, b:+100, c:−250, d:+250}` encadena tres transferencias donde
bastan dos. Hay un test para exactamente ese caso. No lo borres.

### 4.3 El carril de pago — `src/lib/x402.ts`

Tres cosas que costaron un día y **no se pueden adivinar**:

1. **El reto v2 viaja en el header `PAYMENT-REQUIRED`.** Solo los clientes v1
   lo leen del body. Nuestro 402 era perfecto y el cliente oficial lo
   rechazaba sin decir por qué.
2. **`PaymentRequired` necesita un `resource` de nivel superior.** El body se
   valida ahora contra el esquema del propio SDK antes de mandarse, así que no
   puede volver a desviarse en silencio.
3. **El payload de pago lo construye `@x402/hedera`, nunca a mano.** El
   facilitador valida la transacción serializada estrictamente y rechaza una
   hecha a mano con un 500 pelón, sin diagnóstico.

Además: el agente y el servicio **tienen que ser cuentas distintas**. Un agente
pagándose a sí mismo es una transferencia que neta cero y el facilitador la
rechaza.

Y el detalle que vale premio: el facilitador **patrocina la comisión de red**
(`extra.feePayer`, leído en vivo de su `/supported`). Por eso quien paga no
necesita tener el token de la red. Eso no es marketing, está en la cadena.

### 4.4 Precio — `src/lib/pricing.ts`

Se cobra **por obligación, no por petición**. En tinybars, sin floats.

| Obligaciones | Precio c/u |
|---|---|
| 1–10 | 0.00040 ℏ |
| 11–50 | 0.00035 ℏ |
| 51–200 | 0.00028 ℏ |
| 201+ | 0.00021 ℏ |

Hedera da puntos extra explícitamente por tarifado por uso real en vez de
cargo plano. No lo vuelvas plano.

### 4.5 Liquidación atómica — `src/lib/scheduled.ts`

El plan completo es **una sola** transacción programada: todos los cargos y
abonos en una lista de transferencias, pendiente hasta que cada cuenta
debitada firme. La última firma la ejecuta como unidad.

Dos trampas ya resueltas, no las deshagas:

- El mismo plan se serializa idéntico siempre, y Hedera **se niega a crear un
  schedule que duplique uno que todavía recuerda**, incluido uno que ya se
  ejecutó. Cada intento lleva su propio nonce en el memo.
- Repetir el mismo nonce es idempotente, y eso es lo que hace que recargar a
  media firma sea inofensivo en vez de dejar un schedule huérfano.

### 4.6 Quién paga qué

El navegador **no tiene llave y nunca habla x402**. El servidor de la app es el
cliente pagador: `/api/plan` llama al motor, liquida el cargo desde la cuenta
de la app, y le entrega la respuesta al navegador.

Dos cosas evitan que un demo público se drene:

- Grafos idénticos se responden desde caché (5 min), así que un conjunto
  distinto de deudas cuesta un pago sin importar cuánta gente abra la página.
- Si el pago no completa, el plan se calcula **en proceso**, se sirve y se
  marca `paid: false` con la razón.

**Ese fallback no es un bypass.** Nunca le pidas al motor que trabaje gratis
con una bandera tipo `?unpaid=1`. Un bypass que un cliente sin pagar puede
alcanzar no es una puerta.

### 4.7 Mapa del repo

```
src/lib/netting.ts        el solver — el producto está aquí
src/lib/netting.test.ts   15 tests, incluye los casos donde greedy falla
src/lib/pricing.ts        cotización por obligación, en tinybars
src/lib/x402.ts           el reto 402 y las llamadas al facilitador
src/lib/payingClient.ts   la app comprándole una corrida al motor
src/lib/hcs.ts            prueba de cada corrida, publicada en consenso
src/lib/scheduled.ts      liquidación todo-o-nada
src/lib/demoAccounts.ts   las cuentas desechables — esto lo reemplaza Privy
src/lib/sample.ts         el grupo de ejemplo

src/app/page.tsx          la portada
src/app/api/v1/net/       EL MOTOR. Medido, estricto, sin bypass.
src/app/api/plan/         LA APP, como cliente de paga del motor.
src/app/api/settle/       crea la transacción programada
src/app/api/settle/sign/  una persona añade su firma
src/app/{join,grupo,expense,plan,sign,done}/  las seis pantallas

scripts/agent.mjs              un agente que descubre, paga y recibe
scripts/create-topic.mjs       topic de HCS, una vez
scripts/create-agent.mjs       cuenta pagadora (≠ la que cobra)
scripts/create-demo-accounts.mjs  una cuenta por persona del grupo
```

---

## 5. Especificaciones visuales

La app es un teléfono de 390 px centrado. La portada es una página. Comparten
los mismos tokens para que pasar de una a otra no se sienta como dos
productos.

### 5.1 Paleta

Papel de contabilidad, ligeramente verdoso. El neutro está elegido, no
heredado.

| Token | Hex | Para qué |
|---|---|---|
| `--bg` | `#edefec` | fondo |
| `--surface` | `#f8f9f6` | tarjetas |
| `--surface-2` | `#e3e7e0` | fondos secundarios, avatares |
| `--ink` | `#171b17` | texto |
| `--muted` | `#5b655c` | texto secundario |
| `--rule` | `#cfd5cc` | líneas |
| `--settled` | `#0b6b4f` | liquidado, confirmado, éxito |
| `--owed` | `#8e3b2e` | deuda pendiente |
| `--rail` | `#7a5f10` | el riel de pago x402 |

Los tres últimos son **semánticos**: verde es lo saldado, oxblood es lo que se
debe, latón es el cobro por uso. No los uses de adorno.

### 5.2 Tipografía

- **Newsreader** (serif) — display y títulos. Da el aire de documento de
  registro que un motor de compensación merece.
- **Archivo** — interfaz.
- **IBM Plex Mono** — datos, montos, etiquetas técnicas. Todos los números en
  columna llevan `font-variant-numeric: tabular-nums`.

### 5.3 Reglas que no se rompen

- **Áreas táctiles mínimo 44 px** en las pantallas de teléfono.
- **Nada de barra de estado falsa.** El teléfono real dibuja la suya encima.
- **Iconos en SVG inline**, nunca emoji. Trazo, rejilla de 16/20/24.
- **Layout con flex/grid y `gap`**, no con márgenes por elemento.
- **Contraste AA.** El verde `#0b6b4f` con texto claro necesita al menos
  `#d3e8dc`; `#a9d3bf` no pasa y ya se corrigió una vez.
- **`prefers-reduced-motion`** respetado en cualquier animación.

---

## 6. Infraestructura

### 6.1 Todo en testnet, costo cero

Las bases del premio aceptan textualmente *"Hedera testnet or mainnet"*.
Testnet califica al 100%, el HBAR sale gratis del faucet y **el proyecto no ha
costado un peso**. No lo muevas a mainnet.

- Portal: <https://portal.hedera.com/> — 1,000 ℏ cada 24 h, sin tarjeta
- Faucet anónimo: 100 ℏ cada 24 h, sin registro

### 6.2 Cuentas en juego

| Rol | Cuenta |
|---|---|
| El motor, que cobra | `0.0.10450391` |
| El agente / la app, que paga | `0.0.10452163` |
| Facilitador Blocky402 (no es nuestra) | `0.0.7162784` |
| Topic de HCS | `0.0.10452145` |

Más seis cuentas desechables, una por persona del grupo.

### 6.3 Variables de entorno

Alfa te las pasa por separado. **Nunca van al repo** — `.env.local` está
gitignoreado y así se queda.

```
HEDERA_NETWORK  HEDERA_OPERATOR_ID  HEDERA_KEY_TYPE  HEDERA_OPERATOR_KEY
HEDERA_HCS_TOPIC_ID  AGENT_ACCOUNT_ID  AGENT_KEY_TYPE  AGENT_KEY
X402_FACILITATOR_URL  X402_ENABLED  DEMO_ACCOUNTS_JSON
```

Si prefieres tus propias cuentas, sácalas en cinco minutos siguiendo
[CONTRIBUTING.md](CONTRIBUTING.md). Es lo más limpio.

**Nunca uses una llave de una cartera con dinero real.** Las llaves ECDSA de
Hedera son de la misma curva que Ethereum: la dirección EVM derivada es tuya
en cualquier red. Cuenta nueva, solo para esto.

### 6.4 Despliegue

Vercel, producción en <https://squash-pay.vercel.app>. Las variables viven en
el proyecto de Vercel, no en el repo. Cada push a `main` no despliega solo —
el deploy se hace explícito con `vercel deploy --prod`.

---

## 7. Reglas de la casa

Cuatro, y las cuatro costaron sangre:

1. **El dinero son centavos enteros.** `formatCents` es solo para mostrar.
2. **Nunca inventes un hash.** `/done` enlaza al explorador solo cuando hubo
   una liquidación real; si no, lo dice. Un enlace muerto a un explorador real
   es peor que ningún enlace.
3. **El motor no tiene bypass.**
4. **Los payloads de x402 los construye el SDK.**

Y una más, que es de comunicación: **si algo tarda, di para qué.** El plan
tarda ~10 s en frío porque la app lo está comprando de verdad. La pantalla lo
dice en vez de parecer colgada. Esa espera es el pitch, no un bug.

---

## 8. Lo que NO hay que hacer

- No integres ENS. Piden que ENSv2 sea el centro del producto y dicen
  explícitamente que no aceptan usos cosméticos.
- No integres Chainlink CRE. Formulario de acceso con espera desconocida.
- No integres Uniswap. Los gastos en pesos son fiat; convertirlos es un
  oráculo de tipo de cambio, no un swap, y se nota.
- No integres Bazantic. Pide llave de Stripe y llave de API de Claude de paga,
  y liquida en Base — choca con la historia de Hedera.
- **No pases de tres SDKs.** Es el límite del evento.

---

## 9. Contexto que ayuda

[STATUS.md](STATUS.md) es el registro honesto y se mantiene al día.
[CONTRIBUTING.md](CONTRIBUTING.md) tiene el arranque en un minuto.
[README.md](README.md) es lo que leen los jueces.

Lo importante del proyecto no es que use blockchain. Es que **el resultado es
medible y verificable**: 15 → 3, y cualquiera puede rehacer la cuenta desde el
hash publicado. Casi todos los proyectos del hackathon le piden al juez que
crea en una promesa. Este le da algo que puede comprobar.

Mantén esa propiedad y el proyecto se defiende solo.
