# FPV Kamikaze — Operação

Protótipo jogável (HTML autocontido, zero dependências) de um jogo arcade de drone FPV
em mundo aberto procedural. Abrir `index.html` em qualquer navegador — mobile (touch),
teclado ou gamepad.

## Elevator pitch

Você pilota drones FPV descartáveis numa operação de 5 fases. Câmera FPV com projeção
3D real e gimbal funcional até -90°; a metralhadora só funciona com a câmera nivelada e
a bomba pede mergulho — cada ataque é uma escolha de postura. Pairar atrai a antiaérea,
voar baixo atrai a infantaria, e a bateria é um cronômetro: o jogo inteiro é um
speedrun sob pressão. Perdeu o drone? A fase repete e a frota encolhe — 5 drones para a
operação inteira. O próprio kamikaze é mecânica: trocar a aeronave pelo alvo fecha a
missão.

## Loop de retenção

- **5 drones = 5 vidas reais** — falhar repete a fase; esgotar a frota encerra a operação
- **Ranks S/A/B/C por fase**, persistidos — bateria, integridade e bombas restantes contam
- **Combo ×4 com janela de 4 s** + hit-stop e placar animado
- **Kill-cam**: câmera lenta com letterbox no impacto kamikaze
- **Rasante +25** por passar raspando em obstáculos em alta velocidade
- **Mundo que marca**: crateras e destroços em chamas persistem
- **Treino de 60 s** (anéis + primeiro bombardeio) acessível do menu
- **Música procedural** que acelera com a fase e o combo (desligável)
- **Melhorias de campo (roguelite)**: escolha 1 de 3 cartas entre fases — célula extra,
  rack ampliado, refrigeração, blindagem, hélices eficientes, guincho magnético
- **Depósitos de combustível** com reação em cadeia (a partir da fase 2)
- **Escolta do QG**: aproximar-se do alvo final dispara alarme e 2 drones defensores
- **Modo Sobrevivência** desbloqueado ao vencer a campanha — dificuldade cresce sem
  teto, recorde próprio persistido

## Controles

| Ação | Touch | Teclado | Gamepad |
|---|---|---|---|
| Subir/descer · girar | stick esquerdo | W/S · A/D | stick esquerdo |
| Frente/ré · lateral | stick direito | setas | stick direito |
| Metralhadora | segurar 🔫 | F | RT ou X |
| Bomba | 💣 / botão SOLTAR | Espaço/B | A |
| Gimbal até -90° | dial ⤓ (toque = alterna) | G | RB |
| Modo Sport | toque no status ✈ | M | LB |
| Pausa/opções | ⏸ no HUD | P/Esc | Start |
| Treino | menu 🎓 | T | — |

## Opções (na pausa)

Música ligada/desligada · redução de flashes (acessibilidade). Ambas persistem.

## Estado do projeto

Protótipo de mecânica para validação de design. Produção prevista em engine (Godot)
com 3D real; este HTML é o laboratório de tuning e a demo de bolso.
