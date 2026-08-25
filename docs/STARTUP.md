# Perfil e otimização de inicialização

Ative a instrumentação somente para diagnóstico:

```bash
Sharp-OSS.exe --profile-startup --profile-startup-file=C:\\temp\\sharp-startup.json
```

No Linux/macOS, use `SHARP_PROFILE_STARTUP=1`. O relatório JSON contém:

| Marco | Significado |
| --- | --- |
| T0 | entrada do processo principal |
| T1 | Electron pronto |
| T2 | `BrowserWindow` criada |
| T3 | primeira janela visível |
| T4 | estrutura do renderer montada |
| T5 | editor disponível para entrada |
| T6 | tarefas secundárias agendadas |

## Medições desta árvore

As medições abaixo foram feitas em 2026-07-28, no Linux, com Electron 33,
`xvfb-run` e perfil de startup. O ambiente reportou erro de limite de inotify e
falha do processo GPU, portanto os valores não representam um número de
Windows/Portable nem uma comparação estatística de hardware.

| Execução | T1 | T2 | T3 | T4 | T5 | T6 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Antes da divisão efetiva das linguagens Monaco | 142,4 ms | 194,1 ms | 812,0 ms | 884,5 ms | 1.051,7 ms | 1.052,1 ms |
| Depois, cold | 126,0 ms | 173,7 ms | 826,1 ms | 898,5 ms | 1.071,0 ms | 1.071,1 ms |
| Depois, warm | 113,1 ms | 161,7 ms | 795,1 ms | 865,4 ms | 1.028,9 ms | 1.029,1 ms |
| Depois, warm final | 119,3 ms | 171,6 ms | 746,6 ms | 816,5 ms | 915,2 ms | 915,4 ms |

Não há base suficiente para declarar ganho de cold start a partir de uma única
execução em display virtual. A melhoria verificável no build é a retirada das
contribuições de linguagem do chunk inicial do Monaco: ele caiu de 2.533.095 B
para 2.373.648 B (-159.447 B, -6,3%), e as linguagens agora são baixadas só ao
abrir um arquivo correspondente.

Para validar Windows de forma reproduzível, execute cinco cold starts (após
limpar o cache de `data/chromium`) e cinco warm starts para Setup, Portable.exe
e Portable Fast; registre a mediana de cada marco do JSON. Não use splash ou
atrasos artificiais como métrica.
