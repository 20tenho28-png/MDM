/* Ponte entre a app dos relatórios de intervenção (FM-TEC-04) e o ERP da MDM.
 *
 * A app não muda: este ficheiro só é carregado quando ela é aberta a partir do ERP (/erp/ri) e usa o que a própria
 * app expõe em window.RI_UI. Faz três coisas:
 *   ?visita=12   começa um relatório novo com o cliente, a morada, o orçamento e a ref. interna (V0012) da visita;
 *   ?ver=RI-...  mostra um relatório recebido no formato da app, para imprimir no escritório;
 *   sempre       acrescenta «Enviar para o escritório», que manda os relatórios emitidos para o ERP.
 * Sem rede, a app continua a funcionar como sempre (rascunho no telemóvel, exportar JSON).
 */
(function () {
  "use strict";
  var UI = window.RI_UI;
  if (!UI) return;
  var base = location.pathname.replace(/\/ri\/?$/, "");
  var params = new URLSearchParams(location.search);
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  function faixa(html, tipo) {
    var f = $("erpFaixa");
    if (!f) {
      f = document.createElement("div");
      f.id = "erpFaixa";
      f.style.cssText = "max-width:760px;margin:10px auto 0;padding:0 14px";
      var topo = document.querySelector("header.top") || document.body.firstElementChild;
      topo.parentNode.insertBefore(f, topo.nextSibling);
    }
    f.innerHTML = '<div class="msg ' + (tipo || "info") + '" style="margin:0">' + html + "</div>";
    return f;
  }

  function enviar(corpo) {
    return fetch(base + "/api/relatorios", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo),
      credentials: "same-origin"
    }).then(function (resp) {
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return resp.json();
    });
  }

  function textoResumo(r) {
    var partes = [];
    if (r.novos.length) partes.push(r.novos.length + " novo(s)");
    if (r.atualizados.length) partes.push(r.atualizados.length + " atualizado(s)");
    if (r.iguais.length) partes.push(r.iguais.length + " já lá estava(m)");
    if (r.visitas_seguintes) partes.push(r.visitas_seguintes + " visita(s) seguinte(s) por marcar");
    var txt = "Escritório: " + (partes.join(" · ") || "nada de novo") + ".";
    if (r.ignorados.length) txt += " Não entraram: " + r.ignorados.join("; ") + ".";
    if (r.sem_visita.length) txt += " Sem visita na agenda (o escritório associa): " + r.sem_visita.join(", ") + ".";
    return txt;
  }

  function botaoEnviar(depoisDe, texto, obter) {
    var alvo = $(depoisDe);
    if (!alvo) return;
    var b = document.createElement("button");
    b.className = alvo.classList.contains("big") ? "big sec" : "bt sm";
    b.type = "button";
    b.textContent = texto;
    b.onclick = function () {
      b.disabled = true;
      Promise.resolve(obter()).then(function (corpo) {
        if (!corpo) { faixa("Ainda não há relatórios emitidos para enviar.", "warn"); return; }
        return enviar(corpo).then(function (r) { faixa(esc(textoResumo(r)), r.ignorados.length ? "warn" : "ok"); });
      }).catch(function () {
        faixa("Sem ligação ao escritório. O relatório continua guardado neste telemóvel: tenta mais tarde ou " +
              "usa «Exportar JSON».", "err");
      }).then(function () { b.disabled = false; });
    };
    alvo.parentNode.insertBefore(b, alvo.nextSibling);
  }

  // Enviar o relatório aberto (ecrã de entrega) e todos os emitidos (ecrã inicial).
  botaoEnviar("btEmail", "Enviar para o escritório (ERP)", function () {
    var R = UI.R;
    return R && R.estado !== "rascunho" ? R : null;
  });
  botaoEnviar("btExportTudo", "Enviar todos para o escritório", function () {
    return UI.DB.all("relatorios").then(function (todos) {
      var emitidos = (todos || []).filter(function (r) { return r.estado !== "rascunho"; });
      return emitidos.length ? { schema: "mdm-ri-lote/1", relatorios: emitidos } : null;
    });
  });

  function semParametro(nome) {
    params.delete(nome);
    var q = params.toString();
    history.replaceState(null, "", location.pathname + (q ? "?" + q : ""));
  }

  // ?ver=RI-2026-AL-0001: o relatório recebido, no formato da app, para imprimir.
  var ver = params.get("ver");
  if (ver) {
    fetch(base + "/api/relatorios/" + encodeURIComponent(ver), { credentials: "same-origin" })
      .then(function (resp) { if (!resp.ok) throw new Error(resp.status); return resp.json(); })
      .then(function (r) {
        Array.prototype.forEach.call(document.querySelectorAll(".screen"), function (s) { s.classList.remove("on"); });
        var barra = $("bar");
        if (barra) barra.classList.remove("on");
        if ($("ttSub")) $("ttSub").textContent = r.numero + " · recebido no ERP";
        faixa("<b>" + esc(r.numero) + "</b> recebido no ERP · " +
              '<button class="bt sm" id="erpImprimir">Imprimir / Guardar PDF</button> ' +
              '<a class="bt sm" href="' + base + "/relatorios/" + encodeURIComponent(r.numero) + '">Voltar ao ERP</a>');
        var w = document.createElement("div");
        w.className = "prev";
        w.style.cssText = "max-width:860px;margin:12px auto";
        $("erpFaixa").appendChild(w);
        w.innerHTML = UI.renderPaginas(r);
        var escala = Math.min(1, (w.clientWidth - 16) / 794);
        Array.prototype.forEach.call(w.querySelectorAll(".page"), function (p) {
          p.style.transform = "scale(" + escala + ")";
          p.style.marginBottom = (-1123 * (1 - escala) + 14) + "px";
        });
        $("erpImprimir").onclick = function () {
          $("printRoot").innerHTML = UI.renderPaginas(r);
          var t = document.title;
          document.title = r.numero + " " + ((r.cliente && r.cliente.nome) || "");
          setTimeout(function () { window.print(); setTimeout(function () { document.title = t; }, 2000); }, 60);
        };
      })
      .catch(function () { faixa("O relatório " + esc(ver) + " não está no ERP.", "err"); });
    return;
  }

  // ?visita=12: começar (ou continuar) o relatório desta visita.
  var visita = params.get("visita");
  if (!visita) return;
  fetch(base + "/api/visitas/" + encodeURIComponent(visita), { credentials: "same-origin" })
    .then(function (resp) { if (!resp.ok) throw new Error(resp.status); return resp.json(); })
    .then(function (v) {
      var rascunho = null;
      try { rascunho = JSON.parse(localStorage.getItem("mdm_ri_draft") || "null"); } catch (e) { rascunho = null; }
      var continuar = rascunho && rascunho.estado === "rascunho" && rascunho.ref_interna === v.ref_interna;
      var info = "<b>Visita " + esc(v.ref_interna) + "</b> · " + esc(v.cliente.nome) +
        (v.quando ? " · " + esc(v.quando) : "") + " · " + esc(v.tipo) +
        (v.descricao ? '<br><span style="color:var(--slate)">' + esc(v.descricao) + "</span>" : "") +
        (v.relatorios.length ? "<br>Já tem relatório: " + esc(v.relatorios.join(", ")) + "." : "");
      faixa(info + '<div style="margin-top:8px"><button class="bt sm" id="erpComecar">' +
            (continuar ? "Continuar o relatório desta visita" : "Começar o relatório desta visita") +
            '</button> <button class="bt sm" id="erpFechar">Fechar</button></div>');
      $("erpFechar").onclick = function () { $("erpFaixa").remove(); semParametro("visita"); };
      $("erpComecar").onclick = function () {
        semParametro("visita");
        if (continuar) {
          $("erpFaixa").remove();
          if (!(UI.R && UI.R.ref_interna === v.ref_interna)) $("btContinuar").click();
          return;
        }
        var antes = UI.R ? UI.R.numero : null, t0 = Date.now();
        $("btNovo").click();   // a app arquiva o rascunho anterior e dá o número seguinte
        (function esperar() {
          var R = UI.R;
          if (R && R.estado === "rascunho" && R.numero !== antes) return preencher(R, v);
          if (Date.now() - t0 < 6000) setTimeout(esperar, 100);
        })();
      };
    })
    .catch(function () { faixa("A visita " + esc(visita) + " não está no ERP (ou não há ligação).", "warn"); });

  function preencher(R, v) {
    Object.keys(v.cliente).forEach(function (k) { if (v.cliente[k]) R.cliente[k] = v.cliente[k]; });
    R.ref_interna = v.ref_interna;
    if (v.pedido_origem) R.pedido_origem = v.pedido_origem;
    if (v.orcamento_numero) { R.conforme_orcamento = "sim"; R.orcamento_numero = v.orcamento_numero; }
    UI.abrirForm();
    // Um «input» faz a app guardar o rascunho já com o cliente da visita.
    var nome = $("kCliNome");
    if (nome) nome.dispatchEvent(new Event("input", { bubbles: true }));
    var f = $("erpFaixa");
    if (f) f.remove();
  }
})();
