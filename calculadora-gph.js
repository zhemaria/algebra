/*!
 * Calculadora científica GPH v1.0 — GEDparaHispanos
 * José M. Fernández, ABE/ASE Math Master Teacher, Harry S. Truman College — City Colleges of Chicago
 * Licencia: CC BY-NC-SA 4.0 — https://creativecommons.org/licenses/by-nc-sa/4.0/deed.es
 *
 * Uso: agregar antes de </body>
 *   <script src="https://zhemaria.github.io/algebra/calculadora-gph.js" defer></script>
 * Opciones (atributos del <script>):
 *   data-color="#0e7490"  color de acento (debe contrastar con texto blanco)
 *   data-boton="no"       oculta el botón flotante; se abre con cualquier
 *                         elemento que tenga el atributo data-gph-calculadora
 */
(function (global) {
  'use strict';

  /* ==========================================================
     1. MOTOR MATEMÁTICO
     Valores exactos {e:true, n, d} (fracciones con BigInt)
     o aproximados {e:false, v} (números decimales).
     ========================================================== */

  function errorGPH(mensaje) {
    var e = new Error(mensaje);
    e.gph = true;
    return e;
  }

  function absB(a) { return a < 0n ? -a : a; }

  function mcd(a, b) {
    a = absB(a); b = absB(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a;
  }

  function Q(n, d) {
    if (d === undefined) d = 1n;
    if (d === 0n) throw errorGPH('División entre cero');
    if (d < 0n) { n = -n; d = -d; }
    var g = mcd(n, d) || 1n;
    return { e: true, n: n / g, d: d / g };
  }

  function F(v) {
    if (!isFinite(v)) {
      throw errorGPH(isNaN(v) ? 'Operación no válida' : 'Número demasiado grande');
    }
    return { e: false, v: v };
  }

  function aNumero(x) { return x.e ? Number(x.n) / Number(x.d) : x.v; }

  function limitar(x) {
    if (x.e && (x.n.toString().length > 300 || x.d.toString().length > 300)) {
      return F(aNumero(x));
    }
    return x;
  }

  function esEntero(x) { return x.e && x.d === 1n; }
  function esCero(x) { return x.e ? x.n === 0n : x.v === 0; }

  function sumar(a, b) {
    return (a.e && b.e) ? limitar(Q(a.n * b.d + b.n * a.d, a.d * b.d)) : F(aNumero(a) + aNumero(b));
  }
  function opuesto(a) { return a.e ? Q(-a.n, a.d) : F(-a.v); }
  function restar(a, b) { return sumar(a, opuesto(b)); }
  function multiplicar(a, b) {
    return (a.e && b.e) ? limitar(Q(a.n * b.n, a.d * b.d)) : F(aNumero(a) * aNumero(b));
  }
  function dividir(a, b) {
    if (esCero(b)) throw errorGPH('División entre cero');
    return (a.e && b.e) ? limitar(Q(a.n * b.d, a.d * b.n)) : F(aNumero(a) / aNumero(b));
  }

  function potenciaEntera(a, k) {
    if (k === 0n) {
      if (a.n === 0n) throw errorGPH('0 elevado a 0 no está definido');
      return Q(1n);
    }
    var negativo = k < 0n;
    if (negativo) {
      if (a.n === 0n) throw errorGPH('División entre cero');
      k = -k;
    }
    var tamano = (a.n.toString().length + a.d.toString().length) * Number(k);
    if (tamano > 600) return F(Math.pow(aNumero(a), Number(negativo ? -k : k)));
    var r = Q(a.n ** k, a.d ** k);
    return negativo ? Q(r.d, r.n) : r;
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
    if (a.e && esEntero(b)) return potenciaEntera(a, b.n);
    if (a.e && b.e && b.d <= 64n) {
      var q = Number(b.d), p = b.n;
      if (a.n < 0n && q % 2 === 0) throw errorGPH('Raíz par de un número negativo');
      var rn = raizEnteraExacta(absB(a.n), q), rd = raizEnteraExacta(a.d, q);
      if (rn !== null && rd !== null) {
        return potenciaEntera(Q(a.n < 0n ? -rn : rn, rd), p);
      }
      var bv = aNumero(a), ev = aNumero(b);
      if (bv < 0) {
        var m = Math.pow(-bv, ev);
        return F(p % 2n === 0n ? m : -m);
      }
      return F(Math.pow(bv, ev));
    }
    var x = aNumero(a), y = aNumero(b);
    if (x < 0 && !Number.isInteger(y)) {
      throw errorGPH('Base negativa con exponente decimal');
    }
    return F(Math.pow(x, y));
  }

  function enteroNoNegativo(x, mensaje) {
    if (!esEntero(x) || x.n < 0n) throw errorGPH(mensaje);
    if (x.n > 1000n) throw errorGPH('Número demasiado grande');
    return x.n;
  }

  function factorialB(n) {
    var r = 1n;
    for (var k = 2n; k <= n; k++) r *= k;
    return r;
  }

  function factorial(x) {
    var n = enteroNoNegativo(x, 'El factorial solo se aplica a enteros no negativos');
    return limitar(Q(factorialB(n)));
  }

  function permutaciones(a, b) {
    var n = enteroNoNegativo(a, 'nPr necesita números enteros no negativos');
    var r = enteroNoNegativo(b, 'nPr necesita números enteros no negativos');
    if (r > n) throw errorGPH('En nPr, el segundo número no puede ser mayor que el primero');
    var p = 1n;
    for (var k = n - r + 1n; k <= n; k++) p *= k;
    return limitar(Q(p));
  }

  function combinaciones(a, b) {
    var n = enteroNoNegativo(a, 'nCr necesita números enteros no negativos');
    var r = enteroNoNegativo(b, 'nCr necesita números enteros no negativos');
    if (r > n) throw errorGPH('En nCr, el segundo número no puede ser mayor que el primero');
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
    if (x.e ? x.n <= 0n : x.v <= 0) throw errorGPH('El logaritmo solo existe para números positivos');
    if (x.e) {
      if (x.d === 1n) { var k = potenciaDeDiez(x.n); if (k >= 0) return Q(BigInt(k)); }
      if (x.n === 1n) { var j = potenciaDeDiez(x.d); if (j >= 0) return Q(BigInt(-j)); }
    }
    return F(Math.log10(aNumero(x)));
  }

  /* ---------- Análisis de la expresión ---------- */
  // Códigos internos:  0-9 .  + - * / ^ ( )  ² %  ~ (negativo)
  //   E (×10ⁿ)  _ (número mixto)  π  A (Ans)  √ (raíz cuadrada)  R (raíz enésima)
  //   ! (factorial)  P (nPr)  C (nCr)  L (log)  T (10 elevado a)

  function tokenizar(s, ans, info) {
    var t = [], i = 0;

    function leerEntero() {
      var j = i;
      while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
      return s.slice(j, i);
    }

    function leerDecimal() {
      var j = i;
      while (i < s.length && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) i++;
      var txt = s.slice(j, i);
      if ((txt.match(/\./g) || []).length > 1 || txt === '.') throw errorGPH('Número mal escrito');
      if (txt.indexOf('.') >= 0) info.usoDecimal = true;
      var partes = txt.split('.');
      var ent = partes[0] || '0', dec = partes[1] || '';
      return Q(BigInt(ent + dec), 10n ** BigInt(dec.length));
    }

    while (i < s.length) {
      var c = s[i];
      if ((c >= '0' && c <= '9') || c === '.') {
        var v = leerDecimal();
        if (s[i] === '_') {
          if (!esEntero(v)) throw errorGPH('La parte entera del número mixto no puede ser decimal');
          i++;
          var nu = leerEntero();
          if (!nu || s[i] !== '/') throw errorGPH('Número mixto incompleto');
          i++;
          var de = leerEntero();
          if (!de) throw errorGPH('Número mixto incompleto');
          if (BigInt(de) === 0n) throw errorGPH('División entre cero');
          v = sumar(v, Q(BigInt(nu), BigInt(de)));
          info.usoMixto = true;
        }
        if (s[i] === 'E') {
          i++;
          var signo = 1n;
          if (s[i] === '~' || s[i] === '-') { signo = -1n; i++; }
          var ex = leerEntero();
          if (!ex) throw errorGPH('Falta el exponente de 10');
          v = multiplicar(v, potenciaEntera(Q(10n), signo * BigInt(ex)));
          info.usoCientifica = true;
        }
        t.push({ k: 'n', v: v });
        continue;
      }
      if (c === 'π') { t.push({ k: 'n', v: F(Math.PI) }); i++; continue; }
      if (c === 'A') { t.push({ k: 'n', v: ans || Q(0n) }); i++; continue; }
      if (c === 'E') throw errorGPH('Escribe un número antes de ×10ⁿ');
      if (c === '_') throw errorGPH('Escribe la parte entera antes de a b/c');
      if ('+-*/^()²%~√R!PCLT'.indexOf(c) >= 0) { t.push({ k: c }); i++; continue; }
      throw errorGPH('Error de sintaxis');
    }
    return t;
  }

  function analizar(tokens) {
    var i = 0;
    function ver() { return tokens[i]; }
    function tomar() { return tokens[i++]; }
    function es(k) { var x = ver(); return x && x.k === k; }
    function iniciaPrimario(x) { return x && (x.k === 'n' || x.k === '(' || x.k === '√' || x.k === 'L' || x.k === 'T'); }

    function expresion() {
      var v = termino();
      while (es('+') || es('-')) {
        var op = tomar().k;
        var r = termino();
        v = op === '+' ? sumar(v, r) : restar(v, r);
      }
      return v;
    }

    function termino() {
      var v = unario();
      for (;;) {
        if (es('*') || es('/')) {
          var op = tomar().k;
          var r = unario();
          v = op === '*' ? multiplicar(v, r) : dividir(v, r);
        } else if (iniciaPrimario(ver())) {
          v = multiplicar(v, potenciaNivel());
        } else {
          break;
        }
      }
      return v;
    }

    function unario() {
      if (es('-') || es('~')) { tomar(); return opuesto(unario()); }
      return potenciaNivel();
    }

    function potenciaNivel() {
      var b = posfijo();
      if (es('^')) { tomar(); return potencia(b, unario()); }
      if (es('R')) {
        tomar();
        var radicando = unario();
        if (esCero(b)) throw errorGPH('El índice de la raíz no puede ser 0');
        return potencia(radicando, dividir(Q(1n), b));
      }
      if (es('P')) { tomar(); return permutaciones(b, unario()); }
      if (es('C')) { tomar(); return combinaciones(b, unario()); }
      return b;
    }

    function posfijo() {
      var v = primario();
      for (;;) {
        if (es('²')) { tomar(); v = potencia(v, Q(2n)); }
        else if (es('%')) { tomar(); v = dividir(v, Q(100n)); }
        else if (es('!')) { tomar(); v = factorial(v); }
        else break;
      }
      return v;
    }

    function primario() {
      var x = tomar();
      if (!x) throw errorGPH('Falta un número');
      if (x.k === 'n') return x.v;
      if (x.k === '(') {
        var v = expresion();
        if (es(')')) tomar();
        return v;
      }
      if (x.k === '√') {
        var r = primario();
        if (r.e ? r.n < 0n : r.v < 0) throw errorGPH('Raíz cuadrada de un número negativo');
        return potencia(r, Q(1n, 2n));
      }
      if (x.k === 'L') return logaritmo(primario());
      if (x.k === 'T') return potencia(Q(10n), primario());
      if (x.k === ')') throw errorGPH('Sobra un paréntesis');
      throw errorGPH('Error de sintaxis');
    }

    var resultado = expresion();
    if (i < tokens.length) {
      throw errorGPH(tokens[i].k === ')' ? 'Sobra un paréntesis' : 'Error de sintaxis');
    }
    return resultado;
  }

  function evaluar(cadena, ans) {
    var info = { usoDecimal: false, usoMixto: false, usoCientifica: false };
    var tokens = tokenizar(cadena, ans, info);
    if (!tokens.length) throw errorGPH('Falta un número');
    var v = analizar(tokens);
    if (v.e && esCero(v)) v = Q(0n);
    if (!v.e && Object.is(v.v, -0)) v = F(0);
    return { v: v, info: info };
  }

  /* ---------- Presentación del resultado ---------- */

  function signoBonito(s) { return s.replace(/-/g, '−'); }

  function formatoDecimal(x) {
    if (x === 0) return { html: '0', texto: '0' };
    var a = Math.abs(x);
    if (a >= 1e10 || a < 1e-6) {
      var partes = x.toExponential(9).split('e');
      var m = String(parseFloat(partes[0]));
      var ex = String(Number(partes[1]));
      return {
        html: signoBonito(m) + ' × 10<sup>' + signoBonito(ex) + '</sup>',
        texto: signoBonito(m) + ' por 10 a la ' + signoBonito(ex)
      };
    }
    var r = String(parseFloat(x.toPrecision(10)));
    return { html: signoBonito(r), texto: signoBonito(r) };
  }

  function fraccionHTML(n, d) {
    return '<span class="gphc-fr" aria-hidden="true"><span class="gphc-fr-n">' + n +
      '</span><span class="gphc-fr-d">' + d + '</span></span>';
  }

  function modosDisponibles(v) {
    if (!v.e || v.d === 1n) return ['dec'];
    var m = ['frac'];
    if (absB(v.n) > v.d) m.push('mixto');
    m.push('dec');
    return m;
  }

  function formatear(v, modo) {
    if (!v.e) return formatoDecimal(v.v);
    if (v.d === 1n) {
      var s = v.n.toString();
      if (s.replace('-', '').length > 12) return formatoDecimal(aNumero(v));
      return { html: signoBonito(s), texto: signoBonito(s) };
    }
    var signo = v.n < 0n ? '−' : '';
    var n = absB(v.n), d = v.d;
    if (modo === 'frac') {
      return {
        html: signo + fraccionHTML(n.toString(), d.toString()),
        texto: signo + n + '/' + d
      };
    }
    if (modo === 'mixto' && n > d) {
      var entero = n / d, resto = n % d;
      return {
        html: signo + entero + '&nbsp;' + fraccionHTML(resto.toString(), d.toString()),
        texto: signo + entero + ' y ' + resto + '/' + d
      };
    }
    return formatoDecimal(aNumero(v));
  }

  var motor = {
    evaluar: evaluar,
    formatear: formatear,
    modosDisponibles: modosDisponibles
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = motor;
  if (typeof document === 'undefined') return;

  /* ==========================================================
     2. INTERFAZ
     ========================================================== */

  var guion = document.currentScript;
  var opciones = {
    color: (guion && guion.getAttribute('data-color')) || '#0e7490',
    boton: !(guion && guion.getAttribute('data-boton') === 'no')
  };

  var CSS = [
    '#gphc{--gphc-acento:' + opciones.color + ';position:fixed;z-index:2147483000;width:316px;max-width:calc(100vw - 16px);',
    'background:#1e293b;border-radius:18px;box-shadow:0 12px 36px rgba(0,0,0,.45);font-family:"Segoe UI",Tahoma,Arial,sans-serif;',
    'color:#f8fafc;display:none;box-sizing:border-box;line-height:1.3;user-select:none;-webkit-user-select:none}',
    '#gphc *{box-sizing:border-box}',
    '#gphc.gphc-abierta{display:block}',
    '#gphc .gphc-cab{display:flex;align-items:center;gap:6px;background:var(--gphc-acento);color:#fff;border-radius:18px 18px 0 0;',
    'padding:8px 10px 8px 14px;cursor:grab;touch-action:none}',
    '#gphc .gphc-cab:active{cursor:grabbing}',
    '#gphc .gphc-cab:focus-visible{outline:3px solid #fbbf24;outline-offset:-3px}',
    '#gphc .gphc-titulo{flex:1;font-weight:700;font-size:15px;letter-spacing:.3px}',
    '#gphc .gphc-agarre{font-size:13px;opacity:.9;margin-right:2px}',
    '#gphc .gphc-cab button{width:30px;height:30px;border-radius:50%;border:2px solid rgba(255,255,255,.85);background:transparent;',
    'color:#fff;font-size:15px;font-weight:700;cursor:pointer;padding:0;line-height:1}',
    '#gphc .gphc-cab button:hover,#gphc .gphc-cab button:focus-visible{background:#fff;color:#0f172a;outline:none}',
    '#gphc .gphc-cuerpo{padding:12px}',
    '#gphc .gphc-pantalla{background:#0b1220;border-radius:10px;padding:8px 12px;min-height:118px;display:flex;flex-direction:column;',
    'justify-content:flex-end;margin-bottom:10px;border:1px solid #334155}',
    '#gphc .gphc-hist{max-height:58px;overflow-y:auto;font-size:13px;color:#cbd5e1}',
    '#gphc .gphc-hist div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed #334155;padding:2px 0}',
    '#gphc .gphc-hist .gphc-hr{color:#f8fafc;font-weight:600}',
    '#gphc .gphc-entrada{font-size:19px;min-height:28px;word-break:break-all;color:#f8fafc;margin-top:4px;font-family:Consolas,"Courier New",monospace}',
    '#gphc .gphc-entrada.gphc-previa{color:#cbd5e1}',
    '#gphc .gphc-cursor{display:inline-block;width:2px;height:20px;background:#fbbf24;vertical-align:middle;margin-left:1px;animation:gphcParp 1s steps(1) infinite}',
    '@keyframes gphcParp{50%{opacity:0}}',
    '#gphc .gphc-res{font-size:26px;font-weight:700;text-align:right;min-height:36px;color:#fff;display:flex;justify-content:flex-end;align-items:center;gap:2px}',
    '#gphc .gphc-res.gphc-error{font-size:15px;color:#fca5a5;font-weight:600}',
    '#gphc .gphc-res sup{font-size:.6em}',
    '#gphc .gphc-entrada sup{font-size:.7em}',
    '#gphc .gphc-fr{display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;font-size:.78em;line-height:1.05;margin:0 2px}',
    '#gphc .gphc-fr-n{border-bottom:2px solid currentColor;padding:0 3px}',
    '#gphc .gphc-fr-d{padding:0 3px}',
    '#gphc .gphc-modo{font-size:11px;color:#cbd5e1;text-align:right;min-height:14px}',
    '#gphc .gphc-pc{font-size:.8em;margin:0 1px;color:#93c5fd}',
    '#gphc .gphc-mixsep{color:#94a3b8;font-family:"Segoe UI",Arial,sans-serif;font-size:.8em}',
    '#gphc .gphc-teclas{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}',
    '#gphc .gphc-tecla{height:44px;border:none;border-radius:10px;font-size:17px;font-weight:600;cursor:pointer;',
    'font-family:"Segoe UI",Arial,sans-serif;box-shadow:0 2px 0 rgba(0,0,0,.35);padding:0;transition:transform .05s}',
    '#gphc .gphc-tecla:active{transform:translateY(2px);box-shadow:none}',
    '#gphc .gphc-tecla:focus-visible{outline:3px solid #fbbf24;outline-offset:1px}',
    '#gphc .gphc-tecla sup{font-size:.65em}',
    '#gphc .gphc-num{background:#f1f5f9;color:#0f172a;font-size:19px}',
    '#gphc .gphc-op{background:var(--gphc-acento);color:#fff;font-size:20px}',
    '#gphc .gphc-fun{background:#475569;color:#fff;font-size:15px}',
    '#gphc .gphc-ctl{background:#9f1239;color:#fff;font-size:15px}',
    '#gphc .gphc-igual{background:#fbbf24;color:#1f2937;font-size:22px;grid-column:span 5}',
    '#gphc .gphc-ayuda{display:none;background:#0b1220;border:1px solid #334155;border-radius:10px;padding:10px 12px;margin-bottom:10px;',
    'font-size:13px;color:#e2e8f0;max-height:220px;overflow-y:auto;user-select:text;-webkit-user-select:text}',
    '#gphc .gphc-ayuda.gphc-visible{display:block}',
    '#gphc .gphc-ayuda h3{font-size:14px;margin:0 0 6px;color:#fff}',
    '#gphc .gphc-ayuda ul{margin:0;padding-left:18px}',
    '#gphc .gphc-ayuda li{margin-bottom:5px}',
    '#gphc .gphc-ayuda kbd{background:#334155;border-radius:4px;padding:0 5px;font-family:inherit;color:#fff;white-space:nowrap}',
    '#gphc-lanzador{position:fixed;right:18px;bottom:18px;z-index:2147482999;background:' + opciones.color + ';color:#fff;border:none;',
    'border-radius:30px;padding:12px 20px;font-size:16px;font-weight:700;font-family:"Segoe UI",Arial,sans-serif;cursor:pointer;',
    'box-shadow:0 6px 18px rgba(0,0,0,.3)}',
    '#gphc-lanzador:hover{filter:brightness(1.1)}',
    '#gphc-lanzador:focus-visible{outline:3px solid #fbbf24;outline-offset:2px}',
    '.gphc-solo-lector{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '@media print{#gphc,#gphc-lanzador{display:none!important}}'
  ].join('');

  // [etiqueta, aria-label, clase, código interno, texto en pantalla, acción]
  var TECLAS = [
    ['F⇔D', 'Cambiar entre fracción, número mixto y decimal', 'fun', null, null, 'fd'],
    ['Ans', 'Respuesta anterior', 'fun', 'A', 'Ans'],
    ['(', 'Abrir paréntesis', 'fun', '(', '('],
    [')', 'Cerrar paréntesis', 'fun', ')', ')'],
    ['⌫', 'Borrar lo último', 'ctl', null, null, 'borrar'],

    ['x<sup>2</sup>', 'Al cuadrado', 'fun', '²', '²'],
    ['x<sup>y</sup>', 'Elevar a una potencia', 'fun', '^', '^'],
    ['√', 'Raíz cuadrada', 'fun', '√(', '√('],
    ['<sup>x</sup>√', 'Raíz con índice: primero el índice, luego el número', 'fun', 'R', '<sup>x</sup>√'],
    ['AC', 'Borrar todo', 'ctl', null, null, 'todo'],

    ['n!', 'Factorial', 'fun', '!', '!'],
    ['nPr', 'Permutaciones: primero n, luego r', 'fun', 'P', '<span class="gphc-pc">P</span>'],
    ['nCr', 'Combinaciones: primero n, luego r', 'fun', 'C', '<span class="gphc-pc">C</span>'],
    ['log', 'Logaritmo base 10', 'fun', 'L(', 'log('],
    ['10<sup>x</sup>', 'Diez elevado a', 'fun', 'T(', '10^('],

    ['7', '7', 'num', '7', '7'],
    ['8', '8', 'num', '8', '8'],
    ['9', '9', 'num', '9', '9'],
    ['÷', 'Entre', 'op', '/', '÷'],
    ['π', 'Pi', 'fun', 'π', 'π'],

    ['4', '4', 'num', '4', '4'],
    ['5', '5', 'num', '5', '5'],
    ['6', '6', 'num', '6', '6'],
    ['×', 'Por', 'op', '*', '×'],
    ['%', 'Por ciento', 'fun', '%', '%'],

    ['1', '1', 'num', '1', '1'],
    ['2', '2', 'num', '2', '2'],
    ['3', '3', 'num', '3', '3'],
    ['−', 'Menos', 'op', '-', '−'],
    ['×10<sup>n</sup>', 'Por diez elevado a', 'fun', 'E', '×10^'],

    ['0', '0', 'num', '0', '0'],
    ['.', 'Punto decimal', 'num', '.', '.'],
    ['(−)', 'Número negativo', 'fun', '~', '−'],
    ['+', 'Más', 'op', '+', '+'],
    ['a <sup>b</sup>/<sub>c</sub>', 'Número mixto: entero, luego numerador entre denominador', 'fun', '_', ' y '],

    ['=', 'Igual', 'igual', null, null, 'igual']
  ];

  var USAN_ANS = '+-*/^²%RE!PC';

  var estado = {
    piezas: [],
    ans: null,
    resultado: null,
    modo: 'dec',
    previa: '',
    error: '',
    historial: []
  };

  var caja, pantallaHist, pantallaEnt, pantallaRes, pantallaModo, anuncio, ayuda, lanzador, cabecera;
  var ultimoFoco = null;

  function crear(tag, attrs, html) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (html !== undefined) el.innerHTML = html;
    return el;
  }

  function construir() {
    var estilo = crear('style', { id: 'gphc-estilos' });
    estilo.textContent = CSS;
    document.head.appendChild(estilo);

    caja = crear('div', { id: 'gphc', role: 'dialog', 'aria-label': 'Calculadora científica GPH', tabindex: '-1' });

    cabecera = crear('div', {
      'class': 'gphc-cab',
      tabindex: '0',
      'aria-label': 'Barra para mover la calculadora. Arrástrala con el ratón o usa las flechas del teclado.'
    });
    cabecera.innerHTML =
      '<span class="gphc-agarre" aria-hidden="true">⠿</span>' +
      '<span class="gphc-titulo">Calculadora GPH</span>';
    var btnAyuda = crear('button', { type: 'button', 'aria-label': 'Ayuda de la calculadora', 'aria-expanded': 'false', title: 'Ayuda' }, '?');
    var btnCerrar = crear('button', { type: 'button', 'aria-label': 'Cerrar la calculadora', title: 'Cerrar' }, '✕');
    cabecera.appendChild(btnAyuda);
    cabecera.appendChild(btnCerrar);

    var cuerpo = crear('div', { 'class': 'gphc-cuerpo' });

    ayuda = crear('div', { 'class': 'gphc-ayuda', id: 'gphc-ayuda' },
      '<h3>Cómo usar la calculadora</h3><ul>' +
      '<li><strong>Número mixto</strong> (2 y 1/3): <kbd>2</kbd> <kbd>a b/c</kbd> <kbd>1</kbd> <kbd>÷</kbd> <kbd>3</kbd></li>' +
      '<li><strong>Raíz con índice</strong> (raíz cúbica de 27): <kbd>3</kbd> <kbd>ˣ√</kbd> <kbd>27</kbd></li>' +
      '<li><strong>Notación científica</strong> (4.5 × 10⁶): <kbd>4.5</kbd> <kbd>×10ⁿ</kbd> <kbd>6</kbd>. Para un exponente negativo, presiona <kbd>(−)</kbd> antes del exponente.</li>' +
      '<li><strong>Factorial</strong> (5!): <kbd>5</kbd> <kbd>n!</kbd>. <strong>Permutaciones</strong> y <strong>combinaciones</strong> (de 5 tomados de 2): <kbd>5</kbd> <kbd>nPr</kbd> <kbd>2</kbd> o <kbd>5</kbd> <kbd>nCr</kbd> <kbd>2</kbd></li>' +
      '<li><strong>Logaritmo</strong> (log 1000): <kbd>log</kbd> <kbd>1000</kbd> <kbd>)</kbd>. Su inversa es <kbd>10ˣ</kbd>.</li>' +
      '<li><strong>Porcentaje</strong> (15 % de 80): <kbd>15</kbd> <kbd>%</kbd> <kbd>×</kbd> <kbd>80</kbd></li>' +
      '<li><kbd>F⇔D</kbd> cambia el resultado entre fracción, número mixto y decimal.</li>' +
      '<li><kbd>Ans</kbd> usa el resultado anterior. Si empiezas con una operación, la calculadora usa Ans sola.</li>' +
      '<li><strong>Teclado:</strong> números, <kbd>+</kbd> <kbd>-</kbd> <kbd>*</kbd> <kbd>/</kbd> <kbd>^</kbd> <kbd>(</kbd> <kbd>)</kbd> <kbd>%</kbd>, <kbd>Enter</kbd> para el resultado, <kbd>Retroceso</kbd> para borrar, <kbd>Supr</kbd> para borrar todo y <kbd>Esc</kbd> para cerrar.</li>' +
      '</ul>');

    var pantalla = crear('div', { 'class': 'gphc-pantalla' });
    pantallaHist = crear('div', { 'class': 'gphc-hist', 'aria-label': 'Cálculos anteriores' });
    pantallaEnt = crear('div', { 'class': 'gphc-entrada', 'aria-hidden': 'true' });
    pantallaRes = crear('div', { 'class': 'gphc-res', 'aria-hidden': 'true' });
    pantallaModo = crear('div', { 'class': 'gphc-modo', 'aria-hidden': 'true' });
    anuncio = crear('div', { 'class': 'gphc-solo-lector', 'aria-live': 'polite', role: 'status' });
    pantalla.appendChild(pantallaHist);
    pantalla.appendChild(pantallaEnt);
    pantalla.appendChild(pantallaRes);
    pantalla.appendChild(pantallaModo);

    var teclado = crear('div', { 'class': 'gphc-teclas' });
    TECLAS.forEach(function (t) {
      var b = crear('button', { type: 'button', 'class': 'gphc-tecla gphc-' + t[2], 'aria-label': t[1], title: t[1] }, t[0]);
      b.addEventListener('click', function () { pulsar(t); });
      teclado.appendChild(b);
    });

    cuerpo.appendChild(ayuda);
    cuerpo.appendChild(pantalla);
    cuerpo.appendChild(anuncio);
    cuerpo.appendChild(teclado);
    caja.appendChild(cabecera);
    caja.appendChild(cuerpo);
    document.body.appendChild(caja);

    btnCerrar.addEventListener('click', cerrar);
    btnAyuda.addEventListener('click', function () {
      var visible = ayuda.classList.toggle('gphc-visible');
      btnAyuda.setAttribute('aria-expanded', visible ? 'true' : 'false');
      colocar(caja.offsetLeft, caja.offsetTop);
    });

    activarArrastre();
    caja.addEventListener('keydown', teclaFisica);

    if (opciones.boton) {
      lanzador = crear('button', { id: 'gphc-lanzador', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'gphc' },
        '<span aria-hidden="true">🧮</span> Calculadora');
      lanzador.addEventListener('click', alternar);
      document.body.appendChild(lanzador);
      evitarSolapes();
      var pendiente = false;
      var programar = function () {
        if (pendiente) return;
        pendiente = true;
        requestAnimationFrame(function () { pendiente = false; evitarSolapes(); });
      };
      window.addEventListener('scroll', programar, { passive: true });
      window.addEventListener('resize', programar);
      window.addEventListener('load', programar);
    }

    document.addEventListener('click', function (e) {
      var disparador = e.target.closest && e.target.closest('[data-gph-calculadora]');
      if (disparador) { e.preventDefault(); ultimoFoco = disparador; alternar(); }
    });

    window.addEventListener('resize', function () { if (abierta()) colocar(caja.offsetLeft, caja.offsetTop); });
    mostrar();
  }

  // Si la página ya tiene un botón fijo en la misma esquina (p. ej. «↑ Índice»),
  // el botón de la calculadora se coloca justo encima.
  function evitarSolapes() {
    if (!lanzador) return;
    lanzador.style.bottom = '18px';
    var l = lanzador.getBoundingClientRect(), arriba = Infinity;
    var fijos = document.querySelectorAll('body *');
    for (var i = 0; i < fijos.length; i++) {
      var el = fijos[i];
      if (el === lanzador || el.closest('#gphc')) continue;
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || !el.offsetWidth) continue;
      var r = el.getBoundingClientRect();
      var cruza = !(r.right < l.left || r.left > l.right || r.bottom < l.top || r.top > l.bottom);
      if (cruza) arriba = Math.min(arriba, r.top);
    }
    if (arriba !== Infinity) lanzador.style.bottom = (window.innerHeight - arriba + 10) + 'px';
  }

  /* ---------- Abrir, cerrar y mover ---------- */

  function abierta() { return caja.classList.contains('gphc-abierta'); }

  function abrir() {
    if (abierta()) return;
    if (!ultimoFoco) ultimoFoco = document.activeElement;
    caja.classList.add('gphc-abierta');
    var pos = leerPosicion();
    if (pos) colocar(pos.x, pos.y);
    else colocar(window.innerWidth - caja.offsetWidth - 24, 80);
    if (lanzador) { lanzador.setAttribute('aria-expanded', 'true'); lanzador.innerHTML = '<span aria-hidden="true">🧮</span> Cerrar calculadora'; }
    caja.focus();
  }

  function cerrar() {
    if (!abierta()) return;
    caja.classList.remove('gphc-abierta');
    if (lanzador) { lanzador.setAttribute('aria-expanded', 'false'); lanzador.innerHTML = '<span aria-hidden="true">🧮</span> Calculadora'; }
    var volver = ultimoFoco || lanzador;
    ultimoFoco = null;
    if (volver && volver.focus) volver.focus();
  }

  function alternar() { abierta() ? cerrar() : abrir(); }

  function colocar(x, y) {
    var maxX = window.innerWidth - caja.offsetWidth - 4;
    var maxY = Math.max(4, window.innerHeight - caja.offsetHeight - 4);
    x = Math.max(4, Math.min(x, maxX));
    y = Math.max(4, Math.min(y, maxY));
    caja.style.left = x + 'px';
    caja.style.top = y + 'px';
  }

  function guardarPosicion() {
    try { localStorage.setItem('gphc-pos', JSON.stringify({ x: caja.offsetLeft, y: caja.offsetTop })); } catch (e) { /* sin almacenamiento */ }
  }

  function leerPosicion() {
    try {
      var p = JSON.parse(localStorage.getItem('gphc-pos'));
      if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
    } catch (e) { /* sin almacenamiento */ }
    return null;
  }

  function activarArrastre() {
    var arrastrando = false, dx = 0, dy = 0;
    cabecera.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      arrastrando = true;
      dx = e.clientX - caja.offsetLeft;
      dy = e.clientY - caja.offsetTop;
      try { cabecera.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
      e.preventDefault();
    });
    cabecera.addEventListener('pointermove', function (e) {
      if (arrastrando) colocar(e.clientX - dx, e.clientY - dy);
    });
    function soltar() { if (arrastrando) { arrastrando = false; guardarPosicion(); } }
    cabecera.addEventListener('pointerup', soltar);
    cabecera.addEventListener('pointercancel', soltar);

    cabecera.addEventListener('keydown', function (e) {
      var paso = e.shiftKey ? 60 : 20, x = caja.offsetLeft, y = caja.offsetTop;
      if (e.key === 'ArrowLeft') x -= paso;
      else if (e.key === 'ArrowRight') x += paso;
      else if (e.key === 'ArrowUp') y -= paso;
      else if (e.key === 'ArrowDown') y += paso;
      else return;
      e.preventDefault();
      e.stopPropagation();
      colocar(x, y);
      guardarPosicion();
    });
  }

  /* ---------- Teclas ---------- */

  function pulsar(t) {
    var accion = t[5];
    if (accion === 'igual') return calcular();
    if (accion === 'borrar') return borrarUltimo();
    if (accion === 'todo') return borrarTodo();
    if (accion === 'fd') return cambiarModo();
    agregar(t[3], t[4]);
  }

  function agregar(interno, visible) {
    if (estado.piezas.length >= 80) return;
    if (!estado.piezas.length && estado.ans && USAN_ANS.indexOf(interno) >= 0 && estado.resultado) {
      estado.piezas.push({ i: 'A', s: 'Ans' });
    }
    if (!estado.piezas.length) archivarResultado();
    estado.error = '';
    estado.piezas.push({ i: interno, s: visible });
    mostrar();
  }

  function archivarResultado() {
    if (estado.resultado && estado.previa) {
      estado.historial.push({ e: estado.previa, r: formatear(estado.resultado, estado.modo).html });
      if (estado.historial.length > 12) estado.historial.shift();
    }
    estado.resultado = null;
    estado.previa = '';
  }

  function borrarUltimo() {
    estado.error = '';
    if (estado.piezas.length) estado.piezas.pop();
    mostrar();
  }

  function borrarTodo() {
    estado.piezas = [];
    estado.error = '';
    archivarResultado();
    mostrar();
    anunciar('Pantalla borrada');
  }

  function calcular() {
    if (!estado.piezas.length) return;
    var cadena = estado.piezas.map(function (p) { return p.i; }).join('');
    try {
      var r = evaluar(cadena, estado.ans);
      estado.previa = htmlEntrada(estado.piezas);
      estado.resultado = r.v;
      estado.ans = r.v;
      estado.modo = (r.v.e && r.v.d !== 1n && (!r.info.usoDecimal || r.info.usoMixto))
        ? (r.info.usoMixto ? 'mixto' : 'frac') : 'dec';
      if (modosDisponibles(r.v).indexOf(estado.modo) < 0) estado.modo = 'dec';
      estado.piezas = [];
      estado.error = '';
      mostrar();
      anunciar('Resultado: ' + formatear(r.v, estado.modo).texto);
    } catch (e) {
      estado.error = e.gph ? e.message : 'Error de cálculo';
      mostrar();
      anunciar('Error: ' + estado.error);
    }
  }

  function cambiarModo() {
    if (estado.piezas.length || !estado.resultado) return;
    var modos = modosDisponibles(estado.resultado);
    if (modos.length < 2) { anunciar('Este resultado solo se puede mostrar como decimal'); return; }
    var i = modos.indexOf(estado.modo);
    estado.modo = modos[(i + 1) % modos.length];
    mostrar();
    anunciar(formatear(estado.resultado, estado.modo).texto);
  }

  var NOMBRE_MODO = { frac: 'fracción', mixto: 'número mixto', dec: 'decimal' };

  function htmlEntrada(piezas) {
    var out = '', mixto = 0, cientifico = false;
    piezas.forEach(function (p) {
      var s = p.s, esDigito = /^[0-9]$/.test(p.i);
      if (p.i === '_') { mixto = 1; s = '<span class="gphc-mixsep">' + s + '</span>'; }
      else if (mixto === 1 && p.i === '/') { s = '/'; mixto = 2; }
      else if (!esDigito) { mixto = 0; }

      if (p.i === 'E') { cientifico = true; s = '×10'; }
      else if (cientifico && (esDigito || p.i === '~')) { s = '<sup>' + (p.i === '~' ? '−' : s) + '</sup>'; }
      else { cientifico = false; }
      out += s;
    });
    return out;
  }

  function mostrar() {
    pantallaHist.innerHTML = estado.historial.slice(-6).map(function (h) {
      return '<div><span>' + h.e + '</span><span class="gphc-hr">' + h.r + '</span></div>';
    }).join('');
    pantallaHist.scrollTop = pantallaHist.scrollHeight;

    if (estado.piezas.length) {
      pantallaEnt.className = 'gphc-entrada';
      pantallaEnt.innerHTML = htmlEntrada(estado.piezas) + '<span class="gphc-cursor"></span>';
    } else if (estado.previa) {
      pantallaEnt.className = 'gphc-entrada gphc-previa';
      pantallaEnt.innerHTML = estado.previa;
    } else {
      pantallaEnt.className = 'gphc-entrada';
      pantallaEnt.innerHTML = '<span class="gphc-cursor"></span>';
    }

    if (estado.error) {
      pantallaRes.className = 'gphc-res gphc-error';
      pantallaRes.textContent = estado.error;
      pantallaModo.textContent = '';
    } else if (!estado.piezas.length && estado.resultado) {
      pantallaRes.className = 'gphc-res';
      pantallaRes.innerHTML = formatear(estado.resultado, estado.modo).html;
      pantallaModo.textContent = modosDisponibles(estado.resultado).length > 1
        ? 'Mostrando: ' + NOMBRE_MODO[estado.modo] + ' · F⇔D para cambiar' : '';
    } else {
      pantallaRes.className = 'gphc-res';
      pantallaRes.innerHTML = '';
      pantallaModo.textContent = '';
    }
  }

  function anunciar(texto) {
    anuncio.textContent = '';
    setTimeout(function () { anuncio.textContent = texto; }, 30);
  }

  function teclaFisica(e) {
    if (e.target === cabecera && e.key.indexOf('Arrow') === 0) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;
    var mapa = {
      '+': ['+', '+'], '-': ['-', '−'], '!': ['!', '!'], '*': ['*', '×'], 'x': ['*', '×'], '/': ['/', '÷'],
      '^': ['^', '^'], '(': ['(', '('], ')': [')', ')'], '%': ['%', '%'], '.': ['.', '.'], ',': ['.', '.']
    };
    if (/^[0-9]$/.test(k)) { agregar(k, k); e.preventDefault(); return; }
    if (mapa[k]) { agregar(mapa[k][0], mapa[k][1]); e.preventDefault(); return; }
    if (k === 'Enter' || k === '=') {
      if (e.target.tagName === 'BUTTON' && k === 'Enter' && e.target !== caja) return;
      calcular(); e.preventDefault(); return;
    }
    if (k === 'Backspace') { borrarUltimo(); e.preventDefault(); return; }
    if (k === 'Delete') { borrarTodo(); e.preventDefault(); return; }
    if (k === 'Escape') { cerrar(); e.preventDefault(); }
  }

  /* ---------- Arranque ---------- */

  global.CalculadoraGPH = {
    abrir: function () { abrir(); },
    cerrar: function () { cerrar(); },
    alternar: function () { alternar(); },
    motor: motor
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', construir);
  else construir();

})(typeof window !== 'undefined' ? window : globalThis);
