# Continuación

Documento de entrega. Aquí está dónde quedó el proyecto, hasta dónde tiene que
llegar, y todo lo que necesitas para no adivinar nada.

**Deadline: domingo 13 de septiembre, 10:00.** El check-in #2 del evento vence
el jueves 10 a las 21:59 y lo cierra Alfa, no tú.

---

## 0. Auditoría — 12 de septiembre · LEE ESTO PRIMERO

> ### ✅ Resuelto el mismo 12 de septiembre
>
> Todo lo crítico y lo serio de abajo **ya se arregló, se desplegó y se
> verificó en producción** — contra el sitio en vivo y contra la cadena. La
> auditoría se deja tal cual para que se entienda qué pasó y por qué el
> código está como está.
>
> | Hallazgo | Estado |
> |---|---|
> | `/sign` muerta en producción | ✅ vuelve a la ruta que funciona — schedule `0.0.10509839` ejecutado en vivo |
> | Rutas de firma con Privy que no podían funcionar | ✅ eliminadas, no se dejaron "por si acaso" |
> | `/plan` y `/done` daban 405 | ✅ `/api/plan` acepta los gastos del grupo |
> | El plan mostrado ≠ el plan pagado | ✅ ambas rutas usan los mismos gastos, por un solo validador |
> | `.env.local` borrado por otra IA | ✅ restaurado del respaldo (12 variables) |
> | `SUBMISSION.md` afirmaba cosas falsas | ✅ reescrito, cada afirmación enlaza a la cadena |
> | QR decorativo en `/join` | ✅ eliminado; ahora hay un QR real en el flujo de la cena |
> | Estado en `localStorage` | ✅ el flujo de la cena vive en Supabase con tiempo real |
> | Logo 404, App ID de Privy escrito a mano | ✅ corregidos |
>
> Y se construyó el flujo completo de la sección 3.1b. Ver ahí.

Entre el 10 y el 11 trabajaron otras IAs sobre el repo: 7 commits y 12
archivos sin commitear. Esta es la revisión de lo que dejaron. Todo lo de
abajo está verificado — contra el sitio en vivo y contra la cadena — no
deducido.

### Lo que está sano

