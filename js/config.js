/* =========================================================
   Ligação com o banco de dados (Firebase).
   Sem a configuração do Firebase o app abre só no modo demonstração.
   ========================================================= */
window.LAVA_CFG = {
  // Firebase (projeto lava-rapido-enzo). Estes dados podem ficar no site: quem protege
  // os dados são as regras do banco (firestore.rules) e o login.
  firebase: {
    apiKey: 'AIzaSyDDNOS86-y5N6xSmAhbnC81xJ2D3TvCf3s',
    authDomain: 'lava-rapido-enzo.firebaseapp.com',
    projectId: 'lava-rapido-enzo',
    storageBucket: 'lava-rapido-enzo.firebasestorage.app',
    messagingSenderId: '95361363863',
    appId: '1:95361363863:web:af7c5ef9786fdfd02a1ed2'
  },
  dominioLogin: 'lava.local',
  // endereço próprio de cada lava (abre direto com a marca dele, sem precisar de ?l=)
  sites: { 'agaragemz.web.app': 'garagem-z', 'agaragemz.firebaseapp.com': 'garagem-z' },
  sitePrincipal: 'https://lava-rapido-enzo.web.app',
  // WhatsApp de quem dá suporte ao sistema (aparece na Ajuda e no aviso de assinatura). Só números, com DDD.
  suporte: '',
  versao: 7
};
