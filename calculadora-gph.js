/*!
 * Calculadora GPH v2.3 — simulador de la TI-30XS MultiView™ — GEDparaHispanos
 * José M. Fernández, ABE/ASE Math Master Teacher, Harry S. Truman College — City Colleges of Chicago
 * Licencia: CC BY-NC-SA 4.0 — https://creativecommons.org/licenses/by-nc-sa/4.0/deed.es
 * TI-30XS MultiView es marca de Texas Instruments. Este simulador es un recurso
 * educativo independiente, sin relación con Texas Instruments.
 *
 * Uso: agregar antes de </body>
 *   <script src="https://zhemaria.github.io/algebra/calculadora-gph.js" defer></script>
 *
 * Opciones (atributos del <script>):
 *   data-color="#1e3a5f"  color de los botones de la barra (debe contrastar con blanco)
 *   data-boton="no"       oculta el botón «Calculadora» de la barra superior
 *   data-hoja="no"        oculta el botón «Hoja de referencia» de la barra superior
 *   data-pistas="no"      la calculadora empieza sin pistas (como en el examen)
 *   data-abrir="si"       abre la calculadora al cargar la página
 *   data-lado="izquierda" las ventanas se abren a la izquierda (útil dentro de un iframe)
 *   data-recordar="no"    no guarda la posición de las ventanas al moverlas
 * Cualquier elemento con data-gph-calculadora abre la calculadora, y con
 * data-gph-hoja abre la hoja de referencia.
 *
 * API: CalculadoraGPH.abrir(), .cerrar(), .alternar(),
 *      .abrirHoja(pestaña), .cerrarHoja(), .alternarHoja(pestaña)
 *      (pestaña: "formulas" o "guia"), .motor
 */