- 15/15 tests, build de producción limpio, TypeScript sin errores.
- Ninguna llave versionada. Ningún hash inventado en el código.
- **El motor, el cobro x402, la prueba en HCS y la liquidación funcionan.**
  Probado hoy en producción por la ruta original: schedule
  [`0.0.10509320`](https://hashscan.io/testnet/schedule/0.0.10509320),
  pendiente con la 1ª firma, pendiente con la 2ª, **ejecutada con la 3ª**.
- Interfaz en inglés y español. Útil para los jueces; se queda.

### 🔴 Crítico — rompe la demo

**1. La pantalla de firmas está muerta en producción.**

Abre <https://squash-pay.vercel.app/sign>: "0 de 3 confirmaron", Diego y
Luis en "Firmando…" para siempre, y el botón **deshabilitado**. El 9 de
septiembre esto liquidaba de verdad y se verificó al tinybar.

Qué pasó: `/sign` se reconectó a una ruta nueva de firma con Privy
(`/api/settle/sign/prepare` y `/submit`) que **no puede funcionar**, por
cuatro razones independientes — basta cualquiera para que falle:

| | El problema |
|---|---|
| Llave equivocada | La cartera de Privy es una llave de Ethereum nueva. **No controla** la cuenta de Hedera del deudor (`0.0.10453366`, creada con otra llave). Su firma nunca satisface el schedule. |
| Formato equivocado | `wallet.sign()` hace un `personal_sign` de Ethereum: antepone el prefijo `"\x19Ethereum Signed Message"` y devuelve 65 bytes. Hedera espera la firma cruda de 64 bytes. |
| Carga equivocada | Firma `tx.toBytes()` — la transacción serializada completa. En Hedera se firman los *body bytes* de cada nodo. |
| Persona equivocada | El ciclo firma "por Diego" y "por Luis" **con la cartera del usuario que inició sesión**. Una sola persona firmando por tres. |

**El arreglo es chico y de bajo riesgo:** la ruta que sí funciona
(`/api/settle/sign` → `signSchedule`) sigue en el código y sigue viva en
producción. Hay que volver a apuntar `/sign` hacia ella. Es la prioridad cero.

**2. `SUBMISSION.md` le dice a los jueces cosas que el código no hace.**

Afirma *"Participants sign through Privy"* y pide mostrar *"the real-time
signature state"*. Un juez que lo pruebe ve la pantalla colgada. Una
afirmación falsa en la submission es peor que una función que falta: la
función que falta se nota, la afirmación falsa se castiga. Hay que
corregirla antes de entregar.

### 🟠 Serio

**3. El "código QR" de `/join` es decorativo.** Es una cuadrícula de 6×6
puntos donde `index % 3 === 0 || index % 7 === 0` decide cuáles se pintan.
No codifica nada y no se puede escanear, pero tiene
`aria-label="Código de invitación del grupo"`: se le presenta como real a
quien usa lector de pantalla. Parece función y no lo es.

**4. El estado del grupo vive en `localStorage`.** `GroupProvider` lee y
escribe `localStorage`, que es **por navegador y por dispositivo**. Dos
teléfonos no se ven entre sí. "Ver en tiempo real quién eres y cuánto debes"
es imposible con esta arquitectura: cada teléfono tiene su propia copia
aislada. La sección 3.1b dice qué hace falta.

### 🟡 Menor

- `public/logo.svg` existe en local pero `public/` **nunca se commiteó** →
  404 en producción, error visible en consola.
- El App ID de Privy está en `.env.local` **y además** escrito a mano como
  respaldo en `Providers.tsx`. Es un ID público, no es fuga, pero el respaldo
  sobra.
- **12 archivos, 943 líneas sin commitear.** Trabajo que existe en esta
  máquina y no en el repo ni en producción.

### Sobre Privy, sin rodeos

Firmar transacciones de Hedera con una cartera de Privy **no es un ajuste,
es un proyecto**: habría que crear cada cuenta de Hedera con la llave pública
de la cartera del usuario, y firmar los *body bytes* crudos sin el prefijo
de Ethereum. No cabe antes del domingo 10:00 y no hay que intentarlo.

Lo que sí funciona y sí vale: **Privy para iniciar sesión** — identidad sin
contraseña ni frase semilla. Eso se muestra honestamente. La firma se queda
en las cuentas de demo, dicho con todas sus letras.

### Orden para lo que queda

1. **Arreglar `/sign`** — volver a la ruta que funciona. *(30 min)*
2. **Commitear** el trabajo pendiente, subir `public/`, redeploy.
3. **Corregir `SUBMISSION.md`** para que no afirme nada que no pase.
4. **Grabar el video.** Sin video no existimos.
5. *Solo si sobra tiempo:* el flujo de la sección 3.1b.

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
| **Dividir una cuenta en la mesa** — QR, tiempo real, 3 modos, todos confirman | listo, en vivo, 19/19 contra producción |
| Solver de mínimo demostrable | listo |
| `POST /api/v1/net` cobrado por obligación | listo, en vivo |
| Puerta x402 (esquema `exact` de Hedera vía Blocky402) | listo |
| Un agente que descubre, paga y recibe | listo, pagó en cadena |
| La app pagándole al motor por el navegador | listo |
| Prueba de cada corrida publicada en HCS | listo |
| Liquidación atómica con Scheduled Transactions | listo, ejecuta con la última firma |
| Portada + viaje de ejemplo | listo, en vivo |
| Tests | **41** (solver 15, reparto 15, validación 11) |

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

### 3.1 Privy — $2,500 · para iniciar sesión, no para firmar

> **Actualizado el 12 de septiembre.** Esta sección decía que Privy debía
> reemplazar las llaves para firmar. Se intentó, y rompió `/sign` en
> producción — la sección 0 explica las cuatro razones. **Privy se usa para
> identidad** (entrar sin contraseña ni frase semilla), y eso sí funciona.
> Firmar en Hedera con una cartera de Privy queda para después del
> hackathon.

Es lo único que sigue teniendo forma de demo: **la app tiene las llaves de las
seis personas**. Eso está bien para enseñar el mecanismo y está mal para un
producto. A futuro, Privy lo reemplaza con carteras por usuario que la app
nunca ve — pero eso exige crear cada cuenta de Hedera con la llave pública de
la cartera, y no cabe antes de la entrega.

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

### 3.1b El flujo que queremos — caso de uso real

Esta sección reemplaza la versión anterior, que afirmaba que
`GroupProvider` "sincroniza" el estado. No lo hace: guarda en `localStorage`.

#### El caso

Seis amigos salen a cenar. La cuenta es de **$2,500**. El restaurante no
divide cuentas, así que **paga una sola persona** — digamos Rosa, con su
tarjeta. Ahora los otros cinco le deben a Rosa, y hay que decidir cuánto
cada quien.

#### El recorrido

**1. El administrador crea el grupo y pone el total.**
Rosa abre la app, crea "Cena del viernes", pone **$2,500** y queda como
administradora — y como la que pagó.

**2. La app genera un QR del grupo.**
Rosa lo enseña en la mesa. El QR es un **enlace real**, por ejemplo
`squash-pay.vercel.app/join?g=<id-del-grupo>` — no un dibujo. Quien lo
escanea cae directo en ese grupo.

**3. Cada quien escanea y entra.**
Al entrar, cada persona se identifica (Privy: correo o Google, sin
contraseña) y queda como miembro. La lista de Rosa se va llenando **en
vivo**: ve llegar a Diego, a Luis, a Mariana.

**4. Cada persona ve quién es y cuánto debe — en tiempo real.**
Su nombre, el total del grupo y su parte. Si Rosa cambia el reparto, la
cifra cambia en todos los teléfonos al momento.

**5. El administrador elige cómo se divide.** Tres botones:

| Modo | Qué hace |
|---|---|
| **Partes iguales** | $2,500 ÷ 6 = $416.67 c/u. Los centavos que no dividen exacto se reparten uno por uno — el solver ya lo hace, hay test. |
| **Montos por persona** | Rosa escribe cuánto le toca a cada quien. La app no deja confirmar hasta que la suma dé exactamente $2,500. |
| **Cada quien lo suyo** | Cada persona escribe lo que consumió desde su propio teléfono. Rosa ve si falta o sobra contra el total. |

**6. Todos confirman.**
Cada persona ve su monto y le da **"Sí, pago $416.67"**. Rosa ve el avance:
*4 de 5 confirmaron*. Si alguien no está de acuerdo, no confirma y se
corrige el reparto.

**7. Con el último "sí", se paga.**
Aquí entra lo que **ya funciona**: una sola transacción programada en
Hedera que no se ejecuta hasta que todos firmaron. Con la última
confirmación, los cinco pagos a Rosa salen juntos. Nadie paga a medias.

**8. Recibo.**
Cada quien ve "Todos en cero" y el enlace al comprobante real en el
explorador.

#### Una aclaración honesta sobre el pitch

En el caso de la cena **hay una sola acreedora**: todos le pagan a Rosa, y
eso ya es el mínimo — cinco transferencias. **El motor no comprime nada
aquí.** La compresión aparece cuando **varias personas pagan cosas
distintas a lo largo de un viaje**: Rosa la casa, Mariana la cena, Luis la
gasolina. Ahí las deudas se cruzan y 15 se vuelven 3.

El producto tiene dos caras y conviene contarlo así: **la cena es la puerta
de entrada** — fácil de entender, todos la han vivido — y **el viaje es
donde Squash brilla**. No vendas la cena como ejemplo de compresión; un
juez que haga la cuenta lo nota.

#### Estado del flujo — construido y verificado

| Paso | Estado |
|---|---|
| Crear la cuenta con el total (`/nuevo`) | ✅ |
| **QR real** con el enlace al grupo | ✅ decodificado con un lector independiente: da exactamente la URL |
| Entrar escaneando (`/g/[id]`) | ✅ la misma URL sirve para entrar y para ver |
| **Estado compartido entre teléfonos** | ✅ Supabase (Postgres + Realtime) |
| **Tiempo real** | ✅ probado: el websocket entrega cada entrada y cada cambio de parte |
| Rol de administrador | ✅ solo el admin cambia el reparto |
| Partes iguales, al centavo | ✅ probado para grupos de 1 a 20 |
| Montos que pone el admin | ✅ no deja confirmar hasta que sume exacto |
| Cada quien lo suyo | ✅ cada teléfono escribe su monto; nadie puede tocar el de otro |
| Todos confirman antes de pagar | ✅ una sola transacción programada en la cadena |
| El reparto se congela al pedir confirmaciones | ✅ reabrir abandona la transacción y borra confirmaciones |
| Pago con el último "sí" | ✅ verificado en cadena, UI y API |
| Recibo real | ✅ |

**Pruebas en cadena del flujo de la cena:**

- Reparto igual, manejado desde la interfaz — [schedule `0.0.10510230`](https://hashscan.io/testnet/schedule/0.0.10510230):
  Diego −$600, Luis −$600, Rosa +$1,200.
- Reparto personalizado — [schedule `0.0.10510081`](https://hashscan.io/testnet/schedule/0.0.10510081):
  Diego −$1,000, Luis −$500, Rosa +$1,500.

**Cómo probarlo tú mismo:**

```bash
node scripts/test-dinner.mjs https://squash-pay.vercel.app
```

19 verificaciones contra producción, incluidos cinco ataques. Todas pasan.

#### Cómo quedó construido

**El grupo vive en Supabase**, no en cada teléfono:

```
groups         (id, name, total_cents, payer_id, split_mode, status, schedule_id)
members        (id, group_id, name, is_admin, share_cents, confirmed, account_index)
member_secrets (member_id, secret_hash)   ← ningún navegador puede leerla
```

**Seguridad, probada con ataques reales y no supuesta:**

- **Cualquiera con el enlace puede LEER un grupo** — para eso es una invitación.
- **Solo el servidor puede ESCRIBIR.** La seguridad a nivel de fila compara el
  SHA-256 de un encabezado `x-squash-token` con un hash guardado en la base.
  El token no tiene prefijo `NEXT_PUBLIC_` y se verificó ausente de todos los
  archivos públicos del bundle.
- **Nadie actúa como otro.** Cada teléfono guarda un secreto; el servidor
  compara su hash en una tabla que ningún navegador lee. Luis no puede
  confirmar como Diego.
- **Una confirmación ES una firma**, y solo se registra después de que la
  firma cae en la cadena.

**Cuentas:** un pool de 10 cuentas de testnet (`POOL_ACCOUNTS_JSON`). Quien
crea el grupo toma el espacio 0; cada persona que entra, el siguiente. Un
grupo admite hasta 10 personas. Se crean con `node scripts/create-pool.mjs`.

**Archivos del flujo:**

```
src/lib/split.ts            reglas del dinero — 15 tests
src/lib/groups.ts           reglas del grupo, del lado del servidor
src/lib/supabase.ts         cliente de lectura y cliente del servidor
src/lib/pool.ts             el pool de cuentas
src/lib/groupSession.ts     quién eres en este teléfono
src/app/nuevo/              crear la cuenta
src/app/g/[id]/             la mesa: entrar, ver, repartir, confirmar
src/app/api/groups/         crear
src/app/api/groups/[id]/    todas las acciones
scripts/test-dinner.mjs     la cena completa + ataques, contra cualquier servidor
```

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
