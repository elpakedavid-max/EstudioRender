# EstudioRender

App (PWA) para arquitectos e interioristas: de las fotos y las medidas de una habitación al plano a escala, y del plano a renders fotorrealistas y vídeos de presentación para enseñar al cliente en la propia obra. Pensada para iPad con Apple Pencil.

## Qué hace

1. **Ficha**: tipo de estancia (baño, dormitorio, cocina, loft…), medidas, altura, lo que quiere el cliente, estilo, materiales, techo, iluminación y fotos del espacio actual.
2. **Plano** (vista desde arriba, a escala en cm):
   - Paredes a mano alzada que se enderezan solas, con la medida y unidas entre sí.
   - Puertas, ventanas, correderas y entrada sobre las paredes.
   - Biblioteca de muebles por estancia (baño, cocina, dormitorio, salón, altillo, escaleras…), para mover, girar, redimensionar y marcar si van en planta baja o en el altillo.
   - Lápiz para notas y dibujos a mano (con Apple Pencil, el dedo sirve para moverse y hacer zoom) y notas de texto.
   - Deshacer y rehacer, y descarga del plano en PNG.
3. **Renders**, con dos modos que se eligen en Ajustes:
   - **Manual (sin coste)**: genera el prompt a partir de la ficha y del plano, y comparte la foto y el plano con Gemini o ChatGPT. El resultado se sube a la galería.
   - **Automático (API de Gemini o de OpenAI / ChatGPT Images)**: genera el render dentro de la app, aplica correcciones pidiendo un cambio cada vez y propone la distribución con IA leyendo la ficha y las notas a mano.
   - Vistas: desde la entrada, desde el fondo (con izquierda y derecha invertidas en el prompt), laterales, aérea o libre. Admite un render anterior como referencia de estilo para que las vistas cuadren entre sí.
4. **Vídeo**:
   - Montaje en el propio dispositivo con los renders elegidos, movimientos de cámara suaves, rótulos, el plano y música generada sin derechos, en horizontal 16:9 o vertical 9:16.
   - Prompt listo para hacer un recorrido con IA en Veo o Kling.

5. **Cliente**: presentación en un único archivo HTML (portada, datos del proyecto, renders, vídeo y plano) para enviar por WhatsApp o email. Se abre en cualquier móvil sin instalar nada.

Los proyectos se guardan solos mientras se trabaja y también con el botón **Guardar** de la barra superior, aunque estén a medias. Cada proyecto tiene un estado (borrador, en curso, presentado o finalizado) y la lista se puede filtrar por estado. Los datos se guardan en el dispositivo (IndexedDB) y, si se activa, se **sincronizan con Supabase** entre el iPad y el ordenador. Cada proyecto se puede exportar e importar también como `.json`, con sus imágenes incluidas.

## Sincronización entre dispositivos (Supabase)

1. Crear un proyecto en supabase.com (gratis).
2. En *SQL Editor*, ejecutar `supabase/schema.sql`. Crea la tabla `projects` con permisos por usuario y el almacenamiento privado `estudiorender`.
3. En la app: Ajustes → *Sincronización*. Poner la URL del proyecto y la clave *anon* (Project Settings → API) y crear la cuenta con email y contraseña.
4. En el otro dispositivo, los mismos datos y *Entrar*. La sincronización se hace al abrir la app, unos segundos después de cada cambio y con el botón *Sincronizar ahora*.

## Publicarla

Es una web estática sin compilación. Se puede publicar en:

- **GitHub Pages**: Settings → Pages → Branch `main` / carpeta raíz. En un repositorio privado hace falta una cuenta de pago de GitHub; si no, sirven Netlify o Vercel (se conecta el repo y listo).
- Cualquier hosting con HTTPS. El service worker y la instalación en el iPad necesitan HTTPS.

En el iPad: abrir la URL en Safari → Compartir → **Añadir a pantalla de inicio**.

## Modo automático

**Opción rápida**: en Ajustes, elegir *Automático* y pegar una clave de API de Gemini (aistudio.google.com). La clave se queda guardada solo en ese dispositivo.

**Opción segura (recomendada si la usan varias personas)**: la clave se guarda en una función de Supabase.

```bash
supabase functions deploy gemini --no-verify-jwt   # o con verificación JWT usando la anon key
supabase secrets set GEMINI_API_KEY=AIza...
```

Después, en Ajustes: *URL función Supabase* = `https://<proyecto>.supabase.co/functions/v1/gemini` y la clave anon.

Modelos por defecto, que se pueden cambiar en Ajustes:

- Imagen: `gemini-3-pro-image` (Nano Banana Pro). Una alternativa más rápida y barata es `gemini-3.1-flash-image`.
- Texto (propuesta de distribución): `gemini-3-flash-preview`.

### Con ChatGPT (OpenAI)

En Ajustes → *Automático* → *ChatGPT Images (OpenAI)*, pegar una clave de platform.openai.com (de pago por uso y aparte de ChatGPT Plus). Usa `gpt-image-2` con `/v1/images/edits`, enviando la foto, el plano y la referencia como imágenes. La calidad se puede elegir: baja para pruebas y alta para el cliente.

## Estructura

```
index.html            entrada de la app
css/app.css           estilos
js/app.js             vistas: proyectos, ficha, plano, renders, vídeo, ajustes
js/plan.js            editor de plano (SVG, unidades en cm) y exportación PNG
js/catalog.js         biblioteca de muebles y símbolos
js/prompt.js          prompts de render, de corrección y de vídeo
js/ai.js              llamadas a Gemini (directas o vía Supabase)
js/video.js           vídeo de presentación (canvas + MediaRecorder + música WebAudio)
js/present.js         presentación HTML para el cliente
js/sync.js            sincronización con Supabase (sesión, tabla y almacenamiento)
js/db.js              almacenamiento local y ajustes
sw.js                 funcionamiento sin conexión
supabase/functions/gemini/index.ts   proxy seguro para la clave de Gemini
supabase/schema.sql   tablas y permisos para la sincronización
```

## Próximos pasos

- Enlace web para el cliente, con comentarios sobre cada render.
- Recorrido en vídeo con Veo directamente desde el modo automático.
