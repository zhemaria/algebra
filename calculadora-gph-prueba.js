/*!
 * Calculadora GPH v2.0 — simulador de la TI-30XS MultiView™ — GEDparaHispanos
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

  var cfgMotor = { angulo: 'deg' };

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

  function aplicarFuncion(f, x, info) {
    if (f === 'log') return logaritmo(x);
    if (f === 'ln') return logNatural(x);
    return trig(f, x, info);
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

  var FUNCIONES = { 'log(': 'log', 'ln(': 'ln', 'sin(': 'sin', 'cos(': 'cos', 'tan(': 'tan', 'asin(': 'asin', 'acos(': 'acos', 'atan(': 'atan' };
  var CONVERSIONES = { toPct: 1, toFD: 1, toUnd: 1 };

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
        else if (FUNCIONES[c]) t.push({ k: 'fn', f: FUNCIONES[c] });
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
    return t;
  }

  function analizar(tokens, info) {
    var i = 0;
    function ver() { return tokens[i]; }
    function es(k) { var x = tokens[i]; return x && x.k === k; }
    function iniciaPrimario(x) { return x && (x.k === 'n' || x.k === '(' || x.k === 'fn' || x.k === '~'); }

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
        } else {
          break;
        }
      }
      return v;
    }

    function unario() {
      if (es('-') || es('~')) { i++; return opuesto(unario()); }
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
      if (x.k === 'E') return potencia(Q(10n), x.v);
      if (x.k === ')') throw errorGPH(ERR.sint, 'Sobra un paréntesis de cierre');
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

  // Devuelve {v, modo, conversion}
  function evaluarEntrada(fila, ans, cfg, previo) {
    if (cfg) cfgMotor.angulo = cfg.angulo || 'deg';
    var conversion = null;
    var cuerpo = fila.slice();
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
    return { v: v, modo: modo, conversion: conversion, info: info };
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

  function formatear(v, modo, cfg) {
    cfg = cfg || {};
    if (modo === 'pct') {
      var pc = formatoDecimal(aNumero(v) * 100, cfg);
      return { html: pc.html + '%', texto: pc.texto + ' por ciento' };
    }
    if (!v.e) return formatoDecimal(v.v, cfg);
    var signo = v.n < 0n ? '−' : '';
    var n = absB(v.n), d = v.d;
    if (!racional(v)) {
      if (modo !== 'exacto') return formatoDecimal(aNumero(v), cfg);
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
      return { html: signo + fraccionHTML(n.toString(), d.toString()), texto: signo + n + ' sobre ' + d };
    }
    if (modo === 'mixto') {
      var entero = n / d, resto = n % d;
      if (entero === 0n) return { html: signo + fraccionHTML(resto.toString(), d.toString()), texto: signo + resto + ' sobre ' + d };
      return {
        html: signo + entero + '<span class="gti-mx-sep"></span>' + fraccionHTML(resto.toString(), d.toString()),
        texto: signo + entero + ' y ' + resto + ' sobre ' + d
      };
    }
    return formatoDecimal(aNumero(v), cfg);
  }

  // Formas en que se puede mostrar un resultado con la tecla ⟷
  function formasAlternas(v) {
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
    abrir: attr('data-abrir') === 'si'
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
    '+': '+', '-': '−', '*': '×', '/': '÷', '(': '(', ')': ')',
    'neg': '<span class="gti-neg">−</span>', 'pi': 'π', 'ans': 'Ans', 'rand': 'rand',
    'sq': '<sup class="gti-sup">2</sup>', 'inv': '<sup class="gti-sup">−1</sup>', 'fact': '!',
    'nPr': '<span class="gti-prb">nPr</span>', 'nCr': '<span class="gti-prb">nCr</span>', 'pct': '%',
    'log(': 'log(', 'ln(': 'ln(', 'sin(': 'sin(', 'cos(': 'cos(', 'tan(': 'tan(',
    'asin(': 'sin<sup class="gti-sup">−1</sup>(', 'acos(': 'cos<sup class="gti-sup">−1</sup>(', 'atan(': 'tan<sup class="gti-sup">−1</sup>(',
    'toPct': '<span class="gti-conv">▸%</span>', 'toFD': '<span class="gti-conv">▸F◂▸D</span>', 'toUnd': '<span class="gti-conv">▸n/d◂▸Un/d</span>'
  };

  var HUECOS = { frac: 2, mixto: 3, pot: 1, sci: 1, raiz2: 1, raizn: 2, diez: 1, expe: 1 };

  /* ---------- Estado ---------- */
  var estado = {
    entrada: [],
    c: null,
    s2: false,
    historial: [],
    ans: null,
    sel: null,
    menu: null,
    error: null,
    aviso: '',
    pistas: opciones.pistas,
    cfg: { angulo: 'deg', notacion: 'norm', fijo: -1 }
  };
  estado.c = { fila: estado.entrada, i: 0 };

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

  function padreActual() { return buscarPadre(estado.entrada, estado.c.fila); }

  function contar(fila) {
    var t = 0;
    fila.forEach(function (n) { t++; if (n.s) n.s.forEach(function (s) { t += contar(s); }); });
    return t;
  }

  function insertar(nodo) {
    if (contar(estado.entrada) >= 90) { avisar('La entrada ya está llena.'); return; }
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
    if (contar(estado.entrada) >= 90) { avisar('La entrada ya está llena.'); return; }
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

  function reglaAns() {
    if (!estado.entrada.length && estado.c.fila === estado.entrada && estado.ans) estado.entrada.push(K('ans'));
    if (estado.c.fila === estado.entrada && estado.c.i === 0 && estado.entrada.length === 1 && estado.entrada[0].v === 'ans') estado.c.i = 1;
  }

  function operador(v) { reglaAns(); insertar(K(v)); }

  function conversion(v) {
    reglaAns();
    var raiz = estado.entrada;
    if (raiz.length && raiz[raiz.length - 1].t === 'k' && CONVERSIONES[raiz[raiz.length - 1].v]) raiz.pop();
    raiz.push(K(v));
    estado.c = { fila: raiz, i: raiz.length };
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

  function moverVertical(dir) {
    var p = padreActual();
    if (p) {
      var t = p.nodo.t, k = p.k;
      var destino = null;
      if (t === 'frac') destino = dir > 0 ? (k === 0 ? 1 : null) : (k === 1 ? 0 : null);
      else if (t === 'mixto') destino = dir > 0 ? (k < 2 ? k + 1 : null) : (k === 2 ? 1 : null);
      else if (t === 'raizn') destino = dir > 0 ? (k === 0 ? 1 : null) : (k === 1 ? 0 : null);
      if (destino !== null) {
        var f = p.nodo.s[destino];
        estado.c = { fila: f, i: dir > 0 ? 0 : f.length };
      }
      return;
    }
    // Fuera de plantillas: recorrer el historial
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

  function limpiarEntrada() {
    estado.entrada = [];
    estado.c = { fila: estado.entrada, i: 0 };
  }

  function clonar(fila) {
    return fila.map(function (n) {
      var c = { t: n.t };
      if (n.v !== undefined) c.v = n.v;
      if (n.val) { c.val = n.val; c.html = n.html; }
      if (n.s) c.s = n.s.map(clonar);
      return c;
    });
  }

  /* ---------- Cálculo ---------- */

  function calcular() {
    if (estado.sel !== null) { pegarHistorial(); return; }
    if (!estado.entrada.length) {
      if (estado.historial.length) {
        var u = estado.historial[estado.historial.length - 1];
        estado.entrada = clonar(u.entrada);
      } else {
        return;
      }
    }
    try {
      var previo = estado.historial.length ? estado.historial[estado.historial.length - 1].modo : null;
      var r = evaluarEntrada(estado.entrada, estado.ans, estado.cfg, previo);
      var item = { entrada: clonar(estado.entrada), v: r.v, modo: r.modo, base: r.modo === 'dec' ? null : r.modo };
      estado.historial.push(item);
      if (estado.historial.length > 30) estado.historial.shift();
      estado.ans = r.v;
      limpiarEntrada();
      anunciar('Resultado: ' + formatear(r.v, r.modo, estado.cfg).texto);
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
    if (h.modo === 'pct') { avisar('Este resultado está expresado como por ciento.'); return; }
    var formas = formasAlternas(h.v);
    if (formas.length < 2) { avisar('Este resultado no tiene otra forma: solo se muestra como decimal o entero.'); return; }
    if (h.modo === 'dec') {
      if (!h.v.e) h.v = aFraccion(h.v);
      h.modo = h.base || formas[0];
    } else {
      h.modo = 'dec';
    }
    anunciar(formatear(h.v, h.modo, estado.cfg).texto);
  }

  function aproximar() {
    if (estado.entrada.length) { calcular(); if (estado.error) return; }
    var h = estado.historial[estado.historial.length - 1];
    if (!h) return;
    h.modo = 'dec';
    anunciar(formatear(h.v, 'dec', estado.cfg).texto);
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
      insertar({ t: 'k', v: 'hv', val: h.v, html: formatear(h.v, h.modo, estado.cfg).html });
    }
  }

  /* ---------- Menús ---------- */

  var MENU_PRB = [
    { titulo: 'PRB', items: [['nPr', 'nPr'], ['nCr', 'nCr'], ['!', 'fact']] },
    { titulo: 'RAND', items: [['rand', 'rand'], ['randint(', 'randint']] }
  ];

  var MENU_MODO = [
    { clave: 'angulo', ops: [['DEG', 'deg'], ['RAD', 'rad'], ['GRAD', 'grad']] },
    { clave: 'notacion', ops: [['NORM', 'norm'], ['SCI', 'sci'], ['ENG', 'eng']] },
    { clave: 'fijo', ops: [['FLOAT', -1], ['0', 0], ['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 6], ['7', 7], ['8', 8], ['9', 9]] },
    { clave: 'pantalla', ops: [['CLASSIC', 'classic'], ['MATHPRINT', 'mathprint']] }
  ];

  function valorModo(fila) {
    var m = MENU_MODO[fila];
    if (m.clave === 'pantalla') return 'mathprint';
    return estado.cfg[m.clave];
  }

  function indiceActualModo(fila) {
    var v = valorModo(fila), ops = MENU_MODO[fila].ops;
    for (var i = 0; i < ops.length; i++) if (ops[i][1] === v) return i;
    return 0;
  }

  function abrirMenu(tipo) {
    estado.sel = null;
    if (tipo === 'prb') estado.menu = { tipo: 'prb', pest: 0, sel: 0 };
    else if (tipo === 'mode') estado.menu = { tipo: 'mode', fila: 0, col: indiceActualModo(0) };
    else if (tipo === 'reset') estado.menu = { tipo: 'reset', sel: 0 };
    anunciar(tipo === 'prb' ? 'Menú de probabilidad: 1 nPr, 2 nCr, 3 factorial' :
      tipo === 'mode' ? 'Menú de modos' : 'Restablecer la calculadora: 1 No, 2 Sí');
  }

  function cerrarMenu() { estado.menu = null; }

  function elegirPrb(pest, idx) {
    var item = MENU_PRB[pest].items[idx];
    if (!item) return;
    cerrarMenu();
    var v = item[1];
    if (v === 'nPr' || v === 'nCr' || v === 'fact') operador(v);
    else if (v === 'rand') insertar(K('rand'));
    else proximamente('randint(');
  }

  function aplicarModo(fila, col) {
    var m = MENU_MODO[fila], op = m.ops[col];
    if (!op) return;
    if (m.clave === 'pantalla') {
      if (op[1] === 'classic') avisar('El modo CLASSIC estará disponible próximamente. La calculadora sigue en MATHPRINT, que es como viene la del examen.');
      return;
    }
    estado.cfg[m.clave] = op[1];
    anunciar(op[0] + ' seleccionado');
  }

  function elegirReset(si) {
    cerrarMenu();
    if (!si) return;
    estado.historial = [];
    estado.ans = null;
    estado.cfg = { angulo: 'deg', notacion: 'norm', fijo: -1 };
    limpiarEntrada();
    avisar('Calculadora restablecida.');
  }

  function teclaMenu(id, segunda) {
    var m = estado.menu;
    if (id === 'clear' || (segunda && id === 'mode') || (!segunda && id === m.tipo)) { cerrarMenu(); return; }
    if (m.tipo === 'prb') {
      var items = MENU_PRB[m.pest].items;
      if (id === 'left' || id === 'right') { m.pest = 1 - m.pest; m.sel = 0; return; }
      if (id === 'up') { m.sel = (m.sel + items.length - 1) % items.length; return; }
      if (id === 'down') { m.sel = (m.sel + 1) % items.length; return; }
      if (id === 'enter') { elegirPrb(m.pest, m.sel); return; }
      if (/^[1-9]$/.test(id)) { elegirPrb(m.pest, Number(id) - 1); return; }
      return;
    }
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
    if (m.tipo === 'reset') {
      if (id === 'up' || id === 'down') { m.sel = 1 - m.sel; return; }
      if (id === '1') { elegirReset(false); return; }
      if (id === '2') { elegirReset(true); return; }
      if (id === 'enter') { elegirReset(m.sel === 1); return; }
    }
  }

  /* ---------- Pulsar una tecla ---------- */

  var NOMBRES = {
    data: 'data (editor de datos)', stat: 'stat (estadística)', table: 'table (tabla de valores)',
    xvar: 'variables x, y, z, t, a, b, c', sto: 'sto→ (guardar en variable)', recall: 'recall',
    clearvar: 'clear var', K: 'K (constante)', hyp: 'hyp (hiperbólicas)', angle: 'angle (ángulos)',
    coma: 'la coma', 'randint(': 'randint('
  };

  function proximamente(clave) {
    avisar('La función ' + (NOMBRES[clave] || clave) + ' estará disponible próximamente.');
  }

  function avisar(texto) {
    estado.aviso = texto;
    anunciar(texto);
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () { estado.aviso = ''; mostrar(); }, 5000);
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

    if (id === 'on' && !segunda) { estado.error = null; cerrarMenu(); estado.sel = null; limpiarEntrada(); mostrar(); return; }
    if (id === 'on' && segunda) { cerrar(); return; }

    if (estado.error) {
      estado.error = null;
      if (id === 'clear' || id === 'left' || id === 'right' || id === 'delete' || id === 'enter') { mostrar(); return; }
    }
    if (estado.menu) { teclaMenu(id, segunda); mostrar(); return; }
    if (estado.sel !== null && id !== 'up' && id !== 'down' && id !== 'enter') estado.sel = null;

    if (segunda) ejecutar2nd(id);
    else ejecutar(id);
    mostrar();
  }

  function ejecutar(id) {
    if (/^[0-9.]$/.test(id)) { insertar(K(id)); return; }
    switch (id) {
      case '+': case '-': case '*': case '/': operador(id); return;
      case '(': case ')': insertar(K(id)); return;
      case 'neg': insertar(K('neg')); return;
      case 'pi': insertar(K('pi')); return;
      case 'sq': operador('sq'); return;
      case 'inv': operador('inv'); return;
      case 'pot': insertarPlantilla('pot'); return;
      case 'nd': insertarPlantilla('frac'); return;
      case 'x10': insertarPlantilla('sci'); return;
      case 'log': insertar(K('log(')); return;
      case 'ln': insertar(K('ln(')); return;
      case 'sin': case 'cos': case 'tan': insertar(K(id + '(')); return;
      case 'prb': abrirMenu('prb'); return;
      case 'mode': abrirMenu('mode'); return;
      case 'clear':
        if (estado.entrada.length) limpiarEntrada();
        else { estado.historial = []; }
        return;
      case 'delete': borrar(); return;
      case 'enter': calcular(); return;
      case 'toggle': alternarResultado(); return;
      case 'left': izquierda(); return;
      case 'right': derecha(); return;
      case 'up': moverVertical(-1); return;
      case 'down': moverVertical(1); return;
      case 'data': case 'table': case 'xvar': case 'sto': proximamente(id); return;
    }
  }

  function ejecutar2nd(id) {
    switch (id) {
      case 'mode': return;                                   // quit
      case 'delete': avisar('La calculadora siempre inserta lo que escribes donde está el cursor.'); return;
      case 'log': insertarPlantilla('diez'); return;
      case 'ln': insertarPlantilla('expe'); return;
      case 'prb': proximamente('angle'); return;
      case 'data': proximamente('stat'); return;
      case 'nd': insertarPlantilla('mixto'); return;
      case 'table': conversion('toFD'); return;
      case 'pi': proximamente('hyp'); return;
      case 'sin': case 'cos': case 'tan': insertar(K('a' + id + '(')); return;
      case '/': proximamente('K'); return;
      case 'pot': insertarPlantilla('raizn'); return;
      case 'inv': conversion('toUnd'); return;
      case '(': operador('pct'); return;
      case ')': conversion('toPct'); return;
      case 'sq': insertarPlantilla('raiz2'); return;
      case 'xvar': proximamente('recall'); return;
      case 'sto': proximamente('clearvar'); return;
      case 'toggle': aproximar(); return;
      case '0': abrirMenu('reset'); return;
      case '.': proximamente('coma'); return;
      case 'neg': insertar(K('ans')); return;
      default: ejecutar(id);
    }
  }

  /* ---------- Dibujar la pantalla ---------- */

  function htmlFila(fila) {
    var c = estado.c, activa = !estado.menu && !estado.error && estado.sel === null;
    if (!fila.length) {
      if (fila === estado.entrada) return activa ? '<span class="gti-cur"></span>' : '';
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
    if (n.t === 'k') return n.v === 'hv' ? n.html : (SIMBOLO[n.v] !== undefined ? SIMBOLO[n.v] : n.v);
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
    est += '<span>' + NOMBRE_ANGULO[cfg.angulo] + '</span>';
    if (cfg.notacion !== 'norm') est += '<span>' + cfg.notacion.toUpperCase() + '</span>';
    if (cfg.fijo >= 0) est += '<span>FIX</span>';
    var hayMas = estado.historial.length && (estado.sel === null || estado.sel > 0);
    est += '<span class="gti-flechas">' + (hayMas ? '▲' : '') + (estado.sel !== null ? '▼' : '') + '</span>';
    lcdEstado.innerHTML = est;

    if (estado.error) {
      lcdLineas.innerHTML = '<div class="gti-error">' + estado.error.ti + '<small>clear: volver · ◄ ►: corregir</small></div>';
    } else if (estado.menu) {
      lcdLineas.innerHTML = htmlMenu();
      enlazarMenu();
    } else {
      var html = '';
      var desde = Math.max(0, estado.historial.length - 6);
      for (var i = desde; i < estado.historial.length; i++) {
        var h = estado.historial[i];
        html += '<div class="gti-l' + (estado.sel === i * 2 ? ' gti-sel' : '') + '">' + htmlFilaFija(h.entrada) + '</div>';
        html += '<div class="gti-l gti-res' + (estado.sel === i * 2 + 1 ? ' gti-sel' : '') + '">' + formatear(h.v, h.modo, cfg).html + '</div>';
      }
      html += '<div class="gti-l gti-actual">' + htmlFila(estado.entrada) + '</div>';
      lcdLineas.innerHTML = html;
      var sel = lcdLineas.querySelector('.gti-sel');
      if (sel) {
        var top = sel.offsetTop - lcdLineas.offsetTop;
        lcdLineas.scrollTop = Math.max(0, top - 10);
      } else {
        lcdLineas.scrollTop = lcdLineas.scrollHeight;
      }
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

  function htmlMenu() {
    var m = estado.menu, h = '<div class="gti-menu">';
    if (m.tipo === 'prb') {
      h += '<div class="gti-pest">';
      MENU_PRB.forEach(function (p, i) {
        h += '<button type="button" tabindex="-1" data-pest="' + i + '" class="' + (i === m.pest ? 'gti-on' : '') + '">' + p.titulo + '</button>';
      });
      h += '</div>';
      MENU_PRB[m.pest].items.forEach(function (it, i) {
        h += '<div><button type="button" data-prb="' + i + '" class="' + (i === m.sel ? 'gti-on' : '') + '">' + (i + 1) + ':' + it[0] + '</button></div>';
      });
    } else if (m.tipo === 'mode') {
      MENU_MODO.forEach(function (fila, f) {
        var actual = indiceActualModo(f);
        h += '<div class="gti-mfila' + (f === 2 ? ' gti-dig' : '') + '">';
        fila.ops.forEach(function (op, c) {
          var cls = (c === actual ? 'gti-on' : '') + (f === m.fila && c === m.col ? ' gti-foco' : '');
          h += '<button type="button" data-mf="' + f + '" data-mc="' + c + '" class="' + cls + '" aria-pressed="' + (c === actual) + '">' + op[0] + '</button>';
        });
        h += '</div>';
      });
    } else if (m.tipo === 'reset') {
      h += '<div>RESET?</div>';
      h += '<div><button type="button" data-rs="0" class="' + (m.sel === 0 ? 'gti-on' : '') + '">1:No</button></div>';
      h += '<div><button type="button" data-rs="1" class="' + (m.sel === 1 ? 'gti-on' : '') + '">2:Yes</button></div>';
    }
    return h + '</div>';
  }

  function enlazarMenu() {
    lcdLineas.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = estado.menu;
        if (!m) return;
        if (b.hasAttribute('data-pest')) { m.pest = Number(b.getAttribute('data-pest')); m.sel = 0; }
        else if (b.hasAttribute('data-prb')) elegirPrb(m.pest, Number(b.getAttribute('data-prb')));
        else if (b.hasAttribute('data-mf')) {
          m.fila = Number(b.getAttribute('data-mf'));
          m.col = Number(b.getAttribute('data-mc'));
          aplicarModo(m.fila, m.col);
        } else if (b.hasAttribute('data-rs')) elegirReset(b.getAttribute('data-rs') === '1');
        mostrar();
      });
    });
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
    if (estado.error) return '<b>' + estado.error.es + '.</b> Pulsa clear para volver a tu cálculo y corregirlo.';
    if (!estado.pistas) return '';
    if (estado.s2) return '<b>2nd activa:</b> la próxima tecla hace la función escrita en verde encima de ella.';
    var m = estado.menu;
    if (m) {
      if (m.tipo === 'prb') return 'Elige con el número de la opción (1, 2 o 3) o con ▲ ▼ y enter. ◄ ► cambian de pestaña. <b>clear</b> sale del menú.';
      if (m.tipo === 'mode') return 'Muévete con las flechas y pulsa <b>enter</b> para elegir. <b>clear</b> sale del menú.';
      return 'Pulsa 1 para cancelar o 2 para restablecer.';
    }
    if (estado.sel !== null) return '▲ ▼ recorren los cálculos anteriores. <b>enter</b> copia el seleccionado en la línea de entrada.';
    var p = padreActual();
    if (p && PISTA_HUECO[p.nodo.t]) return PISTA_HUECO[p.nodo.t][p.k];
    var e = estado.entrada;
    if (e.length) {
      for (var i = 0; i < e.length; i++) {
        if (e[i].v === 'nPr' || e[i].v === 'nCr') return 'Escribe el segundo número (r) y pulsa <b>enter</b>.';
      }
      return 'Pulsa <b>enter</b> para calcular.';
    }
    var h = estado.historial[estado.historial.length - 1];
    if (h) {
      if (racional(h.v) && h.v.d !== 1n && h.modo !== 'pct') {
        return '<b>⟷</b> alterna fracción y decimal. Para verlo como número mixto: <b>2nd</b> <b>x⁻¹</b> (n/d◂▸Un/d) y <b>enter</b>.';
      }
      if (h.v.e && !racional(h.v) && h.modo !== 'pct') return '<b>⟷</b> alterna entre la forma exacta y el decimal.';
    }
    return '';
  }

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
      '<p class="gti-paso">Si empiezas un cálculo con una operación (' + kb('+') + ' ' + kb('×') + ' ' + kb('x<sup>2</sup>') + '…), la calculadora escribe <b>Ans</b> (el resultado anterior) delante.</p>' +
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
      '<p class="gti-paso">Para un número negativo usa ' + kn('(−)') + ', no la resta ' + kb('−') + '.</p>' +
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
    ['modos', 'Modos y errores',
      '<p class="gti-paso">' + kb('mode') + ' abre los modos. Lo normal para el GED es <b>DEG</b>, <b>NORM</b>, <b>FLOAT</b> y <b>MATHPRINT</b>. ' + k2('0') + ' (reset) devuelve todo a como venía.</p>' +
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
    colocar(v, window.innerWidth - ancho - 12, top);
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
        var x = abierta() ? ventana.offsetLeft - hoja.offsetWidth - 10 : window.innerWidth - hoja.offsetWidth - 12;
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
    try { localStorage.setItem(clave, JSON.stringify({ x: v.offsetLeft, y: v.offsetTop })); } catch (e) { /* sin almacenamiento */ }
  }

  function leerPosicion(clave) {
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
    _error: function () { return estado.error; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', construir);
  else construir();

})(typeof window !== 'undefined' ? window : globalThis);
