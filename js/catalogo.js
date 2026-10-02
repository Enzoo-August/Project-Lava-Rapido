/* =========================================================
   Catálogo de veículos do Brasil (novos e antigos).
   Cada modelo já vem com o PORTE, que define o preço da lavagem:
     moto · p = pequeno (hatch) · m = médio (sedã)
     g = grande (SUV) · x = extra (caminhonete, van)
   Não achou o modelo? O funcionário digita o nome e escolhe o porte.
   ========================================================= */
(function () {
  const BRUTO = {
    'Chevrolet': 'Onix:p,Onix Plus:m,Prisma:m,Celta:p,Corsa:p,Corsa Sedan:m,Classic:m,Agile:p,Sonic:p,Cobalt:m,Cruze:m,Cruze Sport6:m,Astra:m,Vectra:m,Kadett:p,Monza:m,Chevette:p,Opala:m,Omega:m,Meriva:p,Zafira:g,Spin:g,Tracker:g,Equinox:g,Captiva:g,Trailblazer:g,Blazer:g,Montana:x,S10:x,Silverado:x,D20:x,Camaro:m,Bolt:p',
    'Volkswagen': 'Gol:p,Voyage:m,Fox:p,CrossFox:p,SpaceFox:m,Up:p,Polo:p,Polo Sedan:m,Virtus:m,Golf:p,Jetta:m,Passat:m,Bora:m,Santana:m,Parati:m,Fusca:p,Brasília:p,Kombi:x,Nivus:g,T-Cross:g,Taos:g,Tiguan:g,Touareg:g,Saveiro:x,Amarok:x,Variant:m',
    'Fiat': 'Uno:p,Mille:p,Palio:p,Palio Weekend:m,Siena:m,Grand Siena:m,Mobi:p,Argo:p,Cronos:m,Punto:p,Bravo:p,Stilo:p,Idea:p,Linea:m,Tempra:m,Tipo:p,Marea:m,500:p,147:p,Doblò:g,Pulse:g,Fastback:g,Freemont:g,Strada:x,Toro:x,Fiorino:x,Ducato:x,Titano:x',
    'Ford': 'Ka:p,Ka Sedan:m,Fiesta:p,Fiesta Sedan:m,Focus:p,Focus Sedan:m,Fusion:m,Escort:p,Verona:m,Del Rey:m,Corcel:m,Mondeo:m,EcoSport:g,Territory:g,Edge:g,Bronco:g,Maverick:x,Ranger:x,Courier:x,F-250:x,F-1000:x,Transit:x,Mustang:m',
    'Renault': 'Kwid:p,Sandero:p,Stepway:p,Logan:m,Clio:p,Clio Sedan:m,Symbol:m,Fluence:m,Mégane:m,Scénic:g,Duster:g,Captur:g,Kardian:g,Koleos:g,Oroch:x,Kangoo:x,Master:x',
    'Hyundai': 'HB20:p,HB20S:m,HB20X:p,i30:p,Elantra:m,Azera:m,Sonata:m,Veloster:p,Creta:g,Tucson:g,ix35:g,Santa Fe:g,HR:x',
    'Toyota': 'Etios:p,Etios Sedan:m,Yaris:p,Yaris Sedan:m,Corolla:m,Camry:m,Prius:m,Corolla Cross:g,RAV4:g,SW4:g,Hilux:x,Bandeirante:x',
    'Honda': 'Fit:p,City:m,City Hatch:p,Civic:m,Accord:m,WR-V:g,HR-V:g,ZR-V:g,CR-V:g',
    'Nissan': 'March:p,Versa:m,Sentra:m,Tiida:p,Livina:m,Kicks:g,X-Trail:g,Frontier:x',
    'Jeep': 'Renegade:g,Compass:g,Commander:g,Cherokee:g,Grand Cherokee:g,Wrangler:g,Gladiator:x',
    'Peugeot': '206:p,207:p,208:p,307:p,308:p,408:m,2008:g,3008:g,Partner:x,Expert:x',
    'Citroën': 'C3:p,C3 Picasso:p,C3 Aircross:g,C4:p,C4 Lounge:m,C4 Cactus:g,Xsara Picasso:g,Basalt:g,Jumpy:x',
    'Mitsubishi': 'Lancer:m,ASX:g,Outlander:g,Eclipse Cross:g,Pajero:g,Pajero TR4:g,L200:x',
    'Kia': 'Picanto:p,Rio:p,Cerato:m,Soul:p,Sportage:g,Sorento:g,Stonic:g,Seltos:g,Bongo:x,Carnival:x',
    'BYD': 'Dolphin:p,Dolphin Mini:p,King:m,Seal:m,Yuan Plus:g,Song Plus:g,Song Pro:g,Tan:g,Shark:x',
    'GWM': 'Ora 03:p,Haval H6:g,Tank 300:g,Poer:x',
    'Caoa Chery': 'QQ:p,Celer:p,Arrizo 5:m,Arrizo 6:m,Tiggo 2:g,Tiggo 3X:g,Tiggo 5X:g,Tiggo 7:g,Tiggo 8:g',
    'JAC': 'J3:p,J5:m,T40:g,T50:g,E-JS1:p',
    'BMW': 'Série 1:p,Série 3:m,Série 5:m,X1:g,X3:g,X5:g,X6:g',
    'Mercedes-Benz': 'Classe A:p,Classe C:m,Classe E:m,CLA:m,GLA:g,GLB:g,GLC:g,GLE:g,Sprinter:x',
    'Audi': 'A1:p,A3:p,A3 Sedan:m,A4:m,A5:m,Q3:g,Q5:g,Q7:g',
    'Volvo': 'S60:m,XC40:g,XC60:g,XC90:g,EX30:g',
    'Land Rover': 'Evoque:g,Discovery:g,Discovery Sport:g,Defender:g,Velar:g',
    'Suzuki': 'Swift:p,Jimny:g,Vitara:g,S-Cross:g',
    'Subaru': 'Impreza:m,Forester:g,XV:g',
    'Mini': 'Cooper:p,Countryman:g',
    'Ram': 'Rampage:x,1500:x,2500:x,3500:x',
    'Troller': 'T4:g',
    'Porsche': 'Macan:g,Cayenne:g,911:m',
    'Lexus': 'UX:g,NX:g,RX:g',
    'Moto Honda': 'CG 125:moto,CG 150:moto,CG 160:moto,Biz:moto,Pop:moto,Bros:moto,XRE 190:moto,XRE 300:moto,CB 250 Twister:moto,CB 300:moto,CB 500:moto,PCX:moto,Elite:moto,Sahara:moto,Hornet:moto,Africa Twin:moto',
    'Moto Yamaha': 'Factor:moto,Fazer 150:moto,Fazer 250:moto,Crosser:moto,Lander:moto,NMax:moto,XMax:moto,Neo:moto,MT-03:moto,MT-07:moto,MT-09:moto,R3:moto,Ténéré:moto',
    'Moto (outras)': 'Suzuki:moto,Kawasaki:moto,BMW:moto,Royal Enfield:moto,Shineray:moto,Haojue:moto,Dafra:moto,Triumph:moto,Harley-Davidson:moto,Elétrica / scooter:moto'
  };

  const CAT = {};
  window.CAT = CAT;

  CAT.PORTES = [
    { id: 'moto', nome: 'Moto', ex: 'motos e scooters' },
    { id: 'p', nome: 'Pequeno', ex: 'Gol, Onix, HB20, Uno' },
    { id: 'm', nome: 'Médio', ex: 'Corolla, Civic, Cronos' },
    { id: 'g', nome: 'Grande', ex: 'SUV: Compass, Creta, T-Cross' },
    { id: 'x', nome: 'Extra', ex: 'caminhonete e van: Hilux, S10' }
  ];
  CAT.porteNome = (id) => (CAT.PORTES.find((p) => p.id === id) || {}).nome || '';

  CAT.CORES = [
    ['Branco', '#ffffff'], ['Prata', '#c9ced6'], ['Cinza', '#7d858f'], ['Preto', '#1b1d21'],
    ['Vermelho', '#c62828'], ['Azul', '#1e5bb8'], ['Marrom', '#6b4a2f'], ['Bege', '#d8c7a3'],
    ['Verde', '#2e7d32'], ['Amarelo', '#f2c200'], ['Laranja', '#ef6c00'], ['Outra', '']
  ];
  CAT.corHex = (nome) => (CAT.CORES.find((c) => c[0] === nome) || [])[1] || '';

  // lista plana para a busca: { marca, modelo, porte, chave }
  CAT.modelos = [];
  for (const [marca, lista] of Object.entries(BRUTO)) {
    const m = marca.replace(/^Moto \(outras\)$/, 'Moto').replace(/^Moto /, '');
    for (const item of lista.split(',')) {
      const [modelo, porte] = item.split(':');
      CAT.modelos.push({ marca: m, modelo, porte, moto: porte === 'moto', chave: U.norm(m + ' ' + modelo) });
    }
  }

  // os mais comuns nas ruas (aparecem como atalho antes de digitar)
  CAT.POPULARES = ['Onix', 'HB20', 'Gol', 'Argo', 'Mobi', 'Kwid', 'Polo', 'Corolla', 'Ka', 'Uno', 'Compass', 'Creta', 'T-Cross', 'Strada', 'Hilux', 'S10']
    .map((n) => CAT.modelos.find((x) => x.modelo === n && !x.moto)).filter(Boolean);

  // busca por qualquer pedaço, em qualquer ordem ("fie", "ford fi", "civ")
  CAT.buscar = (txt, max = 8) => {
    const partes = U.norm(txt).split(/\s+/).filter(Boolean);
    if (!partes.length) return [];
    const achados = [];
    for (const x of CAT.modelos) {
      if (!partes.every((p) => x.chave.includes(p))) continue;
      const mod = U.norm(x.modelo);
      const nota = mod === partes.join(' ') ? 0 : mod.startsWith(partes[0]) ? 1 : x.chave.startsWith(partes[0]) ? 2 : 3;
      achados.push({ x, nota });
    }
    return achados.sort((a, b) => a.nota - b.nota || a.x.modelo.length - b.x.modelo.length).slice(0, max).map((a) => a.x);
  };
})();
