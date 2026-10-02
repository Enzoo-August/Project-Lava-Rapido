/* =========================================================
   Ligação com o banco de dados (Supabase).
   A chave abaixo é a "publicável": pode ficar no site, porque
   quem protege os dados são as regras do banco (RLS) e o login.
   Com url/chave vazias o app abre só no modo demonstração.
   ========================================================= */
window.LAVA_CFG = {
  url: 'https://mjewlunhkwrdtahfuiyj.supabase.co',
  chave: 'sb_publishable_ka_8nTn-UsZRkOZNaB-cJg_sqw_TvX2',
  dominioLogin: 'lava.local',
  // WhatsApp de quem dá suporte ao sistema (aparece na Ajuda e no aviso de assinatura). Só números, com DDD.
  suporte: '',
  versao: 1
};
