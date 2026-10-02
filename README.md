# Lava Rápido

Aplicativo para lava-rápido: registra a chegada do carro em poucos toques, acompanha a lavagem, avisa o cliente pelo WhatsApp, cuida da fidelidade e mostra ao dono o movimento e o dinheiro do dia.

É **um sistema só para todos os lava-rápidos**. Cada lava tem a sua marca (nome, logo, cor), os seus preços e os seus logins, e nunca enxerga os dados dos outros. Quando o sistema melhora, melhora para todos de uma vez.

- **Demonstração (dados de exemplo):** abra o endereço do site com `?demo=1` no fim.
- **Escopo completo, o que falta e custos:** [docs/ESCOPO.md](docs/ESCOPO.md)
- **Como cadastrar um lava-rápido novo:** [docs/NOVO-CLIENTE.md](docs/NOVO-CLIENTE.md)

## Quem usa o quê

| Perfil | O que vê |
|---|---|
| **Funcionário** | Quatro botões: Chegou carro, No pátio, Prontos, Entregues hoje. Mais nada. |
| **Dono** | Tudo do funcionário + Início (o dia), Resultados (gráficos), Financeiro, Clientes, Ajustes. |
| **Administrador** | Quem vende o sistema: cadastra os lavas, cria o login do dono, controla a assinatura. |
| **Cliente do lava** | Sem login: abre o link que recebe no WhatsApp e acompanha o carro e o cartão fidelidade. |

## Como é feito

HTML, CSS e JavaScript puros (sem etapa de "build"): é só publicar a pasta.

```
index.html            o aplicativo
c/index.html          página que o cliente do lava acompanha (sem login)
css/app.css           visual
js/config.js          endereço e chave pública do banco
js/util.js            datas, dinheiro, placa, telefone, janelas
js/catalogo.js        marcas e modelos de veículos, com o tamanho de cada um
js/store.js           dados na memória do aparelho
js/demo.js            lava-rápido de mentira (demonstração)
js/nuvem.js           login e sincronização com o banco (fila que funciona sem internet)
js/db.js              regras: chegada, etapas, fidelidade, mensagens
js/telas/             uma tela por arquivo
supabase/schema.sql   estrutura do banco e regras de segurança
testes/aud.js         verificador de telas (celular, tablet, computador)
sw.js, manifest       instalar como aplicativo e abrir sem internet
```

Banco de dados: Supabase (PostgreSQL), projeto `lava-rapido`, região São Paulo. A segurança fica no banco (RLS): mesmo que alguém mexa no site, o banco só entrega os dados do lava e do perfil de quem fez login.

## Rodar no computador

```bash
python -m http.server 5318
```

Abra `http://localhost:5318/?demo=1`.

## Publicar

O site é publicado pelo GitHub Pages a partir da branch `main`: cada `git push` atualiza o site em cerca de um minuto, sem custo.

A cada versão nova, aumente o número em dois lugares, para os aparelhos pegarem os arquivos novos:

1. `?v=1` nos arquivos de `index.html`
2. `CACHE = 'lava-rapido-v1'` em `sw.js`

Mudanças só no banco (Supabase) valem na hora e não precisam publicar.

## Testar antes de publicar

1. Abra `?demo=1` e passe pelos dois perfis.
2. No console do navegador, em cada tamanho de tela (360×640, 375×812, 768×1024, 1024×768, 1366×768):
   ```js
   await import('./testes/aud.js'); await aud('funcionario', 'ZZZ9Z99'); await aud('dono', 'YYY8Y88')
   ```
   Tem de responder "sem problemas".
3. Mudou o banco? Rode de novo o teste de segurança descrito em [docs/ESCOPO.md](docs/ESCOPO.md#segurança-testada).
