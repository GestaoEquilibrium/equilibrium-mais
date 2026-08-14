/* ui.js — toasts e modais no visual do sistema (substitui alert/confirm do navegador) */
(function(){
  if(window.__uiReady) return; window.__uiReady=true;
  var css=''
  +'.ui-toast-wrap{position:fixed;top:18px;right:18px;z-index:99999;display:flex;flex-direction:column;gap:10px;max-width:360px}'
  +'.ui-toast{background:#fff;border-radius:12px;box-shadow:0 12px 34px rgba(16,40,60,.18);padding:14px 16px;font:500 14px/1.4 inherit;color:#1a2b3c;border-left:4px solid #1b6cb3;display:flex;gap:10px;align-items:flex-start;animation:uiIn .2s ease}'
  +'.ui-toast.ok{border-left-color:#1E8449}.ui-toast.err{border-left-color:#C0392B}'
  +'.ui-toast .ic{font-size:16px;line-height:1.2}'
  +'@keyframes uiIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}'
  +'.ui-modal-bg{position:fixed;inset:0;background:rgba(16,40,60,.5);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;animation:uiIn .15s ease}'
  +'.ui-modal{background:#fff;border-radius:16px;max-width:420px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.3);font-family:inherit}'
  +'.ui-modal h3{margin:0 0 8px;font-size:18px;color:#1a2b3c;font-family:inherit}'
  +'.ui-modal p{margin:0 0 20px;color:#5a6b7a;font-size:14.5px;line-height:1.5}'
  +'.ui-modal .acts{display:flex;gap:10px;justify-content:flex-end}'
  +'.ui-modal button{padding:10px 18px;border-radius:10px;border:none;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}'
  +'.ui-modal .cancel{background:#eef1f5;color:#5a6b7a}.ui-modal .ok{background:#1b6cb3;color:#fff}.ui-modal .ok.danger{background:#C0392B}';
  var st=document.createElement('style'); st.textContent=css; (document.head||document.documentElement).appendChild(st);

  function esc(t){return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
  function wrap(){var w=document.querySelector('.ui-toast-wrap'); if(!w){w=document.createElement('div');w.className='ui-toast-wrap';document.body.appendChild(w);} return w;}
  function toast(msg,type){
    var t=document.createElement('div'); t.className='ui-toast'+(type?(' '+type):'');
    var ic=type==='ok'?'✓':type==='err'?'⚠️':'ℹ️';
    t.innerHTML='<span class="ic">'+ic+'</span><span>'+esc(msg)+'</span>';
    wrap().appendChild(t);
    setTimeout(function(){t.style.transition='opacity .3s,transform .3s';t.style.opacity='0';t.style.transform='translateX(20px)';setTimeout(function(){t.remove();},300);}, type==='err'?5200:3600);
  }
  window.uiToast=toast;

  // substitui o alert do navegador por toast (erro fica vermelho automaticamente)
  window.alert=function(msg){var s=String(msg==null?'':msg);var err=/erro|falh|inv[aá]lid|não\s|nao\s|sem\s|obrigat/i.test(s);toast(s,err?'err':'ok');};

  // modal de confirmação -> Promise<boolean>
  window.uiConfirm=function(msg,opts){
    opts=opts||{};
    return new Promise(function(res){
      var bg=document.createElement('div'); bg.className='ui-modal-bg';
      var danger=opts.danger?' danger':'';
      bg.innerHTML='<div class="ui-modal"><h3>'+esc(opts.title||'Confirmar')+'</h3><p>'+esc(msg)+'</p>'
        +'<div class="acts"><button class="cancel">'+esc(opts.cancelText||'Cancelar')+'</button>'
        +'<button class="ok'+danger+'">'+esc(opts.okText||'Confirmar')+'</button></div></div>';
      document.body.appendChild(bg);
      function done(v){bg.remove();res(v);}
      bg.querySelector('.cancel').onclick=function(){done(false);};
      bg.querySelector('.ok').onclick=function(){done(true);};
      bg.onclick=function(e){if(e.target===bg)done(false);};
    });
  };
})();