(function (global) {
  'use strict';

  /* ==========================================================
     1. MOTOR MATEMÁTICO
     Valor exacto: {e:true, n, d, r, p}  =  (n/d) · √r · π^p
       n, d, r enteros grandes (BigInt); r libre de cuadrados; p = 0 o 1.
     Valor aproximado: {e:false, v}
     ========================================================== */

  var ERR = {
    sint: 'SYNTAX ERROR',
    div: 'DIVIDE BY 0 ERROR',
    dom: 'DOMAIN ERROR',
    ovf: 'OVERFLOW ERROR'
  };

  function errorGPH(ti, mensaje) {
    var e = new Error(mensaje);
    e.gph = true;
    e.ti = ti;
    return e;
  }

  var cfgMotor = { angulo: 'deg', vars: {}, pantalla: 'mathprint' };

  function absB(a) { return a < 0n ? -a : a; }

  function mcd(a, b) {
    a = absB(a); b = absB(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a;
  }

  function aprox(n, d, r, p) {
    var v = Number(n) / Number(d);
    if (r !== 1n) v *= Math.sqrt(Number(r));
    if (p) v *= Math.pow(Math.PI, p);
    return F(v);
  }

  // r = c² · s  con s libre de cuadrados
  function sacarCuadrado(r) {
    var c = 1n, s = r, k = 2n;
    while (k * k <= s) {
      var kk = k * k;
      while (s % kk === 0n) { s /= kk; c *= k; }
      k++;
    }
    return [c, s];
  }

  function X(n, d, r, p) {
    if (d === undefined) d = 1n;
    if (r === undefined) r = 1n;
    if (p === undefined) p = 0;
    if (d === 0n) throw errorGPH(ERR.div, 'División entre cero');
    if (n === 0n || r === 0n) return { e: true, n: 0n, d: 1n, r: 1n, p: 0 };
    if (r < 0n) throw errorGPH(ERR.dom, 'Raíz cuadrada de un número negativo');
    if (d < 0n) { n = -n; d = -d; }
    if (r !== 1n) {
      if (r > 1000000000000n) return aprox(n, d, r, p);
      var cs = sacarCuadrado(r);
      n *= cs[0];
      r = cs[1];
    }
    var g = mcd(n, d) || 1n;
    return { e: true, n: n / g, d: d / g, r: r, p: p };
  }

  function Q(n, d) { return X(n, d === undefined ? 1n : d, 1n, 0); }

  function F(v) {
    if (!isFinite(v)) {
      throw isNaN(v) ? errorGPH(ERR.dom, 'Operación no válida') : errorGPH(ERR.ovf, 'Número demasiado grande');
    }
    if (Math.abs(v) >= 1e100) throw errorGPH(ERR.ovf, 'Número demasiado grande');
    return { e: false, v: v };
  }

  function racional(x) { return x.e && x.r === 1n && x.p === 0; }

  function aNumero(x) {
    if (!x.e) return x.v;
    var v = Number(x.n) / Number(x.d);
    if (x.r !== 1n) v *= Math.sqrt(Number(x.r));
    if (x.p) v *= Math.pow(Math.PI, x.p);
    return v;
  }

  function limitar(x) {
    if (x.e && (x.n.toString().length > 300 || x.d.toString().length > 300)) return F(aNumero(x));
    return x;
  }

  function esEntero(x) { return racional(x) && x.d === 1n; }
  function esCero(x) { return x.e ? x.n === 0n : x.v === 0; }
  function esNegativo(x) { return x.e ? x.n < 0n : x.v < 0; }

  function sumar(a, b) {
    if (a.e && b.e && (a.r === b.r && a.p === b.p)) return limitar(X(a.n * b.d + b.n * a.d, a.d * b.d, a.r, a.p));
    if (a.e && esCero(a)) return b;
    if (b.e && esCero(b)) return a;
    return F(aNumero(a) + aNumero(b));
  }
  function opuesto(a) { return a.e ? { e: true, n: -a.n, d: a.d, r: a.r, p: a.p } : F(-a.v); }
  function restar(a, b) { return sumar(a, opuesto(b)); }

  function multiplicar(a, b) {
    if (a.e && b.e) {
      var p = a.p + b.p;
      if (p > 1) return F(aNumero(a) * aNumero(b));
      return limitar(X(a.n * b.n, a.d * b.d, a.r * b.r, p));
    }
    return F(aNumero(a) * aNumero(b));
  }

  function dividir(a, b) {
    if (esCero(b)) throw errorGPH(ERR.div, 'División entre cero');
    if (a.e && b.e) {
      var p = a.p - b.p;
      if (p < 0 || p > 1) return F(aNumero(a) / aNumero(b));
      return limitar(X(a.n * b.d, a.d * b.n * b.r, a.r * b.r, p));
    }
    return F(aNumero(a) / aNumero(b));
  }

  function potenciaEntera(a, k) {
    if (k === 0n) {
      if (a.n === 0n) throw errorGPH(ERR.dom, '0 elevado a 0 no está definido');
      return Q(1n);
    }
    var negativo = k < 0n;
    if (negativo) {
      if (a.n === 0n) throw errorGPH(ERR.div, 'División entre cero');
      k = -k;
    }
    var tamano = (a.n.toString().length + a.d.toString().length) * Number(k);
    if (tamano > 600) return F(Math.pow(aNumero(a), Number(negativo ? -k : k)));
    var r = Q(a.n ** k, a.d ** k);
    return negativo ? Q(r.d, r.n) : r;
  }

  function potenciaEnteraGeneral(a, k) {
    if (racional(a)) return potenciaEntera(a, k);
    if (k === 0n) return Q(1n);
    var negativo = k < 0n;
    if (negativo) k = -k;
    if (k > 64n) return F(Math.pow(aNumero(a), Number(negativo ? -k : k)));
    var r = Q(1n);
    for (var i = 0n; i < k; i++) r = multiplicar(r, a);
    return negativo ? dividir(Q(1n), r) : r;
  }

  function raizEnteraExacta(n, q) {
    if (n === 0n) return 0n;
    var g = Math.round(Math.pow(Number(n), 1 / q));
    if (!isFinite(g)) return null;
    var qb = BigInt(q);
    for (var c = g - 1; c <= g + 1; c++) {
      if (c < 0) continue;
      var r = BigInt(c);
      if (r ** qb === n) return r;
    }
    return null;
  }

  function potencia(a, b) {
    if (racional(b) && b.d === 1n) {
      if (a.e) return potenciaEnteraGeneral(a, b.n);
      return F(Math.pow(a.v, Number(b.n)));
    }
    if (racional(a) && racional(b) && b.d <= 64n) {
      var q = Number(b.d), p = b.n;
      if (a.n < 0n && q % 2 === 0) throw errorGPH(ERR.dom, 'Raíz par de un número negativo');
      if (a.n === 0n) return potenciaEntera(Q(0n), p);
      if (q === 2) return potenciaEnteraGeneral(X(1n, a.d, a.n * a.d, 0), p);
      var rn = raizEnteraExacta(absB(a.n), q), rd = raizEnteraExacta(a.d, q);
      if (rn !== null && rd !== null) return potenciaEntera(Q(a.n < 0n ? -rn : rn, rd), p);
      var bv = aNumero(a), ev = aNumero(b);
      if (bv < 0) {
        var m = Math.pow(-bv, ev);
        return F(p % 2n === 0n ? m : -m);
      }
      return F(Math.pow(bv, ev));
    }
    var x = aNumero(a), y = aNumero(b);
    if (x < 0 && !Number.isInteger(y)) throw errorGPH(ERR.dom, 'Base negativa con exponente decimal');
    if (x === 0 && y <= 0) throw errorGPH(y === 0 ? ERR.dom : ERR.div, y === 0 ? '0 elevado a 0 no está definido' : 'División entre cero');
    return F(Math.pow(x, y));
  }

  function raizCuadrada(x) {
    if (esNegativo(x)) throw errorGPH(ERR.dom, 'Raíz cuadrada de un número negativo');
    return potencia(x, Q(1n, 2n));
  }

  function raizN(indice, x) {
    if (esCero(indice)) throw errorGPH(ERR.dom, 'El índice de la raíz no puede ser 0');
    if (esEntero(indice) && indice.n % 2n === 0n && esNegativo(x)) throw errorGPH(ERR.dom, 'Raíz par de un número negativo');
    return potencia(x, dividir(Q(1n), indice));
  }

  function enteroNoNegativo(x, mensaje) {
    if (!esEntero(x) || x.n < 0n) throw errorGPH(ERR.dom, mensaje);
    if (x.n > 1000n) throw errorGPH(ERR.ovf, 'Número demasiado grande');
    return x.n;
  }

  function factorial(x) {
    var n = enteroNoNegativo(x, 'El factorial solo se aplica a enteros no negativos');
    var r = 1n;
    for (var k = 2n; k <= n; k++) r *= k;
    return limitar(Q(r));
  }

  function permutaciones(a, b) {
    var n = enteroNoNegativo(a, 'nPr necesita números enteros no negativos');
    var r = enteroNoNegativo(b, 'nPr necesita números enteros no negativos');
    if (r > n) throw errorGPH(ERR.dom, 'En nPr, el segundo número no puede ser mayor que el primero');
    var p = 1n;
    for (var k = n - r + 1n; k <= n; k++) p *= k;
    return limitar(Q(p));
  }

  function combinaciones(a, b) {
    var n = enteroNoNegativo(a, 'nCr necesita números enteros no negativos');
    var r = enteroNoNegativo(b, 'nCr necesita números enteros no negativos');
    if (r > n) throw errorGPH(ERR.dom, 'En nCr, el segundo número no puede ser mayor que el primero');
    if (r > n - r) r = n - r;
    var c = 1n;
    for (var k = 1n; k <= r; k++) c = c * (n - r + k) / k;
    return limitar(Q(c));
  }

  function potenciaDeDiez(n) {
    if (n < 1n) return -1;
    var s = n.toString();
    return /^10*$/.test(s) ? s.length - 1 : -1;
  }

  function logaritmo(x) {
    if (esNegativo(x) || esCero(x)) throw errorGPH(ERR.dom, 'El logaritmo solo existe para números positivos');
    if (racional(x)) {
      if (x.d === 1n) { var k = potenciaDeDiez(x.n); if (k >= 0) return Q(BigInt(k)); }
      if (x.n === 1n) { var j = potenciaDeDiez(x.d); if (j >= 0) return Q(BigInt(-j)); }
    }
    return F(Math.log10(aNumero(x)));
  }

  function logNatural(x) {
    if (esNegativo(x) || esCero(x)) throw errorGPH(ERR.dom, 'El logaritmo solo existe para números positivos');
    if (racional(x) && x.n === 1n && x.d === 1n) return Q(0n);
    return F(Math.log(aNumero(x)));
  }

  function limpio(v) { return Math.abs(v) < 1e-13 ? 0 : v; }

  // Seno exacto para múltiplos de 30° y 45° (como la TI en MathPrint)
  function senoExactoGrados(a) {
    var s = false;
    a = ((a % 360n) + 360n) % 360n;
    if (a >= 180n) { a -= 180n; s = true; }
    if (a > 90n) a = 180n - a;
    var tabla = { 0: Q(0n), 30: Q(1n, 2n), 45: X(1n, 2n, 2n, 0), 60: X(1n, 2n, 3n, 0), 90: Q(1n) };
    var t = tabla[Number(a)];
    if (!t) return null;
    return s ? opuesto(t) : t;
  }

  function aRadianes(v) {
    return cfgMotor.angulo === 'deg' ? v * Math.PI / 180 : cfgMotor.angulo === 'grad' ? v * Math.PI / 200 : v;
  }
  function deRadianes(v) {
    return cfgMotor.angulo === 'deg' ? v * 180 / Math.PI : cfgMotor.angulo === 'grad' ? v * 200 / Math.PI : v;
  }

  function trig(nombre, x, info) {
    if (cfgMotor.angulo === 'deg' && esEntero(x) && (nombre === 'sin' || nombre === 'cos' || nombre === 'tan')) {
      var a = x.n;
      var s = senoExactoGrados(a), c = senoExactoGrados(a + 90n);
      if (s && c) {
        info.exacto = true;
        if (nombre === 'sin') return s;
        if (nombre === 'cos') return c;
        if (esCero(c)) throw errorGPH(ERR.dom, 'La tangente no existe para ese ángulo');
        return dividir(s, c);
      }
    }
    var v = aNumero(x);
    switch (nombre) {
      case 'sin': return F(limpio(Math.sin(aRadianes(v))));
      case 'cos': return F(limpio(Math.cos(aRadianes(v))));
      case 'tan':
        var cv = limpio(Math.cos(aRadianes(v)));
        if (cv === 0) throw errorGPH(ERR.dom, 'La tangente no existe para ese ángulo');
        return F(limpio(Math.sin(aRadianes(v))) / cv);
      case 'asin':
        if (v < -1 || v > 1) throw errorGPH(ERR.dom, 'sin⁻¹ solo acepta valores entre −1 y 1');
        return F(deRadianes(Math.asin(v)));
      case 'acos':
        if (v < -1 || v > 1) throw errorGPH(ERR.dom, 'cos⁻¹ solo acepta valores entre −1 y 1');
        return F(deRadianes(Math.acos(v)));
      case 'atan': return F(deRadianes(Math.atan(v)));
    }
    throw errorGPH(ERR.sint, 'Error de sintaxis');
  }

  function hiperbolica(f, x) {
    var v = aNumero(x);
    switch (f) {
      case 'sinh': return F(Math.sinh(v));
      case 'cosh': return F(Math.cosh(v));
      case 'tanh': return F(Math.tanh(v));
      case 'asinh': return F(Math.asinh(v));
      case 'acosh':
        if (v < 1) throw errorGPH(ERR.dom, 'cosh⁻¹ solo acepta valores mayores o iguales que 1');
        return F(Math.acosh(v));
      case 'atanh':
        if (v <= -1 || v >= 1) throw errorGPH(ERR.dom, 'tanh⁻¹ solo acepta valores entre −1 y 1');
        return F(Math.atanh(v));
    }
    return null;
  }

  function aplicarFuncion(f, x, info) {
    if (f === 'log') return logaritmo(x);
    if (f === 'ln') return logNatural(x);
    if (f === 'sqrt') return raizCuadrada(x);
    if (f === 'pow10') return potencia(Q(10n), x);
    if (f === 'exp') return esCero(x) ? Q(1n) : F(Math.exp(aNumero(x)));
    var h = hiperbolica(f, x);
    if (h) return h;
    return trig(f, x, info);
  }

  function aplicarFuncion2(f, a, b) {
    var x = aNumero(a), y = aNumero(b);
    switch (f) {
      case 'randint':
        if (!esEntero(a) || !esEntero(b)) throw errorGPH(ERR.dom, 'randint( necesita dos números enteros');
        var lo = Math.min(x, y), hi = Math.max(x, y);
        return Q(BigInt(lo + Math.floor(Math.random() * (hi - lo + 1))));
      case 'RPr': return F(Math.sqrt(x * x + y * y));
      case 'RPt': return F(deRadianes(Math.atan2(y, x)));
      case 'PRx': return F(limpio(x * Math.cos(aRadianes(y))));
      case 'PRy': return F(limpio(x * Math.sin(aRadianes(y))));
    }
    throw errorGPH(ERR.sint, 'Error de sintaxis');
  }

  // Convierte un ángulo dado en grados a la unidad del modo actual
  function desdeGrados(g) {
    if (cfgMotor.angulo === 'deg') return g;
    if (cfgMotor.angulo === 'rad') return multiplicar(g, X(1n, 180n, 1n, 1));
    return multiplicar(g, Q(10n, 9n));
  }

  /* ---------- Estadística ---------- */

  function cuartiles(orden) {
    function mediana(a) {
      var n = a.length, m = Math.floor(n / 2);
      return n % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
    }
    var n = orden.length, mitad = Math.floor(n / 2);
    var inf = orden.slice(0, mitad), sup = orden.slice(n % 2 ? mitad + 1 : mitad);
    return {
      q1: n > 1 ? mediana(inf) : orden[0],
      med: mediana(orden),
      q3: n > 1 ? mediana(sup) : orden[0]
    };
  }

  function expandir(datos, frq) {
    var out = [];
    datos.forEach(function (x, i) {
      var f = frq ? frq[i] : 1;
      if (!Number.isInteger(f) || f < 0) throw errorGPH('FRQ DOMAIN ERROR', 'Las frecuencias deben ser números enteros no negativos');
      for (var k = 0; k < f; k++) out.push(x);
    });
    return out;
  }

  function estadistica1(datos, frq) {
    if (!datos.length) throw errorGPH('STAT ERROR', 'La lista de datos está vacía');
    if (frq && frq.length !== datos.length) throw errorGPH('DIM MISMATCH ERROR', 'La lista de datos y la de frecuencias no tienen la misma cantidad de valores');
    var x = expandir(datos, frq);
    var n = x.length;
    if (!n) throw errorGPH('STAT ERROR', 'No hay datos para calcular');
    var sx = 0, sx2 = 0;
    x.forEach(function (v) { sx += v; sx2 += v * v; });
    var media = sx / n;
    var ss = 0;
    x.forEach(function (v) { ss += (v - media) * (v - media); });
    var orden = x.slice().sort(function (a, b) { return a - b; });
    var q = cuartiles(orden);
    return [
      ['n', n], ['x̄', media], ['Sx', n > 1 ? Math.sqrt(ss / (n - 1)) : null], ['σx', Math.sqrt(ss / n)],
      ['Σx', sx], ['Σx²', sx2], ['minX', orden[0]], ['Q₁', q.q1], ['Med', q.med], ['Q₃', q.q3], ['maxX', orden[n - 1]]
    ];
  }

  function estadistica2(xs, ys, frq) {
    if (!xs.length || !ys.length) throw errorGPH('STAT ERROR', 'Una de las listas de datos está vacía');
    if (xs.length !== ys.length || (frq && frq.length !== xs.length)) throw errorGPH('DIM MISMATCH ERROR', 'Las listas no tienen la misma cantidad de valores');
    var px = [], py = [];
    xs.forEach(function (v, i) {
      var f = frq ? frq[i] : 1;
      if (!Number.isInteger(f) || f < 0) throw errorGPH('FRQ DOMAIN ERROR', 'Las frecuencias deben ser números enteros no negativos');
      for (var k = 0; k < f; k++) { px.push(v); py.push(ys[i]); }
    });
    var n = px.length;
    if (n < 2) throw errorGPH('STAT ERROR', 'Se necesitan al menos dos pares de datos');
    var sx = 0, sy = 0, sx2 = 0, sy2 = 0, sxy = 0;
    for (var i = 0; i < n; i++) { sx += px[i]; sy += py[i]; sx2 += px[i] * px[i]; sy2 += py[i] * py[i]; sxy += px[i] * py[i]; }
    var mx = sx / n, my = sy / n;
    var cxx = sx2 - n * mx * mx, cyy = sy2 - n * my * my, cxy = sxy - n * mx * my;
    var a = cxx ? cxy / cxx : null;
    var b = a === null ? null : my - a * mx;
    var r = cxx && cyy ? cxy / Math.sqrt(cxx * cyy) : null;
    return [
      ['n', n], ['x̄', mx], ['Sx', Math.sqrt(Math.max(0, cxx) / (n - 1))], ['σx', Math.sqrt(Math.max(0, cxx) / n)],
      ['ȳ', my], ['Sy', Math.sqrt(Math.max(0, cyy) / (n - 1))], ['σy', Math.sqrt(Math.max(0, cyy) / n)],
      ['Σx', sx], ['Σx²', sx2], ['Σy', sy], ['Σy²', sy2], ['Σxy', sxy], ['a', a], ['b', b], ['r', r]
    ];
  }

  // Convierte un decimal aproximado en fracción, si hay una sencilla
  function aFraccion(v) {
    if (v.e) return v;
    var x = v.v, signo = x < 0 ? -1 : 1;
    x = Math.abs(x);
    var h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
    for (var i = 0; i < 30; i++) {
      var a = Math.floor(b);
      var h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > 9999) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (Math.abs(x - h1 / k1) < 1e-10 * Math.max(1, x)) return Q(BigInt(signo * h1), BigInt(k1));
      if (b - a < 1e-12) break;
      b = 1 / (b - a);
    }
    return v;
  }

  /* ---------- Análisis de la entrada (árbol MathPrint) ---------- */
  /* Nodos del árbol:
       {t:'k', v:código}                  tecla simple
       {t:'frac',  s:[num, den]}          n/d
       {t:'mixto', s:[entero, num, den]}  U n/d
       {t:'pot',   s:[exponente]}         ^   (se aplica a lo anterior)
       {t:'sci',   s:[exponente]}         ×10ⁿ
       {t:'raiz2', s:[radicando]}         √
       {t:'raizn', s:[índice, radicando]} x√
       {t:'diez',  s:[exponente]}         10ˣ
       {t:'expe',  s:[exponente]}         eˣ
  */

  var FUNCIONES = {
    'log(': 'log', 'ln(': 'ln', 'sin(': 'sin', 'cos(': 'cos', 'tan(': 'tan', 'asin(': 'asin', 'acos(': 'acos', 'atan(': 'atan',
    'sinh(': 'sinh', 'cosh(': 'cosh', 'tanh(': 'tanh', 'asinh(': 'asinh', 'acosh(': 'acosh', 'atanh(': 'atanh',
    'sqrt(': 'sqrt', '10^(': 'pow10', 'e^(': 'exp'
  };
  var FUNCIONES2 = { 'randint(': 'randint', 'RPr(': 'RPr', 'RPt(': 'RPt', 'PRx(': 'PRx', 'PRy(': 'PRy' };
  var CONVERSIONES = { toPct: 1, toFD: 1, toUnd: 1, toDMS: 1 };
  var DMS = { dg: Q(1n), mn: Q(1n, 60n), sg: Q(1n, 3600n) };

  function faltaNumero() { return errorGPH(ERR.sint, 'Falta un número'); }

  function tokenizar(fila, ans, info) {
    var t = [], num = '';

    function cerrarNumero() {
      if (!num) return;
      if ((num.match(/\./g) || []).length > 1 || num === '.') throw errorGPH(ERR.sint, 'Número mal escrito: tiene más de un punto decimal');
      if (num.indexOf('.') >= 0) info.usoDecimal = true;
      var partes = num.split('.');
      var ent = partes[0] || '0', dec = partes[1] || '';
      t.push({ k: 'n', v: Q(BigInt(ent + dec), 10n ** BigInt(dec.length)) });
      num = '';
    }

    for (var i = 0; i < fila.length; i++) {
      var n = fila[i];
      if (n.t === 'k' && /^[0-9.]$/.test(n.v)) { num += n.v; continue; }
      cerrarNumero();
      if (n.t === 'k') {
        var c = n.v;
        if (c === 'neg') t.push({ k: '~' });
        else if ('+-*/()'.indexOf(c) >= 0) t.push({ k: c });
        else if (c === 'pi') t.push({ k: 'n', v: X(1n, 1n, 1n, 1) });
        else if (c === 'ans') t.push({ k: 'n', v: ans || Q(0n) });
        else if (c === 'hv') t.push({ k: 'n', v: n.val });
        else if (c === 'rand') { t.push({ k: 'n', v: F(Math.random()) }); }
        else if (c === 'sq') t.push({ k: 'sq' });
        else if (c === 'inv') { t.push({ k: 'inv' }); info.usoFraccion = true; }
        else if (c === 'fact') t.push({ k: '!' });
        else if (c === 'nPr') t.push({ k: 'P' });
        else if (c === 'nCr') t.push({ k: 'C' });
        else if (c === 'pct') t.push({ k: '%' });
        else if (c === 'var') t.push({ k: 'n', v: cfgMotor.vars[n.n] || Q(0n) });
        else if (c === ',') t.push({ k: ',' });
        else if (c === 'fsl' || c === 'unit' || c === 'El' || c === 'pw' || c === 'xrt' || c === 'rd' || c === 'gd' || DMS[c]) t.push({ k: c });
        else if (c === 'sto') throw errorGPH(ERR.sint, 'Después de sto→ va una variable, al final del cálculo');
        else if (FUNCIONES[c]) t.push({ k: 'fn', f: FUNCIONES[c] });
        else if (FUNCIONES2[c]) t.push({ k: 'fn2', f: FUNCIONES2[c] });
        else if (CONVERSIONES[c]) throw errorGPH(ERR.sint, 'La conversión debe ir al final del cálculo');
        else throw errorGPH(ERR.sint, 'Error de sintaxis');
        continue;
      }
      var s = n.s;
      switch (n.t) {
        case 'frac':
          info.usoFraccion = true;
          t.push({ k: 'n', v: dividir(evaluarFila(s[0], ans, info), evaluarFila(s[1], ans, info)) });
          break;
        case 'mixto':
          info.usoFraccion = true;
          var w = evaluarFila(s[0], ans, info);
          var fr = dividir(evaluarFila(s[1], ans, info), evaluarFila(s[2], ans, info));
          if (esNegativo(fr)) throw errorGPH(ERR.sint, 'En un número mixto, la fracción no puede ser negativa');
          t.push({ k: 'n', v: esNegativo(w) ? restar(w, fr) : sumar(w, fr) });
          break;
        case 'raiz2':
          t.push({ k: 'n', v: raizCuadrada(evaluarFila(s[0], ans, info)) });
          break;
        case 'raizn':
          t.push({ k: 'n', v: raizN(evaluarFila(s[0], ans, info), evaluarFila(s[1], ans, info)) });
          break;
        case 'diez':
          t.push({ k: 'n', v: potencia(Q(10n), evaluarFila(s[0], ans, info)) });
          break;
        case 'expe':
          var ex = evaluarFila(s[0], ans, info);
          t.push({ k: 'n', v: esCero(ex) ? Q(1n) : F(Math.exp(aNumero(ex))) });
          break;
        case 'pot':
          t.push({ k: '^', v: evaluarFila(s[0], ans, info) });
          break;
        case 'sci':
          t.push({ k: 'E', v: evaluarFila(s[0], ans, info) });
          break;
        default:
          throw errorGPH(ERR.sint, 'Error de sintaxis');
      }
    }
    cerrarNumero();
    return combinar(t, info);
  }

  // Entrada lineal (modo CLASSIC) y ángulos en grados, minutos y segundos:
  // une 3/4, 2u1/3, 4.5E6 y 30°15'20" en un solo número.
  function combinar(t, info) {
    var out = [];
    function sinNumero(msj) { return errorGPH(ERR.sint, msj); }
    for (var i = 0; i < t.length; i++) {
      var x = t[i], a, b;
      if (x.k === 'unit') {
        var w = out.pop();
        a = t[i + 1]; var sl = t[i + 2]; b = t[i + 3];
        if (!w || w.k !== 'n' || !a || a.k !== 'n' || !sl || sl.k !== 'fsl' || !b || b.k !== 'n') {
          throw sinNumero('Número mixto incompleto: entero, u, numerador, / y denominador');
        }
        var fr = dividir(a.v, b.v);
        out.push({ k: 'n', v: esNegativo(w.v) ? restar(w.v, fr) : sumar(w.v, fr) });
        info.usoFraccion = true;
        i += 3;
        continue;
      }
      if (x.k === 'fsl') {
        a = out.pop(); b = t[i + 1];
        if (!a || a.k !== 'n' || !b || b.k !== 'n') throw sinNumero('Fracción incompleta: numerador / denominador');
        out.push({ k: 'n', v: dividir(a.v, b.v) });
        info.usoFraccion = true;
        i += 1;
        continue;
      }
      if (x.k === 'El') {
        a = out.pop();
        var j = i + 1, neg = false;
        if (t[j] && t[j].k === '~') { neg = true; j++; }
        b = t[j];
        if (!a || a.k !== 'n' || !b || b.k !== 'n') throw sinNumero('Notación científica incompleta: número E exponente');
        out.push({ k: 'n', v: multiplicar(a.v, potencia(Q(10n), neg ? opuesto(b.v) : b.v)) });
        i = j;
        continue;
      }
      if (DMS[x.k]) {
        a = out.pop();
        if (!a || a.k !== 'n') throw sinNumero('Escribe el número antes de °, \' o "');
        var g = multiplicar(a.v, DMS[x.k]);
        var prev = out[out.length - 1];
        if (prev && prev.dms) { out.pop(); g = sumar(prev.gr, g); }
        out.push({ k: 'n', v: desdeGrados(g), dms: true, gr: g });
        continue;
      }
      out.push(x);
    }
    return out;
  }

  function analizar(tokens, info) {
    var i = 0;
    function ver() { return tokens[i]; }
    function es(k) { var x = tokens[i]; return x && x.k === k; }
    function iniciaPrimario(x) { return x && (x.k === 'n' || x.k === '(' || x.k === 'fn' || x.k === 'fn2'); }

    // Como en la TI: el signo negativo es la tecla (−) y la resta es −.
    // (−) entre dos números, o − donde va un número, dan SYNTAX ERROR.
    function errorNegativoComoResta() {
      return errorGPH(ERR.sint, 'La tecla (−) es para números negativos. Para restar usa la tecla −');
    }

    function exponente() {
      if (es('~')) { i++; return opuesto(exponente()); }
      return posfijo();
    }

    function expresion() {
      var v = termino();
      while (es('+') || es('-')) {
        var op = tokens[i++].k;
        var r = termino();
        v = op === '+' ? sumar(v, r) : restar(v, r);
      }
      return v;
    }

    function termino() {
      var v = unario();
      for (;;) {
        if (es('*') || es('/')) {
          var op = tokens[i++].k;
          var r = unario();
          v = op === '*' ? multiplicar(v, r) : dividir(v, r);
        } else if (iniciaPrimario(ver())) {
          v = multiplicar(v, unario());
        } else if (es('~')) {
          throw errorNegativoComoResta();
        } else {
          break;
        }
      }
      return v;
    }

    function unario() {
      if (es('~')) { i++; return opuesto(unario()); }
      return nivelProbabilidad();
    }

    function nivelProbabilidad() {
      var b = posfijo();
      if (es('P')) { i++; return permutaciones(b, posfijo()); }
      if (es('C')) { i++; return combinaciones(b, posfijo()); }
      return b;
    }

    function posfijo() {
      var v = primario();
      for (;;) {
        if (es('sq')) { i++; v = potencia(v, Q(2n)); }
        else if (es('inv')) { i++; v = dividir(Q(1n), v); }
        else if (es('!')) { i++; v = factorial(v); }
        else if (es('%')) { i++; v = dividir(v, Q(100n)); }
        else if (es('^')) { v = potencia(v, tokens[i++].v); }
        else if (es('E')) { v = multiplicar(v, potencia(Q(10n), tokens[i++].v)); }
        else if (es('pw')) { i++; v = potencia(v, exponente()); }
        else if (es('xrt')) { i++; v = raizN(v, exponente()); }
        else if (es('rd')) { i++; v = F(deRadianes(aNumero(v))); }
        else if (es('gd')) { i++; v = F(deRadianes(aNumero(v) * Math.PI / 200)); }
        else break;
      }
      return v;
    }

    function primario() {
      var x = tokens[i++];
      if (!x) throw faltaNumero();
      if (x.k === 'n') return x.v;
      if (x.k === '(') {
        var v = expresion();
        if (es(')')) i++;
        return v;
      }
      if (x.k === 'fn') {
        var a = expresion();
        if (es(')')) i++;
        return aplicarFuncion(x.f, a, info);
      }
      if (x.k === 'fn2') {
        var p1 = expresion();
        if (!es(',')) throw errorGPH(ERR.sint, 'Esta función necesita dos números separados por una coma (2nd .)');
        i++;
        var p2 = expresion();
        if (es(')')) i++;
        return aplicarFuncion2(x.f, p1, p2);
      }
      if (x.k === 'E') return potencia(Q(10n), x.v);
      if (x.k === ',') throw errorGPH(ERR.sint, 'La coma solo se usa dentro de funciones como randint(');
      if (x.k === ')') throw errorGPH(ERR.sint, 'Sobra un paréntesis de cierre');
      if (x.k === '-') throw errorGPH(ERR.sint, 'Para un número negativo usa la tecla (−), no la resta −');
      if (x.k === '+' || x.k === '*' || x.k === '/') throw errorGPH(ERR.sint, 'Falta el número antes de esta operación');
      if (x.k === 'P' || x.k === 'C') throw errorGPH(ERR.sint, 'Escribe primero el número n y después nPr o nCr');
      if (x.k === '^' || x.k === 'sq' || x.k === 'inv' || x.k === '!' || x.k === '%') throw errorGPH(ERR.sint, 'Falta el número antes de esta tecla');
      throw errorGPH(ERR.sint, 'Error de sintaxis');
    }

    var resultado = expresion();
    if (i < tokens.length) {
      throw errorGPH(ERR.sint, tokens[i].k === ')' ? 'Sobra un paréntesis de cierre' : 'Error de sintaxis');
    }
    return resultado;
  }

  function evaluarFila(fila, ans, info) {
    var tokens = tokenizar(fila, ans, info);
    if (!tokens.length) throw faltaNumero();
    return analizar(tokens, info);
  }

  // Devuelve {v, modo, conversion, guardar}
  function evaluarEntrada(fila, ans, cfg, previo) {
    cfg = cfg || {};
    cfgMotor.angulo = cfg.angulo || 'deg';
    cfgMotor.vars = cfg.vars || {};
    cfgMotor.pantalla = cfg.pantalla || 'mathprint';
    var conversion = null, guardar = null;
    var cuerpo = fila.slice();
    for (var s = 0; s < cuerpo.length; s++) {
      if (cuerpo[s].t === 'k' && cuerpo[s].v === 'sto') {
        var dest = cuerpo[s + 1];
        if (s !== cuerpo.length - 2 || !dest || dest.v !== 'var') {
          throw errorGPH(ERR.sint, 'Después de sto→ pulsa la tecla de variables para elegir dónde guardar');
        }
        guardar = dest.n;
        cuerpo = cuerpo.slice(0, s);
        break;
      }
    }
    var ultimo = cuerpo[cuerpo.length - 1];
    if (ultimo && ultimo.t === 'k' && CONVERSIONES[ultimo.v]) {
      conversion = ultimo.v;
      cuerpo.pop();
    }
    var info = { usoDecimal: false, usoFraccion: false, exacto: false };
    var v = evaluarFila(cuerpo, ans, info);
    if (v.e && esCero(v)) v = Q(0n);
    if (!v.e && Object.is(v.v, -0)) v = F(0);

    var modo = modoPorDefecto(v, info);
    if (conversion === 'toPct') modo = 'pct';
    else if (conversion === 'toDMS') modo = 'dms';
    else if (conversion === 'toFD') {
      if (modo === 'dec') {
        var f = aFraccion(v);
        if (racional(f) && f.d !== 1n) { v = f; modo = 'frac'; }
      } else {
        modo = 'dec';
      }
    } else if (conversion === 'toUnd') {
      if (!v.e) { var g = aFraccion(v); if (racional(g)) v = g; }
      var deMixto = cuerpo.length === 1 && cuerpo[0].t === 'k' && cuerpo[0].v === 'ans' && previo === 'mixto';
      if (racional(v) && v.d !== 1n) modo = deMixto ? 'frac' : 'mixto';
    }
    if ((modo === 'frac' || modo === 'mixto') && (!racional(v) || v.d === 1n || v.d > 9999n)) modo = 'dec';
    if (modo === 'exacto' && cfgMotor.pantalla === 'classic') modo = 'dec';
    return { v: v, modo: modo, conversion: conversion, info: info, guardar: guardar };
  }

  function modoPorDefecto(v, info) {
    if (!v.e) return 'dec';
    if (!racional(v)) return info.usoDecimal ? 'dec' : 'exacto';
    if (v.d === 1n) return 'dec';
    if ((info.usoFraccion || info.exacto) && !info.usoDecimal) return 'frac';
    return 'dec';
  }

  /* ---------- Presentación del resultado ---------- */

  function signoBonito(s) { return String(s).replace(/-/g, '−'); }

  function quitarCeros(s) {
    if (s.indexOf('.') < 0) return s;
    return s.replace(/0+$/, '').replace(/\.$/, '');
  }

  function formatoDecimal(x, cfg) {
    cfg = cfg || {};
    var fijo = cfg.fijo === undefined ? -1 : cfg.fijo;
    var notacion = cfg.notacion || 'norm';
    if (!isFinite(x)) throw errorGPH(ERR.ovf, 'Número demasiado grande');
    var a = Math.abs(x);
    if (notacion === 'norm') {
      if (x === 0) return simple(fijo >= 0 ? (0).toFixed(fijo) : '0');
      if (a < 1e10 && (fijo >= 0 || a >= 1e-9)) {
        var s = fijo >= 0 ? x.toFixed(fijo) : quitarCeros(x.toPrecision(10));
        if (s.indexOf('e') < 0) {
          if (fijo >= 0 && /^-?0\.?0*$/.test(s) && x !== 0) {
            // demasiado pequeño para los decimales fijos: la TI pasa a científica
          } else {
            return simple(s);
          }
        }
      }
      notacion = 'sci';
    }
    if (x === 0) return simple(fijo >= 0 ? (0).toFixed(fijo) : '0');
    var ing = notacion === 'eng';
    var e = Math.floor(Math.log10(a));
    if (ing) e = Math.floor(e / 3) * 3;
    var mant = x / Math.pow(10, e);
    var digitos = ing ? 10 - (String(Math.floor(Math.abs(mant))).length - 1) : 10;
    var ms = fijo >= 0 ? mant.toFixed(fijo) : quitarCeros(mant.toPrecision(Math.max(1, digitos)));
    if (Math.abs(parseFloat(ms)) >= (ing ? 1000 : 10)) {
      e += ing ? 3 : 1;
      mant = x / Math.pow(10, e);
      ms = fijo >= 0 ? mant.toFixed(fijo) : quitarCeros(mant.toPrecision(10));
    }
    if (cfg.pantalla === 'classic') {
      return { html: signoBonito(ms) + '<span class="gti-E">E</span>' + signoBonito(e), texto: signoBonito(ms) + ' por 10 a la ' + signoBonito(e) };
    }
    return {
      html: signoBonito(ms) + '<span class="gti-x10">×10</span><sup>' + signoBonito(e) + '</sup>',
      texto: signoBonito(ms) + ' por 10 a la ' + signoBonito(e)
    };

    function simple(t) { return { html: signoBonito(t), texto: signoBonito(t) }; }
  }

  function fraccionHTML(n, d) {
    return '<span class="gti-fr"><span class="gti-fr-n">' + n + '</span><span class="gti-fr-d">' + d + '</span></span>';
  }

  function raizHTML(r) {
    return '<span class="gti-rz"><span class="gti-rz-s">√</span><span class="gti-rz-a">' + r + '</span></span>';
  }

  function formatoDMS(g) {
    var signo = g < 0 ? '−' : '';
    g = Math.abs(g);
    var d = Math.floor(g), m = Math.floor((g - d) * 60 + 1e-9);
    var sg = parseFloat((((g - d) * 60 - m) * 60).toPrecision(8));
    if (sg >= 60) { sg -= 60; m++; }
    if (m >= 60) { m -= 60; d++; }
    var t = signo + d + '°' + m + '\'' + quitarCeros(String(sg)) + '"';
    return { html: t, texto: signo + d + ' grados ' + m + ' minutos ' + quitarCeros(String(sg)) + ' segundos' };
  }

  function formatear(v, modo, cfg) {
    cfg = cfg || {};
    var clasico = cfg.pantalla === 'classic';
    if (modo === 'dms') return formatoDMS(aNumero(v));
    if (modo === 'pct') {
      var pc = formatoDecimal(aNumero(v) * 100, cfg);
      return { html: pc.html + '%', texto: pc.texto + ' por ciento' };
    }
    if (!v.e) return formatoDecimal(v.v, cfg);
    var signo = v.n < 0n ? '−' : '';
    var n = absB(v.n), d = v.d;
    if (!racional(v)) {
      if (modo !== 'exacto' || clasico) return formatoDecimal(aNumero(v), cfg);
      var coef = (n === 1n && (v.r !== 1n || v.p)) ? '' : n.toString();
      var arriba = coef + (v.r !== 1n ? raizHTML(v.r.toString()) : '') + (v.p ? 'π' : '');
      var habla = (coef ? coef + ' ' : '') + (v.r !== 1n ? 'raíz de ' + v.r + ' ' : '') + (v.p ? 'pi' : '');
      if (d === 1n) return { html: signo + arriba, texto: (signo ? 'menos ' : '') + habla.trim() };
      return { html: signo + fraccionHTML(arriba, d.toString()), texto: (signo ? 'menos ' : '') + habla.trim() + ' sobre ' + d };
    }
    if (d === 1n) {
      var s = v.n.toString();
      if (s.replace('-', '').length > 10) return formatoDecimal(aNumero(v), cfg);
      if (cfg.fijo >= 0 || cfg.notacion === 'sci' || cfg.notacion === 'eng') return formatoDecimal(aNumero(v), cfg);
      return { html: signoBonito(s), texto: signoBonito(s) };
    }
    if (modo === 'frac') {
      if (clasico) return { html: signo + n + '<span class="gti-fsl">/</span>' + d, texto: signo + n + ' sobre ' + d };
      return { html: signo + fraccionHTML(n.toString(), d.toString()), texto: signo + n + ' sobre ' + d };
    }
    if (modo === 'mixto') {
      var entero = n / d, resto = n % d;
      if (clasico) {
        var lin = (entero === 0n ? '' : entero + '<span class="gti-u">u</span>') + resto + '<span class="gti-fsl">/</span>' + d;
        return { html: signo + lin, texto: signo + (entero === 0n ? '' : entero + ' y ') + resto + ' sobre ' + d };
      }
      if (entero === 0n) return { html: signo + fraccionHTML(resto.toString(), d.toString()), texto: signo + resto + ' sobre ' + d };
      return {
        html: signo + entero + '<span class="gti-mx-sep"></span>' + fraccionHTML(resto.toString(), d.toString()),
        texto: signo + entero + ' y ' + resto + ' sobre ' + d
      };
    }
    return formatoDecimal(aNumero(v), cfg);
  }

  // Formas en que se puede mostrar un resultado con la tecla ⟷
  function formasAlternas(v, cfg) {
    if (v.e && !racional(v) && cfg && cfg.pantalla === 'classic') return ['dec'];
    if (!v.e) {
      var f = aFraccion(v);
      return racional(f) && f.d !== 1n && f.d <= 9999n ? ['dec', 'frac'] : ['dec'];
    }
    if (!racional(v)) return ['exacto', 'dec'];
    if (v.d === 1n || v.d > 9999n) return ['dec'];
    return ['frac', 'dec'];
  }

  var motor = {
    evaluarEntrada: evaluarEntrada,
    formatear: formatear,
    formatoDecimal: formatoDecimal,
    formasAlternas: formasAlternas,
    estadistica1: estadistica1,
    estadistica2: estadistica2,
    aFraccion: aFraccion,
    Q: Q,
    aNumero: aNumero
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = motor;
  if (typeof document === 'undefined') return;
  if (global.CalculadoraGPH && global.CalculadoraGPH.version === '2') return;

  /* ==========================================================
     2. INTERFAZ
     ========================================================== */

  var guion = document.currentScript;
  function attr(nombre) { return guion ? guion.getAttribute(nombre) : null; }
  var opciones = {
    color: attr('data-color') || '#1e3a5f',
    boton: attr('data-boton') !== 'no',
    hoja: attr('data-hoja') !== 'no',
    pistas: attr('data-pistas') !== 'no',
    abrir: attr('data-abrir') === 'si',
    izquierda: attr('data-lado') === 'izquierda',
    recordar: attr('data-recordar') !== 'no'
  };

  var CSS = [
    /* Barra superior */
    '#gti-barra{position:fixed;top:10px;right:12px;z-index:2147482999;display:flex;gap:6px;font-family:"Segoe UI",Tahoma,Arial,sans-serif}',
    '#gti-barra button{background:' + opciones.color + ';color:#fff;border:2px solid #fff;border-radius:8px;padding:7px 12px;font-size:14px;font-weight:700;',
    'cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.3);font-family:inherit;line-height:1.2}',
    '#gti-barra button:hover{filter:brightness(1.15)}',
    '#gti-barra button[aria-expanded="true"]{background:#fff;color:' + opciones.color + ';border-color:' + opciones.color + '}',
    '#gti-barra button:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}',

    /* Ventanas flotantes */
    '.gti-ventana{position:fixed;z-index:2147483000;display:none;box-sizing:border-box;font-family:"Segoe UI",Tahoma,Arial,sans-serif;line-height:1.25}',
    '.gti-ventana *{box-sizing:border-box}',
    '.gti-ventana.gti-abierta{display:block}',
    '.gti-asa{display:flex;align-items:center;gap:6px;background:#1b2f45;color:#fff;padding:6px 8px 6px 12px;cursor:grab;touch-action:none;',
    'border-radius:12px 12px 0 0;user-select:none;-webkit-user-select:none}',
    '.gti-asa:active{cursor:grabbing}',
    '.gti-asa:focus-visible{outline:3px solid #f59e0b;outline-offset:-3px}',
    '.gti-asa-t{flex:1;font-size:13px;font-weight:700;letter-spacing:.3px}',
    '.gti-asa button{min-width:28px;height:28px;border-radius:14px;border:2px solid rgba(255,255,255,.85);background:transparent;color:#fff;',
    'font-size:13px;font-weight:700;cursor:pointer;padding:0 7px;font-family:inherit}',
    '.gti-asa button:hover,.gti-asa button:focus-visible{background:#fff;color:#1b2f45;outline:none}',
    '.gti-asa button[aria-pressed="true"]{background:#fde68a;color:#1b2f45;border-color:#fde68a}',

    /* Cuerpo de la calculadora */
    '#gti-calc{width:304px;max-width:calc(100vw - 8px)}',
    '#gti-calc .gti-cuerpo{background:linear-gradient(165deg,#3b6a8c 0%,#2f5a7a 45%,#264c69 100%);border:2px solid #1b2f45;border-top:none;',
    'border-radius:0 0 18px 18px;padding:8px 12px 14px;box-shadow:0 10px 32px rgba(0,0,0,.45);max-height:calc(100vh - 48px);overflow-y:auto;',
    'user-select:none;-webkit-user-select:none}',
    '#gti-calc .gti-marca{display:flex;justify-content:space-between;align-items:flex-end;color:#fff;margin:0 2px 6px}',
    '#gti-calc .gti-marca b{font-size:15px;letter-spacing:.4px}',
    '#gti-calc .gti-marca span{font-size:10px;color:#dbe7f1}',
    '#gti-calc .gti-solar{height:9px;width:84px;margin:0 0 6px auto;border-radius:3px;background:linear-gradient(90deg,#161616,#383838,#161616);border:1px solid #111}',

    /* Pantalla LCD */
    '#gti-calc .gti-lcd{background:#c3cfae;border:3px solid #1f2b17;border-radius:6px;box-shadow:inset 0 2px 6px rgba(0,0,0,.35);color:#141c0c;',
    'height:152px;display:flex;flex-direction:column;padding:2px 6px 4px;font-family:"Segoe UI",Arial,sans-serif}',
    '#gti-calc .gti-estado{display:flex;gap:8px;font-size:10px;font-weight:700;height:13px;line-height:13px;letter-spacing:.3px}',
    '#gti-calc .gti-estado .gti-e2{background:#141c0c;color:#c3cfae;padding:0 3px;border-radius:2px}',
    '#gti-calc .gti-estado .gti-flechas{margin-left:auto}',
    '#gti-calc .gti-lineas{flex:1;overflow:hidden;display:block}',
    '#gti-calc .gti-l{font-size:17px;min-height:22px;line-height:22px;padding:2px 2px;white-space:nowrap;display:block;overflow:hidden;text-align:left}',
    '#gti-calc .gti-l.gti-res{text-align:right;font-weight:600}',
    '#gti-calc .gti-l.gti-sel{background:#141c0c;color:#c3cfae}',
    '#gti-calc .gti-l.gti-actual{white-space:normal;word-break:break-all}',
    '#gti-calc .gti-error{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;font-size:17px;font-weight:700;text-align:center}',
    '#gti-calc .gti-error small{font-size:11px;font-weight:600;margin-top:6px}',

    /* MathPrint */
    '.gti-fr{display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;margin:0 2px;font-size:.82em;line-height:1.05}',
    '.gti-fr-n{border-bottom:2px solid currentColor;padding:0 2px 1px;display:block;text-align:center;min-width:12px;line-height:1.15}',
    '.gti-fr-d{padding:1px 2px 0;display:block;text-align:center;min-width:12px;line-height:1.15}',
    '.gti-mx{display:inline;white-space:nowrap}',
    '.gti-mx-sep{display:inline-block;width:3px}',
    '.gti-sup{font-size:.72em;vertical-align:.6em;display:inline-block;line-height:1}',
    '.gti-rz{display:inline-flex;align-items:stretch;margin:0 1px}',
    '.gti-rz-s{font-size:1.05em;line-height:1;align-self:flex-end;padding-right:1px}',
    '.gti-rz-a{border-top:2px solid currentColor;padding:2px 2px 0 1px;display:inline-block;line-height:1.1}',
    '.gti-rz-i{font-size:.62em;align-self:flex-start;margin-right:-3px;display:inline-block;line-height:1}',
    '.gti-x10{font-size:.9em}',
    '.gti-neg{font-size:.75em;vertical-align:.3em;font-weight:700;margin-right:1px}',
    '.gti-prb{font-size:.78em;font-weight:800;margin:0 4px;padding:0 2px;border:1px solid currentColor;border-radius:3px;letter-spacing:.2px}',
    '.gti-conv{font-size:.78em;font-weight:700;margin-left:2px}',
    '.gti-vacio{display:inline-block;width:10px;height:14px;border:1.5px dotted currentColor;vertical-align:middle;margin:0 1px;opacity:.75}',
    '.gti-vacio.gti-act{opacity:1;border-style:solid;animation:gtiParp 1s steps(1) infinite}',
    '.gti-cur{display:inline-block;width:2px;height:1.05em;background:currentColor;vertical-align:middle;margin:0 -1px;animation:gtiParp 1s steps(1) infinite}',
    '@keyframes gtiParp{50%{opacity:0}}',
    '@media (prefers-reduced-motion:reduce){.gti-cur,.gti-vacio.gti-act{animation:none}}',

    /* Menús de la pantalla */
    '#gti-calc .gti-menu{flex:1;font-size:15px;display:flex;flex-direction:column;gap:1px;padding-top:2px}',
    '#gti-calc .gti-pest{display:flex;gap:8px;margin-bottom:2px}',
    '#gti-calc .gti-menu button{all:unset;cursor:pointer;padding:0 3px;border-radius:2px;font-family:inherit;font-size:15px;line-height:20px;color:#141c0c}',
    '#gti-calc .gti-menu button.gti-on{background:#141c0c;color:#c3cfae}',
    '#gti-calc .gti-menu button.gti-foco{outline:2px dashed #141c0c;outline-offset:0}',
    '#gti-calc .gti-menu button:focus-visible{outline:2px solid #141c0c}',
    '#gti-calc .gti-mfila{display:flex;flex-wrap:wrap;gap:2px 6px}',
    '#gti-calc .gti-mfila.gti-dig{gap:0 1px}',

    /* Pistas */
    '#gti-calc .gti-pista{min-height:30px;margin:6px 0 4px;padding:4px 8px;border-radius:6px;background:#10283c;color:#fff;font-size:12px;line-height:1.3}',
    '#gti-calc .gti-pista[hidden]{display:none}',
    '#gti-calc .gti-pista b{color:#fde68a}',

    /* Teclado */
    '#gti-calc .gti-teclado{display:grid;grid-template-columns:repeat(5,1fr);column-gap:6px;row-gap:1px;margin-top:6px}',
    '#gti-calc .gti-celda{display:flex;flex-direction:column;align-items:stretch}',
    '#gti-calc .gti-sec{font-size:10px;font-weight:700;color:#b8f5ae;text-align:center;height:13px;line-height:13px;white-space:nowrap;overflow:visible;letter-spacing:-.1px}',
    '#gti-calc .gti-k{height:29px;border-radius:7px;border:1px solid #0d1a26;font-family:"Segoe UI",Arial,sans-serif;font-size:13px;font-weight:700;',
    'cursor:pointer;padding:0;box-shadow:0 2px 0 rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;line-height:1}',
    '#gti-calc .gti-k:active,#gti-calc .gti-k.gti-pulsada{transform:translateY(2px);box-shadow:none}',
    '#gti-calc .gti-k:focus-visible{outline:3px solid #f59e0b;outline-offset:1px}',
    '#gti-calc .gti-k sup{font-size:.7em;vertical-align:.5em;line-height:0}','#gti-calc .gti-k sub{font-size:.7em;line-height:0}',
    '#gti-calc .gti-fn{background:linear-gradient(180deg,#22384f,#16283a);color:#fff}',
    '#gti-calc .gti-num{background:linear-gradient(180deg,#fafafa,#e1e4e8);color:#111;font-size:16px;border-color:#7a8592}',
    '#gti-calc .gti-op{background:linear-gradient(180deg,#0f1d2b,#07121c);color:#fff;font-size:17px}',
    '#gti-calc .gti-2nd{background:linear-gradient(180deg,#8fe08a,#5fbf5a);color:#0b2a09;border-color:#2f6b2c}',
    '#gti-calc .gti-2nd[aria-pressed="true"]{background:#fde047;color:#1c1500;border-color:#a37f00;box-shadow:0 0 0 3px #fde68a}',
    '#gti-calc .gti-clear{background:linear-gradient(180deg,#22384f,#16283a);color:#fff}',
    '#gti-calc .gti-enter{background:linear-gradient(180deg,#0f1d2b,#07121c);color:#fff;font-size:13px}',
    '#gti-calc .gti-dpad{grid-column:4 / span 2;grid-row:1 / span 2;display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr 1fr;',
    'gap:1px;padding:4px 8px 0;align-self:center}',
    '#gti-calc .gti-dpad .gti-k{height:24px;border-radius:12px;font-size:12px;background:linear-gradient(180deg,#5a6772,#333d46);color:#fff}',
    '#gti-calc .gti-dpad .gti-up{grid-column:2;grid-row:1}',
    '#gti-calc .gti-dpad .gti-left{grid-column:1;grid-row:2}',
    '#gti-calc .gti-dpad .gti-right{grid-column:3;grid-row:2}',
    '#gti-calc .gti-dpad .gti-down{grid-column:2;grid-row:3}',
    '#gti-calc .gti-pie{margin-top:8px;text-align:center;font-size:10px;color:#dbe7f1}',

    /* Hoja de referencia */
    '#gti-hoja{width:460px;max-width:calc(100vw - 8px);background:#fff;border-radius:12px;box-shadow:0 10px 32px rgba(0,0,0,.4);color:#111827}',
    '#gti-hoja .gti-pests{display:flex;gap:4px;padding:8px 10px 0;background:#e7eef5;border-bottom:2px solid #1b2f45}',
    '#gti-hoja .gti-pests button{border:2px solid #1b2f45;border-bottom:none;background:#fff;color:#1b2f45;padding:6px 12px;border-radius:8px 8px 0 0;',
    'font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}',
    '#gti-hoja .gti-pests button[aria-selected="true"]{background:#1b2f45;color:#fff}',
    '#gti-hoja .gti-pests button:focus-visible{outline:3px solid #f59e0b;outline-offset:1px}',
    '#gti-hoja .gti-panel{padding:12px 16px 16px;max-height:calc(100vh - 150px);overflow-y:auto;font-size:15px;line-height:1.45}',
    '#gti-hoja .gti-panel[hidden]{display:none}',
    '#gti-hoja h3{font-size:16px;margin:14px 0 6px;color:#1b2f45;border-bottom:2px solid #c7d6e4;padding-bottom:3px}',
    '#gti-hoja h3:first-child{margin-top:0}',
    '#gti-hoja table{border-collapse:collapse;width:100%;font-size:14.5px}',
    '#gti-hoja caption{text-align:left;font-weight:700;color:#1b2f45;padding:2px 0 4px}',
    '#gti-hoja th,#gti-hoja td{border:1px solid #c7d6e4;padding:5px 7px;text-align:left;vertical-align:middle}',
    '#gti-hoja th{background:#eef3f8;color:#1b2f45}','#gti-hoja .gti-sv td+td{white-space:nowrap}',
    '#gti-hoja .gti-nota{font-size:13.5px;color:#374151;margin:6px 0 0}',
    '#gti-hoja .gti-indice{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 6px;padding:0;list-style:none}',
    '#gti-hoja .gti-indice button{border:1px solid #1b2f45;background:#eef3f8;color:#1b2f45;border-radius:14px;padding:3px 10px;font-size:13px;',
    'cursor:pointer;font-family:inherit;font-weight:600}',
    '#gti-hoja .gti-indice button:hover,#gti-hoja .gti-indice button:focus-visible{background:#1b2f45;color:#fff;outline:none}',
    '#gti-hoja .gti-paso{margin:4px 0 8px}',
    '#gti-hoja .gti-ej{background:#f3f6f9;border-left:4px solid #3b6a8c;padding:6px 10px;margin:6px 0 10px;border-radius:0 6px 6px 0}',
    '#gti-hoja kbd{display:inline-block;min-width:24px;text-align:center;background:#16283a;color:#fff;border-radius:5px;padding:1px 6px;',
    'font-family:"Segoe UI",Arial,sans-serif;font-size:13px;font-weight:700;margin:1px 1px;box-shadow:0 2px 0 #000}',
    '#gti-hoja kbd.gti-kn{background:#eceff2;color:#111;box-shadow:0 2px 0 #7a8592}',
    '#gti-hoja kbd.gti-k2{background:#6fcf6a;color:#0b2a09;box-shadow:0 2px 0 #2f6b2c}',
    '#gti-hoja .gti-v{display:inline-block;color:#166534;font-weight:700;font-size:12.5px}',
    '#gti-hoja .gti-fr{font-size:.9em}',
    '#gti-hoja .gti-rz-a{border-top-width:1.5px}',

    /* Pantallas de datos, estadística y tabla */
    '.gti-fsl{font-weight:800;margin:0 1px}',
    '.gti-u{font-size:.8em;font-weight:800;margin:0 1px}',
    '.gti-E{font-size:.8em;font-weight:800;margin:0 1px}',
    '.gti-sto{font-weight:800;margin:0 2px}',
    '.gti-var{font-family:Georgia,"Times New Roman",serif;font-weight:700}',
    '#gti-calc .gti-mtit{font-weight:700;font-size:14px;margin-bottom:1px}',
    '#gti-calc .gti-mlab{display:inline-block;min-width:54px;font-weight:600}',
    '#gti-calc .gti-mact{outline:1px dashed #141c0c;outline-offset:1px}',
    '#gti-calc .gti-mas{font-size:10px;text-align:right;line-height:10px}',
    '#gti-calc .gti-tab3,#gti-calc .gti-tab2{font-size:15px;display:flex;flex-direction:column;height:100%}',
    '#gti-calc .gti-tcab,#gti-calc .gti-tfila{display:grid;gap:3px}',
    '#gti-calc .gti-tab3 .gti-tcab,#gti-calc .gti-tab3 .gti-tfila{grid-template-columns:repeat(3,1fr)}',
    '#gti-calc .gti-tab2 .gti-tcab,#gti-calc .gti-tab2 .gti-tfila{grid-template-columns:1fr 1.4fr}',
    '#gti-calc .gti-tcab{border-bottom:2px solid #141c0c;font-weight:700;text-align:center;font-size:13px}',
    '#gti-calc .gti-tcab .gti-tcol{text-decoration:underline}',
    '#gti-calc .gti-tfila{height:24px;border-bottom:1px dotted #5b6b47}',
    '#gti-calc .gti-tcel{all:unset;box-sizing:border-box;text-align:right;padding:0 3px;line-height:23px;white-space:nowrap;overflow:hidden;cursor:pointer;font-size:14px;color:#141c0c}',
    '#gti-calc .gti-tcel.gti-on{background:#141c0c;color:#c3cfae}',
    '#gti-calc .gti-tcel .gti-fr{font-size:.7em}',
    '#gti-calc .gti-tpie{margin-top:auto;font-size:15px;white-space:nowrap;overflow:hidden;padding-top:2px}',
    '#gti-calc .gti-menu .gti-stl{font-size:14px}',
    '.gti-lector{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '@media (max-width:480px){#gti-barra button{font-size:13px;padding:6px 9px}}',
    '@media print{#gti-barra,.gti-ventana{display:none!important}}'
  ].join('');

  /* ---------- Teclas ----------
     [id, etiqueta, etiqueta 2nd, clase, descripción, descripción 2nd] */
  var FILAS = [
    [['2nd', '2nd', '', '2nd', 'Tecla 2nd: activa la función verde de la siguiente tecla'],
     ['mode', 'mode', 'quit', 'fn', 'mode: menú de modos', 'quit: salir del menú'],
     ['delete', 'delete', 'insert', 'fn', 'delete: borrar', 'insert: insertar']],
    [['log', 'log', '10<sup>x</sup>', 'fn', 'log: logaritmo base 10', 'diez elevado a'],
     ['prb', 'prb', 'angle', 'fn', 'prb: menú de probabilidad (nPr, nCr, factorial)', 'angle: menú de ángulos'],
     ['data', 'data', 'stat', 'fn', 'data: editor de datos', 'stat: estadística']],
    [['ln', 'ln', 'e<sup>x</sup>', 'fn', 'ln: logaritmo natural', 'e elevado a'],
     ['nd', 'n/d', 'U n/d', 'fn', 'n/d: fracción', 'U n/d: número mixto'],
     ['x10', '×10<sup>n</sup>', '', 'fn', 'por diez elevado a: notación científica'],
     ['table', 'table', 'f◂▸d', 'fn', 'table: tabla de valores', 'f◂▸d: convertir entre fracción y decimal'],
     ['clear', 'clear', '', 'clear', 'clear: borrar']],
    [['pi', 'π', 'hyp', 'fn', 'pi', 'hyp: funciones hiperbólicas'],
     ['sin', 'sin', 'sin<sup>−1</sup>', 'fn', 'seno', 'seno inverso'],
     ['cos', 'cos', 'cos<sup>−1</sup>', 'fn', 'coseno', 'coseno inverso'],
     ['tan', 'tan', 'tan<sup>−1</sup>', 'fn', 'tangente', 'tangente inversa'],
     ['/', '÷', 'K', 'op', 'entre (división)', 'K: constante']],
    [['pot', '^', '<sup>x</sup>√', 'fn', 'elevar a una potencia', 'raíz con índice'],
     ['inv', 'x<sup>−1</sup>', 'n/d◂▸Un/d', 'fn', 'recíproco', 'n/d◂▸Un/d: convertir entre fracción y número mixto'],
     ['(', '(', '%', 'fn', 'abrir paréntesis', 'por ciento'],
     [')', ')', '▸%', 'fn', 'cerrar paréntesis', 'expresar como por ciento'],
     ['*', '×', '', 'op', 'por (multiplicación)']],
    [['sq', 'x<sup>2</sup>', '√', 'fn', 'al cuadrado', 'raíz cuadrada'],
     ['7', '7', '', 'num', '7'], ['8', '8', '', 'num', '8'], ['9', '9', '', 'num', '9'],
     ['-', '−', '', 'op', 'menos (resta)']],
    [['xvar', 'x<sub>abc</sub><sup>yzt</sup>', 'recall', 'fn', 'variables', 'recall: recuperar variable'],
     ['4', '4', '', 'num', '4'], ['5', '5', '', 'num', '5'], ['6', '6', '', 'num', '6'],
     ['+', '+', '', 'op', 'más (suma)']],
    [['sto', 'sto→', 'clear var', 'fn', 'sto: guardar en variable', 'clear var: borrar variables'],
     ['1', '1', '', 'num', '1'], ['2', '2', '', 'num', '2'], ['3', '3', '', 'num', '3'],
     ['toggle', '⟷', '≈', 'op', 'tecla toggle: alternar el resultado entre fracción y decimal', 'aproximar: resultado decimal']],
    [['on', 'on', 'off', 'fn', 'on', 'off: apagar y cerrar la calculadora'],
     ['0', '0', 'reset', 'num', '0', 'reset: restablecer la calculadora'],
     ['.', '.', ',', 'num', 'punto decimal', 'coma'],
     ['neg', '(−)', 'ans', 'num', 'número negativo', 'ans: respuesta anterior'],
     ['enter', 'enter', '', 'enter', 'enter: calcular']]
  ];

  var SIMBOLO = {
    '+': '+', '-': '−', '*': '×', '/': '÷', '(': '(', ')': ')', ',': ',',
    'neg': '<span class="gti-neg">−</span>', 'pi': 'π', 'ans': 'ans', 'rand': 'rand', 'randint(': 'randint(',
    'sq': '<sup class="gti-sup">2</sup>', 'inv': '<sup class="gti-sup">−1</sup>', 'fact': '!',
    'nPr': '<span class="gti-prb">nPr</span>', 'nCr': '<span class="gti-prb">nCr</span>', 'pct': '%',
    'log(': 'log(', 'ln(': 'ln(', 'sin(': 'sin(', 'cos(': 'cos(', 'tan(': 'tan(',
    'asin(': 'sin<sup class="gti-sup">−1</sup>(', 'acos(': 'cos<sup class="gti-sup">−1</sup>(', 'atan(': 'tan<sup class="gti-sup">−1</sup>(',
    'sinh(': 'sinh(', 'cosh(': 'cosh(', 'tanh(': 'tanh(',
    'asinh(': 'sinh<sup class="gti-sup">−1</sup>(', 'acosh(': 'cosh<sup class="gti-sup">−1</sup>(', 'atanh(': 'tanh<sup class="gti-sup">−1</sup>(',
    'toPct': '<span class="gti-conv">▸%</span>', 'toFD': '<span class="gti-conv">▸F◂▸D</span>', 'toUnd': '<span class="gti-conv">▸n/d◂▸Un/d</span>',
    'toDMS': '<span class="gti-conv">▸DMS</span>',
    'sto': '<span class="gti-sto">→</span>',
    'dg': '°', 'mn': '\'', 'sg': '"', 'rd': '<sup class="gti-sup">r</sup>', 'gd': '<sup class="gti-sup">g</sup>',
    'RPr(': 'R▸Pr(', 'RPt(': 'R▸Pθ(', 'PRx(': 'P▸Rx(', 'PRy(': 'P▸Ry(',
    // Modo CLASSIC: todo en una línea
    'fsl': '<span class="gti-fsl">/</span>', 'unit': '<span class="gti-u">u</span>', 'El': '<span class="gti-E">E</span>',
    'pw': '^', 'xrt': '<sup class="gti-sup">x</sup>√', 'sqrt(': '√(', '10^(': '10^(', 'e^(': 'e^('
  };

  var HUECOS = { frac: 2, mixto: 3, pot: 1, sci: 1, raiz2: 1, raizn: 2, diez: 1, expe: 1 };
  var VARIABLES = ['x', 'y', 'z', 't', 'a', 'b', 'c'];
  var MAX_LISTA = 42;

  function cfgInicial() { return { angulo: 'deg', notacion: 'norm', fijo: -1, pantalla: 'mathprint' }; }
  function varsIniciales() {
    var v = {};
    VARIABLES.forEach(function (n) { v[n] = Q(0n); });
    return v;
  }

  /* ---------- Estado ---------- */
  var estado = {
    entrada: [],
    raiz: null,
    c: null,
    pantalla: 'home',
    s2: false,
    hyp: false,
    K: null,
    kEdit: false,
    ultima: null,
    historial: [],
    ans: null,
    sel: null,
    menu: null,
    error: null,
    aviso: '',
    pistas: opciones.pistas,
    cfg: cfgInicial(),
    vars: varsIniciales(),
    datos: { listas: [[], [], []], col: 0, fila: 0, top: 0, celda: [] },
    stat: { tipo: 1, fila: 0, datos: 0, x: 0, y: 1, frq: 0, res: null, nombre: '', sel: 0, top: 0 },
    tabla: { fx: [], inicio: [K('0')], paso: [K('1')], auto: true, fila: 0, xs: [], col: 0, sel: 0, top: 0, celda: [], x0: null, dx: null }
  };
  estado.raiz = estado.entrada;
  estado.c = { fila: estado.entrada, i: 0 };
  var NADA = [];   // raíz de las pantallas en las que no se escribe

  var ventana, cuerpoCalc, lcdEstado, lcdLineas, pista, anuncio, botonesTecla = {}, btn2nd, btnPistas;
  var hoja, hojaPests = {}, hojaPaneles = {};
  var barra, lanzadorCalc, lanzadorHoja;
  var ultimoFoco = null, ultimoFocoHoja = null, temporizadorAviso = null;

  try {
    var gp = localStorage.getItem('gti-pistas');
    if (gp === 'si' || gp === 'no') estado.pistas = gp === 'si';
    if (!opciones.pistas) estado.pistas = false;
  } catch (e) { /* sin almacenamiento */ }

  function crear(tag, attrs, html) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (html !== undefined) el.innerHTML = html;
    return el;
  }

  function cfgEval(extra) {
    var vars = estado.vars;
    if (extra) {
      vars = {};
      for (var k in estado.vars) vars[k] = estado.vars[k];
      for (var e in extra) vars[e] = extra[e];
    }
    return { angulo: estado.cfg.angulo, notacion: estado.cfg.notacion, fijo: estado.cfg.fijo, pantalla: estado.cfg.pantalla, vars: vars };
  }

  function clasico() { return estado.cfg.pantalla === 'classic'; }

  /* ---------- Pantallas ---------- */

  function irA(pantalla, raiz) {
    estado.pantalla = pantalla;
    estado.raiz = raiz || NADA;
    estado.c = { fila: estado.raiz, i: estado.raiz.length };
    estado.sel = null;
  }

  function irInicio() { irA('home', estado.entrada); }

  /* ---------- Editor del árbol ---------- */

  function K(v) { return { t: 'k', v: v }; }
  function plantilla(tipo) {
    var s = [];
    for (var i = 0; i < HUECOS[tipo]; i++) s.push([]);
    return { t: tipo, s: s };
  }

  function buscarPadre(raiz, fila) {
    for (var i = 0; i < raiz.length; i++) {
      var n = raiz[i];
      if (!n.s) continue;
      for (var k = 0; k < n.s.length; k++) {
        if (n.s[k] === fila) return { fila: raiz, i: i, nodo: n, k: k };
        var r = buscarPadre(n.s[k], fila);
        if (r) return r;
      }
    }
    return null;
  }

  function padreActual() { return buscarPadre(estado.raiz, estado.c.fila); }

  function contar(fila) {
    var t = 0;
    fila.forEach(function (n) { t++; if (n.s) n.s.forEach(function (s) { t += contar(s); }); });
    return t;
  }

  function puedeEscribir() {
    if (estado.raiz === NADA) return false;
    if (contar(estado.raiz) >= 90) { avisar('La entrada ya está llena.'); return false; }
    return true;
  }

  function insertar(nodo) {
    if (!puedeEscribir()) return;
    var c = estado.c;
    c.fila.splice(c.i, 0, nodo);
    if (nodo.s) estado.c = { fila: nodo.s[0], i: 0 };
    else c.i++;
  }

  function tomarNumeroPrevio() {
    var f = estado.c.fila, j = estado.c.i, ini = j;
    while (ini > 0 && f[ini - 1].t === 'k' && /^[0-9.]$/.test(f[ini - 1].v)) ini--;
    var sacado = f.splice(ini, j - ini);
    estado.c.i = ini;
    return sacado;
  }

  function insertarPlantilla(tipo) {
    if (!puedeEscribir()) return;
    if (tipo === 'pot') reglaAns();
    var nodo = plantilla(tipo);
    if (tipo === 'frac' || tipo === 'mixto' || tipo === 'raizn') {
      var previo = tomarNumeroPrevio();
      if (previo.length) {
        nodo.s[0] = previo;
        estado.c.fila.splice(estado.c.i, 0, nodo);
        estado.c = { fila: nodo.s[1], i: 0 };
        return;
      }
    }
    insertar(nodo);
  }

  // Si el cálculo empieza con una operación, la TI escribe Ans delante
  function reglaAns() {
    if (estado.pantalla !== 'home' || estado.kEdit) return;
    var e = estado.entrada;
    if (!e.length && estado.c.fila === e) e.push(K('ans'));   // siempre, como la TI (ans vale 0 al empezar o tras clear)
    if (estado.c.fila === e && estado.c.i === 0 && e.length === 1 && e[0].v === 'ans') estado.c.i = 1;
  }

  function operador(v) { reglaAns(); insertar(K(v)); }

  function conversion(v) {
    if (estado.raiz === NADA) return;
    reglaAns();
    var raiz = estado.raiz;
    if (raiz.length && raiz[raiz.length - 1].t === 'k' && CONVERSIONES[raiz[raiz.length - 1].v]) raiz.pop();
    raiz.push(K(v));
    estado.c = { fila: raiz, i: raiz.length };
  }

  function teclaVariable() {
    if (estado.raiz === NADA) return;
    var c = estado.c, previo = c.fila[c.i - 1];
    if (estado.ultima === 'xvar' && previo && previo.v === 'var') {
      previo.n = VARIABLES[(VARIABLES.indexOf(previo.n) + 1) % VARIABLES.length];
      return;
    }
    insertar({ t: 'k', v: 'var', n: 'x' });
  }

  function derecha() {
    var c = estado.c;
    if (c.i < c.fila.length) {
      var n = c.fila[c.i];
      if (n.s) estado.c = { fila: n.s[0], i: 0 };
      else c.i++;
      return;
    }
    var p = padreActual();
    if (!p) { if (c.fila.length) c.i = 0; return; }
    if (p.k < p.nodo.s.length - 1) estado.c = { fila: p.nodo.s[p.k + 1], i: 0 };
    else estado.c = { fila: p.fila, i: p.i + 1 };
  }

  function izquierda() {
    var c = estado.c;
    if (c.i > 0) {
      var n = c.fila[c.i - 1];
      if (n.s) { var ult = n.s[n.s.length - 1]; estado.c = { fila: ult, i: ult.length }; }
      else c.i--;
      return;
    }
    var p = padreActual();
    if (!p) { c.i = c.fila.length; return; }
    if (p.k > 0) { var ant = p.nodo.s[p.k - 1]; estado.c = { fila: ant, i: ant.length }; }
    else estado.c = { fila: p.fila, i: p.i };
  }

  // Devuelve true si el cursor se movió dentro de una plantilla
  function moverEnPlantilla(dir) {
    var p = padreActual();
    if (!p) return false;
    var t = p.nodo.t, k = p.k, destino = null;
    if (t === 'frac') destino = dir > 0 ? (k === 0 ? 1 : null) : (k === 1 ? 0 : null);
    else if (t === 'mixto') destino = dir > 0 ? (k < 2 ? k + 1 : null) : (k === 2 ? 1 : null);
    else if (t === 'raizn') destino = dir > 0 ? (k === 0 ? 1 : null) : (k === 1 ? 0 : null);
    if (destino !== null) {
      var f = p.nodo.s[destino];
      estado.c = { fila: f, i: dir > 0 ? 0 : f.length };
    }
    return true;
  }

  // Dentro de una plantilla las flechas mueven el cursor por la plantilla en cualquier pantalla
  function flechaEnPlantilla(id) {
    if (!padreActual()) return false;
    if (id === 'up' || id === 'down') { moverEnPlantilla(id === 'up' ? -1 : 1); return true; }
    if (id === 'left') { izquierda(); return true; }
    if (id === 'right') { derecha(); return true; }
    return false;
  }

  function moverVertical(dir) {
    if (moverEnPlantilla(dir)) return;
    if (estado.pantalla !== 'home') return;
    var total = estado.historial.length * 2;
    if (!total) return;
    if (dir < 0) {
      if (estado.sel === null) estado.sel = total - 1;
      else if (estado.sel > 0) estado.sel--;
    } else if (estado.sel !== null) {
      estado.sel++;
      if (estado.sel >= total) estado.sel = null;
    }
  }

  function aplanar(nodo) {
    var out = [];
    nodo.s.forEach(function (s) { out = out.concat(s); });
    return out;
  }

  function borrar() {
    var c = estado.c, f = c.fila;
    if (f === NADA) return;
    if (!f.length) {
      var p = padreActual();
      if (!p) return;
      var dentro = aplanar(p.nodo);
      p.fila.splice.apply(p.fila, [p.i, 1].concat(dentro));
      estado.c = { fila: p.fila, i: p.i + dentro.length };
      return;
    }
    if (c.i < f.length) { f.splice(c.i, 1); return; }
    f.splice(c.i - 1, 1);
    c.i--;
  }

  function vaciar(fila) {
    fila.length = 0;
    if (estado.raiz === fila) estado.c = { fila: fila, i: 0 };
  }

  function limpiarEntrada() {
    estado.entrada = [];
    if (estado.pantalla === 'home') { estado.raiz = estado.entrada; estado.c = { fila: estado.entrada, i: 0 }; }
  }

  function clonar(fila) {
    return fila.map(function (n) {
      var c = { t: n.t };
      if (n.v !== undefined) c.v = n.v;
      if (n.n !== undefined) c.n = n.n;
      if (n.val) { c.val = n.val; c.html = n.html; }
      if (n.s) c.s = n.s.map(clonar);
      return c;
    });
  }

  function valorHTML(v, html) { return { t: 'k', v: 'hv', val: v, html: html }; }

  /* ---------- Cálculo en la pantalla principal ---------- */

  var OPERADORES_K = { '+': 1, '-': 1, '*': 1, '/': 1, pw: 1, sq: 1, inv: 1, pct: 1, fact: 1, nPr: 1, nCr: 1, xrt: 1 };

  function guardarConstante() {
    var e = estado.entrada, p = e[0];
    if (!p || !((p.t === 'k' && OPERADORES_K[p.v]) || p.t === 'pot' || p.t === 'sci')) {
      estado.error = { ti: ERR.sint, es: 'La constante K debe empezar con una operación, por ejemplo + 3 o × 2' };
      return;
    }
    estado.K = clonar(e);
    estado.kEdit = false;
    limpiarEntrada();
    avisar('Constante K guardada: ahora escribe un número y pulsa enter para aplicarle la operación. 2nd K la desactiva.');
  }

  function calcular() {
    if (estado.sel !== null) { pegarHistorial(); return; }
    if (estado.kEdit) { if (estado.entrada.length) guardarConstante(); return; }
    if (!estado.entrada.length) {
      if (!estado.historial.length) return;
      estado.entrada = clonar(estado.historial[estado.historial.length - 1].entrada);
      estado.raiz = estado.entrada;
    } else if (estado.K) {
      estado.entrada = estado.entrada.concat(clonar(estado.K));
      estado.raiz = estado.entrada;
    }
    try {
      var previo = estado.historial.length ? estado.historial[estado.historial.length - 1].modo : null;
      var r = evaluarEntrada(estado.entrada, estado.ans, cfgEval(), previo);
      if (r.guardar) estado.vars[r.guardar] = r.v;
      var item = { entrada: clonar(estado.entrada), v: r.v, modo: r.modo, base: r.modo === 'dec' ? null : r.modo };
      estado.historial.push(item);
      if (estado.historial.length > 30) estado.historial.shift();
      estado.ans = r.v;
      limpiarEntrada();
      anunciar('Resultado: ' + formatear(r.v, r.modo, cfgEval()).texto);
    } catch (e) {
      if (!e.gph) e = errorGPH(ERR.sint, 'Error de cálculo');
      estado.error = { ti: e.ti, es: e.message };
      anunciar('Error: ' + e.message);
    }
  }

  function alternarResultado() {
    if (estado.entrada.length) {
      calcular();
      if (estado.error) return;
    }
    var h = estado.historial[estado.historial.length - 1];
    if (!h) return;
    if (h.modo === 'pct' || h.modo === 'dms') { avisar('Este resultado ya está convertido; pulsa enter con otro cálculo.'); return; }
    var formas = formasAlternas(h.v, estado.cfg);
    if (formas.length < 2) { avisar('Este resultado no tiene otra forma: solo se muestra como decimal o entero.'); return; }
    if (h.modo === 'dec') {
      if (!h.v.e) h.v = aFraccion(h.v);
      h.modo = clasico() && h.base === 'exacto' ? 'dec' : (h.base || formas[0]);
    } else {
      h.modo = 'dec';
    }
    anunciar(formatear(h.v, h.modo, cfgEval()).texto);
  }

  function aproximar() {
    if (estado.entrada.length) { calcular(); if (estado.error) return; }
    var h = estado.historial[estado.historial.length - 1];
    if (!h) return;
    h.modo = 'dec';
    anunciar(formatear(h.v, 'dec', cfgEval()).texto);
  }

  function pegarHistorial() {
    var idx = estado.sel;
    var h = estado.historial[Math.floor(idx / 2)];
    estado.sel = null;
    if (!h) return;
    if (idx % 2 === 0) {
      var copia = clonar(h.entrada);
      var c = estado.c;
      c.fila.splice.apply(c.fila, [c.i, 0].concat(copia));
      c.i += copia.length;
    } else {
      insertar(valorHTML(h.v, formatear(h.v, h.modo, cfgEval()).html));
    }
  }

  function formatoCorto(v, ancho) {
    var f = formatear(v, 'dec', cfgEval());
    var t = f.html;
    if (t.indexOf('<') < 0 && t.length > ancho) {
      var n = aNumero(v);
      t = formatoDecimal(n, { notacion: 'sci', fijo: -1, pantalla: 'classic' }).html;
      if (t.replace(/<[^>]+>/g, '').length > ancho) t = String(n).slice(0, ancho);
    }
    return t;
  }

  /* ---------- Menús ---------- */

  function menuDefinicion(tipo) {
    switch (tipo) {
      case 'prb':
        return [
          { titulo: 'PRB', items: [['nPr', function () { operador('nPr'); }], ['nCr', function () { operador('nCr'); }], ['!', function () { operador('fact'); }]] },
          { titulo: 'RAND', items: [['rand', function () { insertar(K('rand')); }], ['randint(', function () { insertar(K('randint(')); }]] }
        ];
      case 'angle':
        return [
          { titulo: 'DMS', items: [
            ['°', function () { insertar(K('dg')); }], ['\'', function () { insertar(K('mn')); }], ['"', function () { insertar(K('sg')); }],
            ['<sup>r</sup>', function () { insertar(K('rd')); }], ['<sup>g</sup>', function () { insertar(K('gd')); }],
            ['▸DMS', function () { conversion('toDMS'); }]] },
          { titulo: 'R◂▸P', items: [
            ['R▸Pr(', function () { insertar(K('RPr(')); }], ['R▸Pθ(', function () { insertar(K('RPt(')); }],
            ['P▸Rx(', function () { insertar(K('PRx(')); }], ['P▸Ry(', function () { insertar(K('PRy(')); }]] }
        ];
      case 'recall':
        return [{ titulo: 'RECALL VAR', items: VARIABLES.map(function (n) {
          return [n + '=' + formatoCorto(estado.vars[n], 10), function () { insertar(valorHTML(estado.vars[n], formatear(estado.vars[n], modoNatural(estado.vars[n]), cfgEval()).html)); }];
        }) }];
      case 'clearvar':
        return [{ titulo: 'CLEAR VAR?', items: [['Yes', function () { estado.vars = varsIniciales(); avisar('Variables borradas: x, y, z, t, a, b y c valen 0.'); }], ['No', function () {}]] }];
      case 'reset':
        return [{ titulo: 'RESET?', items: [['No', function () {}], ['Yes', reiniciarTodo]] }];
      case 'datos':
        return [
          { titulo: 'CLEAR', items: [
            ['Clear L1', function () { borrarLista(0); }], ['Clear L2', function () { borrarLista(1); }],
            ['Clear L3', function () { borrarLista(2); }], ['Clear ALL', function () { borrarLista(-1); }]] },
          { titulo: 'FORMULA', items: [
            ['Add/Edit Frmla', function () { avisar('Las fórmulas en las listas estarán disponibles más adelante. Por ahora escribe los datos uno por uno.'); }]] }
        ];
      case 'stat':
        return [{ titulo: 'STAT', items: [
          ['1-Var Stats', function () { irStatSetup(1); }], ['2-Var Stats', function () { irStatSetup(2); }],
          ['StatVars', verStatVars]] }];
    }
    return [{ titulo: '', items: [] }];
  }

  function modoNatural(v) { return racional(v) && v.d !== 1n && v.d <= 9999n ? 'frac' : 'dec'; }

  var VISIBLES_MENU = 4;

  function abrirMenu(tipo) {
    estado.sel = null;
    if (tipo === 'mode') estado.menu = { tipo: 'mode', fila: 0, col: indiceActualModo(0) };
    else estado.menu = { tipo: tipo, pest: 0, sel: 0, top: 0, def: menuDefinicion(tipo) };
    var nombres = {
      prb: 'Menú de probabilidad: 1 nPr, 2 nCr, 3 factorial', mode: 'Menú de modos', reset: 'Restablecer la calculadora: 1 No, 2 Sí',
      angle: 'Menú de ángulos', recall: 'Recuperar variable', clearvar: 'Borrar variables: 1 Sí, 2 No', datos: 'Menú para borrar listas',
      stat: 'Menú de estadística: 1 una variable, 2 dos variables, 3 resultados'
    };
    anunciar(nombres[tipo] || 'Menú');
  }

  function cerrarMenu() { estado.menu = null; }

  function elegirMenu(idx) {
    var m = estado.menu;
    var it = m.def[m.pest].items[idx];
    if (!it) return;
    cerrarMenu();
    it[1]();
  }

  var MENU_MODO = [
    { clave: 'angulo', ops: [['DEG', 'deg'], ['RAD', 'rad'], ['GRAD', 'grad']] },
    { clave: 'notacion', ops: [['NORM', 'norm'], ['SCI', 'sci'], ['ENG', 'eng']] },
    { clave: 'fijo', ops: [['FLOAT', -1], ['0', 0], ['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 6], ['7', 7], ['8', 8], ['9', 9]] },
    { clave: 'pantalla', ops: [['CLASSIC', 'classic'], ['MATHPRINT', 'mathprint']] }
  ];

  function indiceActualModo(fila) {
    var v = estado.cfg[MENU_MODO[fila].clave], ops = MENU_MODO[fila].ops;
    for (var i = 0; i < ops.length; i++) if (ops[i][1] === v) return i;
    return 0;
  }

  function aplicarModo(fila, col) {
    var m = MENU_MODO[fila], op = m.ops[col];
    if (!op) return;
    var antes = estado.cfg[m.clave];
    estado.cfg[m.clave] = op[1];
    if (m.clave === 'pantalla' && antes !== op[1]) {
      // Como en la TI, al cambiar de pantalla se empieza una entrada nueva
      limpiarEntrada();
      if (op[1] === 'classic') avisar('Modo CLASSIC: todo se escribe en una sola línea, por ejemplo 3 n/d 4 se ve 3/4 y el exponente se escribe después de ^ sin plantilla.');
      return;
    }
    anunciar(op[0] + ' seleccionado');
  }

  function reiniciarTodo() {
    estado.historial = [];
    estado.ans = null;
    estado.cfg = cfgInicial();
    estado.vars = varsIniciales();
    estado.K = null;
    estado.kEdit = false;
    estado.hyp = false;
    estado.datos = { listas: [[], [], []], col: 0, fila: 0, top: 0, celda: [] };
    estado.stat = { tipo: 1, fila: 0, datos: 0, x: 0, y: 1, frq: 0, res: null, nombre: '', sel: 0, top: 0 };
    estado.tabla = { fx: [], inicio: [K('0')], paso: [K('1')], auto: true, fila: 0, xs: [], col: 0, sel: 0, top: 0, celda: [], x0: null, dx: null };
    limpiarEntrada();
    irInicio();
    avisar('Calculadora restablecida.');
  }

  function teclaMenu(id, segunda) {
    var m = estado.menu;
    if (id === 'clear' || (segunda && id === 'mode')) { cerrarMenu(); return; }
    if (!segunda && (id === m.tipo || (m.tipo === 'datos' && id === 'data'))) { cerrarMenu(); return; }
    if (m.tipo === 'mode') {
      var n = MENU_MODO[m.fila].ops.length;
      if (id === 'left') { m.col = (m.col + n - 1) % n; return; }
      if (id === 'right') { m.col = (m.col + 1) % n; return; }
      if (id === 'up' || id === 'down') {
        m.fila = (m.fila + (id === 'up' ? MENU_MODO.length - 1 : 1)) % MENU_MODO.length;
        m.col = indiceActualModo(m.fila);
        return;
      }
      if (id === 'enter') { aplicarModo(m.fila, m.col); return; }
      return;
    }
    var items = m.def[m.pest].items;
    if ((id === 'left' || id === 'right') && m.def.length > 1) {
      m.pest = (m.pest + (id === 'right' ? 1 : m.def.length - 1)) % m.def.length;
      m.sel = 0; m.top = 0;
      return;
    }
    if (id === 'up' || id === 'down') {
      m.sel = (m.sel + (id === 'up' ? items.length - 1 : 1)) % items.length;
      if (m.sel < m.top) m.top = m.sel;
      if (m.sel >= m.top + VISIBLES_MENU) m.top = m.sel - VISIBLES_MENU + 1;
      return;
    }
    if (id === 'enter') { elegirMenu(m.sel); return; }
    if (/^[1-9]$/.test(id)) { elegirMenu(Number(id) - 1); }
  }

  /* ---------- data: editor de listas ---------- */

  function irDatos() {
    var d = estado.datos;
    d.celda = [];
    irA('data', d.celda);
  }

  function nuevaCelda() {
    var d = estado.datos;
    d.celda = [];
    estado.raiz = d.celda;
    estado.c = { fila: d.celda, i: 0 };
  }

  function borrarLista(i) {
    var d = estado.datos;
    if (i < 0) d.listas = [[], [], []];
    else d.listas[i] = [];
    d.fila = 0; d.top = 0;
    if (estado.pantalla === 'data') nuevaCelda();
    avisar(i < 0 ? 'Se borraron las tres listas.' : 'Se borró la lista L' + (i + 1) + '.');
  }

  function confirmarCelda() {
    var d = estado.datos, L = d.listas[d.col];
    if (!d.celda.length) return true;
    try {
      var r = evaluarEntrada(d.celda, estado.ans, cfgEval());
      if (d.fila >= L.length) {
        if (L.length >= MAX_LISTA) { avisar('Cada lista admite hasta ' + MAX_LISTA + ' datos.'); return false; }
        L.push(r.v);
        d.fila = L.length - 1;
      } else {
        L[d.fila] = r.v;
      }
      nuevaCelda();
      return true;
    } catch (e) {
      if (!e.gph) e = errorGPH(ERR.sint, 'Error de cálculo');
      estado.error = { ti: e.ti, es: e.message };
      return false;
    }
  }

  function ajustarScroll(obj, filas) {
    if (obj.sel !== undefined) {
      if (obj.sel < obj.top) obj.top = obj.sel;
      if (obj.sel >= obj.top + filas) obj.top = obj.sel - filas + 1;
    }
  }

  function teclaDatos(id) {
    var d = estado.datos, L = d.listas[d.col];
    if (flechaEnPlantilla(id)) return true;
    switch (id) {
      case 'enter':
      case 'down':
        if (!confirmarCelda()) return true;
        L = d.listas[d.col];
        d.fila = Math.min(d.fila + 1, L.length);
        break;
      case 'up':
        if (!confirmarCelda()) return true;
        if (d.fila > 0) d.fila--;
        break;
      case 'left':
      case 'right':
        if (!confirmarCelda()) return true;
        d.col = (d.col + (id === 'right' ? 1 : 2)) % 3;
        d.fila = Math.min(d.fila, d.listas[d.col].length);
        nuevaCelda();
        break;
      case 'clear':
        if (d.celda.length) vaciar(d.celda);
        break;
      case 'delete':
        if (d.celda.length) borrar();
        else if (d.fila < L.length) L.splice(d.fila, 1);
        break;
      case 'toggle':
        break;
      default:
        return false;
    }
    if (d.fila < d.top) d.top = d.fila;
    if (d.fila >= d.top + 3) d.top = d.fila - 2;
    return true;
  }

  /* ---------- stat ---------- */

  function filasStat() {
    var listas = ['L1', 'L2', 'L3'], frq = ['ONE', 'L1', 'L2', 'L3'];
    if (estado.stat.tipo === 1) {
      return [{ lab: 'DATA:', clave: 'datos', ops: listas }, { lab: 'FRQ:', clave: 'frq', ops: frq }, { lab: 'CALC' }];
    }
    return [{ lab: 'xDATA:', clave: 'x', ops: listas }, { lab: 'yDATA:', clave: 'y', ops: listas }, { lab: 'FRQ:', clave: 'frq', ops: frq }, { lab: 'CALC' }];
  }

  function irStatSetup(tipo) {
    if (estado.pantalla === 'data' && !confirmarCelda()) return;
    estado.stat.tipo = tipo;
    estado.stat.fila = 0;
    irA('stat-setup');
  }

  function numerosLista(i) { return estado.datos.listas[i].map(aNumero); }

  function calcularStat() {
    var s = estado.stat;
    try {
      var frq = s.frq === 0 ? null : numerosLista(s.frq - 1);
      if (s.tipo === 1) {
        s.res = estadistica1(numerosLista(s.datos), frq);
        s.nombre = '1-Var:L' + (s.datos + 1) + (s.frq ? ',L' + s.frq : '');
      } else {
        s.res = estadistica2(numerosLista(s.x), numerosLista(s.y), frq);
        s.nombre = '2-Var:L' + (s.x + 1) + ',L' + (s.y + 1) + (s.frq ? ',L' + s.frq : '');
      }
      s.sel = 0; s.top = 0;
      irA('stat-res');
      anunciar('Resultados de ' + (s.tipo === 1 ? 'una variable' : 'dos variables') + ' calculados. Usa las flechas para leerlos.');
    } catch (e) {
      if (!e.gph) e = errorGPH('STAT ERROR', 'No se pudo calcular');
      estado.error = { ti: e.ti, es: e.message };
    }
  }

  function verStatVars() {
    if (!estado.stat.res) { avisar('Todavía no hay resultados: primero calcula 1-Var Stats o 2-Var Stats.'); return; }
    estado.stat.sel = 0; estado.stat.top = 0;
    irA('stat-res');
  }

  function teclaStatSetup(id) {
    var s = estado.stat, filas = filasStat(), f = filas[s.fila];
    switch (id) {
      case 'up': s.fila = (s.fila + filas.length - 1) % filas.length; return true;
      case 'down': s.fila = (s.fila + 1) % filas.length; return true;
      case 'left': case 'right':
        if (f.ops) s[f.clave] = (s[f.clave] + (id === 'right' ? 1 : f.ops.length - 1)) % f.ops.length;
        return true;
      case 'enter':
        if (!f.ops) calcularStat();
        else s.fila = Math.min(s.fila + 1, filas.length - 1);
        return true;
      case 'clear': irInicio(); return true;
    }
    return true;
  }

  function etiquetaStat(i) { return i < 9 ? String(i + 1) : String.fromCharCode(65 + i - 9); }

  function pegarStat(i) {
    var r = estado.stat.res[i];
    if (!r || r[1] === null) return;
    irInicio();
    insertar(valorHTML(F(r[1]), r[0]));
  }

  function teclaStatRes(id) {
    var s = estado.stat, n = s.res.length;
    switch (id) {
      case 'up': s.sel = (s.sel + n - 1) % n; break;
      case 'down': s.sel = (s.sel + 1) % n; break;
      case 'enter': pegarStat(s.sel); return true;
      case 'clear': irInicio(); return true;
      default:
        if (/^[1-9]$/.test(id)) { pegarStat(Number(id) - 1); return true; }
        return true;
    }
    ajustarScroll(s, 4);
    return true;
  }

  /* ---------- table ---------- */

  function irTablaFx() { irA('tabla-fx', estado.tabla.fx); }

  function raizSetup() {
    var t = estado.tabla;
    return t.fila === 0 ? t.inicio : t.fila === 1 ? t.paso : NADA;
  }

  function irTablaSetup() {
    estado.tabla.fila = 0;
    irA('tabla-setup', estado.tabla.inicio);
  }

  function evaluarSimple(fila, nombre) {
    if (!fila.length) throw errorGPH(ERR.sint, 'Falta el valor de ' + nombre);
    return evaluarEntrada(fila, estado.ans, cfgEval()).v;
  }

  function abrirTabla() {
    var t = estado.tabla;
    try {
      t.x0 = evaluarSimple(t.inicio, 'Start');
      t.dx = evaluarSimple(t.paso, 'Step');
    } catch (e) {
      estado.error = { ti: e.ti || ERR.sint, es: e.message };
      return;
    }
    t.sel = 0; t.top = 0; t.col = 0;
    t.celda = [];
    irA('tabla', t.auto ? NADA : t.celda);
  }

  function xDeFila(k) {
    var t = estado.tabla;
    if (t.auto) return sumar(t.x0, multiplicar(Q(BigInt(k)), t.dx));
    return t.xs[k] === undefined ? null : t.xs[k];
  }

  function fDe(x) {
    try {
      var r = evaluarEntrada(estado.tabla.fx, estado.ans, cfgEval({ x: x }));
      return { v: r.v, modo: r.modo === 'exacto' ? 'dec' : r.modo };
    } catch (e) {
      return null;
    }
  }

  function teclaTablaSetup(id) {
    var t = estado.tabla;
    if (flechaEnPlantilla(id)) return true;
    function fijarFila(f) {
      t.fila = f;
      var r = raizSetup();
      estado.raiz = r;
      estado.c = { fila: r, i: r.length };
    }
    switch (id) {
      case 'up': fijarFila((t.fila + 3) % 4); return true;
      case 'down': fijarFila((t.fila + 1) % 4); return true;
      case 'left': case 'right':
        if (t.fila === 2) { t.auto = !t.auto; return true; }
        if (t.fila === 3) return true;
        return false;
      case 'enter':
        if (t.fila === 3) { abrirTabla(); return true; }
        if (t.fila === 2) { fijarFila(3); return true; }
        fijarFila(t.fila + 1);
        return true;
      case 'clear':
        if (t.fila < 2) vaciar(raizSetup());
        return true;
      case 'toggle': return true;
    }
    return t.fila >= 2;
  }

  function teclaTablaFx(id) {
    switch (id) {
      case 'enter':
        if (!estado.tabla.fx.length) { avisar('Escribe la función f(x) usando la tecla de variables para la x.'); return true; }
        irTablaSetup();
        return true;
      case 'clear': vaciar(estado.tabla.fx); return true;
      case 'up': case 'down':
        moverEnPlantilla(id === 'up' ? -1 : 1);
        return true;
      case 'toggle': return true;
    }
    return false;
  }

  function teclaTabla(id) {
    var t = estado.tabla;
    if (flechaEnPlantilla(id)) return true;
    function confirmarX() {
      if (t.auto || !t.celda.length) return true;
      try {
        t.xs[t.sel] = evaluarEntrada(t.celda, estado.ans, cfgEval()).v;
        t.celda = [];
        estado.raiz = t.celda;
        estado.c = { fila: t.celda, i: 0 };
        return true;
      } catch (e) {
        estado.error = { ti: e.ti || ERR.sint, es: e.message };
        return false;
      }
    }
    switch (id) {
      case 'up':
        if (!confirmarX()) return true;
        if (t.auto || t.sel > 0) t.sel--;
        if (!t.auto && t.sel < 0) t.sel = 0;
        break;
      case 'down':
      case 'enter':
        if (!confirmarX()) return true;
        if (id === 'down' || t.auto) {
          if (t.auto || t.sel < t.xs.length) t.sel++;
        } else {
          t.sel = Math.min(t.sel + 1, t.xs.length);
        }
        break;
      case 'left': case 'right':
        if (!t.auto && t.col === 0 && t.celda.length) return false;
        t.col = 1 - t.col;
        break;
      case 'clear':
        if (!t.auto && t.celda.length) vaciar(t.celda);
        break;
      case 'delete':
        if (!t.auto && t.celda.length) return false;
        if (!t.auto && t.sel < t.xs.length) t.xs.splice(t.sel, 1);
        break;
      case 'toggle':
        break;
      default:
        if (t.auto || t.col === 1) return true;   // en Auto no se escribe en la tabla
        return false;
    }
    if (t.sel < t.top) t.top = t.sel;
    if (t.sel >= t.top + 3) t.top = t.sel - 2;
    return true;
  }

  /* ---------- Pulsar una tecla ---------- */

  var NOMBRES = { coma: 'la coma' };

  function avisar(texto) {
    estado.aviso = texto;
    anunciar(texto);
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () { estado.aviso = ''; mostrar(); }, 6000);
  }

  function pulsar(id) {
    var segunda = estado.s2;
    if (id === '2nd') {
      estado.s2 = !estado.s2;
      anunciar(estado.s2 ? '2nd activada' : '2nd desactivada');
      mostrar();
      return;
    }
    estado.s2 = false;
    if (estado.aviso) { estado.aviso = ''; clearTimeout(temporizadorAviso); }

    if (id === 'on') {
      if (segunda) { cerrar(); return; }
      estado.error = null; cerrarMenu(); estado.sel = null; estado.hyp = false; estado.kEdit = false;
      limpiarEntrada(); irInicio(); mostrar();
      return;
    }

    if (estado.error) {
      estado.error = null;
      if (id === 'clear' || id === 'left' || id === 'right' || id === 'delete' || id === 'enter') { mostrar(); return; }
    }
    if (estado.menu) { teclaMenu(id, segunda); estado.ultima = null; mostrar(); return; }

    var registrada = (segunda ? '2nd ' : '') + id;
    if (!manejarGlobal(id, segunda)) {
      var hecho = false;
      if (estado.pantalla === 'data') hecho = teclaDatos(id);
      else if (estado.pantalla === 'stat-setup') hecho = teclaStatSetup(id);
      else if (estado.pantalla === 'stat-res') hecho = teclaStatRes(id);
      else if (estado.pantalla === 'tabla-fx') hecho = teclaTablaFx(id);
      else if (estado.pantalla === 'tabla-setup') hecho = teclaTablaSetup(id);
      else if (estado.pantalla === 'tabla') hecho = teclaTabla(id);
      else if (estado.sel !== null && id !== 'up' && id !== 'down' && id !== 'enter') estado.sel = null;
      if (!hecho) {
        if (segunda) ejecutar2nd(id);
        else ejecutar(id);
      }
    }
    estado.ultima = registrada;
    mostrar();
  }

  // Teclas que funcionan igual en todas las pantallas
  function manejarGlobal(id, segunda) {
    if (segunda && id === 'mode') { irInicio(); return true; }               // quit
    if (!segunda && id === 'mode') { abrirMenu('mode'); return true; }
    if (!segunda && id === 'data') {
      if (estado.pantalla === 'data') abrirMenu('datos');
      else irDatos();
      return true;
    }
    if (segunda && id === 'data') {
      if (estado.pantalla === 'data' && !confirmarCelda()) return true;
      abrirMenu('stat');
      return true;
    }
    if (!segunda && id === 'table') { irTablaFx(); return true; }
    if (segunda && id === 'sto') { abrirMenu('clearvar'); return true; }
    if (segunda && id === '0') { abrirMenu('reset'); return true; }
    if (estado.pantalla !== 'home' && (id === 'sto' || (segunda && id === '/'))) return true;
    return false;
  }

  function trigonometrica(id, inversa) {
    var nombre = (inversa ? 'a' : '') + id + (estado.hyp ? 'h' : '') + '(';
    estado.hyp = false;
    insertar(K(nombre));
  }

  function ejecutar(id) {
    if (/^[0-9.]$/.test(id)) { insertar(K(id)); return; }
    var cl = clasico();
    switch (id) {
      case '+': case '-': case '*': case '/': operador(id); return;
      case '(': case ')': insertar(K(id)); return;
      case 'neg': insertar(K('neg')); return;
      case 'pi': insertar(K('pi')); return;
      case 'sq': operador('sq'); return;
      case 'inv': operador('inv'); return;
      case 'pot': if (cl) operador('pw'); else insertarPlantilla('pot'); return;
      case 'nd': if (cl) insertar(K('fsl')); else insertarPlantilla('frac'); return;
      case 'x10': if (cl) insertar(K('El')); else insertarPlantilla('sci'); return;
      case 'log': insertar(K('log(')); return;
      case 'ln': insertar(K('ln(')); return;
      case 'sin': case 'cos': case 'tan': trigonometrica(id, false); return;
      case 'prb': abrirMenu('prb'); return;
      case 'xvar': teclaVariable(); return;
      case 'sto': operador('sto'); return;
      case 'clear':
        if (estado.pantalla !== 'home') { vaciar(estado.raiz); return; }
        // Primer clear: borra la línea. Con la línea vacía: borra la pantalla y la
        // última respuesta (Ans), como la TI. Las variables solo las borran reset y clear var.
        if (estado.entrada.length) limpiarEntrada();
        else if (estado.kEdit) { estado.kEdit = false; avisar('Constante K cancelada.'); }
        else { estado.historial = []; estado.ans = null; }   // ans vuelve a 0
        return;
      case 'delete': borrar(); return;
      case 'enter': if (estado.pantalla === 'home') calcular(); return;
      case 'toggle': if (estado.pantalla === 'home') alternarResultado(); return;
      case 'left': izquierda(); return;
      case 'right': derecha(); return;
      case 'up': moverVertical(-1); return;
      case 'down': moverVertical(1); return;
    }
  }

  function ejecutar2nd(id) {
    var cl = clasico();
    switch (id) {
      case 'delete': avisar('La calculadora siempre inserta lo que escribes donde está el cursor.'); return;
      case 'log': if (cl) insertar(K('10^(')); else insertarPlantilla('diez'); return;
      case 'ln': if (cl) insertar(K('e^(')); else insertarPlantilla('expe'); return;
      case 'prb': abrirMenu('angle'); return;
      case 'nd': if (cl) insertar(K('unit')); else insertarPlantilla('mixto'); return;
      case 'table': conversion('toFD'); return;
      case 'pi':
        estado.hyp = !estado.hyp;
        anunciar(estado.hyp ? 'hyp activada: la próxima sin, cos o tan será hiperbólica' : 'hyp desactivada');
        return;
      case 'sin': case 'cos': case 'tan': trigonometrica(id, true); return;
      case '/':
        if (estado.K || estado.kEdit) {
          estado.K = null; estado.kEdit = false;
          avisar('Constante K desactivada.');
        } else {
          limpiarEntrada();
          estado.kEdit = true;
          avisar('Constante K: escribe la operación que se repetirá (por ejemplo + 3 o × 2) y pulsa enter.');
        }
        return;
      case 'pot': if (cl) operador('xrt'); else insertarPlantilla('raizn'); return;
      case 'inv': conversion('toUnd'); return;
      case '(': operador('pct'); return;
      case ')': conversion('toPct'); return;
      case 'sq': if (cl) insertar(K('sqrt(')); else insertarPlantilla('raiz2'); return;
      case 'xvar': abrirMenu('recall'); return;
      case 'toggle': if (estado.pantalla === 'home') aproximar(); return;
      case '.': insertar(K(',')); return;
      case 'neg': insertar(K('ans')); return;
      default: ejecutar(id);
    }
  }

  /* ---------- Dibujar la pantalla ---------- */

  function htmlFila(fila) {
    var c = estado.c, activa = !estado.menu && !estado.error && estado.sel === null;
    if (!fila.length) {
      if (fila === estado.raiz || fila === estado.entrada) return activa && c.fila === fila ? '<span class="gti-cur"></span>' : '';
      return '<span class="gti-vacio' + (activa && c.fila === fila ? ' gti-act' : '') + '"></span>';
    }
    var out = '';
    for (var i = 0; i <= fila.length; i++) {
      if (activa && c.fila === fila && c.i === i) out += '<span class="gti-cur"></span>';
      if (i < fila.length) out += htmlNodo(fila[i]);
    }
    return out;
  }

  function htmlFilaFija(fila) {
    var c = estado.c;
    estado.c = { fila: null, i: -1 };
    var h = htmlFila(fila);
    estado.c = c;
    return h;
  }

  function htmlNodo(n) {
    if (n.t === 'k') {
      if (n.v === 'hv') return n.html;
      if (n.v === 'var') return '<i class="gti-var">' + n.n + '</i>';
      return SIMBOLO[n.v] !== undefined ? SIMBOLO[n.v] : n.v;
    }
    var s = n.s;
    switch (n.t) {
      case 'frac': return fraccionHTML(htmlFila(s[0]), htmlFila(s[1]));
      case 'mixto': return '<span class="gti-mx">' + htmlFila(s[0]) + '<span class="gti-mx-sep"></span>' + fraccionHTML(htmlFila(s[1]), htmlFila(s[2])) + '</span>';
      case 'pot': return '<sup class="gti-sup">' + htmlFila(s[0]) + '</sup>';
      case 'sci': return '<span class="gti-x10">×10</span><sup class="gti-sup">' + htmlFila(s[0]) + '</sup>';
      case 'raiz2': return '<span class="gti-rz"><span class="gti-rz-s">√</span><span class="gti-rz-a">' + htmlFila(s[0]) + '</span></span>';
      case 'raizn': return '<span class="gti-rz"><sup class="gti-rz-i">' + htmlFila(s[0]) + '</sup><span class="gti-rz-s">√</span><span class="gti-rz-a">' + htmlFila(s[1]) + '</span></span>';
      case 'diez': return '10<sup class="gti-sup">' + htmlFila(s[0]) + '</sup>';
      case 'expe': return 'e<sup class="gti-sup">' + htmlFila(s[0]) + '</sup>';
    }
    return '';
  }

  var NOMBRE_ANGULO = { deg: 'DEG', rad: 'RAD', grad: 'GRAD' };

  function mostrar() {
    if (!ventana) return;
    var cfg = estado.cfg;
    var est = '';
    if (estado.s2) est += '<span class="gti-e2">2nd</span>';
    if (estado.hyp) est += '<span class="gti-e2">HYP</span>';
    est += '<span>' + NOMBRE_ANGULO[cfg.angulo] + '</span>';
    if (cfg.notacion !== 'norm') est += '<span>' + cfg.notacion.toUpperCase() + '</span>';
    if (cfg.fijo >= 0) est += '<span>FIX</span>';
    if (estado.K || estado.kEdit) est += '<span>K</span>';
    if (estado.pantalla === 'home') {
      var hayMas = estado.historial.length && (estado.sel === null || estado.sel > 0);
      est += '<span class="gti-flechas">' + (hayMas ? '▲' : '') + (estado.sel !== null ? '▼' : '') + '</span>';
    }
    lcdEstado.innerHTML = est;

    if (estado.error) {
      lcdLineas.innerHTML = '<div class="gti-error">' + estado.error.ti + '<small>clear: volver · ◄ ►: corregir</small></div>';
    } else if (estado.menu) {
      lcdLineas.innerHTML = estado.menu.tipo === 'mode' ? htmlModo() : htmlMenu();
      enlazarMenu();
    } else if (estado.pantalla === 'data') {
      lcdLineas.innerHTML = htmlDatos();
      enlazarCeldas();
    } else if (estado.pantalla === 'stat-setup') {
      lcdLineas.innerHTML = htmlStatSetup();
      enlazarStatSetup();
    } else if (estado.pantalla === 'stat-res') {
      lcdLineas.innerHTML = htmlStatRes();
      enlazarStatRes();
    } else if (estado.pantalla === 'tabla-fx') {
      lcdLineas.innerHTML = '<div class="gti-l gti-actual">f(<i class="gti-var">x</i>)=' + htmlFila(estado.tabla.fx) + '</div>';
    } else if (estado.pantalla === 'tabla-setup') {
      lcdLineas.innerHTML = htmlTablaSetup();
      enlazarTablaSetup();
    } else if (estado.pantalla === 'tabla') {
      lcdLineas.innerHTML = htmlTabla();
    } else {
      var html = '';
      var desde = Math.max(0, estado.historial.length - 6);
      var cf = cfgEval();
      for (var i = desde; i < estado.historial.length; i++) {
        var h = estado.historial[i];
        html += '<div class="gti-l' + (estado.sel === i * 2 ? ' gti-sel' : '') + '">' + htmlFilaFija(h.entrada) + '</div>';
        html += '<div class="gti-l gti-res' + (estado.sel === i * 2 + 1 ? ' gti-sel' : '') + '">' + formatear(h.v, h.modo, cf).html + '</div>';
      }
      html += '<div class="gti-l gti-actual">' + (estado.kEdit ? 'K=' : '') + htmlFila(estado.entrada) + '</div>';
      lcdLineas.innerHTML = html;
    }
    var sel = lcdLineas.querySelector('.gti-sel');
    if (estado.pantalla === 'home' && !estado.menu && !estado.error) {
      if (sel) lcdLineas.scrollTop = Math.max(0, sel.offsetTop - lcdLineas.offsetTop - 10);
      else lcdLineas.scrollTop = lcdLineas.scrollHeight;
    } else {
      lcdLineas.scrollTop = 0;
    }

    btn2nd.setAttribute('aria-pressed', estado.s2 ? 'true' : 'false');
    Object.keys(botonesTecla).forEach(function (id) {
      var b = botonesTecla[id];
      var d = estado.s2 && b._d2 ? b._d2 : b._d1;
      if (b.getAttribute('aria-label') !== d) b.setAttribute('aria-label', d);
    });

    var p = textoPista();
    if (estado.pistas || estado.aviso || estado.error) {
      pista.hidden = !p;
      pista.innerHTML = p;
    } else {
      pista.hidden = true;
    }
    btnPistas.setAttribute('aria-pressed', estado.pistas ? 'true' : 'false');
  }

  function htmlModo() {
    var m = estado.menu, h = '<div class="gti-menu">';
    MENU_MODO.forEach(function (fila, f) {
      var actual = indiceActualModo(f);
      h += '<div class="gti-mfila' + (f === 2 ? ' gti-dig' : '') + '">';
      fila.ops.forEach(function (op, c) {
        var cls = (c === actual ? 'gti-on' : '') + (f === m.fila && c === m.col ? ' gti-foco' : '');
        h += '<button type="button" data-mf="' + f + '" data-mc="' + c + '" class="' + cls + '" aria-pressed="' + (c === actual) + '">' + op[0] + '</button>';
      });
      h += '</div>';
    });
    return h + '</div>';
  }

  function htmlMenu() {
    var m = estado.menu, def = m.def, h = '<div class="gti-menu">';
    if (def.length > 1) {
      h += '<div class="gti-pest">';
      def.forEach(function (p, i) {
        h += '<button type="button" tabindex="-1" data-pest="' + i + '" class="' + (i === m.pest ? 'gti-on' : '') + '">' + p.titulo + '</button>';
      });
      h += '</div>';
    } else if (def[0].titulo) {
      h += '<div class="gti-mtit">' + def[0].titulo + '</div>';
    }
    var items = def[m.pest].items;
    var fin = Math.min(items.length, m.top + VISIBLES_MENU);
    for (var i = m.top; i < fin; i++) {
      h += '<div><button type="button" data-it="' + i + '" class="' + (i === m.sel ? 'gti-on' : '') + '">' + (i + 1) + ':' + items[i][0] + '</button></div>';
    }
    if (fin < items.length) h += '<div class="gti-mas" aria-hidden="true">▼</div>';
    return h + '</div>';
  }

  function enlazarMenu() {
    lcdLineas.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = estado.menu;
        if (!m) return;
        if (b.hasAttribute('data-pest')) { m.pest = Number(b.getAttribute('data-pest')); m.sel = 0; m.top = 0; }
        else if (b.hasAttribute('data-it')) elegirMenu(Number(b.getAttribute('data-it')));
        else if (b.hasAttribute('data-mf')) {
          m.fila = Number(b.getAttribute('data-mf'));
          m.col = Number(b.getAttribute('data-mc'));
          aplicarModo(m.fila, m.col);
        }
        mostrar();
      });
    });
  }

  function htmlDatos() {
    var d = estado.datos, h = '<div class="gti-tab3"><div class="gti-tcab">';
    for (var c = 0; c < 3; c++) h += '<span class="' + (c === d.col ? 'gti-tcol' : '') + '">L' + (c + 1) + '</span>';
    h += '</div>';
    for (var r = d.top; r < d.top + 3; r++) {
      h += '<div class="gti-tfila">';
      for (var k = 0; k < 3; k++) {
        var L = d.listas[k], val = L[r];
        var sel = k === d.col && r === d.fila;
        var txt = val ? formatoCorto(val, 6) : (r === L.length ? '———' : '');
        h += '<button type="button" tabindex="-1" data-c="' + k + '" data-r="' + r + '" class="gti-tcel' + (sel ? ' gti-on' : '') + '">' + txt + '</button>';
      }
      h += '</div>';
    }
    var actual = d.listas[d.col][d.fila];
    h += '<div class="gti-tpie">L' + (d.col + 1) + '(' + (d.fila + 1) + ')=' +
      (d.celda.length ? htmlFila(d.celda) : (actual ? formatoCorto(actual, 12) + htmlFila(d.celda) : htmlFila(d.celda))) + '</div>';
    return h + '</div>';
  }

  function enlazarCeldas() {
    lcdLineas.querySelectorAll('[data-c]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!confirmarCelda()) { mostrar(); return; }
        var d = estado.datos;
        d.col = Number(b.getAttribute('data-c'));
        d.fila = Math.min(Number(b.getAttribute('data-r')), d.listas[d.col].length);
        nuevaCelda();
        mostrar();
      });
    });
  }

  function htmlStatSetup() {
    var s = estado.stat, filas = filasStat();
    var h = '<div class="gti-menu"><div class="gti-mtit">' + (s.tipo === 1 ? '1-Var' : '2-Var') + '</div>';
    filas.forEach(function (f, i) {
      h += '<div class="gti-mfila">';
      if (f.ops) {
        h += '<span class="gti-mlab">' + f.lab + '</span>';
        f.ops.forEach(function (o, j) {
          var cls = (s[f.clave] === j ? 'gti-on' : '') + (s.fila === i && s[f.clave] === j ? ' gti-foco' : '');
          h += '<button type="button" data-sf="' + i + '" data-so="' + j + '" class="' + cls + '">' + o + '</button>';
        });
      } else {
        h += '<button type="button" data-sf="' + i + '" class="' + (s.fila === i ? 'gti-on gti-foco' : '') + '">CALC</button>';
      }
      h += '</div>';
    });
    return h + '</div>';
  }

  function enlazarStatSetup() {
    lcdLineas.querySelectorAll('[data-sf]').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = estado.stat, filas = filasStat(), i = Number(b.getAttribute('data-sf')), f = filas[i];
        s.fila = i;
        if (f.ops) s[f.clave] = Number(b.getAttribute('data-so'));
        else calcularStat();
        mostrar();
      });
    });
  }

  function htmlStatRes() {
    var s = estado.stat, h = '<div class="gti-menu"><div class="gti-mtit">' + s.nombre + '</div>';
    var fin = Math.min(s.res.length, s.top + 4);
    for (var i = s.top; i < fin; i++) {
      var r = s.res[i];
      var val = r[1] === null ? '' : formatoDecimal(r[1], estado.cfg).html;
      h += '<div><button type="button" data-st="' + i + '" class="gti-stl' + (i === s.sel ? ' gti-on' : '') + '">' + etiquetaStat(i) + ':' + r[0] + '=' + val + '</button></div>';
    }
    if (fin < s.res.length) h += '<div class="gti-mas" aria-hidden="true">▼</div>';
    return h + '</div>';
  }

  function enlazarStatRes() {
    lcdLineas.querySelectorAll('[data-st]').forEach(function (b) {
      b.addEventListener('click', function () { pegarStat(Number(b.getAttribute('data-st'))); mostrar(); });
    });
  }

  function htmlTablaSetup() {
    var t = estado.tabla;
    var campo = function (fila, i) { return t.fila === i ? htmlFila(fila) : htmlFilaFija(fila); };
    var h = '<div class="gti-menu"><div class="gti-mtit">TABLE SETUP</div>';
    h += '<div class="gti-mfila' + (t.fila === 0 ? ' gti-mact' : '') + '"><span class="gti-mlab">Start=</span>' + campo(t.inicio, 0) + '</div>';
    h += '<div class="gti-mfila' + (t.fila === 1 ? ' gti-mact' : '') + '"><span class="gti-mlab">Step=</span>' + campo(t.paso, 1) + '</div>';
    h += '<div class="gti-mfila"><button type="button" data-ts="auto" class="' + (t.auto ? 'gti-on' : '') + (t.fila === 2 && t.auto ? ' gti-foco' : '') + '">Auto</button>' +
      '<button type="button" data-ts="ask" class="' + (!t.auto ? 'gti-on' : '') + (t.fila === 2 && !t.auto ? ' gti-foco' : '') + '">Ask-x</button></div>';
    h += '<div class="gti-mfila"><button type="button" data-ts="ok" class="' + (t.fila === 3 ? 'gti-on gti-foco' : '') + '">OK</button></div>';
    return h + '</div>';
  }

  function enlazarTablaSetup() {
    lcdLineas.querySelectorAll('[data-ts]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = estado.tabla, q = b.getAttribute('data-ts');
        if (q === 'ok') { t.fila = 3; abrirTabla(); }
        else { t.auto = q === 'auto'; t.fila = 2; estado.raiz = NADA; estado.c = { fila: NADA, i: 0 }; }
        mostrar();
      });
    });
  }

  function htmlTabla() {
    var t = estado.tabla, cf = cfgEval();
    var h = '<div class="gti-tab2"><div class="gti-tcab"><span class="' + (t.col === 0 ? 'gti-tcol' : '') + '"><i class="gti-var">x</i></span>' +
      '<span class="' + (t.col === 1 ? 'gti-tcol' : '') + '">f(<i class="gti-var">x</i>)</span></div>';
    var pie = '';
    for (var k = t.top; k < t.top + 3; k++) {
      var x = xDeFila(k), y = x === null ? null : fDe(x);
      var tx = x === null ? (k === t.xs.length && !t.auto ? '———' : '') : formatear(x, modoNatural(x), cf).html;
      var ty = x === null ? '' : (y ? formatear(y.v, y.modo, cf).html : 'ERROR');
      h += '<div class="gti-tfila">' +
        '<span class="gti-tcel' + (k === t.sel && t.col === 0 ? ' gti-on' : '') + '">' + tx + '</span>' +
        '<span class="gti-tcel' + (k === t.sel && t.col === 1 ? ' gti-on' : '') + '">' + ty + '</span></div>';
      if (k === t.sel) {
        if (t.col === 0) pie = '<i class="gti-var">x</i>=' + (t.celda.length || (!t.auto && x === null) ? htmlFila(t.celda) : tx);
        else pie = 'f(<i class="gti-var">x</i>)=' + ty;
      }
    }
    h += '<div class="gti-tpie">' + pie + '</div>';
    return h + '</div>';
  }

  var PISTA_HUECO = {
    frac: ['<b>Numerador.</b> Pulsa ▼ para bajar al denominador.', '<b>Denominador.</b> Pulsa ► para salir de la fracción.'],
    mixto: ['<b>Número entero.</b> Pulsa ► para pasar al numerador.', '<b>Numerador.</b> Pulsa ▼ para bajar al denominador.', '<b>Denominador.</b> Pulsa ► para salir del número mixto.'],
    pot: ['<b>Exponente.</b> Pulsa ► para salir del exponente.'],
    sci: ['<b>Exponente de 10.</b> Pulsa ► para salir.'],
    raiz2: ['<b>Dentro de la raíz.</b> Pulsa ► para salir de la raíz.'],
    raizn: ['<b>Índice de la raíz</b> (2, 3…). Pulsa ► para pasar al número.', '<b>Dentro de la raíz.</b> Pulsa ► para salir.'],
    diez: ['<b>Exponente de 10.</b> Pulsa ► para salir.'],
    expe: ['<b>Exponente de e.</b> Pulsa ► para salir.']
  };

  function textoPista() {
    if (estado.aviso) return estado.aviso;
    if (estado.error) return '<b>' + estado.error.es + '.</b> Pulsa clear para volver y corregirlo.';
    if (!estado.pistas) return '';
    if (estado.s2) return '<b>2nd activa:</b> la próxima tecla hace la función escrita en verde encima de ella.';
    if (estado.hyp) return '<b>hyp activa:</b> pulsa sin, cos o tan (o 2nd con ellas) para la función hiperbólica.';
    var m = estado.menu;
    if (m) {
      if (m.tipo === 'mode') return 'Muévete con las flechas y pulsa <b>enter</b> para elegir. <b>clear</b> sale del menú.';
      if (m.tipo === 'reset') return 'Pulsa 1 para cancelar o 2 para restablecer.';
      if (m.tipo === 'clearvar') return 'Pulsa 1 para poner todas las variables en 0, o 2 para cancelar.';
      if (m.tipo === 'recall') return 'Elige la variable cuyo valor quieres escribir en el cálculo.';
      if (m.tipo === 'stat') return '<b>1-Var Stats</b>: media, mediana, cuartiles… de una lista. <b>2-Var Stats</b>: dos listas (x e y) y la recta de regresión.';
      return 'Elige con el número de la opción o con ▲ ▼ y enter.' + (m.def.length > 1 ? ' ◄ ► cambian de pestaña.' : '') + ' <b>clear</b> sale del menú.';
    }
    var pan = estado.pantalla;
    if (pan === 'data') return 'Escribe un dato y pulsa <b>enter</b> o ▼. ◄ ► cambian de lista. <b>data</b>: borrar listas · <b>2nd data</b>: estadística · <b>2nd mode</b> (quit): salir.';
    if (pan === 'stat-setup') return '▲ ▼ eligen la fila y ◄ ► la lista. Baja a <b>CALC</b> y pulsa <b>enter</b>.';
    if (pan === 'stat-res') return '▲ ▼ recorren los resultados. <b>enter</b> (o el número) lleva el valor al cálculo. <b>clear</b>: salir.';
    if (pan === 'tabla-fx') return 'Escribe la función usando la tecla <b>x<sub>abc</sub><sup>yzt</sup></b> para la <i>x</i> y pulsa <b>enter</b>.';
    if (pan === 'tabla-setup') return '<b>Start</b>: primer valor de <i>x</i>. <b>Step</b>: de cuánto en cuánto. <b>Auto</b> llena la tabla; <b>Ask-x</b> te deja escribir cada <i>x</i>. Baja a <b>OK</b> y pulsa <b>enter</b>.';
    if (pan === 'tabla') return estado.tabla.auto ? '▲ ▼ recorren la tabla. <b>table</b>: cambiar la función · <b>2nd mode</b> (quit): salir.' : 'Escribe un valor de <i>x</i> y pulsa <b>enter</b>. <b>2nd mode</b> (quit): salir.';
    if (estado.kEdit) return 'Escribe la operación de la constante (por ejemplo + 3) y pulsa <b>enter</b>.';
    if (estado.sel !== null) return '▲ ▼ recorren los cálculos anteriores. <b>enter</b> copia el seleccionado en la línea de entrada.';
    var p = padreActual();
    if (p && PISTA_HUECO[p.nodo.t]) return PISTA_HUECO[p.nodo.t][p.k];
    var e = estado.entrada, ant = e[estado.c.i - 1];
    if (e.length) {
      if (ant && ant.v === 'sto') return 'Ahora pulsa la tecla de variables (x<sub>abc</sub><sup>yzt</sup>) para elegir dónde guardar. Púlsala otra vez para cambiar de letra.';
      if (ant && ant.v === 'var' && estado.ultima === 'xvar') return 'Pulsa otra vez la tecla de variables para cambiar a y, z, t, a, b o c.';
      if (ant && ant.v === 'fsl') return '<b>CLASSIC:</b> escribe el denominador.';
      if (ant && ant.v === 'unit') return '<b>CLASSIC:</b> escribe el numerador, pulsa <b>n/d</b> y escribe el denominador.';
      if (ant && ant.v === 'pw') return '<b>CLASSIC:</b> escribe el exponente; si tiene operaciones, ponlo entre paréntesis.';
      for (var i = 0; i < e.length; i++) {
        if (e[i].v === 'nPr' || e[i].v === 'nCr') return 'Escribe el segundo número (r) y pulsa <b>enter</b>.';
        if (e[i].v === 'randint(' || FUNCIONES2_UI[e[i].v]) return 'Separa los dos números con la coma (<b>2nd</b> <b>.</b>) y pulsa <b>enter</b>.';
      }
      return 'Pulsa <b>enter</b> para calcular.';
    }
    if (estado.K) return 'Constante K activa: escribe un número y pulsa <b>enter</b>. <b>2nd ÷</b> la desactiva.';
    var h = estado.historial[estado.historial.length - 1];
    if (h) {
      if (racional(h.v) && h.v.d !== 1n && h.modo !== 'pct' && h.modo !== 'dms') {
        return '<b>⟷</b> alterna fracción y decimal. Para verlo como número mixto: <b>2nd</b> <b>x⁻¹</b> (n/d◂▸Un/d) y <b>enter</b>.';
      }
      if (h.v.e && !racional(h.v) && h.modo === 'exacto') return '<b>⟷</b> alterna entre la forma exacta y el decimal.';
    }
    return '';
  }

  var FUNCIONES2_UI = { 'RPr(': 1, 'RPt(': 1, 'PRx(': 1, 'PRy(': 1 };

  /* ---------- Hoja de referencia ---------- */

  function fr(a, b) { return fraccionHTML(a, b); }
  function rz(a) { return raizHTML(a); }
  function kb(t) { return '<kbd>' + t + '</kbd>'; }
  function kn(t) { return '<kbd class="gti-kn">' + t + '</kbd>'; }
  function k2(t) { return '<kbd class="gti-k2">2nd</kbd>' + kb(t); }
  function ver(t) { return '<span class="gti-v">(' + t + ')</span>'; }
  function nums(s) { return s.split(' ').map(kn).join(''); }

  var HTML_FORMULAS =
    '<h3>Área</h3>' +
    '<table><caption>Área de figuras</caption><thead><tr><th scope="col">Figura</th><th scope="col">Fórmula</th></tr></thead><tbody>' +
    '<tr><td>Paralelogramo</td><td><i>A</i> = <i>bh</i></td></tr>' +
    '<tr><td>Trapecio</td><td><i>A</i> = ' + fr('1', '2') + '<i>h</i>(<i>b</i><sub>1</sub> + <i>b</i><sub>2</sub>)</td></tr>' +
    '</tbody></table>' +
    '<h3>Área de superficie y volumen</h3>' +
    '<table class="gti-sv"><caption>Área de superficie (AS) y volumen (V) de cuerpos geométricos</caption><thead><tr><th scope="col">Cuerpo</th><th scope="col">Área de superficie</th><th scope="col">Volumen</th></tr></thead><tbody>' +
    '<tr><td>Prisma rectangular o recto</td><td><i>AS</i> = <i>ph</i> + 2<i>B</i></td><td><i>V</i> = <i>Bh</i></td></tr>' +
    '<tr><td>Cilindro</td><td><i>AS</i> = 2π<i>rh</i> + 2π<i>r</i><sup>2</sup></td><td><i>V</i> = π<i>r</i><sup>2</sup><i>h</i></td></tr>' +
    '<tr><td>Pirámide</td><td><i>AS</i> = ' + fr('1', '2') + '<i>ps</i> + <i>B</i></td><td><i>V</i> = ' + fr('1', '3') + '<i>Bh</i></td></tr>' +
    '<tr><td>Cono</td><td><i>AS</i> = π<i>rs</i> + π<i>r</i><sup>2</sup></td><td><i>V</i> = ' + fr('1', '3') + 'π<i>r</i><sup>2</sup><i>h</i></td></tr>' +
    '<tr><td>Esfera</td><td><i>AS</i> = 4π<i>r</i><sup>2</sup></td><td><i>V</i> = ' + fr('4', '3') + 'π<i>r</i><sup>3</sup></td></tr>' +
    '</tbody></table>' +
    '<p class="gti-nota"><i>p</i> = perímetro de la base, <i>B</i> = área de la base, <i>s</i> = altura inclinada (apotema), π ≈ 3.14</p>' +
    '<h3>Álgebra</h3>' +
    '<table><caption>Fórmulas de álgebra</caption><thead><tr><th scope="col">Concepto</th><th scope="col">Fórmula</th></tr></thead><tbody>' +
    '<tr><td>Pendiente de una recta</td><td><i>m</i> = ' + fr('<i>y</i><sub>2</sub> − <i>y</i><sub>1</sub>', '<i>x</i><sub>2</sub> − <i>x</i><sub>1</sub>') + '</td></tr>' +
    '<tr><td>Forma pendiente-intersección de la ecuación de una recta</td><td><i>y</i> = <i>mx</i> + <i>b</i></td></tr>' +
    '<tr><td>Forma punto-pendiente de la ecuación de una recta</td><td><i>y</i> − <i>y</i><sub>1</sub> = <i>m</i>(<i>x</i> − <i>x</i><sub>1</sub>)</td></tr>' +
    '<tr><td>Forma estándar de una ecuación cuadrática</td><td><i>y</i> = <i>ax</i><sup>2</sup> + <i>bx</i> + <i>c</i></td></tr>' +
    '<tr><td>Fórmula cuadrática</td><td><i>x</i> = ' + fr('−<i>b</i> ± ' + rz('<i>b</i><sup>2</sup> − 4<i>ac</i>'), '2<i>a</i>') + '</td></tr>' +
    '<tr><td>Teorema de Pitágoras</td><td><i>a</i><sup>2</sup> + <i>b</i><sup>2</sup> = <i>c</i><sup>2</sup></td></tr>' +
    '<tr><td>Interés simple</td><td><i>I</i> = <i>prt</i><br><small>(<i>I</i> = interés, <i>p</i> = capital, <i>r</i> = tasa, <i>t</i> = tiempo)</small></td></tr>' +
    '<tr><td>Distancia</td><td><i>d</i> = <i>rt</i><br><small>(<i>d</i> = distancia, <i>r</i> = velocidad, <i>t</i> = tiempo)</small></td></tr>' +
    '<tr><td>Costo total</td><td>costo total = (número de unidades) × (precio por unidad)</td></tr>' +
    '</tbody></table>';

  var SECCIONES_GUIA = [
    ['basicas', 'Teclas básicas',
      '<p class="gti-paso">' + kb('2nd') + ' es verde: después de pulsarla, la siguiente tecla hace la función escrita en verde encima de ella.</p>' +
      '<p class="gti-paso">' + kb('enter') + ' calcula. ' + kb('clear') + ' borra la línea; si ya está vacía, borra la pantalla. ' + kb('delete') + ' borra lo que está en el cursor.</p>' +
      '<p class="gti-paso">Si empiezas un cálculo con una operación (' + kb('+') + ' ' + kb('−') + ' ' + kb('×') + ' ' + kb('x<sup>2</sup>') + '…), la calculadora escribe <b>ans</b> (el resultado anterior) delante. Si pulsas ' + kb('clear') + ' hasta dejar la pantalla vacía, ans vuelve a valer 0.</p>' +
      '<p class="gti-paso">' + kb('▲') + ' ' + kb('▼') + ' recorren los cálculos anteriores; ' + kb('enter') + ' copia el que está seleccionado.</p>'],
    ['fracciones', 'Fracciones',
      '<p class="gti-paso">' + kb('n/d') + ' abre la plantilla de fracción. Escribe el numerador, baja con ' + kb('▼') + ', escribe el denominador y sal con ' + kb('►') + '.</p>' +
      '<div class="gti-ej">' + fr('3', '4') + ' + ' + fr('1', '6') + ': ' + kb('n/d') + nums('3') + kb('▼') + nums('4') + kb('►') + kb('+') + kb('n/d') + nums('1') + kb('▼') + nums('6') + kb('►') + kb('enter') + ' ' + ver('11/12') + '</div>' +
      '<p class="gti-paso">También puedes escribir primero el numerador: ' + nums('3') + kb('n/d') + nums('4') + ' hace lo mismo.</p>'],
    ['mixtos', 'Números mixtos',
      '<p class="gti-paso">Escribe el número entero y pulsa ' + k2('n/d') + ' (U n/d). El cursor pasa al numerador; baja con ' + kb('▼') + ' al denominador y sal con ' + kb('►') + '.</p>' +
      '<div class="gti-ej">2 ' + fr('1', '3') + ' + 1 ' + fr('1', '2') + ':<br>' + nums('2') + k2('n/d') + nums('1') + kb('▼') + nums('3') + kb('►') + kb('+') + nums('1') + k2('n/d') + nums('1') + kb('▼') + nums('2') + kb('►') + kb('enter') + ' ' + ver('23/6') + '</div>' +
      '<p class="gti-paso">La calculadora da el resultado como fracción impropia. Para verlo como número mixto pulsa ' + k2('x<sup>−1</sup>') + ' (n/d◂▸Un/d) y ' + kb('enter') + ' ' + ver('3 5/6') + '. Para verlo en decimal, pulsa ' + kb('⟷') + '.</p>'],
    ['negativos', 'Números negativos',
      '<p class="gti-paso">Para un número negativo usa ' + kn('(−)') + ', no la resta ' + kb('−') + '. Si las confundes, la calculadora da <b>SYNTAX ERROR</b>, igual que la del examen. Y si empiezas con la resta, escribe <b>ans</b> delante: −5 se convierte en ans−5.</p>' +
      '<div class="gti-ej">−5 − 10 − (−5) + (−6): ' + kn('(−)') + nums('5') + kb('−') + nums('1 0') + kb('−') + kb('(') + kn('(−)') + nums('5') + kb(')') + kb('+') + kb('(') + kn('(−)') + nums('6') + kb(')') + kb('enter') + ' ' + ver('−16') + '</div>' +
      '<div class="gti-ej">−8 + 3: ' + kn('(−)') + nums('8') + kb('+') + nums('3') + kb('enter') + ' ' + ver('−5') + '</div>' +
      '<p class="gti-paso">Ojo: −3<sup>2</sup> da −9. Para elevar −3 al cuadrado, usa paréntesis: ' + kb('(') + kn('(−)') + nums('3') + kb(')') + kb('x<sup>2</sup>') + ' ' + ver('9') + '.</p>'],
    ['porcentajes', 'Porcentajes',
      '<p class="gti-paso">La tecla % es ' + k2('(') + '.</p>' +
      '<div class="gti-ej">15 % de 80: ' + nums('1 5') + k2('(') + kb('×') + nums('8 0') + kb('enter') + ' ' + ver('12') + '</div>' +
      '<p class="gti-paso">Para expresar un resultado como por ciento: ' + k2(')') + ' (▸%) y ' + kb('enter') + '. Ejemplo: ' + fr('1', '5') + ' ▸% ' + ver('20%') + '.</p>'],
    ['potencias', 'Potencias y raíces',
      '<p class="gti-paso">' + kb('x<sup>2</sup>') + ' eleva al cuadrado. ' + kb('^') + ' abre el exponente: escribe el exponente y sal con ' + kb('►') + ' antes de seguir.</p>' +
      '<div class="gti-ej">2<sup>5</sup> + 1: ' + nums('2') + kb('^') + nums('5') + kb('►') + kb('+') + nums('1') + kb('enter') + ' ' + ver('33') + '</div>' +
      '<p class="gti-paso">Raíz cuadrada: ' + k2('x<sup>2</sup>') + ' (√), el número y ' + kb('►') + '. La calculadora da la raíz exacta (por ejemplo, 2√2); ' + kb('⟷') + ' la pasa a decimal.</p>' +
      '<p class="gti-paso">Otra raíz: escribe el índice y pulsa ' + k2('^') + ' (<sup>x</sup>√). Raíz cúbica de 27: ' + nums('3') + k2('^') + nums('2 7') + kb('►') + kb('enter') + ' ' + ver('3') + '</p>'],
    ['cientifica', 'Notación científica',
      '<p class="gti-paso">' + kb('×10<sup>n</sup>') + ' abre el exponente de 10.</p>' +
      '<div class="gti-ej">4.5 × 10<sup>6</sup>: ' + nums('4 . 5') + kb('×10<sup>n</sup>') + nums('6') + kb('►') + '</div>' +
      '<p class="gti-paso">Para un exponente negativo usa ' + kn('(−)') + ' dentro del exponente.</p>'],
    ['probabilidad', 'Probabilidad (nPr, nCr, !)',
      '<p class="gti-paso">Escribe primero <b>n</b>, pulsa ' + kb('prb') + ' y elige con el número de la opción. Después escribe <b>r</b>. En la pantalla se ve <b>nPr</b> o <b>nCr</b> completo, así sabes cuál elegiste.</p>' +
      '<div class="gti-ej">Permutaciones de 5 tomados de 2: ' + nums('5') + kb('prb') + nums('1') + nums('2') + kb('enter') + ' → 5 nPr 2 ' + ver('20') + '<br>' +
      'Combinaciones de 5 tomados de 2: ' + nums('5') + kb('prb') + nums('2') + nums('2') + kb('enter') + ' → 5 nCr 2 ' + ver('10') + '<br>' +
      'Factorial de 5: ' + nums('5') + kb('prb') + nums('3') + kb('enter') + ' → 5! ' + ver('120') + '</div>' +
      '<p class="gti-paso">nPr: el orden importa (podio, contraseñas). nCr: el orden no importa (comités, grupos).</p>'],
    ['toggle', 'Fracción o decimal',
      '<p class="gti-paso">' + kb('⟷') + ' alterna el último resultado entre fracción y decimal (o entre raíz exacta y decimal).</p>' +
      '<p class="gti-paso">' + k2('table') + ' (f◂▸d) convierte un decimal en fracción: 0.75 ' + k2('table') + kb('enter') + ' ' + ver('3/4') + '.</p>' +
      '<p class="gti-paso">La división con ' + kb('÷') + ' da decimal; la plantilla ' + kb('n/d') + ' da fracción.</p>'],
    ['variables', 'Variables (sto→)',
      '<p class="gti-paso">Para guardar un número: escríbelo (o haz el cálculo), pulsa ' + kb('sto→') + ' y después ' + kb('x<sub>abc</sub><sup>yzt</sup>') + '. Cada vez que pulsas ' + kb('x<sub>abc</sub><sup>yzt</sup>') + ' cambia la letra: x, y, z, t, a, b, c.</p>' +
      '<div class="gti-ej">Guardar 12 en x: ' + nums('1 2') + kb('sto→') + kb('x<sub>abc</sub><sup>yzt</sup>') + kb('enter') + '<br>Usarla: ' + kb('x<sub>abc</sub><sup>yzt</sup>') + kb('×') + nums('3') + kb('enter') + ' ' + ver('36') + '</div>' +
      '<p class="gti-paso">' + k2('x<sub>abc</sub><sup>yzt</sup>') + ' (recall) muestra lo que vale cada variable. ' + k2('sto→') + ' (clear var) las pone todas en 0.</p>' +
      '<p class="gti-paso"><b>Fórmula cuadrática con variables.</b> Para 2<i>x</i><sup>2</sup> + 3<i>x</i> − 2 = 0, guarda 2 en <b>a</b>, 3 en <b>b</b> y −2 en <b>c</b>. Después escribe la fórmula una vez con las letras:</p>' +
      '<div class="gti-ej">' + kb('n/d') + kn('(−)') + '<b>b</b>' + kb('+') + k2('x<sup>2</sup>') + '<b>b</b>' + kb('x<sup>2</sup>') + kb('−') + nums('4') + '<b>a</b>' + kb('×') + '<b>c</b>' + kb('►') + kb('▼') + nums('2') + '<b>a</b>' + kb('►') + kb('enter') + ' ' + ver('1/2') + '<br>' +
      'Para la otra solución, cambia + por − ' + ver('−2') + '.</div>' +
      '<p class="gti-paso">Ojo: entre dos letras pulsa ' + kb('×') + ', porque si pulsas dos veces seguidas la tecla de variables cambia la letra.</p>'],
    ['estadistica', 'Datos y estadística',
      '<p class="gti-paso">' + kb('data') + ' abre las listas L1, L2 y L3. Escribe cada dato y pulsa ' + kb('enter') + '; ' + kb('◄') + ' ' + kb('►') + ' cambian de lista. Para borrar una lista, pulsa otra vez ' + kb('data') + ' y elige Clear.</p>' +
      '<p class="gti-paso">' + k2('data') + ' (stat) → <b>1-Var Stats</b>: elige la lista (DATA), deja FRQ en ONE, baja a CALC y pulsa ' + kb('enter') + '.</p>' +
      '<div class="gti-ej">Datos 2, 4, 4, 5, 7: n = 5, x̄ = 4.4 (media), Med = 4 (mediana), minX = 2 y maxX = 7 (el rango es 7 − 2 = 5).</div>' +
      '<p class="gti-paso">FRQ sirve cuando una lista dice cuántas veces se repite cada dato. <b>2-Var Stats</b> usa dos listas (x e y) y da la recta de regresión <i>y</i> = <i>ax</i> + <i>b</i> y la correlación <i>r</i>.</p>' +
      '<p class="gti-paso">Con ▲ ▼ recorres los resultados; ' + kb('enter') + ' lleva el valor elegido a la pantalla principal. ' + k2('mode') + ' (quit) vuelve a la pantalla principal.</p>'],
    ['tabla', 'Tabla de valores',
      '<p class="gti-paso">' + kb('table') + ' pide la función: escríbela usando ' + kb('x<sub>abc</sub><sup>yzt</sup>') + ' para la <i>x</i> y pulsa ' + kb('enter') + '.</p>' +
      '<p class="gti-paso">En TABLE SETUP, <b>Start</b> es el primer valor de <i>x</i> y <b>Step</b>, de cuánto en cuánto aumenta. <b>Auto</b> llena la tabla sola; <b>Ask-x</b> te deja escribir cada <i>x</i>. Baja a OK y pulsa ' + kb('enter') + '.</p>' +
      '<div class="gti-ej">f(<i>x</i>) = <i>x</i><sup>2</sup> + 1 con Start = 2 y Step = 1: <i>x</i> = 2, 3, 4 → f(<i>x</i>) = 5, 10, 17.</div>'],
    ['clasico', 'Modo CLASSIC',
      '<p class="gti-paso">En ' + kb('mode') + ' puedes elegir CLASSIC: todo se escribe en una sola línea, sin plantillas. Las fracciones se ven 3/4 y los números mixtos 2u1/3.</p>' +
      '<p class="gti-paso">En CLASSIC el exponente no tiene plantilla: si tiene operaciones, ponlo entre paréntesis, por ejemplo 2^(1+2). La raíz se escribe √( … ).</p>' +
      '<p class="gti-paso">El examen viene en MATHPRINT, que es el modo recomendado.</p>'],
    ['otras', 'Constante K, ángulos y más',
      '<p class="gti-paso"><b>Constante K</b>: ' + k2('÷') + ', escribe la operación que se repite (por ejemplo ' + kb('+') + nums('3') + ') y ' + kb('enter') + '. Desde entonces, cada número que escribas con ' + kb('enter') + ' recibe esa operación. ' + k2('÷') + ' la desactiva.</p>' +
      '<p class="gti-paso"><b>Ángulos</b>: ' + k2('prb') + ' (angle) tiene °, \', ", radianes y ▸DMS, y las conversiones R▸P y P▸R.</p>' +
      '<p class="gti-paso"><b>Número al azar</b>: ' + kb('prb') + ' ► RAND. randint(1,6) da un entero del 1 al 6; la coma es ' + k2('.') + '.</p>' +
      '<p class="gti-paso"><b>Hiperbólicas</b>: ' + k2('π') + ' (hyp) y después sin, cos o tan.</p>'],
    ['modos', 'Modos y errores',
      '<p class="gti-paso">' + kb('mode') + ' abre los modos: ángulos (DEG, RAD, GRAD), notación (NORM, SCI, ENG), decimales (FLOAT o de 0 a 9) y pantalla (CLASSIC o MATHPRINT). Lo normal para el GED es <b>DEG</b>, <b>NORM</b>, <b>FLOAT</b> y <b>MATHPRINT</b>. ' + k2('0') + ' (reset) devuelve todo a como venía.</p>' +
      '<p class="gti-paso">Si sale <b>SYNTAX ERROR</b> u otro error, pulsa ' + kb('clear') + ' para volver a tu cálculo y corregirlo.</p>']
  ];

  function htmlGuia() {
    var h = '<p class="gti-nota" style="margin-top:0">Ir a:</p><ul class="gti-indice">';
    SECCIONES_GUIA.forEach(function (s) {
      h += '<li><button type="button" data-ir="gti-g-' + s[0] + '">' + s[1] + '</button></li>';
    });
    h += '</ul>';
    SECCIONES_GUIA.forEach(function (s) {
      h += '<h3 id="gti-g-' + s[0] + '" tabindex="-1">' + s[1] + '</h3>' + s[2];
    });
    return h;
  }

  /* ---------- Construcción ---------- */

  function construir() {
    var estilo = crear('style', { id: 'gti-estilos' });
    estilo.textContent = CSS;
    document.head.appendChild(estilo);

    anuncio = crear('div', { 'class': 'gti-lector', 'aria-live': 'polite', role: 'status' });
    document.body.appendChild(anuncio);

    construirCalculadora();
    construirHoja();
    construirBarra();

    document.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      var d = e.target.closest('[data-gph-calculadora]');
      if (d) { e.preventDefault(); ultimoFoco = d; alternar(); return; }
      var h = e.target.closest('[data-gph-hoja]');
      if (h) { e.preventDefault(); ultimoFocoHoja = h; alternarHoja(h.getAttribute('data-gph-hoja') || 'formulas'); }
    });

    window.addEventListener('resize', function () {
      if (abierta()) colocar(ventana, ventana.offsetLeft, ventana.offsetTop);
      if (hojaAbierta()) colocar(hoja, hoja.offsetLeft, hoja.offsetTop);
    });

    mostrar();
    if (opciones.abrir) abrir();
  }

  function construirCalculadora() {
    ventana = crear('div', { id: 'gti-calc', 'class': 'gti-ventana', role: 'dialog', 'aria-label': 'Calculadora TI-30XS MultiView', tabindex: '-1' });

    var asa = crear('div', { 'class': 'gti-asa', tabindex: '0', 'aria-label': 'Barra para mover la calculadora. Arrástrala o usa las flechas del teclado.' });
    asa.innerHTML = '<span aria-hidden="true">⠿</span><span class="gti-asa-t">Calculadora</span>';
    btnPistas = crear('button', { type: 'button', 'aria-pressed': 'false', title: 'Mostrar u ocultar las pistas', 'aria-label': 'Pistas' }, '💡 Pistas');
    var btnHoja = crear('button', { type: 'button', title: 'Hoja de referencia', 'aria-label': 'Abrir la guía de uso de la calculadora' }, '?');
    var btnCerrar = crear('button', { type: 'button', title: 'Cerrar', 'aria-label': 'Cerrar la calculadora' }, '✕');
    asa.appendChild(btnPistas);
    asa.appendChild(btnHoja);
    asa.appendChild(btnCerrar);

    cuerpoCalc = crear('div', { 'class': 'gti-cuerpo' });
    cuerpoCalc.innerHTML =
      '<div class="gti-solar" aria-hidden="true"></div>' +
      '<div class="gti-marca" aria-hidden="true"><b>TI-30XS MultiView</b><span>Simulador GPH</span></div>';

    var lcd = crear('div', { 'class': 'gti-lcd', 'aria-hidden': 'true' });
    lcdEstado = crear('div', { 'class': 'gti-estado' });
    lcdLineas = crear('div', { 'class': 'gti-lineas' });
    lcd.appendChild(lcdEstado);
    lcd.appendChild(lcdLineas);
    cuerpoCalc.appendChild(lcd);

    pista = crear('div', { 'class': 'gti-pista', 'aria-hidden': 'true' });
    cuerpoCalc.appendChild(pista);

    var teclado = crear('div', { 'class': 'gti-teclado' });
    FILAS.forEach(function (fila, f) {
      fila.forEach(function (t) {
        var celda = crear('div', { 'class': 'gti-celda' });
        celda.appendChild(crear('span', { 'class': 'gti-sec', 'aria-hidden': 'true' }, t[2] || '&nbsp;'));
        var b = crear('button', { type: 'button', 'class': 'gti-k gti-' + t[3], 'aria-label': t[4] }, '<span>' + t[1] + '</span>');
        b._d1 = t[4];
        b._d2 = t[5] ? '2nd ' + t[2].replace(/<[^>]+>/g, '') + ': ' + t[5] : null;
        if (t[0] === '2nd') { b.setAttribute('aria-pressed', 'false'); btn2nd = b; }
        else botonesTecla[t[0]] = b;
        b.addEventListener('click', function () { pulsar(t[0]); });
        celda.appendChild(b);
        teclado.appendChild(celda);
      });
      if (f === 0) {
        var dpad = crear('div', { 'class': 'gti-dpad' });
        [['up', '▲', 'arriba'], ['left', '◄', 'izquierda'], ['right', '►', 'derecha'], ['down', '▼', 'abajo']].forEach(function (a) {
          var b = crear('button', { type: 'button', 'class': 'gti-k gti-' + a[0], 'aria-label': 'Flecha ' + a[2] }, a[1]);
          b._d1 = 'Flecha ' + a[2];
          botonesTecla[a[0]] = b;
          b.addEventListener('click', function () { pulsar(a[0]); });
          dpad.appendChild(b);
        });
        teclado.appendChild(dpad);
      }
    });
    cuerpoCalc.appendChild(teclado);
    cuerpoCalc.appendChild(crear('div', { 'class': 'gti-pie' }, 'GEDparaHispanos · recurso educativo'));

    ventana.appendChild(asa);
    ventana.appendChild(cuerpoCalc);
    document.body.appendChild(ventana);

    btnCerrar.addEventListener('click', cerrar);
    btnHoja.addEventListener('click', function () { ultimoFocoHoja = btnHoja; abrirHoja('guia'); });
    btnPistas.addEventListener('click', function () {
      estado.pistas = !estado.pistas;
      try { localStorage.setItem('gti-pistas', estado.pistas ? 'si' : 'no'); } catch (e) { /* nada */ }
      anunciar(estado.pistas ? 'Pistas activadas' : 'Pistas desactivadas');
      mostrar();
    });

    arrastrable(ventana, asa, 'gti-pos-calc');
    ventana.addEventListener('keydown', teclaFisica);
  }

  function construirHoja() {
    hoja = crear('div', { id: 'gti-hoja', 'class': 'gti-ventana', role: 'dialog', 'aria-label': 'Hoja de referencia', tabindex: '-1' });
    var asa = crear('div', { 'class': 'gti-asa', tabindex: '0', 'aria-label': 'Barra para mover la hoja de referencia. Arrástrala o usa las flechas del teclado.' });
    asa.innerHTML = '<span aria-hidden="true">⠿</span><span class="gti-asa-t">Hoja de referencia</span>';
    var btnCerrar = crear('button', { type: 'button', title: 'Cerrar', 'aria-label': 'Cerrar la hoja de referencia' }, '✕');
    asa.appendChild(btnCerrar);

    var pests = crear('div', { 'class': 'gti-pests', role: 'tablist', 'aria-label': 'Secciones de la hoja' });
    [['formulas', 'Fórmulas'], ['guia', 'Uso de la calculadora']].forEach(function (p) {
      var b = crear('button', { type: 'button', role: 'tab', id: 'gti-tab-' + p[0], 'aria-controls': 'gti-panel-' + p[0], 'aria-selected': 'false' }, p[1]);
      b.addEventListener('click', function () { pestanaHoja(p[0]); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var otra = p[0] === 'formulas' ? 'guia' : 'formulas';
          pestanaHoja(otra);
          hojaPests[otra].focus();
        }
      });
      hojaPests[p[0]] = b;
      pests.appendChild(b);
    });

    hojaPaneles.formulas = crear('div', { 'class': 'gti-panel', id: 'gti-panel-formulas', role: 'tabpanel', 'aria-labelledby': 'gti-tab-formulas', tabindex: '0' }, HTML_FORMULAS);
    hojaPaneles.guia = crear('div', { 'class': 'gti-panel', id: 'gti-panel-guia', role: 'tabpanel', 'aria-labelledby': 'gti-tab-guia', tabindex: '0' }, htmlGuia());

    hojaPaneles.guia.querySelectorAll('[data-ir]').forEach(function (b) {
      b.addEventListener('click', function () {
        var destino = document.getElementById(b.getAttribute('data-ir'));
        if (!destino) return;
        hojaPaneles.guia.scrollTop = destino.offsetTop - hojaPaneles.guia.offsetTop - 6;
        destino.focus({ preventScroll: true });
      });
    });

    hoja.appendChild(asa);
    hoja.appendChild(pests);
    hoja.appendChild(hojaPaneles.formulas);
    hoja.appendChild(hojaPaneles.guia);
    document.body.appendChild(hoja);

    btnCerrar.addEventListener('click', cerrarHoja);
    hoja.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); cerrarHoja(); } });
    arrastrable(hoja, asa, 'gti-pos-hoja');
    pestanaHoja('formulas');
  }

  function construirBarra() {
    if (!opciones.boton && !opciones.hoja) return;
    barra = crear('div', { id: 'gti-barra', role: 'toolbar', 'aria-label': 'Herramientas de matemáticas' });
    if (opciones.boton) {
      lanzadorCalc = crear('button', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'gti-calc' }, '<span aria-hidden="true">🧮</span> Calculadora');
      lanzadorCalc.addEventListener('click', function () { ultimoFoco = lanzadorCalc; alternar(); });
      barra.appendChild(lanzadorCalc);
    }
    if (opciones.hoja) {
      lanzadorHoja = crear('button', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'gti-hoja' }, '<span aria-hidden="true">📐</span> Hoja de referencia');
      lanzadorHoja.addEventListener('click', function () { ultimoFocoHoja = lanzadorHoja; alternarHoja('formulas'); });
      barra.appendChild(lanzadorHoja);
    }
    document.body.appendChild(barra);

    var pendiente = false;
    var programar = function () {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () { pendiente = false; evitarSolapes(); });
    };
    window.addEventListener('scroll', programar, { passive: true });
    window.addEventListener('resize', programar);
    window.addEventListener('load', programar);
    evitarSolapes();
  }

  // Si la página ya tiene algo fijo arriba a la derecha (una barra, un botón),
  // la barra de la calculadora se coloca justo debajo.
  function evitarSolapes() {
    if (!barra) return;
    barra.style.top = '10px';
    var b = barra.getBoundingClientRect(), abajo = -Infinity;
    var todos = document.querySelectorAll('body *');
    for (var i = 0; i < todos.length; i++) {
      var el = todos[i];
      if (el === barra || barra.contains(el) || el.closest('.gti-ventana') || el === anuncio) continue;
      var cs = getComputedStyle(el);
      if ((cs.position !== 'fixed' && cs.position !== 'sticky') || cs.display === 'none' || cs.visibility === 'hidden' || !el.offsetWidth) continue;
      var r = el.getBoundingClientRect();
      if (r.height > window.innerHeight * 0.5) continue;
      var cruza = !(r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom);
      if (cruza) abajo = Math.max(abajo, r.bottom);
    }
    if (abajo !== -Infinity) barra.style.top = (abajo + 8) + 'px';
  }

  /* ---------- Abrir, cerrar y mover ---------- */

  function abierta() { return ventana && ventana.classList.contains('gti-abierta'); }
  function hojaAbierta() { return hoja && hoja.classList.contains('gti-abierta'); }

  function posicionInicial(v, clave, ancho) {
    var pos = leerPosicion(clave);
    if (pos) { colocar(v, pos.x, pos.y); return; }
    var top = barra ? barra.getBoundingClientRect().bottom + 8 : 12;
    colocar(v, opciones.izquierda ? 4 : window.innerWidth - ancho - 12, top);
  }

  function abrir() {
    if (!ventana || abierta()) return;
    if (!ultimoFoco) ultimoFoco = document.activeElement;
    ventana.classList.add('gti-abierta');
    posicionInicial(ventana, 'gti-pos-calc', ventana.offsetWidth);
    if (lanzadorCalc) lanzadorCalc.setAttribute('aria-expanded', 'true');
    mostrar();
    ventana.focus();
  }

  function cerrar() {
    if (!abierta()) return;
    ventana.classList.remove('gti-abierta');
    if (lanzadorCalc) lanzadorCalc.setAttribute('aria-expanded', 'false');
    var volver = ultimoFoco || lanzadorCalc;
    ultimoFoco = null;
    if (volver && volver.focus && document.contains(volver)) volver.focus();
  }

  function alternar() { abierta() ? cerrar() : abrir(); }

  function pestanaHoja(cual) {
    ['formulas', 'guia'].forEach(function (p) {
      var activa = p === cual;
      hojaPests[p].setAttribute('aria-selected', activa ? 'true' : 'false');
      hojaPests[p].tabIndex = activa ? 0 : -1;
      hojaPaneles[p].hidden = !activa;
    });
  }

  function abrirHoja(cual) {
    if (!hoja) return;
    pestanaHoja(cual === 'guia' ? 'guia' : 'formulas');
    if (!hojaAbierta()) {
      if (!ultimoFocoHoja) ultimoFocoHoja = document.activeElement;
      hoja.classList.add('gti-abierta');
      var pos = leerPosicion('gti-pos-hoja');
      if (pos) colocar(hoja, pos.x, pos.y);
      else {
        var top = barra ? barra.getBoundingClientRect().bottom + 8 : 12;
        var x = opciones.izquierda ? 4 : abierta() ? ventana.offsetLeft - hoja.offsetWidth - 10 : window.innerWidth - hoja.offsetWidth - 12;
        colocar(hoja, x, top);
      }
      if (lanzadorHoja) lanzadorHoja.setAttribute('aria-expanded', 'true');
    }
    hoja.focus();
  }

  function cerrarHoja() {
    if (!hojaAbierta()) return;
    hoja.classList.remove('gti-abierta');
    if (lanzadorHoja) lanzadorHoja.setAttribute('aria-expanded', 'false');
    var volver = ultimoFocoHoja || lanzadorHoja;
    ultimoFocoHoja = null;
    if (volver && volver.focus && document.contains(volver)) volver.focus();
  }

  function alternarHoja(cual) {
    if (hojaAbierta() && hojaPests[cual === 'guia' ? 'guia' : 'formulas'].getAttribute('aria-selected') === 'true') cerrarHoja();
    else abrirHoja(cual);
  }

  function colocar(v, x, y) {
    var maxX = window.innerWidth - v.offsetWidth - 4;
    var maxY = Math.max(4, window.innerHeight - 60);
    x = Math.max(4, Math.min(x, maxX));
    y = Math.max(4, Math.min(y, maxY));
    v.style.left = x + 'px';
    v.style.top = y + 'px';
  }

  function guardarPosicion(v, clave) {
    if (!opciones.recordar) return;
    try { localStorage.setItem(clave, JSON.stringify({ x: v.offsetLeft, y: v.offsetTop })); } catch (e) { /* sin almacenamiento */ }
  }

  function leerPosicion(clave) {
    if (!opciones.recordar) return null;
    try {
      var p = JSON.parse(localStorage.getItem(clave));
      if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
    } catch (e) { /* sin almacenamiento */ }
    return null;
  }

  function arrastrable(v, asa, clave) {
    var arrastrando = false, dx = 0, dy = 0;
    asa.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      arrastrando = true;
      dx = e.clientX - v.offsetLeft;
      dy = e.clientY - v.offsetTop;
      try { asa.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
      e.preventDefault();
    });
    asa.addEventListener('pointermove', function (e) { if (arrastrando) colocar(v, e.clientX - dx, e.clientY - dy); });
    function soltar() { if (arrastrando) { arrastrando = false; guardarPosicion(v, clave); } }
    asa.addEventListener('pointerup', soltar);
    asa.addEventListener('pointercancel', soltar);
    asa.addEventListener('keydown', function (e) {
      if (e.target !== asa) return;
      var paso = e.shiftKey ? 60 : 20, x = v.offsetLeft, y = v.offsetTop;
      if (e.key === 'ArrowLeft') x -= paso;
      else if (e.key === 'ArrowRight') x += paso;
      else if (e.key === 'ArrowUp') y -= paso;
      else if (e.key === 'ArrowDown') y += paso;
      else return;
      e.preventDefault();
      e.stopPropagation();
      colocar(v, x, y);
      guardarPosicion(v, clave);
    });
  }

  /* ---------- Teclado físico ---------- */

  function teclaFisica(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.classList && e.target.classList.contains('gti-asa')) return;
    var k = e.key, id = null;
    var mapa = {
      '+': '+', '-': '-', '*': '*', 'x': '*', 'X': '*', '/': '/', '(': '(', ')': ')', '.': '.', ',': '.',
      '^': 'pot', '!': null, 'ArrowLeft': 'left', 'ArrowRight': 'right', 'ArrowUp': 'up', 'ArrowDown': 'down',
      'Backspace': 'delete', 'Delete': 'clear'
    };
    if (/^[0-9]$/.test(k)) id = k;
    else if (k in mapa) id = mapa[k];
    if (k === '!') { pulsarPrbDirecto('fact'); e.preventDefault(); return; }
    if (k === '%') { estado.s2 = true; pulsar('('); e.preventDefault(); return; }
    if (k === 'Enter' || k === '=') {
      if (k === 'Enter' && e.target.tagName === 'BUTTON') return;
      id = 'enter';
    }
    if (k === 'Escape') {
      e.preventDefault();
      if (estado.menu) { cerrarMenu(); mostrar(); } else cerrar();
      return;
    }
    if (id) { e.preventDefault(); pulsar(id); }
  }

  function pulsarPrbDirecto(v) {
    estado.s2 = false;
    if (estado.menu || estado.error) return;
    operador(v);
    mostrar();
  }

  function anunciar(texto) {
    if (!anuncio) return;
    anuncio.textContent = '';
    setTimeout(function () { anuncio.textContent = texto.replace(/<[^>]+>/g, ''); }, 30);
  }

  /* ---------- Arranque ---------- */

  global.CalculadoraGPH = {
    version: '2',
    abrir: function () { abrir(); },
    cerrar: function () { cerrar(); },
    alternar: function () { alternar(); },
    abrirHoja: function (p) { abrirHoja(p); },
    cerrarHoja: function () { cerrarHoja(); },
    alternarHoja: function (p) { alternarHoja(p); },
    motor: motor,
    // Para pruebas automáticas: pulsa una secuencia de teclas por su código
    _teclas: function (lista) { lista.forEach(function (id) { pulsar(id); }); },
    _ultimo: function () {
      var h = estado.historial[estado.historial.length - 1];
      return h ? formatear(h.v, h.modo, estado.cfg).texto : null;
    },
    _error: function () { return estado.error; },
    _lcd: function () { return lcdLineas.textContent; },
    _pantalla: function () { return estado.pantalla; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', construir);
  else construir();

})(typeof window !== 'undefined' ? window : globalThis);
