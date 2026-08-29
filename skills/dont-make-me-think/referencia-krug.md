# Referencia — Don't Make Me Think, Revisited (Steve Krug)

Material del libro para consultar durante la auditoría: la formulación original de cada principio, y los capítulos que no entran en el pase a pase (trunk test, home page, móvil, accesibilidad, testing con usuarios).

## Las tres leyes

1. **"Don't make me think."** Una página debe ser *self-evident*: se entiende de un vistazo, sin esfuerzo. Cuando eso es imposible, al menos *self-explanatory*: se entiende con un poco de atención. El principio operativo es **eliminar signos de pregunta**.
2. **"It doesn't matter how many times I have to click, as long as each click is a mindless, unambiguous choice."** Lo que pesa no es la cantidad de clics sino cuánto hay que pensar y cuánta incertidumbre queda en cada uno.
3. **"Get rid of half the words on each page, then get rid of half of what's left."**

## Cómo se usa realmente una interfaz

Tres hechos que contradicen cómo se la diseña:

- **Se escanea, no se lee.** El usuario barre en busca de lo que se parece a su tarea.
- **Satisficing.** Elige la primera opción razonable, no la mejor; adivinar sale más barato que evaluar todo.
- **Muddling through.** No averigua cómo funciona: se las arregla. Si algo le funciona, lo repite aunque haya un camino mejor.

Corolario: nadie usa el sistema como lo usa quien lo construyó. Las discusiones de "a mí me gusta más así" se resuelven mirando a un usuario, no argumentando.

## Billboard Design 101

- Respetar las convenciones existentes, salvo que el reemplazo sea demostrablemente mejor o no exija aprendizaje.
- **La claridad le gana a la consistencia** cuando entran en conflicto.
- Crear jerarquía visual: lo más importante, más prominente; lo relacionado, agrupado; lo contenido, anidado visualmente dentro de su contenedor.
- Lo clickeable se ve clickeable.
- Eliminar ruido: gritos visuales, desorden y desprolijidad.
- Formatear el texto para escanear: títulos, párrafos cortos, listas, términos clave destacados.

## Navegación: carteles de calle y migas

Componentes de la navegación persistente: identidad del sitio (arriba a la izquierda, vuelve al inicio), secciones principales, utilidades (sesión, ayuda), y búsqueda.

Cada pantalla necesita un **nombre prominente que coincida con el link que se tocó** para llegar, un indicador de "estás aquí" evidente, y migas cuando hay jerarquía (el último tramo en negrita y sin link).

**Trunk test.** Imaginá que te dejan caer en una pantalla cualquiera, sin contexto. Deberías poder responder de inmediato:

1. ¿De qué sistema es esta pantalla?
2. ¿En qué pantalla estoy?
3. ¿Cuáles son las secciones principales?
4. ¿En qué parte de la jerarquía estoy?
5. ¿Cómo busco?

## Home page / pantalla de entrada

Tiene que contestar en segundos: qué es esto, qué puedo hacer acá, qué hay adentro, y por qué usarlo. Necesita una frase corta que la resuma y puntos de entrada claros. Su enemigo natural es la tragedia de los comunes: cada área del negocio quiere su espacio y termina saturada.

## Reserva de buena voluntad

**La drena:** esconder lo que el usuario busca (precios, costos, condiciones, contacto); castigarlo por no usar el formato exacto; pedirle datos que no hacen falta; la sinceridad de cartón ("tu llamada es muy importante"); poner promoción delante de la tarea; una apariencia descuidada.

**La repone:** hacer obvio lo que la mayoría viene a hacer; decir el costo y el problema por adelantado; sacar pasos innecesarios; anticipar las preguntas frecuentes; hacer fácil recuperarse de un error; y pedir disculpas cuando el sistema no puede resolver algo.

## Móvil

El espacio no justifica sacrificar usabilidad: el recorte se hace eligiendo, no escondiendo lo importante. Sin `hover` disponible, la pista de que algo es interactivo tiene que darla el color, la posición y la tipografía. Cuidar que se pueda llegar directo a una vista profunda y que exista salida al modo completo. Una app se juzga por tres cosas: que deleite, que se aprenda y que se recuerde.

## Testing de usabilidad barato

- **Una mañana por mes**, con tres usuarios, y se debriefea al mediodía.
- Testear un usuario temprano vale más que cincuenta al final.
- Reclutar es laxo: casi cualquier persona sirve, se corrige al interpretar.
- Que lo mire el equipo entero: mirar convence más que cualquier informe.
- Sesión de una hora: bienvenida (4), preguntas (2), recorrido de la pantalla inicial (3), tareas (35), repreguntas (5), cierre (5).
- Del debrief salen los **diez problemas peores**, y se arreglan los peores primero. "Se encuentran más problemas en media jornada de los que se arreglan en un mes."

## Accesibilidad

Primero arreglar los problemas de usabilidad que confunden a todo el mundo: casi siempre son los mismos que rompen el uso asistido. Después, lo técnico de base: texto alternativo en imágenes, jerarquía real de encabezados, formularios asociados a sus labels, link para saltar al contenido, todo alcanzable por teclado, y contraste suficiente.

## Fuentes

- Steve Krug, *Don't Make Me Think, Revisited: A Common Sense Approach to Web and Mobile Usability*, 3ra edición.
- [Resumen por capítulos — ReadinGraphics](https://readingraphics.com/book-summary-dont-make-me-think/)
- [Notas de lectura — blas.com](https://blas.com/dont-make-me-think/)
- [Resumen completo por capítulos — howtoes.blog](https://howtoes.blog/2025/06/07/dont-make-me-think-a-book-summary/)
- [Krug's 3 laws of usability](https://twobenches.wordpress.com/2008/06/05/krugs-3-laws-of-usability/)
