/**
 * Tabela de preços "desde" mostrada ao cliente (opcional).
 *
 * Regra da casa: nunca inventar preços. Enquanto PRICES for null a calculadora
 * não mostra valores em euros; mostra apenas a potência e o pedido de
 * orçamento. Para ativar, preencher com a tabela MDM em vigor (IVA incluído,
 * equipamento + instalação standard), por exemplo:
 *
 * export const PRICES = {
 *   note: "Valores indicativos com IVA, equipamento e instalação standard até 3 m de linha frigorífica. Orçamento final após visita técnica gratuita.",
 *   mono: { 9000: 950, 12000: 1050, 18000: 1450, 24000: 1850 },
 *   multi: {
 *     outdoor: { 2: 1500, 3: 2100, 4: 2800, 5: 3500 },
 *     indoor: { 9000: 350, 12000: 400, 18000: 550, 24000: 700 },
 *   },
 * };
 */
export const PRICES = null;
